const {
  OLING_XP_PER_LEVEL,
  OLING_MAX_ENERGY,
  OLING_REST_DURATION_MS,
  ENERGY_RESTORE_THRESHOLDS,
  normalizeKey
} = require('./shared');

function getStoredOlingEnergy(oling) {
  return Math.max(
    0,
    Math.min(OLING_MAX_ENERGY, Number(oling?.care?.energy ?? OLING_MAX_ENERGY))
  );
}

function getOlingRestDurationMs(rarity, explicitDurationMs = null) {
  const explicit = Number(explicitDurationMs);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return (
    OLING_REST_DURATION_MS[normalizeKey(rarity)] ||
    OLING_REST_DURATION_MS.common
  );
}

function getOlingBedRestDurationMs(rarity, personalityKey = '') {
  const durationMs = getOlingRestDurationMs(rarity);
  return normalizeKey(personalityKey) === 'lazy'
    ? durationMs * 0.85
    : durationMs;
}

function getOlingAdventureEnergyCost(baseCost, personalityKey = '') {
  const cost = Math.max(0, Number(baseCost) || 0);
  const adjustedCost =
    normalizeKey(personalityKey) === 'energetic' ? cost * 0.85 : cost;
  return Math.round(adjustedCost * 100) / 100;
}

function getOlingEnergy(oling, now = Date.now()) {
  const storedEnergy = getStoredOlingEnergy(oling);
  if (!oling?.care?.isSleeping || storedEnergy >= OLING_MAX_ENERGY)
    return storedEnergy;

  const sleepStartedAt = new Date(oling.care.sleepUpdatedAt).getTime();
  if (!Number.isFinite(sleepStartedAt)) return storedEnergy;

  const durationMs = getOlingRestDurationMs(
    oling.care.sleepBedRarity,
    oling.care.sleepDurationMs
  );
  const elapsedMs = Math.max(0, Number(now) - sleepStartedAt);
  const recoveredEnergy = (elapsedMs / durationMs) * OLING_MAX_ENERGY;
  return Math.min(OLING_MAX_ENERGY, storedEnergy + recoveredEnergy);
}

function getOlingRestRemainingMs(oling, now = Date.now()) {
  const energy = getOlingEnergy(oling, now);
  if (energy >= OLING_MAX_ENERGY) return 0;
  const durationMs = getOlingRestDurationMs(
    oling?.care?.sleepBedRarity,
    oling?.care?.sleepDurationMs
  );
  return Math.max(
    0,
    (durationMs * (OLING_MAX_ENERGY - energy)) / OLING_MAX_ENERGY
  );
}

function getEnergyRestoreThreshold(consumable) {
  if (normalizeKey(consumable?.effect?.type) !== 'energy') return null;

  const explicitThreshold = Number(
    consumable?.effect?.restoreToEnergy ?? consumable?.metadata?.restoreToEnergy
  );
  if (Number.isFinite(explicitThreshold) && explicitThreshold > 0) {
    return Math.min(OLING_MAX_ENERGY, explicitThreshold);
  }

  return (
    ENERGY_RESTORE_THRESHOLDS[normalizeKey(consumable?.metadata?.rarity)] ||
    null
  );
}

function getOlingEnergyStatus(oling) {
  return getOlingEnergy(oling) === 0 ? 'exhausted' : 'ready';
}

function getOlingXpProgress(level, xp, addedXp) {
  let nextLevel = Math.max(1, Number(level) || 1);
  let nextXp = Math.max(0, Number(xp) || 0) + Math.max(0, Number(addedXp) || 0);

  while (nextXp >= OLING_XP_PER_LEVEL) {
    nextXp -= OLING_XP_PER_LEVEL;
    nextLevel += 1;
  }

  return {
    level: nextLevel,
    xp: nextXp
  };
}

function applyConsumableEffectToOling(oling, consumable) {
  const effect = consumable?.effect || {};
  const amount = Number(effect.amount) || 0;
  const effectType = normalizeKey(effect.type);
  const now = new Date();

  if (effectType === 'energy') {
    const currentEnergy = getOlingEnergy(oling);
    const restoreThreshold = getEnergyRestoreThreshold(consumable);
    const nextEnergy = restoreThreshold
      ? Math.max(currentEnergy, restoreThreshold)
      : Math.min(OLING_MAX_ENERGY, currentEnergy + amount);
    oling.set(
      'care.energy',
      Math.max(0, Math.min(OLING_MAX_ENERGY, nextEnergy))
    );
    oling.set('care.energyUpdatedAt', now);
    return;
  }

  if (effectType === 'xp') {
    const progress = getOlingXpProgress(oling.level, oling.xp, amount);
    oling.set('level', progress.level);
    oling.set('xp', progress.xp);
  }
}

async function spendOlingEnergy({ PlayerOling, accountId, olingId, amount }) {
  const energyCost = Math.max(0, Number(amount) || 0);
  if (!energyCost) {
    return {
      error: {
        status: 400,
        code: 'oling_energy_cost_invalid',
        message: 'That activity needs a valid Energy cost.'
      }
    };
  }

  const oling = await PlayerOling.findOne({ _id: olingId, ownerId: accountId });
  if (!oling) {
    return {
      error: {
        status: 404,
        code: 'player_oling_not_found',
        message: 'That Oling could not be found.'
      }
    };
  }

  if (oling.care?.isSleeping) {
    return {
      error: {
        status: 409,
        code: 'oling_sleeping',
        message: 'Wake this Oling before starting an activity.'
      }
    };
  }

  const energy = getOlingEnergy(oling);
  if (energy === 0) {
    return {
      error: {
        status: 409,
        code: 'oling_exhausted',
        message: 'This Oling is Exhausted and needs a snack before doing that.'
      }
    };
  }
  if (energy < energyCost) {
    return {
      error: {
        status: 409,
        code: 'oling_energy_insufficient',
        message: `This Oling is too Tired for that activity. It needs ${energyCost} Energy.`
      }
    };
  }

  oling.set('care.energy', energy - energyCost);
  oling.set('care.energyUpdatedAt', new Date());
  await oling.save();
  return { oling, energyBefore: energy, energyAfter: getOlingEnergy(oling) };
}

async function awardOlingXp({ PlayerOling, accountId, olingId, amount }) {
  const oling = await PlayerOling.findOne({ _id: olingId, ownerId: accountId });
  if (!oling) return null;
  const progress = getOlingXpProgress(oling.level, oling.xp, amount);
  oling.set('level', progress.level);
  oling.set('xp', progress.xp);
  await oling.save();
  return oling;
}

module.exports = {
  getOlingAdventureEnergyCost,
  getOlingBedRestDurationMs,
  getOlingEnergy,
  getOlingRestDurationMs,
  getOlingRestRemainingMs,
  getOlingEnergyStatus,
  spendOlingEnergy,
  awardOlingXp,
  getEnergyRestoreThreshold,
  getOlingXpProgress,
  applyConsumableEffectToOling
};

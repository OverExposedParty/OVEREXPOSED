const CADENCE_MODES = Object.freeze(['cumulative', 'consecutive']);

function toUnitCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeAbilityCadence(cadence = {}) {
  const mode = CADENCE_MODES.includes(cadence?.mode)
    ? cadence.mode
    : 'cumulative';
  return {
    every: Math.max(1, toUnitCount(cadence?.every) || 1),
    mode,
    retainWhileBenched: cadence?.retainWhileBenched !== false,
    consumeWhenPrevented: cadence?.consumeWhenPrevented !== false
  };
}

function getAbilityProgress(oling, abilityKey, abilityRevision) {
  if (!Array.isArray(oling.abilityProgress)) oling.abilityProgress = [];
  const normalizedKey = String(abilityKey || '')
    .trim()
    .toLowerCase();
  const normalizedRevision = Math.max(1, toUnitCount(abilityRevision));
  let progress = oling.abilityProgress.find(
    (entry) =>
      entry.abilityKey === normalizedKey &&
      toUnitCount(entry.abilityRevision) === normalizedRevision
  );
  if (!progress) {
    oling.abilityProgress.push({
      abilityKey: normalizedKey,
      abilityRevision: normalizedRevision,
      activationCount: 0
    });
    progress = oling.abilityProgress[oling.abilityProgress.length - 1];
  }
  return progress;
}

function advanceAbilityCadence(oling, ability, options = {}) {
  const cadence = normalizeAbilityCadence(ability?.cadence);
  const progress = getAbilityProgress(oling, ability?.key, ability?.revision);
  const beforeActivationCount = toUnitCount(progress.activationCount);
  const qualifies = options.qualifies !== false;
  const prevented = options.prevented === true;

  if (prevented && !cadence.consumeWhenPrevented) {
    return {
      ...cadence,
      beforeActivationCount,
      afterActivationCount: beforeActivationCount,
      consumed: false,
      prevented: true,
      qualifies,
      triggered: false
    };
  }

  if (!qualifies) {
    if (cadence.mode === 'consecutive') progress.activationCount = 0;
    return {
      ...cadence,
      beforeActivationCount,
      afterActivationCount: toUnitCount(progress.activationCount),
      consumed: cadence.mode === 'consecutive',
      prevented,
      qualifies: false,
      triggered: false
    };
  }

  const triggered = beforeActivationCount + 1 >= cadence.every;
  progress.activationCount = triggered ? 0 : beforeActivationCount + 1;
  return {
    ...cadence,
    beforeActivationCount,
    afterActivationCount: toUnitCount(progress.activationCount),
    consumed: true,
    prevented,
    qualifies: true,
    triggered
  };
}

function resetUnretainedAbilityCadences(oling) {
  for (const ability of oling?.snapshot?.abilities || []) {
    if (!ability?.cadence) continue;
    const cadence = normalizeAbilityCadence(ability.cadence);
    if (cadence.retainWhileBenched) continue;
    const progress = getAbilityProgress(oling, ability.key, ability.revision);
    progress.activationCount = 0;
  }
}

module.exports = {
  CADENCE_MODES,
  advanceAbilityCadence,
  getAbilityProgress,
  normalizeAbilityCadence,
  resetUnretainedAbilityCadences
};

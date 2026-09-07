const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_LAYERS,
  OLING_MAX_ENERGY,
  normalizeKey,
  toPlainObject
} = require('../shared');
const {
  getEnergyRestoreThreshold,
  getOlingEnergy,
  getOlingRestDurationMs,
  getOlingRestRemainingMs
} = require('../energy');
const { getSetDerivedOlingPools } = require('./build-sets');
const { getProminentClashRoles } = require('../clash-roles');

function serializeOlingTrait(trait) {
  const plain = toPlainObject(trait);
  if (!plain) return null;

  return {
    key: plain.key,
    name: plain.name,
    collection: plain.collection,
    theme: plain.theme,
    layer: plain.layer,
    flightType: plain.flightType || '',
    flightMotion: plain.flightMotion || '',
    flightSpeed:
      Number.isFinite(Number(plain.flightSpeed)) &&
      Number(plain.flightSpeed) > 0
        ? Number(plain.flightSpeed)
        : 1,
    rarity: plain.rarity,
    assets: plain.assets || {},
    body: plain.body || null,
    attack: plain.attack || null,
    modifiers: plain.modifiers || {},
    passive: plain.passive || {},
    flavor: plain.flavor || '',
    metadata: plain.metadata || {}
  };
}

function serializeOlingEgg(egg) {
  const plain = toPlainObject(egg);
  if (!plain) return null;

  return {
    key: plain.key,
    name: plain.name,
    collection: plain.collection,
    rarityOdds: plain.rarityOdds || {},
    setKeys: plain.setKeys || [],
    sets: plain.sets || [],
    pools: getSetDerivedOlingPools(plain),
    assets: plain.assets || {},
    metadata: plain.metadata || {}
  };
}

function serializeOlingConsumable(consumable) {
  const plain = toPlainObject(consumable);
  if (!plain) return null;

  const effect = plain.effect || {};
  const energyRestoreThreshold = getEnergyRestoreThreshold(plain);

  return {
    key: plain.key,
    name: plain.name,
    description: plain.description || '',
    category: plain.category || null,
    subcategory: plain.subcategory || null,
    target: plain.target || 'oling',
    effect,
    energyRestoreThreshold,
    stackable: plain.stackable !== false,
    maxStack: Number(plain.maxStack) || null,
    cooldownSeconds: Number(plain.cooldownSeconds) || 0,
    assets: plain.assets || {},
    metadata: plain.metadata || {}
  };
}

function serializeOlingConsumableForJson(consumable) {
  const plain = toPlainObject(consumable);
  if (!plain) return null;

  return {
    key: plain.key,
    name: plain.name,
    description: plain.description || '',
    category: plain.category || null,
    subcategory: plain.subcategory || null,
    target: plain.target || 'oling',
    effect: plain.effect || {},
    enabled: plain.enabled !== false,
    status: plain.status || 'published',
    stackable: plain.stackable !== false,
    maxStack: Number(plain.maxStack) || null,
    cooldownSeconds: Number(plain.cooldownSeconds) || 0,
    assets: plain.assets || {},
    metadata: plain.metadata || {}
  };
}

function getMatchingOlingSet(oling, traitsByKey, egg) {
  const build = oling?.build || {};
  const themes = OLING_LAYERS.map(
    (layer) => traitsByKey.get(build[layer])?.theme
  ).filter(Boolean);

  if (themes.length !== OLING_LAYERS.length) return null;
  if (!themes.every((theme) => theme === themes[0])) return null;

  const sets = Array.isArray(egg?.sets) ? egg.sets : [];
  return (
    sets.find(
      (set) =>
        set.key === themes[0] &&
        OLING_LAYERS.every(
          (layer) =>
            normalizeKey(set.traits?.[layer]) === normalizeKey(build[layer])
        )
    ) || null
  );
}

function serializeOlingResidency(residency) {
  const state = residency?.state === 'stored' ? 'stored' : 'active';
  const labSlot = Number(residency?.labSlot);
  const pod = residency?.pod;

  return {
    state,
    labSlot:
      Number.isInteger(labSlot) &&
      labSlot > 0 &&
      labSlot <= OLING_LAB_ACTIVE_LIMIT
        ? labSlot
        : null,
    pod:
      state === 'stored' && pod?.key
        ? {
            key: normalizeKey(pod.key),
            definitionRevision:
              Number.isInteger(Number(pod.definitionRevision)) &&
              Number(pod.definitionRevision) > 0
                ? Number(pod.definitionRevision)
                : null,
            releaseOutcome: normalizeKey(pod.releaseOutcome) || null,
            storedAt: pod.storedAt || null,
            containerPlacedId:
              String(pod.containerPlacedId || '').trim() || null
          }
        : null
  };
}

function serializePlayerOling(oling, definitions = {}) {
  const plain = toPlainObject(oling);
  if (!plain) return null;

  const traitsByKey = definitions.traitsByKey || new Map();
  const eggsByKey = definitions.eggsByKey || new Map();
  const matchingSet = getMatchingOlingSet(
    plain,
    traitsByKey,
    eggsByKey.get(plain.eggKey)
  );
  const headwearKey = normalizeKey(plain.equipment?.headwear);
  const energy = getOlingEnergy(plain);
  const restDurationMs = getOlingRestDurationMs(
    plain.care?.sleepBedRarity,
    plain.care?.sleepDurationMs
  );
  const restRemainingMs = getOlingRestRemainingMs(plain);

  return {
    id: String(plain._id || plain.id || ''),
    ownerId: String(plain.ownerId || ''),
    eggKey: plain.eggKey,
    collection: plain.collection,
    name: plain.name || null,
    build: plain.build || {},
    buildRarities: plain.buildRarities || {},
    equipment: {
      headwearKey: headwearKey || null,
      headwear: serializeOlingTrait(traitsByKey.get(headwearKey)) || null
    },
    matchingSet: matchingSet
      ? {
          key: matchingSet.key,
          name: matchingSet.name,
          rarity: matchingSet.rarity
        }
      : null,
    traits: Object.fromEntries(
      OLING_LAYERS.map((layer) => [
        layer,
        serializeOlingTrait(traitsByKey.get(plain.build?.[layer])) || null
      ])
    ),
    clashRoles: getProminentClashRoles(
      plain.build,
      definitions.clashAbilitiesByTraitKey
    ),
    care: {
      energy,
      maxEnergy: OLING_MAX_ENERGY,
      status: plain.care?.isSleeping
        ? 'sleeping'
        : energy === 0
          ? 'exhausted'
          : 'ready',
      energyUpdatedAt: plain.care?.energyUpdatedAt || null,
      isSleeping: Boolean(plain.care?.isSleeping),
      sleepUpdatedAt: plain.care?.sleepUpdatedAt || null,
      sleepBedPlacedId: plain.care?.sleepBedPlacedId || null,
      sleepBedSlotId: plain.care?.sleepBedSlotId || null,
      sleepBedRarity: normalizeKey(plain.care?.sleepBedRarity) || null,
      sleepDurationMs: restDurationMs,
      restRemainingMs,
      restReadyAt:
        plain.care?.isSleeping && restRemainingMs > 0
          ? new Date(Date.now() + restRemainingMs).toISOString()
          : null
    },
    residency: serializeOlingResidency(plain.residency),
    favorite: Boolean(plain.favorite),
    displayOnProfile: Boolean(plain.displayOnProfile),
    hatchedAt: plain.hatchedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

function serializeHatchReceipt(receipt) {
  const plain = toPlainObject(receipt);
  if (!plain) return null;

  return {
    id: String(plain._id || plain.id || ''),
    ownerId: String(plain.ownerId || ''),
    eggKey: plain.eggKey,
    olingId: plain.olingId ? String(plain.olingId) : null,
    rolls: plain.rolls || {},
    influences: Array.isArray(plain.influences) ? plain.influences : [],
    eggOddsSnapshot: plain.eggOddsSnapshot || {},
    baseEggOddsSnapshot: plain.metadata?.baseEggOddsSnapshot || {},
    inventoryChange: plain.inventoryChange || {},
    createdAt: plain.createdAt
  };
}

module.exports = {
  getMatchingOlingSet,
  serializeHatchReceipt,
  serializeOlingConsumable,
  serializeOlingConsumableForJson,
  serializeOlingEgg,
  serializeOlingResidency,
  serializeOlingTrait,
  serializePlayerOling
};

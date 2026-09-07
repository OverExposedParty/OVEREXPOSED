const { normalizeKey } = require('./shared');

function createConsumableMap(consumables = []) {
  return new Map(
    consumables
      .filter((item) => item?.key)
      .map((item) => [normalizeKey(item.key), item])
  );
}

function getInfluenceConsumables(influenceSlots = [], consumables = []) {
  const consumableMap =
    consumables instanceof Map ? consumables : createConsumableMap(consumables);
  return (Array.isArray(influenceSlots) ? influenceSlots : [])
    .map((influence) => ({
      influence,
      consumable: consumableMap.get(normalizeKey(influence?.itemKey)) || null
    }))
    .filter(({ consumable }) => Boolean(consumable));
}

function getHatchSpeedPercent(influenceSlots = [], consumables = []) {
  return getInfluenceConsumables(influenceSlots, consumables).reduce(
    (total, { consumable }) =>
      normalizeKey(consumable.effect?.type) === 'hatch_speed'
        ? total + Math.max(0, Number(consumable.effect?.amount) || 0)
        : total,
    0
  );
}

function applyHatchSpeedToDuration(
  durationMs,
  influenceSlots = [],
  consumables = []
) {
  const duration = Math.max(0, Number(durationMs) || 0);
  const speedPercent = getHatchSpeedPercent(influenceSlots, consumables);
  return speedPercent > 0
    ? Math.round(duration / (1 + speedPercent / 100))
    : duration;
}

function getRarityChancePercent(influenceSlots = [], consumables = []) {
  return getInfluenceConsumables(influenceSlots, consumables).reduce(
    (total, { consumable }) =>
      normalizeKey(consumable.effect?.type) === 'rarity_chance'
        ? total + Math.max(0, Number(consumable.effect?.amount) || 0)
        : total,
    0
  );
}

function applyRarityChanceToOdds(
  rarityOdds = {},
  influenceSlots = [],
  consumables = []
) {
  const entries = Object.entries(rarityOdds).map(([key, value]) => [
    key,
    Math.max(0, Number(value) || 0)
  ]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const commonWeight = Math.max(0, Number(rarityOdds.common) || 0);
  const nonCommonWeight = entries.reduce(
    (sum, [key, weight]) => sum + (key === 'common' ? 0 : weight),
    0
  );
  const chancePercent = getRarityChancePercent(influenceSlots, consumables);

  if (
    chancePercent <= 0 ||
    total <= 0 ||
    commonWeight <= 0 ||
    nonCommonWeight <= 0
  ) {
    return Object.fromEntries(entries);
  }

  const shift = Math.min(commonWeight, (total * chancePercent) / 100);
  return Object.fromEntries(
    entries.map(([key, weight]) => [
      key,
      key === 'common'
        ? commonWeight - shift
        : weight + shift * (weight / nonCommonWeight)
    ])
  );
}

function createHatchInfluenceSnapshots(influenceSlots = [], consumables = []) {
  return getInfluenceConsumables(influenceSlots, consumables).map(
    ({ influence, consumable }) => ({
      slotKey: influence.slotKey,
      itemKey: consumable.key,
      itemName: consumable.name,
      itemRarity: consumable.metadata?.rarity || null,
      effect: { ...(consumable.effect || {}) },
      assets: { ...(consumable.assets || {}) },
      consumedAt: influence.consumedAt || null
    })
  );
}

module.exports = {
  applyHatchSpeedToDuration,
  applyRarityChanceToOdds,
  createConsumableMap,
  createHatchInfluenceSnapshots,
  getHatchSpeedPercent,
  getInfluenceConsumables,
  getRarityChancePercent
};

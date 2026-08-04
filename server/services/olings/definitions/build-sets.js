const {
  OLING_LAYERS,
  OLING_RARITIES,
  normalizeKey,
  toPlainObject
} = require('../shared');

function getSetDerivedOlingPools(egg) {
  const pools = Object.fromEntries(
    OLING_LAYERS.map((layer) => [
      layer,
      Object.fromEntries(OLING_RARITIES.map((rarity) => [rarity, []]))
    ])
  );

  (Array.isArray(egg?.sets) ? egg.sets : []).forEach((set) => {
    const rarity = normalizeKey(set?.rarity);
    if (!OLING_RARITIES.includes(rarity)) return;

    OLING_LAYERS.forEach((layer) => {
      const traitKey = normalizeKey(set?.traits?.[layer]);
      if (!traitKey || pools[layer][rarity].includes(traitKey)) return;
      pools[layer][rarity].push(traitKey);
    });
  });

  return pools;
}

function getLayerPool(egg, layer, rarity) {
  const pool = getSetDerivedOlingPools(egg)?.[layer]?.[rarity];
  return Array.isArray(pool) ? pool.map(normalizeKey).filter(Boolean) : [];
}

function getSetDerivedOlingRarities(egg) {
  const rarities = (Array.isArray(egg?.sets) ? egg.sets : [])
    .map((set) => normalizeKey(set?.rarity))
    .filter((rarity) => OLING_RARITIES.includes(rarity));

  return [...new Set(rarities)];
}

function getRollableOlingRarityOdds(egg) {
  const setRarities = new Set(getSetDerivedOlingRarities(egg));

  return Object.fromEntries(
    OLING_RARITIES.filter((rarity) => setRarities.has(rarity)).map((rarity) => [
      rarity,
      Math.max(0, Number(egg?.rarityOdds?.[rarity]) || 0)
    ])
  );
}

async function attachOlingBuildSetsToEggs(
  { OlingBuildSet },
  eggs = [],
  { publicOnly = false } = {}
) {
  const plainEggs = eggs.map(toPlainObject).filter(Boolean);
  const setKeys = [
    ...new Set(
      plainEggs
        .flatMap((egg) => egg.setKeys || [])
        .map(normalizeKey)
        .filter(Boolean)
    )
  ];

  if (!setKeys.length) {
    return plainEggs.map((egg) => ({ ...egg, sets: [] }));
  }

  const buildSetQuery = {
    key: { $in: setKeys },
    ...(publicOnly ? { enabled: true, status: 'published' } : {})
  };
  const buildSets = await OlingBuildSet.find(buildSetQuery).lean();
  const buildSetsByKey = new Map(buildSets.map((set) => [set.key, set]));

  return plainEggs.map((egg) => ({
    ...egg,
    setKeys: (egg.setKeys || []).map(normalizeKey).filter(Boolean),
    sets: (egg.setKeys || [])
      .map((setKey) => buildSetsByKey.get(normalizeKey(setKey)))
      .filter(Boolean)
  }));
}

function rollWeightedKey(weights) {
  const entries = Object.entries(weights || {})
    .map(([key, weight]) => [key, Number(weight) || 0])
    .filter(([, weight]) => weight > 0);

  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;

  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }

  return entries[entries.length - 1]?.[0] || null;
}

function pickRandom(values) {
  if (!Array.isArray(values) || !values.length) return null;
  return values[Math.floor(Math.random() * values.length)] || null;
}

module.exports = {
  attachOlingBuildSetsToEggs,
  getLayerPool,
  getRollableOlingRarityOdds,
  getSetDerivedOlingPools,
  pickRandom,
  rollWeightedKey
};

const fs = require('fs/promises');
const path = require('path');

const { OLING_DEFINITIONS_ROOT, OLING_LAYERS, normalizeKey } = require('../shared');
const { attachOlingBuildSetsToEggs } = require('./build-sets');

async function getOlingDefinitions(
  { OlingTrait, OlingEgg, OlingBuildSet, OlingPersonality },
  olings = []
) {
  const traitKeys = [
    ...new Set(
      olings.flatMap((oling) =>
        [
          ...OLING_LAYERS.map((layer) =>
            normalizeKey(oling.build?.[layer])
          ),
          normalizeKey(oling.equipment?.headwear)
        ].filter(Boolean)
      )
    )
  ];
  const personalityKeys = [
    ...new Set(
      olings.map((oling) => normalizeKey(oling.personalityKey)).filter(Boolean)
    )
  ];
  const eggKeys = [
    ...new Set(olings.map((oling) => normalizeKey(oling.eggKey)).filter(Boolean))
  ];

  const [traits, rawEggs, personalities] = await Promise.all([
    traitKeys.length
      ? OlingTrait.find({ key: { $in: traitKeys } }).lean()
      : Promise.resolve([]),
    eggKeys.length
      ? OlingEgg.find({ key: { $in: eggKeys } }).lean()
      : Promise.resolve([]),
    personalityKeys.length
      ? OlingPersonality.find({ key: { $in: personalityKeys } }).lean()
      : Promise.resolve([])
  ]);
  const eggs = await attachOlingBuildSetsToEggs({ OlingBuildSet }, rawEggs, {
    publicOnly: false
  });

  return {
    traitsByKey: new Map(traits.map((trait) => [trait.key, trait])),
    eggsByKey: new Map(eggs.map((egg) => [egg.key, egg])),
    personalitiesByKey: new Map(
      personalities.map((personality) => [personality.key, personality])
    )
  };
}

async function readJsonList(fileName, key) {
  const filePath = path.join(OLING_DEFINITIONS_ROOT, fileName);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (Array.isArray(data)) return data;
  return Array.isArray(data[key]) ? data[key] : [];
}

function normalizeOlingConsumable(consumable = {}) {
  return {
    ...consumable,
    key: normalizeKey(consumable.key),
    enabled: consumable.enabled !== false,
    status: consumable.status || 'published'
  };
}

function filterPublishedOlingConsumables(consumables = []) {
  return consumables
    .map(normalizeOlingConsumable)
    .filter(
      (consumable) =>
        consumable.key &&
        consumable.enabled !== false &&
        consumable.status === 'published'
    );
}

async function listOlingConsumables({ OlingConsumable } = {}) {
  if (OlingConsumable) {
    try {
      const consumables = await OlingConsumable.find({
        enabled: true,
        status: 'published'
      })
        .sort({ category: 1, subcategory: 1, key: 1 })
        .lean();

      if (consumables.length) return consumables.map(normalizeOlingConsumable);
      if (typeof OlingConsumable.countDocuments === 'function') {
        const totalConsumables = await OlingConsumable.countDocuments({});
        if (totalConsumables > 0) return [];
      }
    } catch (error) {
      console.warn(
        'Falling back to JSON Oling consumables:',
        error.message || error
      );
    }
  }

  const consumables = await readJsonList('consumables.json', 'consumables');
  return filterPublishedOlingConsumables(consumables);
}

async function getOlingConsumableByKey(consumableKey, { OlingConsumable } = {}) {
  const normalizedKey = normalizeKey(consumableKey);
  if (!normalizedKey) return null;

  if (OlingConsumable) {
    try {
      const consumable = await OlingConsumable.findOne({
        key: normalizedKey,
        enabled: true,
        status: 'published'
      }).lean();

      if (consumable) return normalizeOlingConsumable(consumable);
      if (typeof OlingConsumable.countDocuments === 'function') {
        const totalConsumables = await OlingConsumable.countDocuments({});
        if (totalConsumables > 0) return null;
      }
    } catch (error) {
      console.warn(
        `Falling back to JSON Oling consumable "${normalizedKey}":`,
        error.message || error
      );
    }
  }

  const consumables = await listOlingConsumables();
  return consumables.find((consumable) => consumable.key === normalizedKey) || null;
}

async function readAllOlingConsumablesFromJson() {
  const consumables = await readJsonList('consumables.json', 'consumables');
  return consumables
    .map((consumable) => ({ ...consumable, key: normalizeKey(consumable.key) }))
    .filter((consumable) => consumable.key);
}

async function listOlingPersonalities() {
  const personalities = await readJsonList(
    'personalities.json',
    'personalities'
  );
  return personalities
    .map((personality) => ({
      ...personality,
      key: normalizeKey(personality.key),
      enabled: personality.enabled !== false,
      status: personality.status || 'published'
    }))
    .filter(
      (personality) =>
        personality.key &&
        personality.enabled !== false &&
        personality.status === 'published'
    );
}

async function listPublishedOlingEggs({ OlingEgg, OlingBuildSet }) {
  try {
    const eggs = await OlingEgg.find({ enabled: true, status: 'published' })
      .sort({ collection: 1, key: 1 })
      .lean();

    if (eggs.length) {
      return attachOlingBuildSetsToEggs(
        { OlingBuildSet },
        eggs,
        { publicOnly: true }
      );
    }
  } catch (error) {
    console.warn('Falling back to JSON Oling eggs:', error.message || error);
  }

  return readJsonList('eggs.json', 'eggs');
}

async function listPublishedOlingTraits({ OlingTrait }) {
  try {
    const traits = await OlingTrait.find({ enabled: true, status: 'published' })
      .sort({ collection: 1, layer: 1, rarity: 1, key: 1 })
      .lean();

    if (traits.length) return traits;
  } catch (error) {
    console.warn('Falling back to JSON Oling traits:', error.message || error);
  }

  return readJsonList('traits.json', 'traits');
}

async function listPublishedOlingPersonalities({ OlingPersonality }) {
  try {
    const personalities = await OlingPersonality.find({
      enabled: true,
      status: 'published'
    })
      .sort({ key: 1 })
      .lean();

    if (personalities.length) return personalities;
  } catch (error) {
    console.warn(
      'Falling back to JSON Oling personalities:',
      error.message || error
    );
  }

  return listOlingPersonalities();
}

module.exports = {
  filterPublishedOlingConsumables,
  getOlingConsumableByKey,
  getOlingDefinitions,
  listOlingConsumables,
  listOlingPersonalities,
  listPublishedOlingEggs,
  listPublishedOlingPersonalities,
  listPublishedOlingTraits,
  normalizeOlingConsumable,
  readAllOlingConsumablesFromJson,
  readJsonList
};

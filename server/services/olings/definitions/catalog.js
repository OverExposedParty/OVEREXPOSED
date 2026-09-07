const fs = require('fs/promises');
const path = require('path');

const {
  OLING_DEFINITIONS_ROOT,
  OLING_LAYERS,
  normalizeKey
} = require('../shared');
const { attachOlingBuildSetsToEggs } = require('./build-sets');

const ACTIVE_OLING_CONSUMABLE_KEYS = Object.freeze([
  'oling-cookie',
  'o-juice',
  'oling-blanket',
  'opal-dust',
  'lucky-clover'
]);
const activeOlingConsumableKeys = new Set(ACTIVE_OLING_CONSUMABLE_KEYS);

async function getOlingDefinitions(
  { OlingTrait, OlingEgg, OlingBuildSet, OlingClashAbility },
  olings = []
) {
  const clashTraitKeys = [
    ...new Set(
      olings.flatMap((oling) =>
        OLING_LAYERS.map((layer) => normalizeKey(oling.build?.[layer])).filter(
          Boolean
        )
      )
    )
  ];
  const traitKeys = [
    ...new Set(
      [
        ...clashTraitKeys,
        ...olings.map((oling) => normalizeKey(oling.equipment?.headwear))
      ].filter(Boolean)
    )
  ];
  const eggKeys = [
    ...new Set(
      olings.map((oling) => normalizeKey(oling.eggKey)).filter(Boolean)
    )
  ];

  const [traits, rawEggs, clashAbilities] = await Promise.all([
    traitKeys.length
      ? OlingTrait.find({ key: { $in: traitKeys } }).lean()
      : Promise.resolve([]),
    eggKeys.length
      ? OlingEgg.find({ key: { $in: eggKeys } }).lean()
      : Promise.resolve([]),
    clashTraitKeys.length && OlingClashAbility
      ? OlingClashAbility.find({
          traitKey: { $in: clashTraitKeys },
          isCurrent: true,
          enabled: true,
          status: 'published'
        }).lean()
      : Promise.resolve([])
  ]);
  const eggs = await attachOlingBuildSetsToEggs({ OlingBuildSet }, rawEggs, {
    publicOnly: false
  });

  return {
    traitsByKey: new Map(traits.map((trait) => [trait.key, trait])),
    clashAbilitiesByTraitKey: new Map(
      clashAbilities.map((ability) => [ability.traitKey, ability])
    ),
    eggsByKey: new Map(eggs.map((egg) => [egg.key, egg]))
  };
}

async function readJsonList(fileName, key) {
  const filePath = path.join(OLING_DEFINITIONS_ROOT, fileName);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (Array.isArray(data)) return data;
  return Array.isArray(data[key]) ? data[key] : [];
}

function normalizeOlingConsumable(consumable = {}) {
  const normalized = {
    ...consumable,
    key: normalizeKey(consumable.key),
    enabled: consumable.enabled !== false,
    status: consumable.status || 'published'
  };

  if (normalized.key !== 'o-juice') return normalized;

  return {
    ...normalized,
    name: 'O-Juice',
    category: 'care',
    subcategory: 'energy',
    target: 'oling',
    effect: { type: 'energy', restoreToEnergy: 75 },
    assets: {
      icon: '/images/olings/lab/consumables/energy/o-juice.svg',
      image: '/images/olings/lab/consumables/energy/o-juice.svg'
    }
  };
}

function filterPublishedOlingConsumables(consumables = []) {
  return consumables
    .map(normalizeOlingConsumable)
    .filter(
      (consumable) =>
        consumable.key &&
        activeOlingConsumableKeys.has(consumable.key) &&
        consumable.enabled !== false &&
        consumable.status === 'published'
    );
}

async function listOlingConsumables({ OlingConsumable } = {}) {
  if (OlingConsumable) {
    try {
      const storedConsumables = await OlingConsumable.find({
        key: { $in: ACTIVE_OLING_CONSUMABLE_KEYS }
      })
        .sort({ category: 1, subcategory: 1, key: 1 })
        .lean();
      const storedKeys = new Set(
        storedConsumables.map((item) => normalizeKey(item.key))
      );
      const jsonConsumables = await readJsonList(
        'consumables.json',
        'consumables'
      );
      return filterPublishedOlingConsumables([
        ...storedConsumables,
        ...jsonConsumables.filter(
          (item) => !storedKeys.has(normalizeKey(item.key))
        )
      ]).sort((left, right) =>
        [left.category, left.subcategory, left.key]
          .map((value) => String(value || ''))
          .join(':')
          .localeCompare(
            [right.category, right.subcategory, right.key]
              .map((value) => String(value || ''))
              .join(':')
          )
      );
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

async function getOlingConsumableByKey(
  consumableKey,
  { OlingConsumable } = {}
) {
  const normalizedKey = normalizeKey(consumableKey);
  if (!activeOlingConsumableKeys.has(normalizedKey)) return null;

  if (OlingConsumable) {
    try {
      const consumable = await OlingConsumable.findOne({
        key: normalizedKey,
        enabled: true,
        status: 'published'
      }).lean();

      if (consumable) return normalizeOlingConsumable(consumable);
      if (typeof OlingConsumable.countDocuments === 'function') {
        const totalConsumables = await OlingConsumable.countDocuments({
          key: normalizedKey
        });
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
  return (
    consumables.find((consumable) => consumable.key === normalizedKey) || null
  );
}

async function readAllOlingConsumablesFromJson() {
  const consumables = await readJsonList('consumables.json', 'consumables');
  return consumables
    .map((consumable) => ({ ...consumable, key: normalizeKey(consumable.key) }))
    .filter((consumable) => activeOlingConsumableKeys.has(consumable.key));
}

async function listPublishedOlingEggs({ OlingEgg, OlingBuildSet }) {
  try {
    const eggs = await OlingEgg.find({ enabled: true, status: 'published' })
      .sort({ collection: 1, key: 1 })
      .lean();

    if (eggs.length) {
      return attachOlingBuildSetsToEggs({ OlingBuildSet }, eggs, {
        publicOnly: true
      });
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

module.exports = {
  ACTIVE_OLING_CONSUMABLE_KEYS,
  filterPublishedOlingConsumables,
  getOlingConsumableByKey,
  getOlingDefinitions,
  listOlingConsumables,
  listPublishedOlingEggs,
  listPublishedOlingTraits,
  normalizeOlingConsumable,
  readAllOlingConsumablesFromJson,
  readJsonList
};

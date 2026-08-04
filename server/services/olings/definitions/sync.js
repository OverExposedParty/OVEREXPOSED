const fs = require('fs/promises');

const {
  OLING_CONSUMABLES_FILE,
  OLING_DEFINITIONS_ROOT,
  normalizeKey
} = require('../shared');
const { readAllOlingConsumablesFromJson, readJsonList } = require('./catalog');
const { serializeOlingConsumableForJson } = require('./serializers');

async function importOlingDefinitionsFromJson({
  OlingTrait,
  OlingEgg,
  OlingBuildSet,
  OlingPersonality,
  OlingConsumable
}) {
  const [traits, eggs, personalities] = await Promise.all([
    readJsonList('traits.json', 'traits'),
    readJsonList('eggs.json', 'eggs'),
    readJsonList('personalities.json', 'personalities')
  ]);
  const consumables = OlingConsumable
    ? await readAllOlingConsumablesFromJson()
    : [];
  const imported = {
    traits: [],
    buildSets: [],
    eggs: [],
    personalities: [],
    consumables: []
  };

  for (const trait of traits) {
    const key = normalizeKey(trait.key);
    if (!key) continue;
    const importedTrait = await OlingTrait.findOneAndUpdate(
      { key },
      { $set: { ...trait, key } },
      { new: true, runValidators: true, upsert: true }
    );
    imported.traits.push(importedTrait);
  }

  for (const personality of personalities) {
    const key = normalizeKey(personality.key);
    if (!key) continue;
    const importedPersonality = await OlingPersonality.findOneAndUpdate(
      { key },
      { $set: { ...personality, key } },
      { new: true, runValidators: true, upsert: true }
    );
    imported.personalities.push(importedPersonality);
  }

  if (OlingConsumable) {
    for (const consumable of consumables) {
      const key = normalizeKey(consumable.key);
      if (!key) continue;
      const importedConsumable = await OlingConsumable.findOneAndUpdate(
        { key },
        {
          $set: {
            ...consumable,
            key,
            enabled: consumable.enabled !== false,
            status: consumable.status || 'published'
          }
        },
        { new: true, runValidators: true, upsert: true }
      );
      imported.consumables.push(importedConsumable);
    }
  }

  for (const egg of eggs) {
    const key = normalizeKey(egg.key);
    if (!key) continue;
    const collection = normalizeKey(egg.collection || 'base');
    const setKeys = [];

    for (const set of Array.isArray(egg.sets) ? egg.sets : []) {
      const setKey = normalizeKey(set.key);
      if (!setKey) continue;
      setKeys.push(setKey);

      const importedBuildSet = await OlingBuildSet.findOneAndUpdate(
        { key: setKey },
        {
          $set: {
            ...set,
            key: setKey,
            collection,
            status: set.status || 'published',
            enabled: set.enabled !== false
          }
        },
        { new: true, runValidators: true, upsert: true }
      );
      imported.buildSets.push(importedBuildSet);
    }

    const { sets, pools, ...eggPayload } = egg;
    const importedEgg = await OlingEgg.findOneAndUpdate(
      { key },
      {
        $set: {
          ...eggPayload,
          key,
          collection,
          setKeys: [...new Set(setKeys)]
        },
        $unset: { sets: '', pools: '' }
      },
      { new: true, runValidators: true, upsert: true }
    );
    imported.eggs.push(importedEgg);
  }

  return imported;
}

async function exportOlingConsumablesToJson(OlingConsumable) {
  const consumables = await OlingConsumable.find({})
    .sort({ category: 1, subcategory: 1, key: 1 })
    .lean();

  await fs.mkdir(OLING_DEFINITIONS_ROOT, { recursive: true });
  await fs.writeFile(
    OLING_CONSUMABLES_FILE,
    `${JSON.stringify(
      {
        consumables: consumables
          .map(serializeOlingConsumableForJson)
          .filter(Boolean)
      },
      null,
      2
    )}\n`
  );

  return consumables;
}

module.exports = {
  exportOlingConsumablesToJson,
  importOlingDefinitionsFromJson
};

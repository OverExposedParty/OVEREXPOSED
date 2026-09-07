const fs = require('fs/promises');

const {
  OLING_CONSUMABLES_FILE,
  OLING_DEFINITIONS_ROOT,
  normalizeKey
} = require('../shared');
const { readAllOlingConsumablesFromJson, readJsonList } = require('./catalog');
const { serializeOlingConsumableForJson } = require('./serializers');

async function importVersionedRecords({
  model,
  records,
  destination,
  currentScope,
  unsetFields = []
}) {
  if (!model) return;

  for (const record of records) {
    const key = normalizeKey(record.key);
    const revision = Number(record.revision);
    const scopeValue = normalizeKey(record[currentScope] || key);
    if (!key || !Number.isInteger(revision) || revision < 1 || !scopeValue) {
      continue;
    }

    const payload = {
      ...record,
      key,
      revision,
      ...(currentScope === 'traitKey'
        ? { traitKey: normalizeKey(record.traitKey) }
        : {}),
      status: record.status || 'published',
      ...(Object.hasOwn(record, 'enabled')
        ? { enabled: record.enabled !== false }
        : {})
    };

    if (payload.isCurrent) {
      await model.updateMany(
        {
          [currentScope]: scopeValue,
          revision: { $ne: revision },
          isCurrent: true
        },
        { $set: { isCurrent: false } }
      );
    }

    const update = { $set: payload };
    if (unsetFields.length > 0) {
      update.$unset = Object.fromEntries(
        unsetFields.map((fieldName) => [fieldName, ''])
      );
    }

    const importedRecord = await model.findOneAndUpdate(
      { [currentScope]: scopeValue, revision },
      update,
      {
        new: true,
        runValidators: true,
        upsert: true,
        ...(unsetFields.length > 0 ? { strict: false } : {})
      }
    );
    destination.push(importedRecord);
  }
}

async function importOlingDefinitionsFromJson({
  OlingTrait,
  OlingEgg,
  OlingBuildSet,
  OlingConsumable,
  OlingClashAbility,
  OlingClashRuleset,
  OlingClashStatus
}) {
  const [traits, eggs, clashAbilities, clashRulesets, clashStatuses] =
    await Promise.all([
      readJsonList('traits.json', 'traits'),
      readJsonList('eggs.json', 'eggs'),
      readJsonList('clash-abilities.json', 'abilities'),
      readJsonList('clash-rulesets.json', 'rulesets'),
      readJsonList('clash-statuses.json', 'statuses')
    ]);
  const consumables = OlingConsumable
    ? await readAllOlingConsumablesFromJson()
    : [];
  const imported = {
    traits: [],
    buildSets: [],
    eggs: [],
    consumables: [],
    clashAbilities: [],
    clashRulesets: [],
    clashStatuses: []
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

  await importVersionedRecords({
    model: OlingClashAbility,
    records: clashAbilities,
    destination: imported.clashAbilities,
    currentScope: 'traitKey',
    unsetFields: ['handler', 'parameters']
  });
  await importVersionedRecords({
    model: OlingClashRuleset,
    records: clashRulesets,
    destination: imported.clashRulesets,
    currentScope: 'key'
  });
  await importVersionedRecords({
    model: OlingClashStatus,
    records: clashStatuses,
    destination: imported.clashStatuses,
    currentScope: 'key'
  });

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
  importOlingDefinitionsFromJson,
  importVersionedRecords
};

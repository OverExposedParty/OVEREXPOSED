require('dotenv').config();

const mongoose = require('mongoose');

const CURRENT_BASE_TRAIT_KEYS = Object.freeze([
  'round-body',
  'sprout-body',
  'moss-body',
  'dot-eyes',
  'bright-eyes',
  'moss-eyes',
  'bite-mouth',
  'spit-mouth',
  'moss-mouth',
  'soft-ears',
  'tiny-horns',
  'soft-wings',
  'sprout-wings',
  'moss-wings',
  'vampire-body',
  'vampire-eyes',
  'vampire-mouth',
  'vampire-wings',
  'stone-body',
  'stone-eyes',
  'stone-mouth',
  'stone-wings',
  'bone-body',
  'bone-eyes',
  'bone-mouth',
  'bone-wings',
  'magma-body',
  'magma-eyes',
  'magma-mouth',
  'magma-wings',
  'trash-body',
  'trash-eyes',
  'trash-mouth',
  'trash-balloons',
  'lava-body',
  'lava-eyes',
  'lava-mouth'
]);

const TRAIT_KEY_RENAMES = new Map(
  CURRENT_BASE_TRAIT_KEYS.map((key) => [`base-${key}`, key])
);

function renameTraitKey(value) {
  return typeof value === 'string' && TRAIT_KEY_RENAMES.has(value)
    ? TRAIT_KEY_RENAMES.get(value)
    : value;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function renameTraitReferences(value) {
  if (typeof value === 'string') {
    const renamed = renameTraitKey(value);
    return { value: renamed, changed: renamed !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const renamed = value.map((item) => {
      const result = renameTraitReferences(item);
      changed ||= result.changed;
      return result.value;
    });
    return { value: changed ? renamed : value, changed };
  }

  if (isPlainObject(value)) {
    let changed = false;
    const renamed = {};
    for (const [key, item] of Object.entries(value)) {
      const renamedKey = renameTraitKey(key);
      if (
        renamedKey !== key &&
        Object.prototype.hasOwnProperty.call(value, renamedKey)
      ) {
        throw new Error(
          `Cannot rename Oling trait reference "${key}" because "${renamedKey}" already exists.`
        );
      }
      const result = renameTraitReferences(item);
      changed ||= result.changed || renamedKey !== key;
      renamed[renamedKey] = result.value;
    }
    return { value: changed ? renamed : value, changed };
  }

  return { value, changed: false };
}

function getPathValue(document, path) {
  return path
    .split('.')
    .reduce(
      (value, part) => (value == null ? undefined : value[part]),
      document
    );
}

async function migrateTraitDefinitions(database, { apply }) {
  const collection = database.collection('oling-traits');
  const oldKeys = [...TRAIT_KEY_RENAMES.keys()];
  const newKeys = [...TRAIT_KEY_RENAMES.values()];
  const [oldTraits, newTraits] = await Promise.all([
    collection
      .find({ key: { $in: oldKeys } }, { projection: { key: 1 } })
      .toArray(),
    collection
      .find({ key: { $in: newKeys } }, { projection: { key: 1 } })
      .toArray()
  ]);
  const existingNewKeys = new Set(newTraits.map((trait) => trait.key));
  const collisions = oldTraits
    .map((trait) => renameTraitKey(trait.key))
    .filter((key) => existingNewKeys.has(key));

  if (collisions.length) {
    throw new Error(
      `Cannot rename Oling traits because target keys already exist: ${collisions.join(', ')}`
    );
  }

  let modified = 0;
  if (apply && oldTraits.length) {
    const result = await collection.bulkWrite(
      oldTraits.map((trait) => ({
        updateOne: {
          filter: { _id: trait._id, key: trait.key },
          update: { $set: { key: renameTraitKey(trait.key) } }
        }
      }))
    );
    modified = result.modifiedCount;
  }

  return {
    database: database.databaseName,
    collection: collection.collectionName,
    wouldModify: oldTraits.length,
    modified
  };
}

async function migrateCollectionReferences(
  database,
  collectionName,
  fieldPaths,
  { apply }
) {
  const collection = database.collection(collectionName);
  const projection = Object.fromEntries([
    ['_id', 1],
    ...fieldPaths.map((path) => [path, 1])
  ]);
  const cursor = collection.find({}, { projection });
  const operations = [];
  let scanned = 0;
  let wouldModify = 0;
  let modified = 0;

  async function flushOperations() {
    if (!apply || !operations.length) return;
    const result = await collection.bulkWrite(operations.splice(0));
    modified += result.modifiedCount;
  }

  for await (const document of cursor) {
    scanned += 1;
    const updates = {};

    for (const path of fieldPaths) {
      const currentValue = getPathValue(document, path);
      if (currentValue === undefined) continue;
      const renamed = renameTraitReferences(currentValue);
      if (renamed.changed) updates[path] = renamed.value;
    }

    if (!Object.keys(updates).length) continue;
    wouldModify += 1;
    if (apply) {
      operations.push({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: updates }
        }
      });

      if (operations.length >= 500) await flushOperations();
    }
  }

  await flushOperations();

  return {
    database: database.databaseName,
    collection: collection.collectionName,
    scanned,
    wouldModify,
    modified
  };
}

function getDatabaseUri(baseUri, directUri, databaseName) {
  if (directUri) return directUri;
  if (!baseUri) {
    throw new Error(`Missing MongoDB URI for the "${databaseName}" database.`);
  }
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${databaseName}`;
  return parsedUri.toString();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const {
    accountsConnection,
    olingsConnection,
    shopConnection,
    socialConnection
  } = require('../server/models');

  const connections = [
    {
      connection: olingsConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_OLINGS,
        process.env.MONGO_DB_OLINGS || 'olings'
      )
    },
    {
      connection: accountsConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_ACCOUNTS,
        process.env.MONGO_DB_ACCOUNTS || 'accounts'
      )
    },
    {
      connection: shopConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_SHOP,
        process.env.MONGO_DB_SHOP || 'shop'
      )
    },
    {
      connection: socialConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_SOCIAL,
        process.env.MONGO_DB_SOCIAL || 'social'
      )
    }
  ];

  await Promise.all(
    connections.map(({ connection, uri }) =>
      connection.openUri(uri, { serverSelectionTimeoutMS: 15000 })
    )
  );

  const results = [];
  results.push(await migrateTraitDefinitions(olingsConnection.db, { apply }));

  const migrations = [
    [
      olingsConnection.db,
      'oling-traits',
      ['assets', 'body', 'attack', 'modifiers', 'passive', 'metadata']
    ],
    [
      olingsConnection.db,
      'oling-eggs',
      ['sets', 'pools', 'assets', 'metadata']
    ],
    [olingsConnection.db, 'oling-build-sets', ['traits', 'metadata']],
    [olingsConnection.db, 'oling-hatch-receipts', ['rolls', 'metadata']],
    [olingsConnection.db, 'oling-battle-matches', ['players']],
    [olingsConnection.db, 'oling-battle-archives', ['players', 'events']],
    [olingsConnection.db, 'oling-battle-events-legacy', ['payload']],
    [
      accountsConnection.db,
      'player-olings',
      ['build', 'equipment', 'metadata']
    ],
    [
      accountsConnection.db,
      'accounts',
      ['gameData.inGamePurchasesAndUnlocks', 'gameData.achievements']
    ],
    [accountsConnection.db, 'achievement-reward-claims', ['rewardResults']],
    [shopConnection.db, 'products', ['digitalEntitlement', 'variants']],
    [socialConnection.db, 'achievements', ['rewards']]
  ];

  for (const [database, collectionName, fieldPaths] of migrations) {
    results.push(
      await migrateCollectionReferences(database, collectionName, fieldPaths, {
        apply
      })
    );
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        traitKeyRenames: TRAIT_KEY_RENAMES.size,
        results
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const {
        accountsConnection,
        olingsConnection,
        shopConnection,
        socialConnection
      } = require('../server/models');
      await Promise.all([
        accountsConnection.close().catch(() => {}),
        olingsConnection.close().catch(() => {}),
        shopConnection.close().catch(() => {}),
        socialConnection.close().catch(() => {}),
        mongoose.disconnect().catch(() => {})
      ]);
    });
}

module.exports = {
  CURRENT_BASE_TRAIT_KEYS,
  TRAIT_KEY_RENAMES,
  getPathValue,
  isPlainObject,
  migrateCollectionReferences,
  migrateTraitDefinitions,
  renameTraitKey,
  renameTraitReferences
};

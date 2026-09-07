require('dotenv').config();

const mongoose = require('mongoose');

const consumableCatalog = require('../public/json-files/olings/consumables.json');
const { O_JUICE_KEY, createOJuiceProduct } = require('./seed-o-juice-product');

const LEGACY_PERSONALITY_CONSUMABLE_KEYS = Object.freeze([
  'briefcase',
  'crystal-ball',
  'lucky-coin',
  'magnifying-glass',
  'puzzle-piece',
  'sleeping-mask',
  'small-pillow',
  'small-pilow',
  'teddy-bear',
  'toy-microphone',
  'toy-shield',
  'toy-sword',
  'treasure-map',
  'trophy',
  'whoope-cushion',
  'whoopee-cushion'
]);
const legacyPersonalityConsumableKeys = new Set(
  LEGACY_PERSONALITY_CONSUMABLE_KEYS
);

const LEGACY_OLING_SNAPSHOT_FIELDS = Object.freeze([
  'battleStats',
  'level',
  'personality',
  'personalityKey',
  'xp'
]);

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function hasPersonalityMarker(value = {}) {
  const metadata = value.metadata || {};
  const effect = value.effect || {};
  return (
    (normalizeKey(value.category) === 'hatching' &&
      normalizeKey(value.subcategory) === 'personality') ||
    normalizeKey(effect.type).includes('personality') ||
    Boolean(effect.personalityKey || metadata.personalityKey)
  );
}

function getProductGrants(product = {}) {
  return [
    ...(product.digitalEntitlement?.grants || []),
    ...(product.variants || []).flatMap(
      (variant) => variant.digitalEntitlement?.grants || []
    )
  ];
}

function isPersonalityGrant(grant = {}) {
  const metadata = grant.metadata || {};
  return (
    normalizeKey(grant.type) === 'oling_consumable' &&
    (normalizeKey(metadata.consumableSubcategory) === 'personality' ||
      normalizeKey(metadata.effectType).includes('personality') ||
      Boolean(metadata.personalityKey))
  );
}

function isRetiredPersonalityProduct(product = {}) {
  const productKey = normalizeKey(product.identity?.slug || product.slug);
  if (productKey === O_JUICE_KEY) return false;

  const tags = (product.identity?.tags || []).map(normalizeKey);
  const styles = (product.merchandising?.catalog?.style || []).map(
    normalizeKey
  );
  const mediaPaths = [
    product.media?.mainImage?.url,
    ...(product.media?.gallery || []).map((item) => item?.url)
  ];

  return (
    legacyPersonalityConsumableKeys.has(productKey) ||
    tags.includes('personality') ||
    styles.includes('personality') ||
    mediaPaths.some((value) =>
      String(value || '').includes('/hatching/personality/')
    ) ||
    getProductGrants(product).some(isPersonalityGrant)
  );
}

function isRetiredPersonalityConsumable(consumable = {}) {
  const consumableKey = normalizeKey(consumable.key);
  return (
    consumableKey !== O_JUICE_KEY &&
    (legacyPersonalityConsumableKeys.has(consumableKey) ||
      hasPersonalityMarker(consumable))
  );
}

function collectRetiredConsumableKeys(consumables = [], products = []) {
  const keys = new Set(LEGACY_PERSONALITY_CONSUMABLE_KEYS);

  consumables.filter(isRetiredPersonalityConsumable).forEach((consumable) => {
    const key = normalizeKey(consumable.key);
    if (key) keys.add(key);
  });

  products.filter(isRetiredPersonalityProduct).forEach((product) => {
    getProductGrants(product).forEach((grant) => {
      if (!isPersonalityGrant(grant)) return;
      const key = normalizeKey(grant.key);
      if (key && key !== O_JUICE_KEY) keys.add(key);
    });
  });

  keys.delete(O_JUICE_KEY);
  return keys;
}

function removeLegacyOlingSnapshotFields(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { changed: false, value: snapshot };
  }

  const value = { ...snapshot };
  let changed = false;
  LEGACY_OLING_SNAPSHOT_FIELDS.forEach((field) => {
    if (!Object.hasOwn(value, field)) return;
    delete value[field];
    changed = true;
  });
  return { changed, value: changed ? value : snapshot };
}

function cleanBattlePlayers(players = []) {
  let changed = false;
  const value = players.map((player) => {
    const cleaned = removeLegacyOlingSnapshotFields(player?.olingSnapshot);
    if (!cleaned.changed) return player;
    changed = true;
    return { ...player, olingSnapshot: cleaned.value };
  });
  return { changed, value: changed ? value : players };
}

function cleanClashPlayers(players = []) {
  let changed = false;
  const value = players.map((player) => {
    let teamChanged = false;
    const team = (player?.team || []).map((oling) => {
      const cleaned = removeLegacyOlingSnapshotFields(oling?.snapshot);
      if (!cleaned.changed) return oling;
      teamChanged = true;
      return { ...oling, snapshot: cleaned.value };
    });
    if (!teamChanged) return player;
    changed = true;
    return { ...player, team };
  });
  return { changed, value: changed ? value : players };
}

function cleanConsumableInventory(items, retiredKeys) {
  if (!Array.isArray(items))
    return { changed: false, removed: 0, value: items };
  const value = items.filter(
    (item) => !retiredKeys.has(normalizeKey(item?.key))
  );
  return {
    changed: value.length !== items.length,
    removed: items.length - value.length,
    value
  };
}

function cleanInfluenceSlots(influenceSlots, retiredKeys) {
  if (!Array.isArray(influenceSlots)) {
    return { changed: false, removed: 0, value: influenceSlots };
  }
  const value = influenceSlots.filter((influence) => {
    const itemKey = normalizeKey(influence?.itemKey);
    return (
      normalizeKey(influence?.slotKey) !== 'personality' &&
      itemKey !== O_JUICE_KEY &&
      !retiredKeys.has(itemKey)
    );
  });
  return {
    changed: value.length !== influenceSlots.length,
    removed: influenceSlots.length - value.length,
    value
  };
}

function cleanInventorySlot(slot, retiredKeys) {
  const cleaned = cleanInfluenceSlots(slot?.influenceSlots, retiredKeys);
  return cleaned.changed
    ? {
        changed: true,
        removed: cleaned.removed,
        value: { ...slot, influenceSlots: cleaned.value }
      }
    : { changed: false, removed: 0, value: slot };
}

function cleanLab(lab, retiredKeys) {
  if (!lab || !Array.isArray(lab.placedItems)) {
    return { changed: false, removed: 0, value: lab };
  }

  let changed = false;
  let removed = 0;
  const placedItems = lab.placedItems.map((placedItem) => {
    let placedItemChanged = false;
    const inventorySlots = (placedItem.inventorySlots || []).map((slot) => {
      const cleaned = cleanInventorySlot(slot, retiredKeys);
      placedItemChanged ||= cleaned.changed;
      removed += cleaned.removed;
      return cleaned.value;
    });
    const containerSlots = (placedItem.containerSlots || []).map(
      (containerSlot) => {
        let containerChanged = false;
        const childInventorySlots = (containerSlot.inventorySlots || []).map(
          (slot) => {
            const cleaned = cleanInventorySlot(slot, retiredKeys);
            containerChanged ||= cleaned.changed;
            removed += cleaned.removed;
            return cleaned.value;
          }
        );
        if (!containerChanged) return containerSlot;
        placedItemChanged = true;
        return { ...containerSlot, inventorySlots: childInventorySlots };
      }
    );

    if (!placedItemChanged) return placedItem;
    changed = true;
    return { ...placedItem, inventorySlots, containerSlots };
  });

  return {
    changed,
    removed,
    value: changed ? { ...lab, placedItems } : lab
  };
}

function cleanProductReferences(items, retiredProductIds) {
  if (!Array.isArray(items))
    return { changed: false, removed: 0, value: items };
  const value = items.filter(
    (item) => !retiredProductIds.has(String(item?.productId || ''))
  );
  return {
    changed: value.length !== items.length,
    removed: items.length - value.length,
    value
  };
}

function cleanAccountDocument(account, retiredKeys, retiredProductIds) {
  const updates = {};
  let removedInventoryItems = 0;
  let removedInfluences = 0;
  let removedProductReferences = 0;

  const inventoryPaths = [
    ['olings', 'consumables'],
    ['olings', 'inventory', 'consumables']
  ];
  inventoryPaths.forEach((parts) => {
    const items = parts.reduce((value, part) => value?.[part], account);
    const cleaned = cleanConsumableInventory(items, retiredKeys);
    if (!cleaned.changed) return;
    updates[parts.join('.')] = cleaned.value;
    removedInventoryItems += cleaned.removed;
  });

  const lab = cleanLab(account?.olings?.lab, retiredKeys);
  if (lab.changed) {
    updates['olings.lab'] = lab.value;
    removedInfluences += lab.removed;
  }

  [
    'cart',
    'wishlist',
    'savedItems',
    'recentlyViewedProducts',
    'purchasedProducts',
    'digitalProductAccess'
  ].forEach((field) => {
    const cleaned = cleanProductReferences(
      account?.shop?.[field],
      retiredProductIds
    );
    if (!cleaned.changed) return;
    updates[`shop.${field}`] = cleaned.value;
    removedProductReferences += cleaned.removed;
  });

  return {
    changed: Object.keys(updates).length > 0,
    removedInfluences,
    removedInventoryItems,
    removedProductReferences,
    updates
  };
}

function cleanOlingStateDocument(state, retiredKeys) {
  const updates = {};
  const inventory = cleanConsumableInventory(
    state?.inventory?.consumables,
    retiredKeys
  );
  if (inventory.changed) updates['inventory.consumables'] = inventory.value;

  const lab = cleanLab(state?.lab, retiredKeys);
  if (lab.changed) updates.lab = lab.value;

  return {
    changed: Object.keys(updates).length > 0,
    removedInfluences: lab.removed,
    removedInventoryItems: inventory.removed,
    updates
  };
}

async function migrateProjectedDocuments(
  collection,
  projection,
  transform,
  { apply }
) {
  const operations = [];
  const totals = {
    scanned: 0,
    wouldModify: 0,
    modified: 0,
    removedInfluences: 0,
    removedInventoryItems: 0,
    removedProductReferences: 0
  };

  async function flush() {
    if (!apply || operations.length === 0) return;
    const result = await collection.bulkWrite(operations.splice(0));
    totals.modified += result.modifiedCount;
  }

  for await (const document of collection.find({}, { projection })) {
    totals.scanned += 1;
    const transformed = transform(document);
    if (!transformed.changed) continue;
    totals.wouldModify += 1;
    totals.removedInfluences += transformed.removedInfluences || 0;
    totals.removedInventoryItems += transformed.removedInventoryItems || 0;
    totals.removedProductReferences +=
      transformed.removedProductReferences || 0;
    if (apply) {
      operations.push({
        updateOne: {
          filter: { _id: document._id },
          update: { $set: transformed.updates }
        }
      });
      if (operations.length >= 250) await flush();
    }
  }
  await flush();

  return {
    database: collection.namespace.split('.')[0],
    collection: collection.collectionName,
    ...totals
  };
}

async function migrateSnapshotCollection(collection, cleanPlayers, { apply }) {
  return migrateProjectedDocuments(
    collection,
    { players: 1 },
    (document) => {
      const cleaned = cleanPlayers(document.players || []);
      return {
        changed: cleaned.changed,
        updates: cleaned.changed ? { players: cleaned.value } : {}
      };
    },
    { apply }
  );
}

async function unsetLegacyFields(collection, filter, unset, { apply }) {
  const wouldModify = await collection.countDocuments(filter);
  const result =
    apply && wouldModify > 0
      ? await collection.updateMany(filter, { $unset: unset })
      : null;
  return {
    database: collection.namespace.split('.')[0],
    collection: collection.collectionName,
    wouldModify,
    modified: result?.modifiedCount || 0
  };
}

async function removeCollection(database, collectionName, { apply }) {
  const exists = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();
  const documentCount = exists
    ? await database.collection(collectionName).countDocuments({})
    : 0;
  if (apply && exists) await database.dropCollection(collectionName);
  return {
    database: database.databaseName,
    collection: collectionName,
    existed: exists,
    wouldDrop: exists,
    dropped: apply && exists,
    documentCount
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

function getOJuiceConsumable() {
  const consumable = (consumableCatalog.consumables || []).find(
    (item) => normalizeKey(item.key) === O_JUICE_KEY
  );
  if (!consumable) throw new Error('The local O-Juice definition is missing.');
  return consumable;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const {
    OlingConsumable,
    Product,
    accountsConnection,
    olingsConnection,
    shopConnection
  } = require('../server/models');

  const connections = [
    {
      connection: accountsConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_ACCOUNTS,
        process.env.MONGO_DB_ACCOUNTS || 'accounts'
      )
    },
    {
      connection: olingsConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_OLINGS,
        process.env.MONGO_DB_OLINGS || 'olings'
      )
    },
    {
      connection: shopConnection,
      uri: getDatabaseUri(
        baseUri,
        process.env.MONGO_URI_SHOP,
        process.env.MONGO_DB_SHOP || 'shop'
      )
    }
  ];

  await Promise.all(
    connections.map(({ connection, uri }) =>
      connection.openUri(uri, { serverSelectionTimeoutMS: 15000 })
    )
  );

  const consumableCollection =
    olingsConnection.db.collection('oling-consumables');
  const productCollection = shopConnection.db.collection('products');
  const [allConsumables, allProducts] = await Promise.all([
    consumableCollection.find({}).toArray(),
    productCollection.find({}).toArray()
  ]);
  const retiredConsumables = allConsumables.filter(
    isRetiredPersonalityConsumable
  );
  const retiredProducts = allProducts.filter(isRetiredPersonalityProduct);
  const retiredKeys = collectRetiredConsumableKeys(
    retiredConsumables,
    retiredProducts
  );
  const retiredProductIds = new Set(
    retiredProducts.map((product) => String(product._id))
  );
  const results = [];

  results.push(
    await unsetLegacyFields(
      accountsConnection.db.collection('player-olings'),
      {
        $or: LEGACY_OLING_SNAPSHOT_FIELDS.map((field) => ({
          [field]: { $exists: true }
        }))
      },
      Object.fromEntries(
        LEGACY_OLING_SNAPSHOT_FIELDS.map((field) => [field, ''])
      ),
      { apply }
    )
  );
  results.push(
    await unsetLegacyFields(
      olingsConnection.db.collection('oling-eggs'),
      { personalityPool: { $exists: true } },
      { personalityPool: '' },
      { apply }
    )
  );
  results.push(
    await unsetLegacyFields(
      olingsConnection.db.collection('oling-hatch-receipts'),
      { 'rolls.personality': { $exists: true } },
      { 'rolls.personality': '' },
      { apply }
    )
  );

  for (const collectionName of [
    'oling-battle-matches',
    'oling-battle-archives'
  ]) {
    results.push(
      await migrateSnapshotCollection(
        olingsConnection.db.collection(collectionName),
        cleanBattlePlayers,
        { apply }
      )
    );
  }
  for (const collectionName of [
    'oling-clash-matches',
    'oling-clash-archives'
  ]) {
    results.push(
      await migrateSnapshotCollection(
        olingsConnection.db.collection(collectionName),
        cleanClashPlayers,
        { apply }
      )
    );
  }

  results.push(
    await migrateProjectedDocuments(
      accountsConnection.db.collection('accounts'),
      { olings: 1, shop: 1 },
      (account) =>
        cleanAccountDocument(account, retiredKeys, retiredProductIds),
      { apply }
    )
  );
  results.push(
    await migrateProjectedDocuments(
      accountsConnection.db.collection('player-oling-states'),
      { inventory: 1, lab: 1 },
      (state) => cleanOlingStateDocument(state, retiredKeys),
      { apply }
    )
  );

  const personalityCollections = await Promise.all([
    removeCollection(olingsConnection.db, 'oling-personalities', { apply }),
    removeCollection(accountsConnection.db, 'oling-personalities', { apply })
  ]);

  let deletedConsumables = 0;
  let deletedProducts = 0;
  if (apply) {
    if (retiredConsumables.length > 0) {
      const result = await consumableCollection.deleteMany({
        _id: { $in: retiredConsumables.map((item) => item._id) }
      });
      deletedConsumables = result.deletedCount;
    }
    if (retiredProducts.length > 0) {
      const result = await productCollection.deleteMany({
        _id: { $in: retiredProducts.map((item) => item._id) }
      });
      deletedProducts = result.deletedCount;
    }

    const oJuiceConsumable = getOJuiceConsumable();
    await OlingConsumable.findOneAndUpdate(
      { key: O_JUICE_KEY },
      { $set: oJuiceConsumable },
      { new: true, runValidators: true, upsert: true }
    );
    const oJuiceProduct = createOJuiceProduct();
    await Product.findOneAndUpdate(
      {
        $or: [{ slug: O_JUICE_KEY }, { 'identity.slug': O_JUICE_KEY }]
      },
      { $set: oJuiceProduct },
      { new: true, runValidators: true, upsert: true }
    );
  }

  const [storedOJuiceConsumable, storedOJuiceProduct] = await Promise.all([
    consumableCollection.findOne({ key: O_JUICE_KEY }),
    productCollection.findOne({
      $or: [{ slug: O_JUICE_KEY }, { 'identity.slug': O_JUICE_KEY }]
    })
  ]);
  const remainingRetiredConsumables = (
    await consumableCollection.find({}).toArray()
  ).filter(isRetiredPersonalityConsumable);
  const remainingRetiredProducts = (
    await productCollection.find({}).toArray()
  ).filter(isRetiredPersonalityProduct);

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        retiredConsumableKeys: [...retiredKeys].sort(),
        retiredConsumables: {
          wouldDelete: retiredConsumables.length,
          deleted: deletedConsumables,
          keys: retiredConsumables.map((item) => item.key).sort()
        },
        retiredProducts: {
          wouldDelete: retiredProducts.length,
          deleted: deletedProducts,
          slugs: retiredProducts
            .map((item) => item.identity?.slug || item.slug)
            .filter(Boolean)
            .sort()
        },
        oJuice: {
          wouldUpsertConsumable: 1,
          wouldUpsertProduct: 1,
          upserted: apply
        },
        verification: {
          remainingRetiredConsumables: remainingRetiredConsumables.length,
          remainingRetiredProducts: remainingRetiredProducts.length,
          oJuiceConsumable: storedOJuiceConsumable
            ? {
                effectType: storedOJuiceConsumable.effect?.type || null,
                restoreToEnergy:
                  Number(storedOJuiceConsumable.effect?.restoreToEnergy) || null
              }
            : null,
          oJuiceProduct: storedOJuiceProduct
            ? {
                slug:
                  storedOJuiceProduct.identity?.slug ||
                  storedOJuiceProduct.slug ||
                  null,
                grantKey:
                  storedOJuiceProduct.digitalEntitlement?.grants?.[0]?.key ||
                  null,
                effectType:
                  storedOJuiceProduct.digitalEntitlement?.grants?.[0]?.metadata
                    ?.effectType || null
              }
            : null
        },
        personalityCollections,
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
        shopConnection
      } = require('../server/models');
      await Promise.all([
        accountsConnection.close().catch(() => {}),
        olingsConnection.close().catch(() => {}),
        shopConnection.close().catch(() => {}),
        mongoose.disconnect().catch(() => {})
      ]);
    });
}

module.exports = {
  LEGACY_OLING_SNAPSHOT_FIELDS,
  LEGACY_PERSONALITY_CONSUMABLE_KEYS,
  cleanAccountDocument,
  cleanBattlePlayers,
  cleanClashPlayers,
  cleanConsumableInventory,
  cleanInfluenceSlots,
  cleanLab,
  cleanOlingStateDocument,
  collectRetiredConsumableKeys,
  getDatabaseUri,
  getProductGrants,
  hasPersonalityMarker,
  isPersonalityGrant,
  isRetiredPersonalityConsumable,
  isRetiredPersonalityProduct,
  main,
  normalizeKey,
  removeLegacyOlingSnapshotFields
};

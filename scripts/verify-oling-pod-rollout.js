require('dotenv').config();

const mongoose = require('mongoose');

const {
  Account,
  OlingState,
  PlayerOling,
  Product,
  accountsConnection,
  shopConnection
} = require('../server/models');
const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_POD_RELEASE_OUTCOMES
} = require('../models/olings/oling-storage-contract');

const PRODUCT_SLUG = 'oling_pod';
const ACTIVE_SLOT_INDEX = 'owner_active_oling_lab_slot';

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function normalizePodInventory(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      key: String(item?.key || '')
        .trim()
        .toLowerCase(),
      rarity: String(item?.rarity || 'common')
        .trim()
        .toLowerCase(),
      quantity: Number(item?.quantity || 0),
      metadata: item?.metadata || {}
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function auditRollout({ accounts, states, olings, products, indexes }) {
  const errors = [];
  const product = products[0];
  const grant = product?.digitalEntitlement?.grants?.find(
    (entry) => entry?.type === 'oling_pod' && entry?.key === PRODUCT_SLUG
  );

  if (products.length !== 1) {
    errors.push(
      `Expected one ${PRODUCT_SLUG} product; found ${products.length}.`
    );
  }
  if (
    !product ||
    product?.publishing?.status !== 'active' ||
    product?.publishing?.visibility !== 'public' ||
    product?.publishing?.isActive !== true
  ) {
    errors.push('The Oling Pod product is not active and public.');
  }
  if (Number(product?.digitalEntitlement?.opalPrice?.amount) !== 75) {
    errors.push('The Oling Pod product does not cost 75 Opals.');
  }
  if (!grant || Number(grant.quantity) !== 1) {
    errors.push('The Oling Pod product does not grant one oling_pod item.');
  }
  if (
    grant?.metadata?.lifecycle !== 'one-use' ||
    grant?.metadata?.releaseOutcome !== 'destroy'
  ) {
    errors.push('The Oling Pod product lifecycle is not one-use/destroy.');
  }

  const statesByOwner = new Map(
    states.map((state) => [String(state.ownerId), state])
  );
  const olingsByOwner = new Map();
  olings.forEach((oling) => {
    const ownerId = String(oling.ownerId);
    const ownerOlings = olingsByOwner.get(ownerId) || [];
    ownerOlings.push(oling);
    olingsByOwner.set(ownerId, ownerOlings);
  });

  let activeOlings = 0;
  let storedOlings = 0;
  let activeAdventures = 0;

  accounts.forEach((account) => {
    const ownerId = String(account._id);
    const state = statesByOwner.get(ownerId);
    if (!state) errors.push(`Account ${ownerId} has no OlingState document.`);

    const accountPods = normalizePodInventory(account?.olings?.pods);
    const statePods = normalizePodInventory(state?.inventory?.pods);
    if (JSON.stringify(accountPods) !== JSON.stringify(statePods)) {
      errors.push(`Account ${ownerId} has unsynchronised pod inventories.`);
    }

    const ownerOlings = olingsByOwner.get(ownerId) || [];
    const active = ownerOlings.filter(
      (oling) => oling?.residency?.state !== 'stored'
    );
    const stored = ownerOlings.filter(
      (oling) => oling?.residency?.state === 'stored'
    );
    activeOlings += active.length;
    storedOlings += stored.length;

    if (active.length > OLING_LAB_ACTIVE_LIMIT) {
      errors.push(
        `Account ${ownerId} has ${active.length} active Olings; limit is ${OLING_LAB_ACTIVE_LIMIT}.`
      );
    }

    const slots = active.map((oling) => Number(oling?.residency?.labSlot));
    if (
      slots.some(
        (slot) =>
          !Number.isInteger(slot) || slot < 1 || slot > OLING_LAB_ACTIVE_LIMIT
      ) ||
      new Set(slots).size !== slots.length
    ) {
      errors.push(`Account ${ownerId} has invalid or duplicate active slots.`);
    }
    if (active.some((oling) => Boolean(oling?.residency?.pod))) {
      errors.push(`Account ${ownerId} has an active Oling assigned to a pod.`);
    }

    stored.forEach((oling) => {
      const pod = oling?.residency?.pod;
      if (
        oling?.residency?.labSlot != null ||
        !pod?.key ||
        !Number.isInteger(Number(pod?.definitionRevision)) ||
        Number(pod.definitionRevision) < 1 ||
        !OLING_POD_RELEASE_OUTCOMES.includes(pod?.releaseOutcome) ||
        !pod?.storedAt
      ) {
        errors.push(`Stored Oling ${oling._id} has an invalid pod snapshot.`);
      }
    });

    const adventureOlingId = String(
      account?.olings?.adventures?.active?.olingId || ''
    );
    if (adventureOlingId) {
      activeAdventures += 1;
      const adventureOling = ownerOlings.find(
        (oling) => String(oling._id) === adventureOlingId
      );
      if (!adventureOling) {
        errors.push(
          `Account ${ownerId} has an adventure for an unknown Oling.`
        );
      } else if (adventureOling?.residency?.state === 'stored') {
        errors.push(`Account ${ownerId} has a stored Oling on an adventure.`);
      }
    }
  });

  const slotIndex = indexes.find((index) => index.name === ACTIVE_SLOT_INDEX);
  if (!slotIndex?.unique || !slotIndex?.partialFilterExpression) {
    errors.push(`The ${ACTIVE_SLOT_INDEX} unique partial index is missing.`);
  }

  return {
    ok: errors.length === 0,
    accounts: accounts.length,
    olingStates: states.length,
    olings: olings.length,
    activeOlings,
    storedOlings,
    activeAdventures,
    product: product?.identity?.slug || null,
    errors
  };
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (
    (!process.env.MONGO_URI_ACCOUNTS && !baseUri) ||
    (!process.env.MONGO_URI_SHOP && !baseUri)
  ) {
    throw new Error('Missing configured accounts or shop MongoDB URI.');
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');
  const shopUri =
    process.env.MONGO_URI_SHOP ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_SHOP || 'shop');

  await Promise.all([
    accountsConnection.openUri(accountsUri, {
      serverSelectionTimeoutMS: 15000
    }),
    shopConnection.openUri(shopUri, { serverSelectionTimeoutMS: 15000 })
  ]);

  const [accounts, states, olings, products, indexes] = await Promise.all([
    Account.find({}).select('_id olings.pods olings.adventures.active').lean(),
    OlingState.find({}).select('ownerId inventory.pods').lean(),
    PlayerOling.find({}).select('ownerId residency').lean(),
    Product.find({ 'identity.slug': PRODUCT_SLUG }).lean(),
    PlayerOling.collection.indexes()
  ]);

  const result = auditRollout({ accounts, states, olings, products, indexes });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await Promise.all([
        accountsConnection.close().catch(() => {}),
        shopConnection.close().catch(() => {})
      ]);
      await mongoose.disconnect().catch(() => {});
    });
}

module.exports = {
  ACTIVE_SLOT_INDEX,
  PRODUCT_SLUG,
  auditRollout,
  getDatabaseUri,
  main,
  normalizePodInventory
};

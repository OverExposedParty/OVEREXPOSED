require('dotenv').config();

const mongoose = require('mongoose');

const { Account, accountsConnection } = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  try {
    const parsedUri = new URL(baseUri);
    parsedUri.pathname = `/${dbName}`;
    return parsedUri.toString();
  } catch (error) {
    console.warn(
      `Could not derive "${dbName}" MongoDB URI from base URI:`,
      error.message || error
    );
    return baseUri;
  }
}

function toPositiveInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function addQuantity(map, key, quantity) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return;
  map.set(
    normalizedKey,
    (map.get(normalizedKey) || 0) + toPositiveInteger(quantity)
  );
}

function getList(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function collectPurchasedEggs(account) {
  const purchased = new Map();
  const transactions = Array.isArray(account?.gameData?.opalTransactions)
    ? account.gameData.opalTransactions
    : [];

  transactions.forEach((transaction) => {
    if (transaction?.sourceType !== 'shop_purchase') return;

    const grants = Array.isArray(transaction?.metadata?.grants)
      ? transaction.metadata.grants
      : [];

    grants.forEach((grant) => {
      if (grant?.type !== 'oling_egg') return;
      addQuantity(purchased, grant.key, grant.quantity || 1);
    });
  });

  return purchased;
}

function collectHatchedEggs(account) {
  const hatched = new Map();
  const hatchHistory = getList(
    account?.olings?.hatchHistory,
    account?.gameData?.olingInventory?.hatchHistory
  );

  hatchHistory.forEach((entry) => {
    addQuantity(hatched, entry?.eggKey, 1);
  });

  return hatched;
}

function mergeEggInventory(account, purchasedEggs, hatchedEggs, now) {
  const existingEggs = getList(
    account?.olings?.eggs,
    account?.gameData?.olingInventory?.eggs
  )
    .map((egg) => ({
      key: normalizeKey(egg?.key),
      quantity: toPositiveInteger(egg?.quantity),
      acquiredAt: egg?.acquiredAt || now,
      lastUpdatedAt: egg?.lastUpdatedAt || now,
      metadata: egg?.metadata || {}
    }))
    .filter((egg) => egg.key);
  const nextEggs = [...existingEggs];

  purchasedEggs.forEach((purchasedQuantity, key) => {
    const expectedQuantity = Math.max(
      0,
      purchasedQuantity - (hatchedEggs.get(key) || 0)
    );
    const existing = nextEggs.find((egg) => egg.key === key);

    if (existing) {
      if (existing.quantity >= expectedQuantity) return;
      existing.quantity = expectedQuantity;
      existing.lastUpdatedAt = now;
      existing.metadata = {
        ...existing.metadata,
        repairedFromOpalPurchasesAt: now
      };
      return;
    }

    if (expectedQuantity <= 0) return;

    nextEggs.push({
      key,
      quantity: expectedQuantity,
      acquiredAt: now,
      lastUpdatedAt: now,
      metadata: {
        source: 'opals',
        repairedFromOpalPurchasesAt: now
      }
    });
  });

  return nextEggs;
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_ACCOUNTS || process.env.MONGO_URI_OVEREXPOSURE;

  if (!baseUri) {
    throw new Error(
      'Missing MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');
  const accountId = String(process.env.ACCOUNT_ID || '').trim();
  const query = {
    'gameData.opalTransactions.metadata.grants.type': 'oling_egg',
    ...(accountId ? { _id: accountId } : {})
  };
  const now = new Date();
  let scanned = 0;
  let repaired = 0;

  await accountsConnection.openUri(accountsUri);

  const cursor = Account.find(query).cursor();
  for await (const account of cursor) {
    scanned += 1;

    const purchasedEggs = collectPurchasedEggs(account);
    if (!purchasedEggs.size) continue;

    const nextEggs = mergeEggInventory(
      account,
      purchasedEggs,
      collectHatchedEggs(account),
      now
    );
    const currentEggs = getList(account?.olings?.eggs);
    const changed = JSON.stringify(currentEggs) !== JSON.stringify(nextEggs);

    if (!changed) continue;

    await Account.updateOne(
      { _id: account._id },
      {
        $set: {
          'olings.eggs': nextEggs
        }
      }
    );
    repaired += 1;
    console.log(`Repaired Oling egg inventory for ${account._id}.`);
  }

  console.log(`Scanned ${scanned} account(s); repaired ${repaired}.`);
}

main()
  .catch((error) => {
    console.error('Failed to repair Oling egg inventory:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await accountsConnection.close().catch(() => {});
  });

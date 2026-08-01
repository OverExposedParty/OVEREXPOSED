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

function getList(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function getLab(account) {
  const lab = account?.olings?.lab || account?.gameData?.olingLab;
  return lab && Array.isArray(lab.placedItems) ? lab : {};
}

function buildOlingState(account) {
  const inventory = account?.gameData?.olingInventory || {};
  const currentOlings =
    account?.olings && !Array.isArray(account.olings) ? account.olings : {};

  return {
    eggs: getList(currentOlings.eggs, inventory.eggs),
    consumables: getList(currentOlings.consumables, inventory.consumables),
    furniture: getList(currentOlings.furniture, inventory.furniture),
    olings: getList(currentOlings.olings, currentOlings.pets, inventory.pets),
    hatchHistory: getList(currentOlings.hatchHistory, inventory.hatchHistory),
    lab: getLab(account)
  };
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!process.env.MONGO_URI_ACCOUNTS && !baseUri) {
    throw new Error(
      'Missing MongoDB URI. Set MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE.'
    );
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');

  await accountsConnection.openUri(accountsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const accounts = await Account.find({}).limit(2);
  if (accounts.length !== 1) {
    throw new Error(
      `Expected exactly one account, found ${accounts.length}. Refusing to update.`
    );
  }

  const account = accounts[0];
  const beforeType = Array.isArray(account.olings)
    ? 'array'
    : typeof account.olings;
  const nextOlings = buildOlingState(account);

  account.set('olings', nextOlings);
  account.markModified('olings');
  await account.save();

  console.log(
    JSON.stringify(
      {
        updated: true,
        accountId: String(account._id),
        beforeType,
        afterKeys: Object.keys(nextOlings),
        inventoryCounts: {
          eggs: nextOlings.eggs.length,
          consumables: nextOlings.consumables.length,
          furniture: nextOlings.furniture.length,
          olings: nextOlings.olings.length,
          hatchHistory: nextOlings.hatchHistory.length
        },
        labPlacedItems: Array.isArray(nextOlings.lab?.placedItems)
          ? nextOlings.lab.placedItems.length
          : 0
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await accountsConnection.close().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });

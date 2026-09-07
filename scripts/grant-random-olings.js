require('dotenv').config();

const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const models = require('../server/models');
const {
  hatchOling,
  getOrCreateOlingState
} = require('../server/services/olings');

const CONFIRM_FLAG = '--confirm';
const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;
const EGG_KEY = 'base-egg';

function getArgument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function getDatabaseUris() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const accountsBaseUri = process.env.MONGO_URI_ACCOUNTS || baseUri;
  const olingsBaseUri = process.env.MONGO_URI_OLINGS || baseUri;
  if (!accountsBaseUri || !olingsBaseUri) {
    throw new Error(
      'Missing MongoDB URI. Configure the accounts and Olings database connections.'
    );
  }

  return {
    accountsUri:
      process.env.MONGO_URI_ACCOUNTS ||
      getDatabaseUri(
        accountsBaseUri,
        process.env.MONGO_DB_ACCOUNTS || 'accounts'
      ),
    olingsUri:
      process.env.MONGO_URI_OLINGS ||
      getDatabaseUri(olingsBaseUri, process.env.MONGO_DB_OLINGS || 'olings')
  };
}

function toPlain(value) {
  if (!value) return value;
  return typeof value.toObject === 'function'
    ? value.toObject({ depopulate: true })
    : structuredClone(value);
}

async function restoreAccountOlingSetup(accountId, snapshot) {
  if (!accountId || !snapshot) return;
  await models.Account.updateOne(
    { _id: accountId },
    {
      $set: {
        'olings.eggs': snapshot.eggs,
        'olings.lab': snapshot.lab
      }
    },
    { runValidators: false }
  );
}

async function removeCreatedRecords(accountId, created) {
  const olingIds = created.map(({ olingId }) => olingId).filter(Boolean);
  const receiptIds = created.map(({ receiptId }) => receiptId).filter(Boolean);
  await Promise.all([
    receiptIds.length
      ? models.OlingHatchReceipt.deleteMany({
          _id: { $in: receiptIds },
          ownerId: accountId
        })
      : Promise.resolve(),
    olingIds.length
      ? models.PlayerOling.deleteMany({
          _id: { $in: olingIds },
          ownerId: accountId
        })
      : Promise.resolve()
  ]);
}

async function grantTemporaryEggs(account, quantity, operationId) {
  const inventoryEgg = account.olings.eggs.find(
    ({ key }) => String(key).toLowerCase() === EGG_KEY
  );
  const now = new Date();
  if (inventoryEgg) {
    inventoryEgg.quantity = Number(inventoryEgg.quantity || 0) + quantity;
    inventoryEgg.lastUpdatedAt = now;
  } else {
    account.olings.eggs.push({
      key: EGG_KEY,
      quantity,
      acquiredAt: now,
      lastUpdatedAt: now,
      metadata: { source: 'clash_test_data', operationId }
    });
  }
  account.markModified('olings.eggs');
  await account.save({ validateBeforeSave: false });
}

async function main() {
  const username = String(getArgument('--username')).trim().toLowerCase();
  const count = Number.parseInt(getArgument('--count', DEFAULT_COUNT), 10);
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to write without ${CONFIRM_FLAG}.`);
  }
  if (!username) throw new Error('Provide an exact username with --username.');
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    throw new Error(`--count must be an integer between 1 and ${MAX_COUNT}.`);
  }

  const { accountsUri, olingsUri } = getDatabaseUris();
  await Promise.all([
    models.accountsConnection.openUri(accountsUri, {
      serverSelectionTimeoutMS: 15000
    }),
    models.olingsConnection.openUri(olingsUri, {
      serverSelectionTimeoutMS: 15000
    })
  ]);

  const account = await models.Account.findOne({ username });
  if (!account) throw new Error(`Account "${username}" was not found.`);
  const duplicate = await models.Account.find({ username }).limit(2).lean();
  if (duplicate.length !== 1) {
    throw new Error(
      `Expected one exact account for "${username}", found ${duplicate.length}.`
    );
  }
  const egg = await models.OlingEgg.findOne({
    key: EGG_KEY,
    enabled: true,
    status: 'published'
  }).lean();
  if (!egg) throw new Error(`Published egg "${EGG_KEY}" was not found.`);

  await getOrCreateOlingState(models.OlingState, account);
  const preparedAccount = await models.Account.findById(account._id);
  const accountSnapshot = {
    eggs: preparedAccount.olings.eggs.map(toPlain),
    lab: toPlain(preparedAccount.olings.lab)
  };
  const operationId = randomUUID();
  const created = [];

  try {
    await grantTemporaryEggs(preparedAccount, count, operationId);
    for (let index = 0; index < count; index += 1) {
      const result = await hatchOling({
        models,
        accountId: account._id,
        eggKey: EGG_KEY,
        request: { userAgent: `clash-test-data/${operationId}` }
      });
      if (result.error) throw new Error(result.error.message);

      const metadata = {
        source: 'clash_test_data',
        operationId,
        requestedFor: username
      };
      result.oling.set('metadata', metadata);
      result.receipt.set('metadata', metadata);
      const createdRecord = {
        olingId: result.oling._id,
        receiptId: result.receipt._id,
        build: toPlain(result.oling.build),
        buildRarities: toPlain(result.oling.buildRarities)
      };
      created.push(createdRecord);
      await Promise.all([
        result.oling.save({ validateBeforeSave: false }),
        result.receipt.save({ validateBeforeSave: false })
      ]);
    }
  } catch (error) {
    await removeCreatedRecords(account._id, created);
    throw error;
  } finally {
    await restoreAccountOlingSetup(account._id, accountSnapshot);
  }

  console.log(
    JSON.stringify(
      {
        accountId: String(account._id),
        username,
        operationId,
        created: created.map((item) => ({
          ...item,
          olingId: String(item.olingId),
          receiptId: String(item.receiptId)
        }))
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
    await Promise.allSettled([
      models.accountsConnection.close(),
      models.olingsConnection.close()
    ]);
    await mongoose.disconnect().catch(() => {});
  });

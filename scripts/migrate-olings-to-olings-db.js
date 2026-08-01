require('dotenv').config();

const mongoose = require('mongoose');

const { accountsConnection, olingsConnection } = require('../server/models');

const OLING_COLLECTIONS = [
  'oling-build-sets',
  'oling-eggs',
  'oling-hatch-receipts',
  'oling-personalities',
  'oling-traits'
];

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function copyCollection({ sourceDb, targetDb, collectionName }) {
  const source = sourceDb.collection(collectionName);
  const target = targetDb.collection(collectionName);
  const docs = await source.find({}).toArray();

  if (!docs.length) {
    return { collectionName, copied: 0, skipped: true };
  }

  await target.deleteMany({});
  await target.insertMany(docs, { ordered: false });

  return { collectionName, copied: docs.length, skipped: false };
}

async function main() {
  const dropSource = process.argv.includes('--drop-source');
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;

  if (
    !baseUri &&
    (!process.env.MONGO_URI_ACCOUNTS || !process.env.MONGO_URI_OLINGS)
  ) {
    throw new Error(
      'Missing MongoDB URI. Set MONGO_URI_OVEREXPOSURE or both MONGO_URI_ACCOUNTS and MONGO_URI_OLINGS.'
    );
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');
  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await Promise.all([
    accountsConnection.openUri(accountsUri, {
      serverSelectionTimeoutMS: 15000
    }),
    olingsConnection.openUri(olingsUri, { serverSelectionTimeoutMS: 15000 })
  ]);

  const results = [];
  for (const collectionName of OLING_COLLECTIONS) {
    results.push(
      await copyCollection({
        sourceDb: accountsConnection.db,
        targetDb: olingsConnection.db,
        collectionName
      })
    );
  }

  if (dropSource) {
    for (const collectionName of OLING_COLLECTIONS) {
      await accountsConnection.db
        .collection(collectionName)
        .drop()
        .catch((err) => {
          if (err?.codeName !== 'NamespaceNotFound') throw err;
        });
    }
  }

  console.log(
    JSON.stringify(
      {
        copiedTo: process.env.MONGO_DB_OLINGS || 'olings',
        droppedSource: dropSource,
        results
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
    await Promise.all([
      accountsConnection.close().catch(() => {}),
      olingsConnection.close().catch(() => {}),
      mongoose.disconnect().catch(() => {})
    ]);
  });

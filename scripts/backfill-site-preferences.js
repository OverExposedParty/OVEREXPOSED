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

  await accountsConnection.openUri(accountsUri);

  const result = await Account.updateMany(
    {
      $or: [
        { 'profile.sitePreferences.soundEnabled': { $exists: false } },
        { 'profile.sitePreferences.nsfwEnabled': { $exists: false } },
        { 'profile.sitePreferences.consoleEnabled': { $exists: false } }
      ]
    },
    [
      {
        $set: {
          'profile.sitePreferences.soundEnabled': {
            $ifNull: ['$profile.sitePreferences.soundEnabled', true]
          },
          'profile.sitePreferences.nsfwEnabled': {
            $ifNull: ['$profile.sitePreferences.nsfwEnabled', false]
          },
          'profile.sitePreferences.consoleEnabled': {
            $ifNull: ['$profile.sitePreferences.consoleEnabled', false]
          }
        }
      }
    ]
  );

  console.log(
    `Backfilled site preferences on ${result.modifiedCount} account(s).`
  );
}

main()
  .catch((error) => {
    console.error('Failed to backfill site preferences:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await accountsConnection.close().catch(() => {});
  });

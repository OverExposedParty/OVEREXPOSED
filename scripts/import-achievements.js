require('dotenv').config();

const mongoose = require('mongoose');
const {
  hardMigrateAchievementsFromJson
} = require('../server/services/achievements');
const {
  Achievement,
  AchievementRewardClaim,
  accountsConnection,
  socialConnection
} = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const socialBaseUri = process.env.MONGO_URI_SOCIAL || baseUri;
  const accountsBaseUri = process.env.MONGO_URI_ACCOUNTS || baseUri;
  if (!socialBaseUri || !accountsBaseUri) {
    throw new Error('MongoDB social and accounts URIs must be configured.');
  }

  const socialUri =
    process.env.MONGO_URI_SOCIAL ||
    getDatabaseUri(socialBaseUri, process.env.MONGO_DB_SOCIAL || 'social');
  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(
      accountsBaseUri,
      process.env.MONGO_DB_ACCOUNTS || 'accounts'
    );

  await Promise.all([
    socialConnection.openUri(socialUri),
    accountsConnection.openUri(accountsUri)
  ]);
  await AchievementRewardClaim.createIndexes();

  const result = await hardMigrateAchievementsFromJson(Achievement);
  console.log(
    `Imported ${result.imported.length} achievements, removed ${result.legacyFieldsRemoved} legacy reward fields, and removed ${result.staleAchievementsRemoved} stale achievements.`
  );
}

main()
  .catch((error) => {
    console.error('Failed to import achievements:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await accountsConnection.close();
    await socialConnection.close();
  });

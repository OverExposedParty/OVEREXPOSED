require('dotenv').config();

const mongoose = require('mongoose');
const {
  importAchievementsFromJson
} = require('../server/services/achievements');
const {
  Account,
  Achievement,
  accountsConnection,
  socialConnection
} = require('../server/models');

const OLD_KEY = 'lone-wolf';
const NEW_KEY = 'isolation';
const OLD_STAT_KEY = 'loneWolf';
const NEW_STAT_KEY = 'isolation';

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function connectDatabases() {
  const socialBaseUri =
    process.env.MONGO_URI_SOCIAL || process.env.MONGO_URI_OVEREXPOSURE;
  const accountsBaseUri =
    process.env.MONGO_URI_ACCOUNTS || process.env.MONGO_URI_OVEREXPOSURE;

  if (!socialBaseUri) {
    throw new Error('Missing MONGO_URI_SOCIAL or MONGO_URI_OVEREXPOSURE.');
  }
  if (!accountsBaseUri) {
    throw new Error('Missing MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE.');
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
}

async function renameAchievementDocument() {
  await importAchievementsFromJson(Achievement);
  const result = await Achievement.deleteMany({ key: OLD_KEY });
  return result.deletedCount || 0;
}

async function renameAccountUnlocks(path) {
  const result = await Account.updateMany(
    { [`${path}.key`]: OLD_KEY },
    { $set: { [`${path}.$[unlock].key`]: NEW_KEY } },
    { arrayFilters: [{ 'unlock.key': OLD_KEY }] }
  );
  return result.modifiedCount || 0;
}

async function renameAccountAchievementStats() {
  const result = await Account.collection.updateMany(
    { [`gameData.achievementStats.${OLD_STAT_KEY}`]: { $exists: true } },
    [
      {
        $set: {
          [`gameData.achievementStats.${NEW_STAT_KEY}`]: {
            $max: [
              { $ifNull: [`$gameData.achievementStats.${NEW_STAT_KEY}`, 0] },
              { $ifNull: [`$gameData.achievementStats.${OLD_STAT_KEY}`, 0] }
            ]
          }
        }
      },
      { $unset: `gameData.achievementStats.${OLD_STAT_KEY}` }
    ]
  );
  return result.modifiedCount || 0;
}

async function main() {
  await connectDatabases();

  const deletedOldAchievements = await renameAchievementDocument();
  const achievementUnlocksUpdated = await renameAccountUnlocks(
    'gameData.achievements'
  );
  const purchaseUnlocksUpdated = await renameAccountUnlocks(
    'gameData.inGamePurchasesAndUnlocks'
  );
  const statsUpdated = await renameAccountAchievementStats();

  console.log(
    [
      `Achievement rows removed for ${OLD_KEY}: ${deletedOldAchievements}`,
      `Account achievement unlocks renamed: ${achievementUnlocksUpdated}`,
      `Account purchase/unlock entries renamed: ${purchaseUnlocksUpdated}`,
      `Account achievement stats renamed: ${statsUpdated}`
    ].join('\n')
  );
}

main()
  .catch((error) => {
    console.error('Failed to rename Lone Wolf achievement:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await Promise.all([
      accountsConnection.close().catch(() => {}),
      socialConnection.close().catch(() => {})
    ]);
  });

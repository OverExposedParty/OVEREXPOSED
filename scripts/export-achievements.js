require('dotenv').config();

const mongoose = require('mongoose');
const { exportAchievementsToJson } = require('../server/services/achievements');
const { Achievement, socialConnection } = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_SOCIAL || process.env.MONGO_URI_OVEREXPOSURE;
  const uri =
    process.env.MONGO_URI_SOCIAL ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_SOCIAL || 'social');

  await socialConnection.openUri(uri);

  const exported = await exportAchievementsToJson(Achievement);
  console.log(`Exported ${exported.length} achievements to local JSON.`);
}

main()
  .catch((error) => {
    console.error('Failed to export achievements:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await socialConnection.close();
  });

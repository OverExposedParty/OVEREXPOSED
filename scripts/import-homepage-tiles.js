require('dotenv').config();

const mongoose = require('mongoose');
const { importHomepageTiles } = require('../server/services/homepage-tiles');
const { HomepageTile, siteContentConnection } = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_SITE_CONTENT || process.env.MONGO_URI_OVEREXPOSURE;
  if (!baseUri) {
    throw new Error(
      'MONGO_URI_SITE_CONTENT or MONGO_URI_OVEREXPOSURE is required.'
    );
  }

  const uri =
    process.env.MONGO_URI_SITE_CONTENT ||
    getDatabaseUri(
      baseUri,
      process.env.MONGO_DB_SITE_CONTENT || 'site-content'
    );

  await siteContentConnection.openUri(uri);
  const imported = await importHomepageTiles(HomepageTile);
  console.log(
    `Migrated ${imported.length} homepage tiles into site-content.homepage-tiles.`
  );
}

main()
  .catch((error) => {
    console.error('Failed to migrate homepage tiles:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await siteContentConnection.close();
  });

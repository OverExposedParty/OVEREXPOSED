require('dotenv').config();

const mongoose = require('mongoose');
const { importOeImagesFromJson } = require('../server/services/oe-images');
const {
  OeCustomisation,
  oeCustomisationConnection
} = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_OE_CUSTOMISATION ||
    process.env.MONGO_URI_OVEREXPOSURE;
  const uri =
    process.env.MONGO_URI_OE_CUSTOMISATION ||
    getDatabaseUri(
      baseUri,
      process.env.MONGO_DB_OE_CUSTOMISATION || 'oe-customisation'
    );

  await oeCustomisationConnection.openUri(uri);

  const imported = await importOeImagesFromJson(OeCustomisation);
  console.log(
    `Imported ${imported.packs.length} OE image packs and ${imported.images.length} OE images into MongoDB.`
  );
}

main()
  .catch((error) => {
    console.error('Failed to import OE images:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await oeCustomisationConnection.close();
  });

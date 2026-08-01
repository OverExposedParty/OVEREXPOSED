require('dotenv').config();

const mongoose = require('mongoose');
const { exportOeImagesToJson } = require('../server/services/oe-images');
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

  const exported = await exportOeImagesToJson(OeCustomisation);
  console.log(
    `Exported ${exported.packs.length} OE image packs and ${exported.images.length} OE images to local JSON files.`
  );
}

main()
  .catch((error) => {
    console.error('Failed to export OE images:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await oeCustomisationConnection.close();
  });

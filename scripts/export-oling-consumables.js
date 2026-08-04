require('dotenv').config();

const mongoose = require('mongoose');

const { OlingConsumable, olingsConnection } = require('../server/models');
const { exportOlingConsumablesToJson } = require('../server/services/olings');

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
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;

  if (!process.env.MONGO_URI_OLINGS && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_OLINGS or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }

  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri);

  const exported = await exportOlingConsumablesToJson(OlingConsumable);
  console.log(`Exported ${exported.length} Oling consumables to local JSON.`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await olingsConnection.close().catch(() => {});
    await mongoose.disconnect();
  });

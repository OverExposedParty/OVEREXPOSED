require('dotenv').config();

const mongoose = require('mongoose');

const OE_CUSTOMISATION_COLLECTIONS_IN_PARTY_GAMES = [
  'oe-image-packs',
  'oe-images',
  'oe-customisation'
];

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_PARTY_GAMES || process.env.MONGO_URI_OVEREXPOSURE;
  const uri =
    process.env.MONGO_URI_PARTY_GAMES ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_PARTY_GAMES || 'party-games');

  const connection = await mongoose.createConnection(uri).asPromise();
  const dropped = [];
  const missing = [];

  for (const collectionName of OE_CUSTOMISATION_COLLECTIONS_IN_PARTY_GAMES) {
    try {
      await connection.db.dropCollection(collectionName);
      dropped.push(collectionName);
    } catch (error) {
      if (error?.codeName === 'NamespaceNotFound' || error?.code === 26) {
        missing.push(collectionName);
        continue;
      }

      throw error;
    }
  }

  console.log(
    JSON.stringify(
      {
        database: connection.db.databaseName,
        dropped,
        missing
      },
      null,
      2
    )
  );

  await connection.close();
}

main()
  .catch((error) => {
    console.error(
      'Failed to drop OE customisation data from Party Games:',
      error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

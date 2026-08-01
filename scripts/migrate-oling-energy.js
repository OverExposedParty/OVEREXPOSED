require('dotenv').config();

const mongoose = require('mongoose');

const { olingsConnection } = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!process.env.MONGO_URI_OLINGS && !baseUri) {
    throw new Error(
      'Missing MONGO_URI_OLINGS or MONGO_URI_OVEREXPOSURE environment variable.'
    );
  }

  const olingsUri =
    process.env.MONGO_URI_OLINGS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_OLINGS || 'olings');

  await olingsConnection.openUri(olingsUri, {
    serverSelectionTimeoutMS: 15000
  });

  const result = await olingsConnection.db
    .collection('player-olings')
    .updateMany({}, [
      {
        $set: {
          care: {
            energy: { $ifNull: ['$care.energy', 100] },
            energyUpdatedAt: {
              $ifNull: [
                '$care.energyUpdatedAt',
                '$updatedAt',
                '$hatchedAt',
                '$$NOW'
              ]
            }
          }
        }
      }
    ]);

  console.log(
    JSON.stringify(
      {
        matched: result.matchedCount,
        modified: result.modifiedCount
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
    await olingsConnection.close().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  });

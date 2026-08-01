require('dotenv').config();

const mongoose = require('mongoose');
const {
  GamePack,
  GameRole,
  GameRule,
  partyGamesConnection
} = require('../server/models');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_PARTY_GAMES || process.env.MONGO_URI_OVEREXPOSURE;
  if (!baseUri) {
    throw new Error(
      'Missing MONGO_URI_PARTY_GAMES or MONGO_URI_OVEREXPOSURE in environment.'
    );
  }
  const uri =
    process.env.MONGO_URI_PARTY_GAMES ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_PARTY_GAMES || 'party-games');

  await partyGamesConnection.openUri(uri);
  const models = [GamePack, GameRule, GameRole];
  const results = await Promise.all(
    models.map((model) =>
      model.updateMany(
        { availability: { $exists: false } },
        {
          $set: {
            availability: {
              mode: 'always',
              timeZone: 'UTC',
              availableFrom: null,
              availableUntil: null,
              annualFrom: null,
              annualUntil: null
            }
          }
        }
      )
    )
  );

  results.forEach((result, index) => {
    console.log(
      `Backfilled ${result.modifiedCount} ${models[index].collection.name} record(s).`
    );
  });
}

main()
  .catch((error) => {
    console.error('Failed to backfill game content availability:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await partyGamesConnection.close().catch(() => {});
  });

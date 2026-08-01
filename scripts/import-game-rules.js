require('dotenv').config();

const mongoose = require('mongoose');
const { importGameRulesFromJson } = require('../server/services/game-rules');
const { GameRule, partyGamesConnection } = require('../server/models');

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

  await partyGamesConnection.openUri(uri);

  const imported = await importGameRulesFromJson(GameRule);
  console.log(`Imported ${imported.length} game rules into MongoDB.`);
}

main()
  .catch((error) => {
    console.error('Failed to import game rules:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await partyGamesConnection.close();
  });

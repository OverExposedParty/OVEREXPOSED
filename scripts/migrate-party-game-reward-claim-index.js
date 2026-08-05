require('dotenv').config();

const mongoose = require('mongoose');
const {
  migratePartyGameRewardClaimIndex
} = require('./lib/party-game-reward-claim-index');

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
      'MONGO_URI_PARTY_GAMES or MONGO_URI_OVEREXPOSURE is required.'
    );
  }

  const partyGamesUri =
    process.env.MONGO_URI_PARTY_GAMES ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_PARTY_GAMES || 'party-games');
  const connection = await mongoose.createConnection(partyGamesUri).asPromise();

  try {
    const result = await migratePartyGameRewardClaimIndex(
      connection.collection('party-game-reward-claims')
    );
    console.log(
      result.changed
        ? 'Migrated the party-game reward claim index successfully.'
        : 'The party-game reward claim index is already correct.'
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to migrate the party-game reward claim index:', error);
  process.exitCode = 1;
});

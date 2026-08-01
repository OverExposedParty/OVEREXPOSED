require('dotenv').config();

const mongoose = require('mongoose');
const {
  activePartyOwnerLeaseSchema,
  GamePack,
  GameRole,
  GameRule,
  partyGameChatLogSchema,
  partyGameMafiaSchema,
  waitingRoomSchema,
  partyGamesConnection
} = require('../server/models');
const {
  readMafiaRoleKeys,
  runMafiaRoleHardCutover
} = require('./lib/mafia-role-hard-cutover');

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

  const uri =
    process.env.MONGO_URI_PARTY_GAMES ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_PARTY_GAMES || 'party-games');
  const terminateActiveRooms = process.argv.includes(
    '--terminate-active-mafia-rooms'
  );

  await partyGamesConnection.openUri(uri);

  const expectedRoleKeys = await readMafiaRoleKeys();
  const result = await runMafiaRoleHardCutover({
    expectedRoleKeys,
    terminateActiveRooms,
    models: {
      GamePack,
      GameRole,
      GameRule,
      PartyGameMafia: partyGameMafiaSchema,
      WaitingRoom: waitingRoomSchema,
      PartyGameChatLog: partyGameChatLogSchema,
      ActivePartyOwnerLease: activePartyOwnerLeaseSchema
    }
  });

  console.log(
    [
      `Imported ${result.importedRoles} Mafia role catalog entries.`,
      `Deleted ${result.deletedStaleRoles} stale role entries.`,
      `Deleted ${result.deletedPacks} retired role packs.`,
      `Deleted ${result.deletedRules} retired role rules.`,
      `Terminated ${result.deletedGameRooms} active Mafia game rooms`,
      `and ${result.deletedWaitingRooms} waiting-room projections.`,
      'Post-migration verification passed.'
    ].join(' ')
  );
}

main()
  .catch((error) => {
    console.error('Failed to migrate Mafia roles:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    await partyGamesConnection.close();
  });

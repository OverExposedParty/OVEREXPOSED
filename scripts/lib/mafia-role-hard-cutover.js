const fs = require('fs/promises');
const path = require('path');
const { importGameRolesFromJson } = require('../../server/services/game-roles');

const RETIRED_MAFIA_ROLE_PACK_KEYS = Object.freeze([
  'mafioso',
  'inspector',
  'godfather',
  'mayor',
  'serial-killer',
  'lawyer'
]);
const RETIRED_MAFIA_ROLE_RULE_KEYS = Object.freeze(['mafioso', 'inspector']);

const DEFAULT_MAFIA_ROLE_CATALOG_PATH = path.join(
  process.cwd(),
  'public',
  'json-files',
  'party-games',
  'roles',
  'mafia.json'
);

function createCutoverError(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

function normalizePartyIds(...partyIdLists) {
  return Array.from(
    new Set(
      partyIdLists
        .flat()
        .map((partyId) => String(partyId || '').trim())
        .filter(Boolean)
    )
  ).sort();
}

function assertSameRoleKeys(expectedRoleKeys, actualRoleKeys) {
  const expected = [...expectedRoleKeys].sort();
  const actual = [...actualRoleKeys].sort();

  if (
    expected.length !== actual.length ||
    expected.some((key, index) => key !== actual[index])
  ) {
    throw createCutoverError(
      'The persisted Mafia role catalog does not match the JSON catalog.',
      'mafia_role_cutover_catalog_mismatch',
      { expectedRoleKeys: expected, actualRoleKeys: actual }
    );
  }
}

async function readMafiaRoleKeys(
  catalogPath = DEFAULT_MAFIA_ROLE_CATALOG_PATH
) {
  const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  const roles = catalog['mafia-roles'];

  if (!Array.isArray(roles) || roles.length === 0) {
    throw createCutoverError(
      'The Mafia role cutover refused an empty role catalog.',
      'mafia_role_cutover_empty_catalog'
    );
  }

  const roleKeys = roles.map((role) => String(role['role-name'] || '').trim());
  if (
    roleKeys.some((key) => !key) ||
    new Set(roleKeys).size !== roleKeys.length
  ) {
    throw createCutoverError(
      'The Mafia role cutover requires unique, non-empty role keys.',
      'mafia_role_cutover_invalid_catalog'
    );
  }

  return roleKeys;
}

async function findActiveMafiaPartyIds({ PartyGameMafia, WaitingRoom }) {
  const [gamePartyIds, waitingPartyIds] = await Promise.all([
    PartyGameMafia.distinct('partyId', {}),
    WaitingRoom.distinct('partyId', { 'config.gamemode': 'mafia' })
  ]);

  return normalizePartyIds(gamePartyIds, waitingPartyIds);
}

async function terminateMafiaRooms({
  partyIds,
  PartyGameMafia,
  WaitingRoom,
  PartyGameChatLog,
  ActivePartyOwnerLease
}) {
  if (partyIds.length === 0) {
    return {
      deletedGameRooms: 0,
      deletedWaitingRooms: 0,
      deletedChatLogs: 0,
      deletedOwnerLeases: 0
    };
  }

  const query = { partyId: { $in: partyIds } };
  const [gameRooms, waitingRooms, chatLogs, ownerLeases] = await Promise.all([
    PartyGameMafia.deleteMany(query),
    WaitingRoom.deleteMany(query),
    PartyGameChatLog.deleteMany(query),
    ActivePartyOwnerLease.deleteMany(query)
  ]);

  return {
    deletedGameRooms: Number(gameRooms?.deletedCount || 0),
    deletedWaitingRooms: Number(waitingRooms?.deletedCount || 0),
    deletedChatLogs: Number(chatLogs?.deletedCount || 0),
    deletedOwnerLeases: Number(ownerLeases?.deletedCount || 0)
  };
}

async function removeRetiredMafiaRoleContent({ GamePack, GameRule }) {
  const [packResult, ruleResult] = await Promise.all([
    GamePack.deleteMany({
      gameType: 'mafia',
      slug: { $in: RETIRED_MAFIA_ROLE_PACK_KEYS }
    }),
    GameRule.deleteMany({
      gameType: 'mafia',
      key: { $in: RETIRED_MAFIA_ROLE_RULE_KEYS }
    })
  ]);

  return {
    deletedPacks: Number(packResult?.deletedCount || 0),
    deletedRules: Number(ruleResult?.deletedCount || 0)
  };
}

async function verifyMafiaRoleHardCutover({
  expectedRoleKeys,
  terminatedPartyIds,
  GamePack,
  GameRule,
  GameRole,
  PartyGameMafia,
  WaitingRoom,
  PartyGameChatLog,
  ActivePartyOwnerLease
}) {
  const relatedQuery = { partyId: { $in: terminatedPartyIds } };
  const [
    remainingRetiredPacks,
    remainingRetiredRules,
    remainingGameRooms,
    remainingWaitingRooms,
    remainingChatLogs,
    remainingOwnerLeases,
    nonNullRoleDescriptions,
    actualRoleKeys
  ] = await Promise.all([
    GamePack.countDocuments({
      gameType: 'mafia',
      slug: { $in: RETIRED_MAFIA_ROLE_PACK_KEYS }
    }),
    GameRule.countDocuments({
      gameType: 'mafia',
      key: { $in: RETIRED_MAFIA_ROLE_RULE_KEYS }
    }),
    PartyGameMafia.countDocuments({}),
    WaitingRoom.countDocuments({ 'config.gamemode': 'mafia' }),
    PartyGameChatLog.countDocuments(relatedQuery),
    ActivePartyOwnerLease.countDocuments(relatedQuery),
    GameRole.countDocuments({
      gameType: 'mafia',
      description: { $ne: null }
    }),
    GameRole.distinct('key', { gameType: 'mafia' })
  ]);

  const counts = {
    remainingRetiredPacks,
    remainingRetiredRules,
    remainingGameRooms,
    remainingWaitingRooms,
    remainingChatLogs,
    remainingOwnerLeases,
    nonNullRoleDescriptions
  };
  const failedCounts = Object.entries(counts).filter(
    ([, count]) => count !== 0
  );

  if (failedCounts.length > 0) {
    throw createCutoverError(
      'The Mafia role hard cutover did not reach a clean post-migration state.',
      'mafia_role_cutover_verification_failed',
      { counts }
    );
  }

  assertSameRoleKeys(expectedRoleKeys, actualRoleKeys);

  return {
    ...counts,
    roleKeys: [...actualRoleKeys].sort()
  };
}

async function runMafiaRoleHardCutover({
  expectedRoleKeys,
  terminateActiveRooms = false,
  models,
  importRoles = importGameRolesFromJson
}) {
  const {
    GamePack,
    GameRule,
    GameRole,
    PartyGameMafia,
    WaitingRoom,
    PartyGameChatLog,
    ActivePartyOwnerLease
  } = models;
  const activePartyIds = await findActiveMafiaPartyIds({
    PartyGameMafia,
    WaitingRoom
  });

  if (activePartyIds.length > 0 && !terminateActiveRooms) {
    throw createCutoverError(
      [
        `Found ${activePartyIds.length} active Mafia room(s).`,
        'Stop the application and rerun with --terminate-active-mafia-rooms.'
      ].join(' '),
      'mafia_role_cutover_active_rooms',
      { partyIds: activePartyIds }
    );
  }

  const importedRoles = await importRoles(GameRole);
  const importedMafiaRoleKeys = importedRoles
    .filter((role) => role?.gameType === 'mafia')
    .map((role) => role.key);
  assertSameRoleKeys(expectedRoleKeys, importedMafiaRoleKeys);

  const staleRoles = await GameRole.deleteMany({
    gameType: 'mafia',
    key: { $nin: expectedRoleKeys }
  });
  const retiredRoleContent = await removeRetiredMafiaRoleContent({
    GamePack,
    GameRule
  });
  const terminatedRooms = await terminateMafiaRooms({
    partyIds: activePartyIds,
    PartyGameMafia,
    WaitingRoom,
    PartyGameChatLog,
    ActivePartyOwnerLease
  });
  const verification = await verifyMafiaRoleHardCutover({
    expectedRoleKeys,
    terminatedPartyIds: activePartyIds,
    GamePack,
    GameRule,
    GameRole,
    PartyGameMafia,
    WaitingRoom,
    PartyGameChatLog,
    ActivePartyOwnerLease
  });

  return {
    importedRoles: importedMafiaRoleKeys.length,
    deletedStaleRoles: Number(staleRoles?.deletedCount || 0),
    ...retiredRoleContent,
    ...terminatedRooms,
    verification
  };
}

module.exports = {
  DEFAULT_MAFIA_ROLE_CATALOG_PATH,
  assertSameRoleKeys,
  findActiveMafiaPartyIds,
  normalizePartyIds,
  readMafiaRoleKeys,
  runMafiaRoleHardCutover,
  terminateMafiaRooms,
  verifyMafiaRoleHardCutover
};

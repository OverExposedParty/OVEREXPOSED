const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizePartyIds,
  readMafiaRoleKeys,
  runMafiaRoleHardCutover
} = require('../../scripts/lib/mafia-role-hard-cutover');

function createDeleteModel({
  distinctValues = [],
  deletedCount = 0,
  count = 0
} = {}) {
  const calls = [];

  return {
    calls,
    async distinct(field, query) {
      calls.push({ operation: 'distinct', field, query });
      return [...distinctValues];
    },
    async deleteMany(query) {
      calls.push({ operation: 'deleteMany', query });
      return { deletedCount };
    },
    async countDocuments(query) {
      calls.push({ operation: 'countDocuments', query });
      return count;
    }
  };
}

function createCutoverModels({
  gamePartyIds = [],
  waitingPartyIds = [],
  roleKeys = ['civilian', 'mafioso', 'inspector']
} = {}) {
  return {
    GamePack: createDeleteModel({ deletedCount: 6 }),
    GameRule: createDeleteModel({ deletedCount: 2 }),
    GameRole: createDeleteModel({
      distinctValues: roleKeys,
      deletedCount: 2
    }),
    PartyGameMafia: createDeleteModel({
      distinctValues: gamePartyIds,
      deletedCount: gamePartyIds.length
    }),
    WaitingRoom: createDeleteModel({
      distinctValues: waitingPartyIds,
      deletedCount: waitingPartyIds.length
    }),
    PartyGameChatLog: createDeleteModel({ deletedCount: 1 }),
    ActivePartyOwnerLease: createDeleteModel({ deletedCount: 1 })
  };
}

test('Mafia role hard cutover reads the canonical non-empty role catalog', async () => {
  const roleKeys = await readMafiaRoleKeys();

  assert.deepEqual(roleKeys, [
    'civilian',
    'mafioso',
    'inspector',
    'godfather',
    'mayor',
    'serial-killer',
    'lawyer'
  ]);
});

test('Mafia role hard cutover normalizes and deduplicates party ids', () => {
  assert.deepEqual(
    normalizePartyIds(['XYZ-789', 'ABC-123'], ['ABC-123', '', null]),
    ['ABC-123', 'XYZ-789']
  );
});

test('Mafia role hard cutover refuses active rooms without explicit termination', async () => {
  const models = createCutoverModels({
    gamePartyIds: ['ABC-123'],
    waitingPartyIds: ['ABC-123']
  });
  let importCalled = false;

  await assert.rejects(
    runMafiaRoleHardCutover({
      expectedRoleKeys: ['civilian', 'mafioso', 'inspector'],
      models,
      importRoles: async () => {
        importCalled = true;
        return [];
      }
    }),
    {
      code: 'mafia_role_cutover_active_rooms',
      details: { partyIds: ['ABC-123'] }
    }
  );

  assert.equal(importCalled, false);
  assert.equal(
    models.PartyGameMafia.calls.some((call) => call.operation === 'deleteMany'),
    false
  );
});

test('Mafia role hard cutover terminates rooms and verifies the final state', async () => {
  const expectedRoleKeys = ['civilian', 'mafioso', 'inspector'];
  const models = createCutoverModels({
    gamePartyIds: ['ABC-123'],
    waitingPartyIds: ['ABC-123'],
    roleKeys: expectedRoleKeys
  });
  const result = await runMafiaRoleHardCutover({
    expectedRoleKeys,
    terminateActiveRooms: true,
    models,
    importRoles: async () =>
      expectedRoleKeys.map((key) => ({ gameType: 'mafia', key }))
  });

  assert.equal(result.importedRoles, 3);
  assert.equal(result.deletedStaleRoles, 2);
  assert.equal(result.deletedPacks, 6);
  assert.equal(result.deletedRules, 2);
  assert.equal(result.deletedGameRooms, 1);
  assert.equal(result.deletedWaitingRooms, 1);
  assert.deepEqual(result.verification.roleKeys, [...expectedRoleKeys].sort());
  assert.deepEqual(
    models.GamePack.calls.find((call) => call.operation === 'deleteMany').query,
    {
      gameType: 'mafia',
      slug: {
        $in: [
          'mafioso',
          'inspector',
          'godfather',
          'mayor',
          'serial-killer',
          'lawyer'
        ]
      }
    }
  );
  assert.deepEqual(
    models.GameRule.calls.find((call) => call.operation === 'deleteMany').query,
    {
      gameType: 'mafia',
      key: { $in: ['mafioso', 'inspector'] }
    }
  );

  for (const model of [
    models.PartyGameMafia,
    models.WaitingRoom,
    models.PartyGameChatLog,
    models.ActivePartyOwnerLease
  ]) {
    assert.ok(
      model.calls.some((call) => call.operation === 'deleteMany'),
      'expected related active-room data to be deleted'
    );
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');

const PartyGameSession = require('../../models/party-games/party-game-session-schema');
const {
  createPartyGameSessionService
} = require('../../server/services/party-game-sessions');

test('party game session registry enforces globally unique game ids', () => {
  assert.equal(PartyGameSession.schema.path('gameId').options.unique, true);
  assert.equal(PartyGameSession.schema.path('gameId').options.immutable, true);
  assert.equal(
    PartyGameSession.schema.path('gameModeRelease').options.immutable,
    true
  );
});

test('game session allocation retries duplicate ids before reserving', async () => {
  const created = [];
  const generatedIds = ['TOD-DUPLICATE', 'TOD-UNIQUE'];
  const service = createPartyGameSessionService({
    PartyGameSession: {
      async create(document) {
        created.push(document);
        if (document.gameId === 'TOD-DUPLICATE') {
          const error = new Error('duplicate key');
          error.code = 11000;
          throw error;
        }
        return document;
      }
    },
    createPartyGameId: () => generatedIds.shift(),
    allocationAttempts: 3
  });

  const reservation = await service.reservePartyGameSession({
    partyId: 'abc-123',
    gamemode: 'truth-or-dare'
  });

  assert.equal(reservation.gameId, 'TOD-UNIQUE');
  assert.equal(reservation.partyId, 'ABC-123');
  assert.equal(reservation.gameModeRelease.version, '1.0.0');
  assert.equal(
    created[1].gameModeRelease.releaseId,
    reservation.gameModeRelease.releaseId
  );
  assert.deepEqual(
    created.map(({ gameId }) => gameId),
    ['TOD-DUPLICATE', 'TOD-UNIQUE']
  );
});

test('game session allocation fails cleanly after its retry limit', async () => {
  const service = createPartyGameSessionService({
    PartyGameSession: {
      async create() {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
    },
    createPartyGameId: () => 'TOD-DUPLICATE',
    allocationAttempts: 2
  });

  await assert.rejects(
    service.reservePartyGameSession({
      partyId: 'ABC-123',
      gamemode: 'truth-or-dare'
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'party_game_session_allocation_failed');
      return true;
    }
  );
});

test('reserved game sessions become active or permanently released', async () => {
  const updates = [];
  const service = createPartyGameSessionService({
    PartyGameSession: {
      async create() {},
      async updateOne(filter, update) {
        updates.push({ filter, update });
        return { matchedCount: 1 };
      }
    }
  });

  await service.activatePartyGameSession({
    gameId: 'TOD-ACTIVE',
    partyId: 'abc-123'
  });
  await service.releasePartyGameSession({
    gameId: 'TOD-RELEASED',
    partyId: 'abc-123'
  });

  assert.deepEqual(
    updates.map(({ filter, update }) => ({
      gameId: filter.gameId,
      partyId: filter.partyId,
      fromStatus: filter.status,
      status: update.$set.status
    })),
    [
      {
        gameId: 'TOD-ACTIVE',
        partyId: 'ABC-123',
        fromStatus: 'reserved',
        status: 'active'
      },
      {
        gameId: 'TOD-RELEASED',
        partyId: 'ABC-123',
        fromStatus: 'reserved',
        status: 'released'
      }
    ]
  );
});

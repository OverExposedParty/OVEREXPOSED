const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyActionRoute
} = require('../../server/game-engine/party-runtime/route-handlers/action-route');
const {
  assertPartyActionBody
} = require('../../server/validation/party-requests');
const { createApplier, createGameOverParty } = require('./scenarios/helpers');

function createLeanQuery(value) {
  return {
    select() {
      return this;
    },
    async lean() {
      return structuredClone(value);
    }
  };
}

test('replay route archives, rotates the game id, starts, and notifies the room', async () => {
  const oldParty = createGameOverParty();
  oldParty.session = {
    gameId: `MLT-${'A'.repeat(32)}`,
    playSequence: 2,
    createdAt: new Date('2026-08-05T12:00:00.000Z'),
    startedAt: new Date('2026-08-05T12:01:00.000Z'),
    endedAt: new Date('2026-08-05T12:10:00.000Z')
  };
  const nextGameId = `MLT-${'B'.repeat(32)}`;
  const nextGameModeRelease = {
    version: '2.0.0',
    releaseId: 'most-likely-to@2.0.0+release',
    runtimeBuild: 'build-123',
    contentHash: 'content-123',
    capturedAt: new Date('2026-08-06T12:00:00.000Z')
  };
  const calls = {
    archived: [],
    activated: [],
    completed: [],
    emitted: [],
    released: [],
    waitingRoomUpdates: []
  };
  let handler;
  let savedParty;
  const { applyPartyActionToSnapshot } = createApplier({
    assertOnlinePlayerRestrictions() {}
  });
  const mainModel = {
    findOne() {
      return createLeanQuery(oldParty);
    },
    async findOneAndUpdate(filter, update) {
      assert.equal(filter.partyId, 'ABC-123');
      assert.equal(filter['state.phase'], 'game-over');
      assert.equal(filter['session.gameId'], oldParty.session.gameId);
      savedParty = structuredClone({ partyId: oldParty.partyId, ...update });
      return savedParty;
    }
  };
  const waitingRoomModel = {
    async findOneAndUpdate(filter, update) {
      calls.waitingRoomUpdates.push({ filter, update });
      return update;
    }
  };

  const route = createPartyActionRoute({
    app: {
      post(path, callback) {
        assert.equal(path, '/api/test-party/action');
        handler = callback;
      }
    },
    io: {
      to(partyId) {
        assert.equal(partyId, 'ABC-123');
        return {
          emit(name, transition) {
            calls.emitted.push({ name, transition });
          }
        };
      }
    },
    crypto: { randomInt: () => 42 },
    assertPartyActionBody,
    applyPartyActionToSnapshot,
    async getPartyRequestPrincipal() {
      return { type: 'guest' };
    },
    assertPrincipalOwnsPlayer(party, actorId) {
      assert.equal(party.partyId, 'ABC-123');
      assert.equal(actorId, 'host-device');
    },
    async archiveRoomSnapshot(input) {
      calls.archived.push(input);
      return true;
    },
    async reservePartyGameSession({ partyId, gamemode }) {
      return {
        partyId,
        gamemode,
        gameId: nextGameId,
        gameModeRelease: nextGameModeRelease
      };
    },
    async activatePartyGameSession(reservation) {
      calls.activated.push(reservation);
    },
    async completePartyGameSession(session) {
      calls.completed.push(session);
    },
    async releasePartyGameSession(reservation) {
      calls.released.push(reservation);
    },
    async recordPartyRouteError() {},
    async grantPartyGameRewards() {
      assert.fail('replay must not grant the completed game rewards again');
    }
  });
  route.createPartyActionHandler({
    route: '/api/test-party',
    mainModel,
    waitingRoomModel,
    logLabel: 'Test party',
    hasDeck: true
  });

  let responsePayload;
  await handler(
    {
      id: 'replay-test',
      query: {},
      body: {
        partyId: 'ABC-123',
        action: 'replay-game',
        actorId: 'host-device',
        payload: { expectedGameId: oldParty.session.gameId }
      }
    },
    {
      apiSuccess(payload) {
        responsePayload = payload;
      },
      apiError(payload) {
        assert.fail(`unexpected API error: ${payload.message}`);
      }
    }
  );

  assert.equal(calls.archived.length, 1);
  assert.equal(calls.activated.length, 1);
  assert.deepEqual(calls.completed, [
    { gameId: oldParty.session.gameId, partyId: oldParty.partyId }
  ]);
  assert.equal(calls.released.length, 0);
  assert.equal(calls.waitingRoomUpdates.length, 1);
  assert.equal(savedParty.session.gameId, nextGameId);
  assert.deepEqual(savedParty.session.gameModeRelease, nextGameModeRelease);
  assert.equal(savedParty.session.playSequence, 3);
  assert.equal(savedParty.config.shuffleSeed, 42);
  assert.equal(savedParty.state.isPlaying, true);
  assert.deepEqual(
    savedParty.players.map((player) => player.state.score),
    [0, 0]
  );
  assert.equal(calls.emitted.length, 1);
  assert.equal(calls.emitted[0].name, 'party-game-replayed');
  assert.equal(calls.emitted[0].transition.gameId, nextGameId);
  assert.equal(responsePayload.transition.gameId, nextGameId);
});

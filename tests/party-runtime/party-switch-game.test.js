const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canAccountAccessGamemodeTile,
  createPartySwitchGameRoute,
  createPartySwitchSnapshot
} = require('../../server/game-engine/party-runtime/route-handlers/switch-game-route');

const MODELS = {
  'truth-or-dare': require('../../models/party-games/party-game-truth-or-dare-schema'),
  paranoia: require('../../models/party-games/party-game-paranoia-schema'),
  'never-have-i-ever': require('../../models/party-games/party-game-never-have-i-ever-schema'),
  'most-likely-to': require('../../models/party-games/party-game-most-likely-to-schema'),
  imposter: require('../../models/party-games/party-game-imposter-schema'),
  'would-you-rather': require('../../models/party-games/party-game-would-you-rather-schema'),
  mafia: require('../../models/party-games/party-game-mafia-schema')
};

function createSourceParty() {
  return {
    partyId: 'ABC-123',
    session: {
      gameId: 'MLT-OLDGAME0000001',
      createdAt: new Date('2026-08-05T12:00:00.000Z'),
      startedAt: new Date('2026-08-05T12:01:00.000Z'),
      endedAt: new Date('2026-08-05T12:10:00.000Z'),
      playSequence: 3,
      serverRegion: 'LOCAL',
      access: { originalHostComputerId: 'host-device' }
    },
    config: { gamemode: 'most-likely-to' },
    state: {
      isPlaying: false,
      phase: 'game-over',
      hostComputerId: 'host-device'
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          username: 'Host',
          userIcon: '0000:0100:0200:0300',
          accountId: '64f000000000000000000001',
          partyOwnerIdHash: 'host-owner-hash'
        },
        connection: { socketId: 'host-socket' },
        state: { isReady: false, score: 12, vote: 'guest-device' }
      },
      {
        identity: {
          computerId: 'guest-device',
          username: 'Guest',
          userIcon: '0000:0100:0200:0300',
          guestIdHash: 'guest-hash'
        },
        connection: { socketId: 'guest-socket' },
        state: { isReady: true, score: 8, vote: 'host-device' }
      }
    ]
  };
}

function createGameModeRelease(gamemode = 'truth-or-dare') {
  return {
    version: '2.0.0',
    releaseId: `${gamemode}@2.0.0+release`,
    runtimeBuild: 'build-123',
    contentHash: 'content-123',
    capturedAt: new Date('2026-08-06T12:00:00.000Z')
  };
}

test('switch snapshot keeps the room identity and resets match state', () => {
  const now = new Date('2026-08-05T13:00:00.000Z');
  const switched = createPartySwitchSnapshot({
    party: createSourceParty(),
    targetGamemode: 'truth-or-dare',
    gameId: 'TOD-0123456789ABCDEF',
    gameModeRelease: createGameModeRelease(),
    now,
    shuffleSeed: 42
  });

  assert.equal(switched.partyId, 'ABC-123');
  assert.equal(switched.session.gameId, 'TOD-0123456789ABCDEF');
  assert.equal(switched.session.playSequence, 3);
  assert.equal(switched.session.access.originalHostComputerId, 'host-device');
  assert.equal(switched.session.createdAt, now);
  assert.equal(switched.session.startedAt, null);
  assert.equal(switched.session.endedAt, null);
  assert.equal(switched.session.gameModeRelease.version, '2.0.0');
  assert.equal(switched.config.gamemode, 'truth-or-dare');
  assert.equal(switched.config.shuffleSeed, 42);
  assert.equal(switched.state.phase, 'lobby');
  assert.equal(switched.state.isPlaying, false);
  assert.equal(switched.players[0].state.isReady, true);
  assert.equal(switched.players[1].state.isReady, false);
  assert.equal(switched.players[0].state.score, 0);
  assert.equal(
    switched.players[0].identity.partyOwnerIdHash,
    'host-owner-hash'
  );
  assert.equal(switched.players[1].identity.guestIdHash, 'guest-hash');
  assert.deepEqual(switched.state.hostComputerIdList, [
    'host-device',
    'guest-device'
  ]);
});

test('switch snapshot creates clean mafia player state', () => {
  const switched = createPartySwitchSnapshot({
    party: createSourceParty(),
    targetGamemode: 'mafia',
    gameId: 'MAF-0123456789ABCDEF'
  });

  assert.equal(switched.deck, undefined);
  assert.deepEqual(switched.config.roleCounts, {});
  assert.deepEqual(switched.players[0].state, {
    isReady: true,
    hasConfirmed: false,
    roleKey: null,
    status: 'alive',
    vote: 'N/A',
    phase: {
      scenarioFileName: 'N/A',
      index: 1,
      state: 'pending'
    }
  });
});

test('switch snapshots satisfy every target game schema', () => {
  for (const [gamemode, Model] of Object.entries(MODELS)) {
    const snapshot = createPartySwitchSnapshot({
      party: createSourceParty(),
      targetGamemode: gamemode,
      gameId: `TEST-${gamemode}`,
      shuffleSeed: 7
    });
    const validationError = new Model(snapshot).validateSync();
    assert.equal(
      validationError,
      undefined,
      `${gamemode}: ${validationError?.message || ''}`
    );
  }
});

test('switch snapshot rejects unknown game modes', () => {
  assert.throws(
    () =>
      createPartySwitchSnapshot({
        party: createSourceParty(),
        targetGamemode: 'unknown-game',
        gameId: 'UNKNOWN-1'
      }),
    /not supported/
  );
});

test('switch access follows the gamemode catalogue entitlement', () => {
  const betaAccount = { role: 'BETA TESTER' };
  const featureTile = {
    access: { type: 'feature', feature: 'imposter' }
  };
  const accessTools = {
    canAccessFeature(account, feature) {
      return account === betaAccount && feature === 'imposter';
    },
    canAccessOwnerPages: () => false
  };

  assert.equal(
    canAccountAccessGamemodeTile(featureTile, betaAccount, accessTools),
    true
  );
  assert.equal(
    canAccountAccessGamemodeTile(featureTile, null, accessTools),
    false
  );
  assert.equal(
    canAccountAccessGamemodeTile(
      { access: { type: 'owner' } },
      betaAccount,
      accessTools
    ),
    false
  );
});

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

test('switch route archives, replaces, redirects, and retires the old game', async () => {
  const sourceParty = createSourceParty();
  const waitingRoom = structuredClone(sourceParty);
  const calls = {
    archived: [],
    emitted: [],
    sessionActivated: [],
    sessionCompleted: [],
    sessionReleased: [],
    sourceDeleted: [],
    targetReplaced: [],
    waitingUpdated: []
  };
  let handler;
  const sourceModel = {
    findOne() {
      return createLeanQuery(sourceParty);
    },
    async findOneAndUpdate() {
      return { locked: true };
    },
    async deleteOne(filter) {
      calls.sourceDeleted.push(filter);
    },
    async updateOne() {
      assert.fail('the source lock should not need to be restored');
    }
  };
  const targetModel = {
    async replaceOne(filter, snapshot) {
      calls.targetReplaced.push({ filter, snapshot });
    },
    async deleteOne() {
      assert.fail('the target should not be rolled back');
    }
  };
  const waitingRoomModel = {
    findOne() {
      return createLeanQuery(waitingRoom);
    },
    async findOneAndUpdate(filter, update) {
      calls.waitingUpdated.push({ filter, update });
      return update;
    }
  };
  const leaseModel = {
    async updateOne() {}
  };
  const route = createPartySwitchGameRoute({
    app: {
      post(path, callback) {
        assert.equal(path, '/api/party-lobbies/switch-game');
        handler = callback;
      }
    },
    io: {
      to(partyId) {
        assert.equal(partyId, 'ABC-123');
        return {
          emit(name, event) {
            calls.emitted.push({ name, event });
          }
        };
      }
    },
    assertPartyId(partyId) {
      assert.equal(partyId, 'ABC-123');
    },
    async getPartyRequestPrincipal() {
      return { type: 'guest' };
    },
    assertPrincipalOwnsPlayer(party, playerId) {
      assert.equal(party.partyId, 'ABC-123');
      assert.equal(playerId, 'host-device');
    },
    withoutGuestHashes: (party) => party,
    async archiveRoomSnapshot(input) {
      calls.archived.push(input);
      return true;
    },
    async reservePartyGameSession({ partyId, gamemode }) {
      return {
        gameId: `MAF-${'B'.repeat(32)}`,
        partyId,
        gamemode,
        gameModeRelease: createGameModeRelease(gamemode)
      };
    },
    async activatePartyGameSession(input) {
      calls.sessionActivated.push(input);
    },
    async completePartyGameSession(input) {
      calls.sessionCompleted.push(input);
    },
    async releasePartyGameSession(input) {
      calls.sessionReleased.push(input);
    },
    waitingRoomSchema: waitingRoomModel,
    activePartyOwnerLeaseSchema: leaseModel,
    PARTY_GAME_MODELS_BY_GAMEMODE: {
      'most-likely-to': sourceModel,
      mafia: targetModel
    },
    ONLINE_GAMEMODE_MAX_PLAYERS: { mafia: 20 },
    crypto: { randomInt: () => 17 }
  });
  route.createSwitchGameHandler();

  let responsePayload = null;
  await handler(
    {
      id: 'switch-test',
      body: {
        partyId: 'abc-123',
        targetGamemode: 'mafia',
        expectedGameId: sourceParty.session.gameId
      },
      query: {}
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
  assert.equal(calls.targetReplaced.length, 1);
  assert.equal(calls.targetReplaced[0].snapshot.config.gamemode, 'mafia');
  assert.equal(
    calls.targetReplaced[0].snapshot.session.gameModeRelease.releaseId,
    'mafia@2.0.0+release'
  );
  assert.equal(calls.targetReplaced[0].snapshot.config.shuffleSeed, 17);
  assert.equal(calls.waitingUpdated.length, 1);
  assert.equal(calls.sourceDeleted.length, 1);
  assert.equal(calls.emitted.length, 1);
  assert.equal(calls.emitted[0].name, 'party-game-switched');
  assert.equal(calls.emitted[0].event.toGamemode, 'mafia');
  assert.equal(calls.sessionActivated.length, 1);
  assert.equal(calls.sessionCompleted.length, 1);
  assert.equal(calls.sessionReleased.length, 0);
  assert.equal(
    responsePayload.transition.gameId,
    calls.emitted[0].event.gameId
  );
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PARTY_ERROR_DEDUPLICATION_WINDOW_MS,
  createPartyErrorTools
} = require('../../server/game-engine/party-runtime/errors');

function createTools() {
  return createPartyErrorTools({
    PARTY_ERROR_LOG_LIMIT: 20,
    PARTY_ID_PATTERN: /^[A-Z]{3}-\d{3}$/,
    debugWarn() {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    shouldUsePlayerTurnOrder: () => false,
    getTurnPlayer: () => null,
    getPartyRuntimeBuild: () => 'build-that-handled-error'
  });
}

function createParty(overrides = {}) {
  return {
    partyId: 'ABC-123',
    config: { gamemode: 'paranoia' },
    state: { phase: 'voting' },
    players: [],
    errors: [],
    ...overrides
  };
}

function createMemoryModel(party) {
  return {
    findCalls: 0,
    updateCalls: 0,
    findOne() {
      this.findCalls += 1;
      return { lean: async () => party };
    },
    async updateOne(filter, update) {
      this.updateCalls += 1;
      const duplicate = party.errors.some(
        (entry) =>
          entry.fingerprint === filter.errors.$not.$elemMatch.fingerprint &&
          new Date(entry.occurredAt) >=
            filter.errors.$not.$elemMatch.occurredAt.$gte
      );
      if (duplicate) return { matchedCount: 0, modifiedCount: 0 };

      party.errors.push(...update.$push.errors.$each);
      party.errors = party.errors.slice(update.$push.errors.$slice);
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };
}

test('party errors retain the session release and record the handling build', () => {
  const tools = createTools();
  const gameModeRelease = {
    version: '2.4.0',
    releaseId: 'paranoia@2.4.0+abc123',
    runtimeBuild: 'build-that-created-game',
    contentHash: 'content-hash',
    capturedAt: new Date('2026-08-06T12:00:00.000Z')
  };

  const entry = tools.createPartyErrorEntry({
    err: new Error('Voting failed'),
    req: { method: 'POST', originalUrl: '/api/paranoia/action', body: {} },
    party: {
      session: { gameModeRelease },
      config: { gamemode: 'paranoia' },
      state: { phase: 'voting' },
      players: []
    }
  });

  assert.deepEqual(entry.gameModeRelease, gameModeRelease);
  assert.equal(entry.runtimeBuild, 'build-that-handled-error');
  assert.equal(entry.gamemode, 'paranoia');
  assert.match(entry.fingerprint, /^[a-f0-9]{64}$/);
});

test('expected party control-flow failures are not written as room errors', async () => {
  const tools = createTools();
  const party = createParty();
  const model = createMemoryModel(party);
  const error = new Error('Only the host can start this game');
  error.status = 403;
  error.code = 'party_host_required';

  await tools.recordPartyRouteError({
    err: error,
    req: {
      method: 'POST',
      originalUrl: '/api/paranoia/action',
      body: { partyId: 'ABC-123', action: 'startGame' }
    },
    mainModel: model
  });

  assert.equal(model.findCalls, 0);
  assert.equal(model.updateCalls, 0);
  assert.deepEqual(party.errors, []);

  const uncodedDenial = new Error('Only the current player can continue');
  uncodedDenial.status = 403;
  await tools.recordPartyRouteError({
    err: uncodedDenial,
    req: {
      method: 'POST',
      originalUrl: '/api/paranoia/action',
      body: { partyId: 'ABC-123', action: 'continue' }
    },
    mainModel: model
  });

  assert.equal(model.findCalls, 0);
  assert.equal(model.updateCalls, 0);
  assert.deepEqual(party.errors, []);
});

test('unexpected failures and expected codes with a 5xx status remain reportable', async () => {
  const tools = createTools();
  const party = createParty();
  const model = createMemoryModel(party);

  for (const [message, code] of [
    ['Database write failed', 'party_action_failed'],
    ['Host check crashed', 'party_host_required']
  ]) {
    const error = new Error(message);
    error.status = 500;
    error.code = code;
    await tools.recordPartyRouteError({
      err: error,
      req: {
        method: 'POST',
        originalUrl: '/api/paranoia/action',
        body: { partyId: 'ABC-123', action: 'startGame' }
      },
      mainModel: model
    });
  }

  assert.equal(party.errors.length, 2);
  assert.deepEqual(
    party.errors.map((entry) => entry.message),
    ['Database write failed', 'Host check crashed']
  );
});

test('identical room errors are deduplicated briefly while distinct errors remain', async () => {
  const tools = createTools();
  const party = createParty();
  const model = createMemoryModel(party);
  const request = {
    method: 'POST',
    originalUrl: '/api/paranoia/action',
    body: { partyId: 'ABC-123', action: 'vote', actorId: 'device-1' }
  };
  const first = tools.createPartyErrorEntry({
    err: new Error('Vote write failed'),
    req: request,
    party
  });
  const repeated = tools.createPartyErrorEntry({
    err: new Error('Vote write failed'),
    req: request,
    party
  });
  const distinct = tools.createPartyErrorEntry({
    err: new Error('Round write failed'),
    req: request,
    party
  });

  await tools.appendPartyError({
    mainModel: model,
    partyId: party.partyId,
    entry: first
  });
  await tools.appendPartyError({
    mainModel: model,
    partyId: party.partyId,
    entry: repeated
  });
  await tools.appendPartyError({
    mainModel: model,
    partyId: party.partyId,
    entry: distinct
  });

  assert.equal(party.errors.length, 2);
  assert.deepEqual(
    party.errors.map((entry) => entry.message),
    ['Vote write failed', 'Round write failed']
  );

  repeated.occurredAt = new Date(
    first.occurredAt.getTime() + PARTY_ERROR_DEDUPLICATION_WINDOW_MS + 1
  );
  await tools.appendPartyError({
    mainModel: model,
    partyId: party.partyId,
    entry: repeated
  });

  assert.equal(party.errors.length, 3);
});

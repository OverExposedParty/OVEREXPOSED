const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyOwnerReservationTools
} = require('../../server/game-engine/party-runtime/party-owner-reservations');
const {
  createPartyUpsertRoute
} = require('../../server/game-engine/party-runtime/route-handlers/upsert-route');

function createPartyBody(partyId = 'ABC-123') {
  return {
    partyId,
    session: { gameId: 'game-one' },
    config: { gamemode: 'truth-or-dare' },
    state: {
      isPlaying: false,
      hostComputerId: 'host-device'
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          username: 'Host',
          userIcon: 'host-icon'
        },
        connection: {},
        state: {}
      }
    ]
  };
}

test('party-code reservation acquires the owner lease before returning', async () => {
  const shells = [];
  const acquisitions = [];
  const principal = {
    type: 'account',
    accountId: 'account-one',
    partyOwnerIdHash: 'owner-hash'
  };
  const tools = createPartyOwnerReservationTools({
    waitingRoomSchema: {
      async create(shell) {
        shells.push(shell);
      },
      async deleteOne() {
        assert.fail('a successful reservation must keep its shell');
      }
    },
    getPartyRequestPrincipal: async () => principal,
    acquireActivePartyOwnerLease: async (input) => {
      acquisitions.push(input);
    }
  });

  const partyCode = await tools.reservePartyCodeForRequest({}, {});

  assert.match(partyCode, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  assert.deepEqual(shells, [{ partyId: partyCode }]);
  assert.deepEqual(acquisitions, [{ partyId: partyCode, principal }]);
});

test('party-code reservation rejects an active participant before creating a shell', async () => {
  let shellCreated = false;
  const conflict = new Error('You are already in an active party.');
  conflict.status = 409;
  conflict.code = 'party_participant_active_party_exists';
  const tools = createPartyOwnerReservationTools({
    waitingRoomSchema: {
      async create() {
        shellCreated = true;
      }
    },
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash: 'owner-hash'
    }),
    assertNoActiveParticipantParty: async () => {
      throw conflict;
    },
    acquireActivePartyOwnerLease: async () => {
      assert.fail('an active participant must not acquire an owner lease');
    }
  });

  await assert.rejects(
    tools.reservePartyCodeForRequest({}, {}),
    (error) => error === conflict
  );
  assert.equal(shellCreated, false);
});

test('a rejected reservation removes only its unused party shell', async () => {
  const deleted = [];
  const conflict = new Error('You already own an active party.');
  conflict.status = 409;
  conflict.code = 'party_owner_active_party_exists';
  const tools = createPartyOwnerReservationTools({
    waitingRoomSchema: {
      async create() {},
      async deleteOne(filter) {
        deleted.push(filter);
      }
    },
    getPartyRequestPrincipal: async () => ({
      type: 'guest',
      guestIdHash: 'owner-hash',
      partyOwnerIdHash: 'owner-hash'
    }),
    acquireActivePartyOwnerLease: async () => {
      throw conflict;
    }
  });

  await assert.rejects(
    tools.reservePartyCodeForRequest({}, {}),
    (error) => error === conflict
  );
  assert.equal(deleted.length, 1);
  assert.match(deleted[0].partyId, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
});

function createUpsertHarness({
  acquire,
  update,
  existingParty = null,
  assertNoActiveParticipantParty = async () => {},
  assertPartyConfigContentAccess = async () => {}
}) {
  let handler = null;
  const activations = [];
  const releases = [];
  const errors = [];
  const model = {
    findOne() {
      return {
        select() {
          return this;
        },
        async lean() {
          return existingParty;
        }
      };
    },
    async findOneAndUpdate(filter, updateData, options) {
      return update(filter, updateData, options);
    }
  };
  const routes = createPartyUpsertRoute({
    app: {
      post(_route, routeHandler) {
        handler = routeHandler;
      }
    },
    assertPartyUpdateBody() {},
    getServerRegion: async () => 'test-region',
    PARTY_ID_PATTERN: /^[A-Z0-9]{3}-[A-Z0-9]{3}$/,
    PLAYER_TURN_ORDER_GAMEMODES: new Set(),
    initializePlayerTurnOrder() {},
    assertOnlinePlayerRestrictions() {},
    recordPartyRouteError: async ({ err }) => errors.push(err),
    getPartyPlayerId: (player) => player?.identity?.computerId,
    isReservedPartyShell: () => false,
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash: 'owner-hash'
    }),
    bindPlayerToPrincipal(player, principal) {
      player.identity.accountId = principal.accountId;
      player.identity.partyOwnerIdHash = principal.partyOwnerIdHash;
    },
    assertPrincipalOwnsPlayer() {},
    preservePlayerBindings: (_existing, requested) => requested,
    assertNoActiveParticipantParty,
    assertPartyConfigContentAccess,
    acquireActivePartyOwnerLease: acquire,
    activateActivePartyOwnerLease: async (input) => activations.push(input),
    releaseActivePartyOwnerLeaseIfInactive: async (input) =>
      releases.push(input)
  });
  routes.createUpsertPartyHandler({
    route: '/party',
    model,
    logLabel: 'Party',
    fields: ['session', 'config', 'state', 'players']
  });
  return { handler, activations, releases, errors };
}

function createResponseCapture() {
  const result = {};
  return {
    result,
    response: {
      apiSuccess(payload) {
        result.success = payload;
      },
      apiError(payload) {
        result.error = payload;
      }
    }
  };
}

test('direct party creation returns 409 before writing when ownership conflicts', async () => {
  let wroteParty = false;
  const conflict = new Error('You already own an active party.');
  conflict.status = 409;
  conflict.code = 'party_owner_active_party_exists';
  conflict.details = { partyCode: 'OLD-123', lobbyPath: '/OLD-123' };
  const harness = createUpsertHarness({
    acquire: async () => {
      throw conflict;
    },
    update: async () => {
      wroteParty = true;
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-one' },
    response
  );

  assert.equal(wroteParty, false);
  assert.equal(result.error.status, 409);
  assert.equal(result.error.code, 'party_owner_active_party_exists');
  assert.deepEqual(result.error.details, conflict.details);
  assert.equal(harness.activations.length, 0);
});

test('direct party creation returns 409 before writing for an active participant', async () => {
  let wroteParty = false;
  const conflict = new Error('You are already in an active party.');
  conflict.status = 409;
  conflict.code = 'party_participant_active_party_exists';
  conflict.details = { partyCode: 'OLD-123', lobbyPath: '/OLD-123' };
  const harness = createUpsertHarness({
    assertNoActiveParticipantParty: async () => {
      throw conflict;
    },
    acquire: async () => {
      assert.fail('an active participant must not acquire an owner lease');
    },
    update: async () => {
      wroteParty = true;
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-participant' },
    response
  );

  assert.equal(wroteParty, false);
  assert.equal(result.error.status, 409);
  assert.equal(result.error.code, 'party_participant_active_party_exists');
  assert.deepEqual(result.error.details, conflict.details);
});

test('successful direct creation activates the exact acquired lease', async () => {
  const acquisition = {
    acquired: true,
    lease: { partyId: 'ABC-123' },
    releaseToken: { leaseId: 'lease-one', leaseToken: 'release-token' }
  };
  const harness = createUpsertHarness({
    acquire: async () => acquisition,
    update: async (_filter, updateData) => updateData
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-two' },
    response
  );

  assert.ok(result.success);
  assert.deepEqual(harness.activations, [
    {
      partyId: 'ABC-123',
      releaseToken: acquisition.releaseToken,
      gamemode: 'truth-or-dare'
    }
  ]);
  assert.equal(harness.releases.length, 0);
});

test('party content access is enforced before a party configuration write', async () => {
  let wroteParty = false;
  const accessError = new Error('Prompt Heist requires additional access.');
  accessError.status = 403;
  accessError.code = 'feature_access_required';
  const harness = createUpsertHarness({
    acquire: async () => ({
      acquired: true,
      lease: { partyId: 'ABC-123' },
      releaseToken: { leaseId: 'lease-one', leaseToken: 'release-token' }
    }),
    assertPartyConfigContentAccess: async () => {
      throw accessError;
    },
    update: async () => {
      wroteParty = true;
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-content-access' },
    response
  );

  assert.equal(wroteParty, false);
  assert.equal(result.error.status, 403);
  assert.equal(result.error.code, 'feature_access_required');
});

test('failed direct creation releases a newly acquired unused lease', async () => {
  const acquisition = {
    acquired: true,
    lease: { partyId: 'ABC-123' },
    releaseToken: { leaseId: 'lease-one', leaseToken: 'release-token' }
  };
  const harness = createUpsertHarness({
    acquire: async () => acquisition,
    update: async () => {
      throw new Error('party write failed');
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-three' },
    response
  );

  assert.equal(result.error.status, 500);
  assert.deepEqual(harness.releases, [
    {
      partyId: 'ABC-123',
      releaseToken: acquisition.releaseToken
    }
  ]);
  assert.equal(harness.activations.length, 0);
});

test('direct party creation canonicalizes lowercase party IDs before storage', async () => {
  let acquisitionInput = null;
  let write = null;
  const acquisition = {
    acquired: true,
    lease: { partyId: 'ABC-123' },
    releaseToken: {
      leaseId: 'lease-one',
      leaseToken: 'release-token',
      revision: 1
    }
  };
  const harness = createUpsertHarness({
    acquire: async (input) => {
      acquisitionInput = input;
      return acquisition;
    },
    update: async (filter, updateData, options) => {
      write = { filter, updateData, options };
      return updateData;
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody('abc-123'), query: {}, id: 'request-four' },
    response
  );

  assert.ok(result.success);
  assert.equal(acquisitionInput.partyId, 'ABC-123');
  assert.deepEqual(write.filter, { partyId: 'ABC-123' });
  assert.equal(write.updateData.partyId, 'ABC-123');
  assert.equal(write.options.upsert, true);
});

test('an existing-party update cannot recreate a concurrently deleted room', async () => {
  let writeOptions = null;
  const existingParty = {
    partyId: 'ABC-123',
    session: {},
    config: { gamemode: 'truth-or-dare' },
    state: { hostComputerId: 'host-device' },
    players: createPartyBody().players
  };
  const harness = createUpsertHarness({
    existingParty,
    acquire: async () => assert.fail('existing updates must not reacquire'),
    update: async (_filter, _updateData, options) => {
      writeOptions = options;
      return null;
    }
  });
  const { result, response } = createResponseCapture();

  await harness.handler(
    { body: createPartyBody(), query: {}, id: 'request-five' },
    response
  );

  assert.equal(writeOptions.upsert, false);
  assert.equal(result.error.status, 409);
  assert.equal(result.error.code, 'party_update_conflict');
  assert.equal(harness.activations.length, 0);
});

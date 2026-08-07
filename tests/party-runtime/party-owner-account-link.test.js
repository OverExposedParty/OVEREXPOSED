const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyPlayerUpdateRoutes
} = require('../../server/game-engine/party-runtime/route-handlers/player-update-routes');

test('guest account claims retain the browser party owner binding', async () => {
  const handlers = new Map();
  const patches = [];
  const guestHash = 'guest-owner-hash';
  const partyOwnerIdHash = 'party-owner-hash';
  const existingParty = {
    players: [
      {
        identity: {
          computerId: 'guest-device',
          accountId: null,
          guestIdHash: guestHash
        }
      }
    ],
    state: { phase: 'lobby' }
  };
  const mainModel = {
    findOne() {
      return {
        async select() {
          return existingParty;
        }
      };
    }
  };
  const waitingRoomModel = {};
  const routes = createPartyPlayerUpdateRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    Account: {},
    partyGameRewardClaimSchema: {},
    assertPatchPlayerBody() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    grantPendingPartyGameReward: async () => null,
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash
    }),
    playerMatchesGuestPrincipal: (player, principal) =>
      player.identity?.guestIdHash === principal.guestIdHash,
    getPartyGuestPrincipalFromRequest: () => ({
      type: 'guest',
      guestIdHash: guestHash,
      partyOwnerIdHash
    }),
    withoutGuestHashes: (party) => party,
    patchPlayerInPartyDocument: async (model, partyId, computerId, patch) => {
      patches.push({ model, partyId, computerId, patch });
      return { state: { phase: 'lobby' } };
    },
    withPartyJoinLock: async (partyId, callback) => callback()
  });
  routes.createLinkPlayerAccountHandler({
    route: '/link-player-account',
    mainModel,
    waitingRoomModel,
    logLabel: 'Test party'
  });
  const successes = [];

  await handlers.get('/link-player-account')(
    {
      body: {
        partyId: 'ABC-123',
        computerId: 'guest-device'
      },
      query: {}
    },
    {
      apiSuccess(payload) {
        successes.push(payload);
      },
      apiError(payload) {
        assert.fail(`Unexpected API error: ${JSON.stringify(payload)}`);
      }
    }
  );

  assert.equal(successes.length, 1);
  assert.equal(patches.length, 2);
  patches.forEach(({ patch }) => {
    assert.equal(
      patch['players.$.identity.partyOwnerIdHash'],
      partyOwnerIdHash
    );
    assert.equal(patch['players.$.identity.accountId'], 'account-one');
    assert.equal(patch['players.$.identity.guestIdHash'], null);
  });
});

test('guest account claims complete the auth lease and restore active state', async () => {
  const handlers = new Map();
  const patches = [];
  const cancelledTransitions = [];
  const existingParty = {
    players: [
      {
        identity: {
          computerId: 'guest-device',
          accountId: null,
          guestIdHash: 'guest-owner-hash'
        },
        state: {
          participationStatus: 'reconnecting',
          reconnectDeadline: new Date(Date.now() + 300_000)
        }
      }
    ],
    state: { phase: 'lobby' }
  };
  const mainModel = {
    findOne() {
      return { select: async () => existingParty };
    }
  };
  const waitingRoomModel = {};
  const routes = createPartyPlayerUpdateRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    Account: {},
    partyGameRewardClaimSchema: {},
    assertPatchPlayerBody() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    grantPendingPartyGameReward: async () => null,
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash: 'party-owner-hash'
    }),
    playerMatchesGuestPrincipal: (player, principal) =>
      player.identity?.guestIdHash === principal.guestIdHash,
    getPartyGuestPrincipalFromRequest: () => ({
      type: 'guest',
      guestIdHash: 'guest-owner-hash'
    }),
    withoutGuestHashes: (party) => party,
    patchPlayerInPartyDocument: async (model, partyId, computerId, patch) => {
      patches.push({ model, partyId, computerId, patch });
      return { ...existingParty, state: { phase: 'lobby' } };
    },
    withPartyJoinLock: async (_partyId, callback) => callback(),
    hasAuthTransitionForPlayer: () => true,
    cancelAuthTransitionForPlayer: (partyId, computerId) => {
      cancelledTransitions.push({ partyId, computerId });
      return true;
    }
  });
  routes.createLinkPlayerAccountHandler({
    route: '/link-player-account',
    mainModel,
    waitingRoomModel,
    logLabel: 'Test party'
  });

  await handlers.get('/link-player-account')(
    {
      body: { partyId: 'ABC-123', computerId: 'guest-device' },
      query: {}
    },
    {
      apiSuccess() {},
      apiError(payload) {
        assert.fail(`Unexpected API error: ${JSON.stringify(payload)}`);
      }
    }
  );

  assert.equal(patches.length, 2);
  patches.forEach(({ patch }) => {
    assert.equal(patch['players.$.state.participationStatus'], 'active');
    assert.equal(patch['players.$.state.reconnectDeadline'], null);
  });
  assert.deepEqual(cancelledTransitions, [
    { partyId: 'ABC-123', computerId: 'guest-device' }
  ]);
});

test('guest account claims stop before mutation when the owner lease conflicts', async () => {
  const handlers = new Map();
  const errors = [];
  const existingParty = {
    players: [
      {
        identity: {
          computerId: 'guest-device',
          accountId: null,
          guestIdHash: 'guest-owner-hash'
        }
      }
    ],
    state: { phase: 'lobby' }
  };
  const routes = createPartyPlayerUpdateRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    Account: {},
    partyGameRewardClaimSchema: {},
    assertPatchPlayerBody() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    grantPendingPartyGameReward: async () => null,
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash: 'party-owner-hash'
    }),
    playerMatchesGuestPrincipal: (player, principal) =>
      player.identity?.guestIdHash === principal.guestIdHash,
    getPartyGuestPrincipalFromRequest: () => ({
      type: 'guest',
      guestIdHash: 'guest-owner-hash',
      partyOwnerIdHash: 'party-owner-hash'
    }),
    withoutGuestHashes: (party) => party,
    patchPlayerInPartyDocument: async () =>
      assert.fail('a conflicting lease must prevent party mutation'),
    withPartyJoinLock: async (_partyId, callback) => callback(),
    attachAccountToPartyOwnerLease: async () => ({
      attached: false,
      conflict: true,
      partyId: 'OLD-123',
      gamemode: 'truth-or-dare',
      apiRoute: 'party-game-truth-or-dare'
    })
  });
  routes.createLinkPlayerAccountHandler({
    route: '/link-player-account',
    mainModel: {
      findOne() {
        return { select: async () => existingParty };
      }
    },
    waitingRoomModel: {},
    logLabel: 'Test party'
  });

  await handlers.get('/link-player-account')(
    {
      body: { partyId: 'NEW-123', computerId: 'guest-device' },
      query: {}
    },
    {
      apiSuccess(payload) {
        assert.fail(`Unexpected API success: ${JSON.stringify(payload)}`);
      },
      apiError(payload) {
        errors.push(payload);
      }
    }
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0].status, 409);
  assert.equal(errors[0].code, 'party_owner_active_party_exists');
  assert.deepEqual(errors[0].details, {
    partyCode: 'OLD-123',
    lobbyPath: '/OLD-123',
    gamemode: 'truth-or-dare',
    apiRoute: 'party-game-truth-or-dare'
  });
});

test('logout converts the same-browser account player to a guest profile', async () => {
  const handlers = new Map();
  const patches = [];
  const existingParty = {
    session: {
      access: { originalHostAccountId: 'account-one' }
    },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one',
          partyOwnerIdHash: 'owner-hash',
          username: 'Account Name',
          userIcon: 'account-icon'
        }
      }
    ]
  };
  const routes = createPartyPlayerUpdateRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    assertPatchPlayerBody() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    getPartyRequestPrincipal: async () => ({
      type: 'guest',
      guestIdHash: 'owner-hash',
      partyOwnerIdHash: 'owner-hash'
    }),
    playerMatchesPrincipal: (player, principal) =>
      player.identity?.partyOwnerIdHash === principal.partyOwnerIdHash,
    patchPlayerInPartyDocument: async (model, partyId, computerId, patch) => {
      patches.push({ model, partyId, computerId, patch });
      return { ...existingParty, players: [] };
    },
    withPartyJoinLock: async (_partyId, callback) => callback()
  });
  routes.createContinuePlayerAsGuestHandler({
    route: '/continue-player-as-guest',
    mainModel: {
      findOne() {
        return {
          select() {
            return { lean: async () => existingParty };
          }
        };
      }
    },
    waitingRoomModel: {},
    logLabel: 'Test party'
  });
  const successes = [];

  await handlers.get('/continue-player-as-guest')(
    {
      body: {
        partyId: 'ABC-123',
        computerId: 'host-device',
        newUsername: 'OE12345678',
        newUserIcon: 'guest-icon'
      },
      query: {}
    },
    {
      apiSuccess(payload) {
        successes.push(payload);
      },
      apiError(payload) {
        assert.fail(`Unexpected API error: ${JSON.stringify(payload)}`);
      }
    }
  );

  assert.equal(successes.length, 1);
  assert.equal(patches.length, 2);
  patches.forEach(({ patch }) => {
    assert.equal(patch['players.$.identity.accountId'], null);
    assert.equal(patch['players.$.identity.guestIdHash'], 'owner-hash');
    assert.equal(patch['players.$.identity.partyOwnerIdHash'], 'owner-hash');
    assert.equal(patch['players.$.identity.username'], 'OE12345678');
    assert.equal(patch['players.$.identity.userIcon'], 'guest-icon');
  });
  assert.equal(
    existingParty.session.access.originalHostAccountId,
    'account-one'
  );
});

test('logout guest conversion rejects a different browser owner identity', async () => {
  const handlers = new Map();
  const errors = [];
  const routes = createPartyPlayerUpdateRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    assertPatchPlayerBody() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    getPartyRequestPrincipal: async () => ({
      type: 'guest',
      guestIdHash: 'different-owner-hash',
      partyOwnerIdHash: 'different-owner-hash'
    }),
    playerMatchesPrincipal: () => false,
    patchPlayerInPartyDocument: async () =>
      assert.fail('an unverified browser must not mutate the player'),
    withPartyJoinLock: async (_partyId, callback) => callback()
  });
  routes.createContinuePlayerAsGuestHandler({
    route: '/continue-player-as-guest',
    mainModel: {
      findOne() {
        return {
          select() {
            return {
              lean: async () => ({
                players: [
                  {
                    identity: {
                      computerId: 'host-device',
                      accountId: 'account-one',
                      partyOwnerIdHash: 'actual-owner-hash'
                    }
                  }
                ]
              })
            };
          }
        };
      }
    },
    waitingRoomModel: {},
    logLabel: 'Test party'
  });

  await handlers.get('/continue-player-as-guest')(
    {
      body: { partyId: 'ABC-123', computerId: 'host-device' },
      query: {}
    },
    {
      apiSuccess(payload) {
        assert.fail(`Unexpected API success: ${JSON.stringify(payload)}`);
      },
      apiError(payload) {
        errors.push(payload);
      }
    }
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0].status, 403);
  assert.equal(errors[0].code, 'party_player_forbidden');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  createPartyAuthTransitionRoutes
} = require('../../server/game-engine/party-runtime/route-handlers/auth-transition-routes');

function createHarness({ leaseMs = 30, maxMs = 200, partyState = {} } = {}) {
  const handlers = new Map();
  const events = [];
  const departedRooms = [];
  const disconnectedPlayers = [];
  const host = {
    identity: {
      computerId: 'host-device',
      username: 'Host',
      userIcon: 'host-oe'
    },
    connection: { socketId: 'host-socket' }
  };
  const guest = {
    identity: {
      computerId: 'guest-device',
      username: 'Guest',
      userIcon: 'guest-oe'
    },
    connection: { socketId: 'guest-socket' }
  };
  const session = {
    partyId: 'ABC-123',
    config: { gamemode: 'truth-or-dare' },
    state: {
      hostComputerId: 'host-device',
      isPlaying: false,
      phase: 'lobby',
      ...partyState
    },
    players: [host, guest],
    async save() {}
  };
  const waitingRoom = {
    partyId: 'ABC-123',
    state: { hostComputerId: 'host-device' },
    players: [host, guest],
    async save() {}
  };
  const modelFor = (document) => ({
    findOne() {
      return { select: async () => document };
    }
  });
  const response = () => {
    const result = { payload: null, error: null };
    return {
      result,
      apiSuccess(payload) {
        result.payload = payload;
        return payload;
      },
      apiError(payload) {
        result.error = payload;
        return payload;
      }
    };
  };

  const routes = createPartyAuthTransitionRoutes({
    app: {
      post(route, handler) {
        handlers.set(route, handler);
      }
    },
    io: {
      to(partyId) {
        return {
          emit(event, payload) {
            events.push({ partyId, event, payload });
          }
        };
      },
      sockets: {
        sockets: new Map([
          [
            'guest-socket',
            {
              leave(partyId) {
                departedRooms.push(partyId);
              }
            }
          ]
        ])
      }
    },
    crypto,
    assertPartyId() {},
    recordPartyRouteError: async () => {},
    getPartyPlayerId: (player) => player?.identity?.computerId,
    getPartyRequestPrincipal: async () => ({ type: 'guest' }),
    assertPrincipalOwnsPlayer() {},
    withoutGuestHashes: (party) => ({
      partyId: party.partyId,
      config: { ...party.config },
      state: { ...party.state },
      players: party.players.map((player) => structuredClone(player))
    }),
    withPartyJoinLock: async (_partyId, callback) => callback(),
    disconnectPartyPlayer: async (options) => {
      disconnectedPlayers.push(options);
      return session;
    },
    forgetSocketPartyMembership() {},
    getPlayerConnectionSocketId: (player) => player?.connection?.socketId,
    createLivePartyNotification: ({ type, partyId, player }) => ({
      type,
      partyId,
      actorUsername: player?.identity?.username || 'Player',
      actorOeIcon: player?.identity?.userIcon || null
    }),
    AUTH_TRANSITION_LEASE_MS: leaseMs,
    AUTH_TRANSITION_MAX_MS: maxMs
  });
  routes.createAuthTransitionHandlers({
    route: '/auth-transition',
    mainModel: modelFor(session),
    waitingRoomModel: modelFor(waitingRoom),
    logLabel: 'Party Game Truth Or Dare'
  });

  async function begin(computerId = 'guest-device') {
    const res = response();
    await handlers.get('/auth-transition/begin')(
      {
        body: {
          partyId: 'ABC-123',
          computerId,
          socketId: `${computerId}-socket`
        },
        id: 'begin-auth-transition'
      },
      res
    );
    return res.result;
  }

  async function post(action, transition) {
    const res = response();
    await handlers.get(`/auth-transition/${action}`)(
      {
        body: {
          partyId: 'ABC-123',
          computerId: 'guest-device',
          transitionId: transition.transitionId,
          token: transition.token
        }
      },
      res
    );
    return res.result;
  }

  return {
    begin,
    departedRooms,
    disconnectedPlayers,
    events,
    post,
    session,
    waitingRoom
  };
}

test('auth transition heartbeat renews the lobby lease and completion cancels it', async () => {
  const harness = createHarness({ leaseMs: 50, maxMs: 250 });
  const started = await harness.begin();

  assert.ok(started.payload.transitionId);
  assert.ok(started.payload.token);
  const signingInEvent = harness.events.find(
    ({ event }) => event === 'user-authenticating'
  );
  assert.equal(signingInEvent.payload.notification.actorUsername, 'Guest');
  assert.equal(signingInEvent.payload.notification.actorOeIcon, 'guest-oe');
  await new Promise((resolve) => setTimeout(resolve, 30));
  const heartbeat = await harness.post('heartbeat', started.payload);
  assert.equal(heartbeat.error, null);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(harness.session.players.length, 2);

  const completed = await harness.post('complete', started.payload);
  assert.equal(completed.payload.completed, true);
  assert.equal(
    harness.session.players[1].state.participationStatus,
    'active'
  );
  assert.equal(harness.session.players[1].state.reconnectDeadline, null);
  assert.equal(
    harness.waitingRoom.players[1].state.participationStatus,
    'active'
  );
  assert.equal(
    harness.waitingRoom.players[1].state.reconnectDeadline,
    null
  );
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(harness.session.players.length, 2);
});

test('an abandoned auth transition removes the non-host from the lobby', async () => {
  const harness = createHarness({ leaseMs: 20, maxMs: 100 });
  const started = await harness.begin();
  assert.ok(started.payload.transitionId);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.deepEqual(
    harness.session.players.map((player) => player.identity.computerId),
    ['host-device']
  );
  assert.deepEqual(
    harness.waitingRoom.players.map((player) => player.identity.computerId),
    ['host-device']
  );
  assert.equal(harness.events.at(-1).event, 'user-left');
  assert.deepEqual(harness.departedRooms, ['ABC-123']);
});

test('hosts cannot start a participant auth transition lease', async () => {
  const harness = createHarness();
  const result = await harness.begin('host-device');

  assert.equal(result.payload, null);
  assert.equal(result.error.status, 409);
  assert.equal(result.error.code, 'party_auth_transition_unavailable');
});

test('active-game players enter reconnecting state and are disconnected only after expiry', async () => {
  const harness = createHarness({
    leaseMs: 20,
    maxMs: 100,
    partyState: { isPlaying: true, phase: 'playing' }
  });
  const started = await harness.begin('host-device');

  assert.ok(started.payload.transitionId);
  assert.equal(
    harness.session.players[0].state.participationStatus,
    'reconnecting'
  );
  assert.ok(harness.session.players[0].state.reconnectDeadline instanceof Date);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(harness.session.players.length, 2);
  assert.equal(harness.disconnectedPlayers.length, 1);
  assert.equal(harness.disconnectedPlayers[0].computerId, 'host-device');
});

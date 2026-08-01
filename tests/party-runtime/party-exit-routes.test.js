const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyExitRoutes,
  shouldDisbandPartyForExit
} = require('../../server/game-engine/party-runtime/route-handlers/exit-routes');

test('main menu disbands only when the host removes themselves', () => {
  assert.equal(
    shouldDisbandPartyForExit({
      exitIntent: 'main-menu',
      isSelfRemoval: true,
      actorComputerId: 'host-device',
      hostComputerId: 'host-device'
    }),
    true
  );

  assert.equal(
    shouldDisbandPartyForExit({
      exitIntent: 'main-menu',
      isSelfRemoval: true,
      actorComputerId: 'guest-device',
      hostComputerId: 'host-device'
    }),
    false
  );

  assert.equal(
    shouldDisbandPartyForExit({
      exitIntent: null,
      isSelfRemoval: true,
      actorComputerId: 'host-device',
      hostComputerId: 'host-device'
    }),
    false
  );
});

function createPlayerRemovalHarness({
  actorComputerId = 'host-device',
  computerIdToRemove = 'guest-device',
  guestSocketId = 'guest-socket'
} = {}) {
  let removeHandler;
  const emittedEvents = [];
  const directSocketEvents = [];
  const queuedNotifications = [];
  const departedRooms = [];
  const host = {
    identity: {
      computerId: 'host-device',
      accountId: 'host-account',
      username: 'Party Host',
      userIcon: 'host-oe'
    },
    connection: { socketId: 'host-socket' }
  };
  const guest = {
    identity: {
      computerId: 'guest-device',
      accountId: 'guest-account',
      username: 'Party Guest',
      userIcon: 'guest-oe'
    },
    connection: { socketId: guestSocketId }
  };
  const observer = {
    identity: {
      computerId: 'observer-device',
      accountId: 'observer-account',
      username: 'Party Observer',
      userIcon: 'observer-oe'
    },
    connection: { socketId: 'observer-socket' }
  };
  const session = {
    partyId: 'ABC-123',
    config: { gamemode: 'would-you-rather' },
    state: { hostComputerId: 'host-device' },
    players: [host, guest, observer],
    async save() {}
  };
  const waitingRoom = {
    partyId: 'ABC-123',
    state: { hostComputerId: 'host-device' },
    players: [host, guest, observer],
    async save() {}
  };
  const getPlayerId = (player) => player?.identity?.computerId || null;
  const getAccountId = (player) => player?.identity?.accountId || null;
  const getActor = (player) => ({
    accountId: getAccountId(player),
    username: player?.identity?.username || 'Player',
    oeIcon: player?.identity?.userIcon || null
  });
  const plainParty = (party) => ({
    partyId: party.partyId,
    config: structuredClone(party.config),
    state: structuredClone(party.state),
    players: structuredClone(party.players)
  });
  const sockets = new Map(
    [host, guest, observer].map((player) => [
      player.connection.socketId,
      {
        emit(event, payload) {
          directSocketEvents.push({
            socketId: player.connection.socketId,
            event,
            payload
          });
        },
        leave(partyId) {
          departedRooms.push({
            socketId: player.connection.socketId,
            partyId
          });
        }
      }
    ])
  );
  const io = {
    to(partyId) {
      return {
        emit(event, payload) {
          emittedEvents.push({ partyId, event, payload });
        }
      };
    },
    sockets: {
      adapter: { rooms: new Map([['ABC-123', new Set(sockets.keys())]]) },
      sockets
    }
  };

  const routes = createPartyExitRoutes({
    app: {
      post(_route, handler) {
        removeHandler = handler;
      }
    },
    io,
    partyGameChatLogSchema: {
      async findOne() {
        return null;
      }
    },
    assertRemovePlayerBody() {},
    parseBeaconBody: (body) => body,
    recordPartyRouteError: async () => {},
    cloneSerializable: (value) =>
      value === undefined ? undefined : structuredClone(value),
    getPartyPlayerId: getPlayerId,
    getPartyPlayerAccountId: getAccountId,
    getConnectedPartyPlayers: (players) =>
      players.filter(
        (player) => player.connection?.socketId !== 'DISCONNECTED'
      ),
    formatPartyModeName: () => 'Would You Rather',
    getPartyNotificationModeName: () => 'Would You Rather',
    getPartyNotificationActor: getActor,
    queuePartyAccountNotification: async (notification) => {
      queuedNotifications.push(notification);
    },
    getPartyRequestPrincipal: async () => ({ type: 'account' }),
    assertPrincipalOwnsPlayer() {},
    withoutGuestHashes: plainParty,
    withPartyJoinLock: async (_partyId, callback) => callback(),
    forgetSocketPartyMembership() {},
    getPlayerConnectionSocketId: (player) =>
      player?.connection?.socketId || null,
    unlockLastOneStandingForRemainingPlayer: async () => {},
    repairPartyHost: async () => ({ hostChanged: false }),
    emitPartyHostChanged() {},
    createLivePartyNotification: ({ type, partyId, party, player }) => ({
      id: `live:${type}:${partyId}:${getPlayerId(player)}`,
      type,
      partyId,
      modeName: party.config.gamemode,
      actorAccountId: getAccountId(player),
      actorUsername: player.identity.username,
      actorOeIcon: player.identity.userIcon
    })
  });
  routes.createRemoveUserHandler({
    route: '/remove-user',
    mainModel: {
      findOne() {
        return { select: async () => session };
      }
    },
    waitingRoomModel: {
      findOne() {
        return { select: async () => waitingRoom };
      }
    },
    logLabel: 'Party Game Would You Rather'
  });

  return {
    departedRooms,
    directSocketEvents,
    emittedEvents,
    queuedNotifications,
    async invoke() {
      let responsePayload;
      await removeHandler(
        {
          body: {
            partyId: 'ABC-123',
            computerIdToRemove,
            actorComputerId,
            actorSocketId: `${actorComputerId.replace('-device', '')}-socket`
          },
          id: 'remove-player-request'
        },
        {
          apiSuccess(payload) {
            responsePayload = payload;
            return payload;
          },
          apiError(payload) {
            throw new Error(payload.message);
          }
        }
      );
      return responsePayload;
    }
  };
}

test('confirmed kicks notify the removed player and the remaining lobby', async () => {
  const kick = createPlayerRemovalHarness();

  await kick.invoke();

  const removedPlayerEvent = kick.directSocketEvents.find(
    ({ event }) => event === 'kicked-from-party'
  );
  assert.equal(removedPlayerEvent.socketId, 'guest-socket');
  assert.equal(removedPlayerEvent.payload.partyCode, 'ABC-123');
  assert.equal(
    removedPlayerEvent.payload.notification.perspective,
    'removed-player'
  );
  assert.equal(
    removedPlayerEvent.payload.notification.actorUsername,
    'Party Host'
  );

  const lobbyEvent = kick.emittedEvents.find(
    ({ event }) => event === 'user-kicked'
  );
  assert.equal(lobbyEvent.payload.username, 'Party Guest');
  assert.equal(lobbyEvent.payload.notification.perspective, 'lobby');
  assert.equal(
    lobbyEvent.payload.notification.actorUsername,
    'Party Guest'
  );
  assert.equal(kick.queuedNotifications.length, 1);
  assert.equal(kick.departedRooms.length, 1);
});

test('voluntary departures do not emit kick notifications', async () => {
  const leave = createPlayerRemovalHarness({
    actorComputerId: 'guest-device',
    computerIdToRemove: 'guest-device'
  });

  await leave.invoke();

  assert.equal(
    leave.directSocketEvents.some(
      ({ event }) => event === 'kicked-from-party'
    ),
    false
  );
  assert.equal(
    leave.emittedEvents.some(({ event }) => event === 'user-kicked'),
    false
  );
  assert.equal(
    leave.emittedEvents.some(({ event }) => event === 'user-left'),
    true
  );
  assert.equal(leave.queuedNotifications.length, 0);
  assert.equal(leave.departedRooms.length, 1);
});

test('kicking a disconnected player still notifies the remaining lobby', async () => {
  const kick = createPlayerRemovalHarness({
    guestSocketId: 'DISCONNECTED'
  });

  await kick.invoke();

  assert.equal(
    kick.emittedEvents.some(({ event }) => event === 'user-kicked'),
    true
  );
  assert.equal(
    kick.directSocketEvents.some(
      ({ event }) => event === 'kicked-from-party'
    ),
    false
  );
});

test('host main menu exit deletes the party and attributes notifications to the host', async () => {
  let removeHandler;
  const deleted = [];
  const queuedNotifications = [];
  const emittedEvents = [];
  const departedRooms = [];
  const forgottenMemberships = [];
  const host = {
    identity: {
      computerId: 'host-device',
      accountId: 'host-account',
      username: 'Party Host',
      userIcon: 'host-oe'
    },
    connection: { socketId: 'host-socket' }
  };
  const guest = {
    identity: {
      computerId: 'guest-device',
      accountId: 'guest-account',
      username: 'Party Guest',
      userIcon: 'guest-oe'
    },
    connection: { socketId: 'guest-socket' }
  };
  const session = {
    partyId: 'ABC-123',
    config: { gamemode: 'would-you-rather' },
    state: { hostComputerId: 'host-device' },
    players: [host, guest]
  };
  const mainModel = {
    findOne() {
      return { select: async () => session };
    },
    async deleteOne(query) {
      deleted.push(['main', query]);
    }
  };
  const waitingRoomModel = {
    async deleteOne(query) {
      deleted.push(['waiting', query]);
    }
  };
  const sockets = new Map([
    [
      'host-socket',
      { leave: (partyId) => departedRooms.push(['host', partyId]) }
    ],
    [
      'guest-socket',
      { leave: (partyId) => departedRooms.push(['guest', partyId]) }
    ]
  ]);
  const io = {
    to(partyId) {
      return {
        emit(event, payload) {
          emittedEvents.push({ partyId, event, payload });
        }
      };
    },
    sockets: {
      adapter: { rooms: new Map([['ABC-123', new Set(sockets.keys())]]) },
      sockets
    }
  };
  const getPlayerId = (player) => player?.identity?.computerId || null;
  const getAccountId = (player) => player?.identity?.accountId || null;
  const getActor = (player) => ({
    accountId: getAccountId(player),
    username: player?.identity?.username || 'Player',
    oeIcon: player?.identity?.userIcon || null
  });

  const routes = createPartyExitRoutes({
    app: {
      post(_route, handler) {
        removeHandler = handler;
      }
    },
    io,
    partyGameChatLogSchema: {
      async deleteMany(query) {
        deleted.push(['chat', query]);
      }
    },
    assertRemovePlayerBody() {},
    parseBeaconBody: (body) => body,
    cloneSerializable: (value) => structuredClone(value),
    getPartyPlayerId: getPlayerId,
    getPartyPlayerAccountId: getAccountId,
    formatPartyModeName: () => 'Would You Rather',
    getPartyNotificationModeName: () => 'Would You Rather',
    getPartyNotificationActor: getActor,
    queuePartyAccountNotification: async (notification) => {
      queuedNotifications.push(notification);
    },
    getPartyRequestPrincipal: async () => ({ type: 'account' }),
    assertPrincipalOwnsPlayer() {},
    withoutGuestHashes: (party) => structuredClone(party),
    withPartyJoinLock: async (_partyId, callback) => callback(),
    forgetSocketPartyMembership: (...args) => forgottenMemberships.push(args),
    getPlayerConnectionSocketId: (player) =>
      player?.connection?.socketId || null,
    createLivePartyNotification: ({ type, partyId, party, player }) => ({
      type,
      partyId,
      modeName: party.config.gamemode,
      actorUsername: player.identity.username,
      actorOeIcon: player.identity.userIcon
    })
  });
  routes.createRemoveUserHandler({
    route: '/remove-user',
    mainModel,
    waitingRoomModel,
    logLabel: 'Party Game Would You Rather'
  });

  let responsePayload;
  await removeHandler(
    {
      body: {
        partyId: 'ABC-123',
        computerIdToRemove: 'host-device',
        actorComputerId: 'host-device',
        exitIntent: 'main-menu'
      },
      id: 'request-1'
    },
    {
      apiSuccess(payload) {
        responsePayload = payload;
        return payload;
      },
      apiError(payload) {
        throw new Error(payload.message);
      }
    }
  );

  assert.deepEqual(deleted, [
    ['waiting', { partyId: 'ABC-123' }],
    ['main', { partyId: 'ABC-123' }],
    ['chat', { partyId: 'ABC-123' }]
  ]);
  assert.equal(queuedNotifications.length, 1);
  assert.deepEqual(queuedNotifications[0], {
    accountId: 'guest-account',
    type: 'party_disbanded',
    partyId: 'ABC-123',
    modeName: 'Would You Rather',
    actor: {
      accountId: 'host-account',
      username: 'Party Host',
      oeIcon: 'host-oe'
    }
  });
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0].event, 'party-deleted');
  assert.equal(
    emittedEvents[0].payload.notification.actorUsername,
    'Party Host'
  );
  assert.equal(emittedEvents[0].payload.notification.actorOeIcon, 'host-oe');
  assert.equal(forgottenMemberships.length, 2);
  assert.equal(departedRooms.length, 2);
  assert.match(responsePayload.message, /disbanded successfully/);
});

test('host disband endpoint deletes party state before broadcasting', async () => {
  let disbandHandler;
  const lifecycle = [];
  const host = {
    identity: {
      computerId: 'host-device',
      accountId: 'host-account',
      username: 'Party Host',
      userIcon: 'host-oe'
    },
    connection: { socketId: 'host-socket' }
  };
  const guest = {
    identity: {
      computerId: 'guest-device',
      accountId: 'guest-account',
      username: 'Party Guest',
      userIcon: 'guest-oe'
    },
    connection: { socketId: 'guest-socket' }
  };
  const session = {
    partyId: 'ABC-123',
    config: { gamemode: 'truth-or-dare' },
    state: { hostComputerId: 'host-device' },
    players: [host, guest]
  };
  const sockets = new Map([
    [
      'host-socket',
      { leave: (partyId) => lifecycle.push(`leave:host:${partyId}`) }
    ],
    [
      'guest-socket',
      { leave: (partyId) => lifecycle.push(`leave:guest:${partyId}`) }
    ]
  ]);
  const io = {
    to() {
      return {
        emit(event) {
          lifecycle.push(`emit:${event}`);
        }
      };
    },
    sockets: {
      adapter: { rooms: new Map([['ABC-123', new Set(sockets.keys())]]) },
      sockets
    }
  };

  const routes = createPartyExitRoutes({
    app: {
      post(_route, handler) {
        disbandHandler = handler;
      }
    },
    io,
    partyGameChatLogSchema: {
      async deleteMany() {
        lifecycle.push('delete:chat');
      }
    },
    assertPartyId(value) {
      assert.equal(value, 'ABC-123');
    },
    parseBeaconBody: (body) => body,
    cloneSerializable: (value) => structuredClone(value),
    getPartyPlayerId: (player) => player?.identity?.computerId || null,
    getPartyPlayerAccountId: (player) => player?.identity?.accountId || null,
    formatPartyModeName: () => 'Truth or Dare',
    getPartyNotificationModeName: () => 'Truth or Dare',
    getPartyNotificationActor: (player) => ({
      accountId: player?.identity?.accountId || null,
      username: player?.identity?.username || 'Player',
      oeIcon: player?.identity?.userIcon || null
    }),
    queuePartyAccountNotification: async () => {
      lifecycle.push('notify:guest');
    },
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'host-account'
    }),
    assertPrincipalOwnsPlayer(_party, computerId) {
      assert.equal(computerId, 'host-device');
    },
    withoutGuestHashes: (party) => structuredClone(party),
    withPartyJoinLock: async (_partyId, callback) => callback(),
    forgetSocketPartyMembership() {},
    getPlayerConnectionSocketId: (player) =>
      player?.connection?.socketId || null,
    createLivePartyNotification: ({ type, partyId }) => ({ type, partyId }),
    getActivePartyOwnerLeaseReleaseToken: async () => {
      lifecycle.push('lease:capture');
      return { leaseId: 'lease-one', leaseToken: 'release-token' };
    },
    releaseActivePartyOwnerLeaseIfInactive: async ({
      partyId,
      releaseToken
    }) => {
      assert.equal(partyId, 'ABC-123');
      assert.equal(releaseToken.leaseToken, 'release-token');
      lifecycle.push('lease:release');
    },
    recordPartyRouteError: async () => {
      lifecycle.push('record:error');
    }
  });
  routes.createDisbandPartyHandler({
    route: '/delete',
    mainModel: {
      findOne() {
        return { select: async () => session };
      },
      async deleteOne() {
        lifecycle.push('delete:main');
        return { deletedCount: 1 };
      }
    },
    waitingRoomModel: {
      async deleteOne() {
        lifecycle.push('delete:waiting');
      }
    },
    logLabel: 'Party Game Truth Or Dare'
  });

  let responsePayload;
  await disbandHandler(
    { body: { partyCode: 'ABC-123' }, query: {}, id: 'request-2' },
    {
      apiSuccess(payload) {
        responsePayload = payload;
        return payload;
      },
      apiError(payload) {
        throw new Error(payload.message);
      }
    }
  );

  assert.deepEqual(lifecycle.slice(0, 5), [
    'lease:capture',
    'delete:waiting',
    'delete:main',
    'lease:release',
    'delete:chat'
  ]);
  assert.ok(lifecycle.indexOf('emit:party-deleted') > 4);
  assert.equal(lifecycle.includes('record:error'), false);
  assert.equal(responsePayload.partyCode, 'ABC-123');
  assert.match(responsePayload.message, /disbanded successfully/);
});

test('failed waiting-room cleanup preserves the main party for retry', async () => {
  let disbandHandler;
  let mainDeleted = false;
  let emitted = false;
  let leaseReleased = false;
  const session = {
    partyId: 'ABC-123',
    state: { hostComputerId: 'host-device' },
    players: [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'host-account'
        },
        connection: { socketId: 'host-socket' }
      }
    ]
  };
  const routes = createPartyExitRoutes({
    app: {
      post(_route, handler) {
        disbandHandler = handler;
      }
    },
    io: {
      to() {
        return {
          emit() {
            emitted = true;
          }
        };
      },
      sockets: { adapter: { rooms: new Map() }, sockets: new Map() }
    },
    partyGameChatLogSchema: { async deleteMany() {} },
    assertPartyId() {},
    parseBeaconBody: (body) => body,
    cloneSerializable: (value) => structuredClone(value),
    getPartyPlayerId: (player) => player?.identity?.computerId || null,
    getPartyPlayerAccountId: () => null,
    formatPartyModeName: () => 'Truth or Dare',
    getPartyNotificationModeName: () => 'Truth or Dare',
    getPartyNotificationActor: () => ({}),
    queuePartyAccountNotification: async () => {},
    getPartyRequestPrincipal: async () => ({
      type: 'account',
      accountId: 'host-account'
    }),
    assertPrincipalOwnsPlayer() {},
    withoutGuestHashes: (party) => structuredClone(party),
    withPartyJoinLock: async (_partyId, callback) => callback(),
    forgetSocketPartyMembership() {},
    getPlayerConnectionSocketId: (player) =>
      player?.connection?.socketId || null,
    createLivePartyNotification: () => ({}),
    getActivePartyOwnerLeaseReleaseToken: async () => ({
      leaseId: 'lease-one',
      leaseToken: 'release-token'
    }),
    releaseActivePartyOwnerLeaseIfInactive: async () => {
      leaseReleased = true;
    },
    recordPartyRouteError: async () => {}
  });
  routes.createDisbandPartyHandler({
    route: '/delete',
    mainModel: {
      findOne() {
        return { select: async () => session };
      },
      async deleteOne() {
        mainDeleted = true;
        return { deletedCount: 1 };
      }
    },
    waitingRoomModel: {
      async deleteOne() {
        throw new Error('waiting-room unavailable');
      }
    },
    logLabel: 'Party Game Truth Or Dare'
  });

  let responsePayload;
  await disbandHandler(
    { body: { partyCode: 'ABC-123' }, query: {}, id: 'request-3' },
    {
      apiSuccess(payload) {
        responsePayload = payload;
      },
      apiError(payload) {
        responsePayload = payload;
        return payload;
      }
    }
  );

  assert.equal(responsePayload.status, 500);
  assert.match(responsePayload.message, /waiting-room unavailable/);
  assert.equal(mainDeleted, false);
  assert.equal(emitted, false);
  assert.equal(leaseReleased, false);
});

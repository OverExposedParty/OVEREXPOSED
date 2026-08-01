const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartyDisconnectTools
} = require('../../server/game-engine/party-runtime/route-handlers/socket-tools/disconnect-tools');
const {
  createPartySocketTools
} = require('../../server/game-engine/party-runtime/route-handlers/socket-tools');
const {
  createPartyTimelineNotificationTools
} = require('../../server/game-engine/party-runtime/route-handlers/timeline-notifications');

function createPlayer({ computerId, accountId, username, socketId }) {
  return {
    identity: { computerId, accountId, username, userIcon: `${username}-icon` },
    connection: { socketId },
    socketId,
    state: { participationStatus: 'active' }
  };
}

function createSession() {
  return {
    partyId: 'PARTY-ONE',
    config: { gamemode: 'truth-or-dare' },
    state: {
      hostComputerId: 'host-device',
      hostComputerIdList: ['host-device', 'player-device'],
      isPlaying: false,
      lastPinged: new Date(0),
      playerTurn: 0,
      playerTurnOrder: [],
      roundParticipantIds: []
    },
    players: [
      createPlayer({
        computerId: 'host-device',
        accountId: 'host-account',
        username: 'Host',
        socketId: 'host-socket'
      }),
      createPlayer({
        computerId: 'player-device',
        accountId: 'player-account',
        username: 'Player',
        socketId: 'player-socket'
      })
    ],
    async save() {}
  };
}

function getPlayerId(player) {
  return player?.identity?.computerId ?? player?.computerId ?? null;
}

function getAccountId(player) {
  return player?.identity?.accountId ?? player?.accountId ?? null;
}

function getActor(player) {
  return {
    accountId: getAccountId(player),
    username: player?.identity?.username || 'Player',
    oeIcon: player?.identity?.userIcon || null
  };
}

function createOccurrenceFactory(ids) {
  let index = 0;
  return createPartyTimelineNotificationTools({
    Account: null,
    crypto: {
      randomUUID() {
        const id = ids[index];
        index += 1;
        if (!id) throw new Error('Unexpected notification occurrence');
        return id;
      }
    }
  }).createPartyNotificationOccurrence;
}

function createSocketHarness(occurrenceIds) {
  const emitted = [];
  const queued = [];
  const io = {
    sockets: {
      sockets: new Map([
        ['host-socket', {}],
        ['player-socket', {}]
      ])
    },
    to(room) {
      return {
        emit(event, payload) {
          emitted.push({ room, event, payload });
        }
      };
    }
  };
  const tools = createPartySocketTools({
    io,
    Account: {},
    Achievement: {},
    partyGameChatLogSchema: {
      async findOne() {
        return null;
      },
      async findOneAndUpdate() {
        return { chat: [], async save() {} };
      }
    },
    debugWarn() {},
    getPartyPlayerId: getPlayerId,
    getPartyPlayerAccountId: getAccountId,
    async unlockAchievementByKey() {},
    getPartyNotificationModeName(party) {
      return party?.config?.gamemode || 'Party Game';
    },
    getPartyNotificationActor: getActor,
    createPartyNotificationOccurrence: createOccurrenceFactory(occurrenceIds),
    queuePartyAccountNotification(notification) {
      queued.push(notification);
    },
    withoutGuestHashes(value) {
      return value;
    }
  });

  return { emitted, io, queued, tools };
}

test('party occurrences are unique and persistence preserves their identity', async () => {
  const generatedIds = [
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  ];
  const account = {
    gameData: { notifications: [] },
    markedPath: null,
    markModified(path) {
      this.markedPath = path;
    },
    async save() {}
  };
  const occurrenceTools = createPartyTimelineNotificationTools({
    Account: {
      async findById(accountId) {
        assert.equal(accountId, 'host-account');
        return account;
      }
    },
    crypto: {
      randomUUID() {
        const id = generatedIds.shift();
        if (!id) throw new Error('Persistence generated a second identity');
        return id;
      }
    }
  });
  const createdAt = new Date('2026-07-19T12:00:00.000Z');
  const first = occurrenceTools.createPartyNotificationOccurrence({
    type: 'party_player_disconnected',
    partyId: 'PARTY-ONE',
    modeName: 'Truth Or Dare',
    actor: getActor(createSession().players[1]),
    createdAt
  });
  const second = occurrenceTools.createPartyNotificationOccurrence({
    type: 'party_player_disconnected',
    partyId: 'PARTY-ONE',
    modeName: 'Truth Or Dare',
    actor: getActor(createSession().players[1]),
    createdAt
  });

  assert.notEqual(first.id, second.id);
  const persisted = await occurrenceTools.queuePartyAccountNotification({
    accountId: 'host-account',
    notification: first
  });

  assert.equal(persisted.id, first.id);
  assert.equal(account.gameData.notifications[0].notificationId, first.id);
  assert.equal(
    account.gameData.notifications[0].createdAt.getTime(),
    first.createdAt.getTime()
  );
  assert.equal(account.gameData.notifications[0].category, 'party');
  assert.equal(account.markedPath, 'gameData.notifications');
});

test('reconnects share one occurrence across live and persisted delivery', async () => {
  const { emitted, queued, tools } = createSocketHarness([
    '33333333-3333-4333-8333-333333333333',
    '44444444-4444-4444-8444-444444444444'
  ]);
  const party = createSession();
  const player = party.players[1];

  await tools.announcePartyPlayerReconnected({
    partyId: party.partyId,
    party,
    player,
    logLabel: 'Party Game Truth Or Dare'
  });
  await tools.announcePartyPlayerReconnected({
    partyId: party.partyId,
    party,
    player,
    logLabel: 'Party Game Truth Or Dare'
  });

  const liveNotifications = emitted
    .filter(({ event }) => event === 'user-reconnected')
    .map(({ payload }) => payload.notification);
  assert.equal(liveNotifications.length, 2);
  assert.equal(queued.length, 2);
  assert.strictEqual(queued[0].notification, liveNotifications[0]);
  assert.strictEqual(queued[1].notification, liveNotifications[1]);
  assert.notEqual(liveNotifications[0].id, liveNotifications[1].id);
});

test('ordinary disconnect shares one occurrence across live and persisted delivery', async () => {
  const { emitted, queued, tools } = createSocketHarness([
    '55555555-5555-4555-8555-555555555555'
  ]);
  const session = createSession();
  const mainModel = {
    findOne() {
      return { select: async () => session };
    }
  };

  await tools.disconnectPartyPlayer({
    partyId: session.partyId,
    computerId: 'player-device',
    mainModel,
    waitingRoomModel: null,
    logLabel: 'Party Game Truth Or Dare',
    socketId: 'player-socket'
  });

  const liveNotification = emitted.find(
    ({ event }) => event === 'user-disconnected'
  )?.payload.notification;
  assert.ok(liveNotification);
  assert.equal(queued.length, 1);
  assert.strictEqual(queued[0].notification, liveNotification);
});

test('disconnect grace carries the live occurrence into delayed persistence', async () => {
  const emitted = [];
  const queued = [];
  const session = createSession();
  const disconnectGraceTimers = new Map();
  const mainModel = {
    findOne() {
      return { select: async () => session };
    }
  };
  const tools = createPartyDisconnectTools({
    io: {
      to(room) {
        return {
          emit(event, payload) {
            emitted.push({ room, event, payload });
          }
        };
      }
    },
    partyGameChatLogSchema: {
      async findOne() {
        return null;
      },
      async findOneAndUpdate() {
        return { chat: [] };
      }
    },
    debugWarn(error) {
      throw error;
    },
    getPartyPlayerId: getPlayerId,
    getPartyPlayerAccountId: getAccountId,
    getPartyNotificationModeName: (party) => party.config.gamemode,
    getPartyNotificationActor: getActor,
    createPartyNotificationOccurrence: createOccurrenceFactory([
      '66666666-6666-4666-8666-666666666666'
    ]),
    queuePartyAccountNotification(notification) {
      queued.push(notification);
    },
    withoutGuestHashes: (value) => value,
    withPartyJoinLock: async (_partyId, callback) => callback(),
    getDisconnectGraceKey: (partyId, computerId) => `${partyId}:${computerId}`,
    cancelDisconnectGrace() {},
    forgetSocketPartyMembership() {},
    getPlayerConnectionSocketId: (player) =>
      player?.connection?.socketId ?? player?.socketId ?? null,
    getConnectedPartyPlayers: (players) =>
      players.filter(
        (player) =>
          player.connection?.socketId !== 'DISCONNECTED' &&
          player.state?.participationStatus !== 'reconnecting' &&
          player.state?.participationStatus !== 'disconnected'
      ),
    socketPartyMemberships: new Map(),
    disconnectGraceTimers,
    DISCONNECT_GRACE_PERIOD_MS: 1,
    async repairPartyHost() {
      return { hostChanged: false };
    },
    emitPartyHostChanged() {},
    async unlockLastOneStandingForRemainingPlayer() {}
  });

  await tools.beginTruthOrDareDisconnectGrace({
    partyId: session.partyId,
    computerId: 'player-device',
    mainModel,
    waitingRoomModel: null,
    logLabel: 'Party Game Truth Or Dare',
    socketId: 'player-socket'
  });
  await new Promise((resolve) => setTimeout(resolve, 25));

  const liveNotification = emitted.find(
    ({ event }) => event === 'user-disconnected'
  )?.payload.notification;
  assert.ok(liveNotification);
  assert.equal(queued.length, 1);
  assert.strictEqual(queued[0].notification, liveNotification);
  assert.equal(disconnectGraceTimers.size, 0);
});

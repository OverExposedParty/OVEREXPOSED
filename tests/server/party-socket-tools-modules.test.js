const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPartySocketTools
} = require('../../server/game-engine/party-runtime/route-handlers/socket-tools');
const {
  queueAccountNotification
} = require('../../server/services/account-notifications');

test('party socket tools preserve the composed public API', () => {
  const tools = createPartySocketTools({
    io: {
      sockets: { sockets: new Map() },
      to() {
        return { emit() {} };
      }
    },
    Account: {},
    Achievement: {},
    partyGameChatLogSchema: {},
    debugWarn() {},
    getPartyPlayerId(player) {
      return player?.identity?.computerId ?? player?.computerId ?? null;
    },
    getPartyPlayerAccountId(player) {
      return player?.identity?.accountId ?? player?.accountId ?? null;
    },
    unlockAchievementByKey() {},
    getPartyNotificationModeName() {
      return 'Party Game';
    },
    getPartyNotificationActor() {
      return {};
    },
    queuePartyAccountNotification() {},
    withoutGuestHashes(value) {
      return value;
    }
  });

  assert.deepEqual(Object.keys(tools).sort(), [
    'DISCONNECT_GRACE_PERIOD_MS',
    'announcePartyPlayerReconnected',
    'appendHostChangedChat',
    'beginTruthOrDareDisconnectGrace',
    'cancelDisconnectGrace',
    'createLivePartyNotification',
    'disconnectGraceTimers',
    'disconnectPartyPlayer',
    'disconnectSocketPartyMemberships',
    'emitPartyHostChanged',
    'forgetSocketPartyMembership',
    'getConnectedPartyPlayers',
    'getDisconnectGraceKey',
    'getLiveHostCandidate',
    'getPlayerConnectionSocketId',
    'getSocketPartyMembershipKey',
    'hasLivePartySocketId',
    'isDisconnectedPartyPlayer',
    'isSocketIdActive',
    'partyJoinLocks',
    'rememberSocketPartyMembership',
    'repairPartyHost',
    'repairPartyHostForParty',
    'socketPartyMemberships',
    'syncWaitingRoomHostState',
    'unlockLastOneStandingForRemainingPlayer',
    'withPartyJoinLock'
  ]);
});

test('last one standing emits its persisted progression notification', async () => {
  const deliveries = [];
  const account = {
    _id: 'account-one',
    gameData: { notifications: [] }
  };
  const tools = createPartySocketTools({
    io: {
      sockets: { sockets: new Map() },
      to() {
        return { emit() {} };
      }
    },
    Account: {
      async findById() {
        return account;
      }
    },
    Achievement: {},
    partyGameChatLogSchema: {},
    debugWarn() {},
    getPartyPlayerId(player) {
      return player?.identity?.computerId ?? null;
    },
    getPartyPlayerAccountId(player) {
      return player?.identity?.accountId ?? null;
    },
    async unlockAchievementByKey({ account: targetAccount }) {
      queueAccountNotification(targetAccount, {
        id: 'last-one-standing-notification',
        type: 'achievement_unlocked',
        metadata: { achievementKey: 'last-one-standing' }
      });
    },
    getPartyNotificationModeName() {
      return 'Party Game';
    },
    getPartyNotificationActor() {
      return {};
    },
    queuePartyAccountNotification() {},
    withoutGuestHashes(value) {
      return value;
    },
    emitPartyProgressionNotifications(payload) {
      deliveries.push(payload);
    }
  });
  const player = {
    identity: {
      accountId: 'account-one',
      computerId: 'computer-one'
    },
    connection: { socketId: 'socket-one' }
  };

  await tools.unlockLastOneStandingForRemainingPlayer({
    partyId: 'ABC-123',
    state: { isPlaying: true },
    players: [player]
  });

  assert.deepEqual(deliveries, [
    {
      partyId: 'ABC-123',
      players: [player],
      deliveries: [
        {
          accountId: 'account-one',
          notifications: [
            {
              id: 'last-one-standing-notification',
              type: 'achievement_unlocked',
              achievementKey: 'last-one-standing',
              rewardStatus: undefined,
              rewardResults: undefined,
              createdAt: account.gameData.notifications[0].createdAt
            }
          ]
        }
      ]
    }
  ]);
});

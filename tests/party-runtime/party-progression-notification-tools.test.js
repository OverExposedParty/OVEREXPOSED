const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyProgressionNotificationTools
} = require('../../server/game-engine/party-runtime/route-handlers/progression-notification-tools');

test('progression notifications target only live sockets for the matching account', () => {
  const emitted = [];
  const sockets = new Map([
    ['socket-one', { rooms: new Set(['ABC-123']) }],
    ['socket-two', { rooms: new Set(['ABC-123']) }],
    ['socket-other', { rooms: new Set(['ABC-123']) }],
    ['socket-wrong-room', { rooms: new Set(['OTHER']) }]
  ]);
  const io = {
    sockets: { sockets },
    to(socketId) {
      return {
        emit(eventName, payload) {
          emitted.push({ eventName, payload, socketId });
        }
      };
    }
  };
  const { emitPartyProgressionNotifications } =
    createPartyProgressionNotificationTools({
      io,
      getPartyPlayerAccountId(player) {
        return player.identity?.accountId || null;
      }
    });
  const achievementNotification = {
    id: 'achievement-notification',
    type: 'achievement_unlocked',
    achievementKey: 'first-steps'
  };

  const count = emitPartyProgressionNotifications({
    partyId: 'ABC-123',
    players: [
      {
        identity: { accountId: 'account-one' },
        connection: { socketId: 'socket-one' }
      },
      {
        identity: { accountId: 'account-one' },
        connection: { socketId: 'socket-two' }
      },
      {
        identity: { accountId: 'account-one' },
        connection: { socketId: 'socket-wrong-room' }
      },
      {
        identity: { accountId: 'account-other' },
        connection: { socketId: 'socket-other' }
      }
    ],
    deliveries: [
      {
        accountId: 'account-one',
        notifications: [achievementNotification, achievementNotification]
      }
    ]
  });

  assert.equal(count, 2);
  assert.deepEqual(emitted.map(({ socketId }) => socketId).sort(), [
    'socket-one',
    'socket-two'
  ]);
  assert.ok(
    emitted.every(
      ({ eventName }) => eventName === 'account-progression-notifications'
    )
  );
  assert.ok(
    emitted.every(
      ({ payload }) =>
        payload.notifications.length === 1 &&
        payload.notifications[0] === achievementNotification
    )
  );
});

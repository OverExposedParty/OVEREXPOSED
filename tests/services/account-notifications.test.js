const assert = require('node:assert/strict');
const test = require('node:test');

const {
  countUnreadNotifications,
  createAccountNotificationState,
  inferNotificationDelivery,
  markAccountNotificationsDelivered,
  markNotificationsRead,
  persistAccountNotificationsDelivered,
  persistNotificationsDeliveredAtomically,
  persistNotificationsReadAtomically,
  queueAccountNotification,
  serializeInboxNotifications,
  serializePendingNotifications,
  serializePendingAccountNotifications
} = require('../../server/services/account-notifications');

test('notification delivery separates persistent inbox items from activity toasts', () => {
  const account = {
    gameData: { notifications: [] },
    markModified() {}
  };
  const friendRequest = queueAccountNotification(account, {
    type: 'friend_request'
  });
  const friendOnline = queueAccountNotification(account, {
    type: 'friend_online'
  });
  const partyActivity = queueAccountNotification(account, {
    type: 'party_player_joined'
  });
  const systemNotice = queueAccountNotification(account, {
    type: 'account_security_notice'
  });

  assert.equal(inferNotificationDelivery('friend_request'), 'both');
  assert.equal(inferNotificationDelivery('friend_online'), 'toast');
  assert.equal(inferNotificationDelivery('party_player_joined'), 'toast');
  assert.equal(inferNotificationDelivery('account_security_notice'), 'both');
  assert.equal(countUnreadNotifications(account), 2);
  assert.deepEqual(
    serializeInboxNotifications(account)
      .map((notification) => notification.id)
      .sort(),
    [friendRequest.notificationId, systemNotice.notificationId].sort()
  );
  assert.deepEqual(
    serializePendingNotifications(account, {
      deliveries: ['toast']
    })
      .map((notification) => notification.id)
      .sort(),
    [friendOnline.notificationId, partyActivity.notificationId].sort()
  );

  const deliveredAt = new Date('2026-07-31T14:00:00.000Z');
  assert.equal(
    markAccountNotificationsDelivered(
      account,
      [friendOnline.notificationId],
      deliveredAt
    ),
    1
  );
  assert.equal(friendOnline.readAt, deliveredAt);
  assert.equal(countUnreadNotifications(account), 2);
});

test('historic account records are not treated as pending notifications', () => {
  const account = {
    gameData: {
      achievements: [
        {
          type: 'achievement',
          key: 'historic-achievement',
          unlockedAt: new Date('2026-01-01T00:00:00.000Z')
        }
      ],
      opalTransactions: [
        {
          type: 'admin_adjustment',
          amount: 1000,
          sourceType: 'admin',
          balanceAfter: 1000,
          createdAt: new Date('2026-01-01T00:00:00.000Z')
        }
      ]
    }
  };

  assert.deepEqual(serializePendingAccountNotifications(account), []);
});

test('pending achievement and Opal notifications are serialized oldest first', () => {
  const achievementState = createAccountNotificationState();
  const opalState = createAccountNotificationState();
  const account = {
    gameData: {
      achievements: [
        {
          type: 'achievement',
          key: 'verified',
          rewardStatus: 'granted',
          rewardResults: [{ type: 'xp', amount: 25, granted: true }],
          unlockedAt: new Date('2026-07-15T10:00:00.000Z'),
          ...achievementState
        }
      ],
      opalTransactions: [
        {
          type: 'admin_adjustment',
          amount: 1000,
          reason: 'Account correction',
          sourceType: 'admin',
          balanceAfter: 1400,
          createdAt: new Date('2026-07-15T11:00:00.000Z'),
          ...opalState
        }
      ]
    }
  };

  assert.deepEqual(serializePendingAccountNotifications(account), [
    {
      id: achievementState.notificationId,
      type: 'achievement_unlocked',
      achievementKey: 'verified',
      rewardStatus: 'granted',
      rewardResults: [{ type: 'xp', amount: 25, granted: true }],
      createdAt: new Date('2026-07-15T10:00:00.000Z')
    },
    {
      id: opalState.notificationId,
      type: 'opal_reward',
      amount: 1000,
      balance: 1400,
      label: 'Admin Opal grant',
      reason: 'Opals added to your account',
      sourceType: 'admin',
      sourceId: null,
      createdAt: new Date('2026-07-15T11:00:00.000Z')
    }
  ]);
});

test('legacy achievement Opal transactions do not create separate notifications', () => {
  const opalState = createAccountNotificationState();
  const account = {
    gameData: {
      achievements: [],
      opalTransactions: [
        {
          type: 'earn',
          amount: 35,
          reason: 'Achievement unlocked: Opal Test',
          sourceType: 'achievement',
          sourceId: 'opal-test',
          balanceAfter: 45,
          createdAt: new Date('2026-07-15T11:00:00.000Z'),
          ...opalState
        }
      ]
    }
  };

  assert.deepEqual(serializePendingAccountNotifications(account), []);
  assert.equal(account.gameData.opalTransactions[0].notificationPending, false);
});

test('queued achievement Opal notifications are hidden from toast and inbox views', () => {
  const account = {
    gameData: { notifications: [] },
    markModified() {}
  };
  queueAccountNotification(account, {
    type: 'achievement_unlocked',
    metadata: { achievementKey: 'opal-test' }
  });
  queueAccountNotification(account, {
    type: 'opal_reward',
    metadata: {
      amount: 35,
      balance: 45,
      sourceType: 'achievement',
      sourceId: 'opal-test'
    }
  });

  assert.deepEqual(
    serializePendingNotifications(account).map(
      (notification) => notification.type
    ),
    ['achievement_unlocked']
  );
  assert.deepEqual(
    serializeInboxNotifications(account).map(
      (notification) => notification.type
    ),
    ['achievement_unlocked']
  );
  assert.equal(countUnreadNotifications(account), 1);
});

test('account notification acknowledgement is persisted and idempotent', () => {
  const achievementState = createAccountNotificationState();
  const opalState = createAccountNotificationState();
  const deliveredAt = new Date('2026-07-15T12:00:00.000Z');
  const markedPaths = [];
  const account = {
    gameData: {
      achievements: [
        {
          type: 'achievement',
          key: 'verified',
          ...achievementState
        }
      ],
      opalTransactions: [
        {
          type: 'earn',
          amount: 20,
          balanceAfter: 20,
          ...opalState
        }
      ]
    },
    markModified(path) {
      markedPaths.push(path);
    }
  };
  const ids = [achievementState.notificationId, opalState.notificationId];

  assert.equal(markAccountNotificationsDelivered(account, ids, deliveredAt), 2);
  assert.equal(account.gameData.achievements[0].notificationPending, false);
  assert.equal(account.gameData.achievements[0].notifiedAt, deliveredAt);
  assert.equal(account.gameData.opalTransactions[0].notificationPending, false);
  assert.equal(
    account.gameData.opalTransactions[0].notificationDeliveredAt,
    deliveredAt
  );
  assert.ok(markedPaths.includes('gameData.notifications'));
  assert.ok(markedPaths.includes('gameData.achievements'));
  assert.ok(markedPaths.includes('gameData.opalTransactions'));
  assert.equal(markAccountNotificationsDelivered(account, ids, deliveredAt), 0);
});

test('unified notification acknowledgement persists one inbox lifecycle', async () => {
  const deliveredAt = new Date('2026-07-15T12:00:00.000Z');
  let saves = 0;
  const account = {
    gameData: { notifications: [], achievements: [], opalTransactions: [] },
    markModified() {},
    async save() {
      saves += 1;
    }
  };
  const first = queueAccountNotification(account, {
    type: 'achievement_unlocked',
    metadata: { achievementKey: 'verified' }
  });
  const second = queueAccountNotification(account, {
    type: 'opal_reward',
    metadata: { amount: 20, balance: 20 }
  });

  const updated = await persistAccountNotificationsDelivered(
    account,
    [first.notificationId, second.notificationId],
    deliveredAt
  );

  assert.equal(updated, 2);
  assert.equal(saves, 1);
  assert.equal(account.gameData.notifications[0].deliveredAt, deliveredAt);
  assert.equal(account.gameData.notifications[0].readAt, null);
  assert.equal(countUnreadNotifications(account), 2);
  assert.deepEqual(serializePendingNotifications(account), []);

  assert.equal(
    markNotificationsRead(
      account,
      [first.notificationId],
      new Date('2026-07-15T12:05:00.000Z')
    ),
    1
  );
  assert.equal(countUnreadNotifications(account), 1);
  assert.deepEqual(
    serializeInboxNotifications(account)
      .map((notification) => notification.id)
      .sort(),
    [first.notificationId, second.notificationId].sort()
  );
});

test('unified notification delivery uses a targeted atomic account update', async () => {
  const deliveredAt = new Date('2026-08-01T10:00:00.000Z');
  const account = {
    _id: 'account-one',
    gameData: {
      notifications: [
        {
          notificationId: 'notification-one',
          type: 'friend_request',
          delivery: 'both',
          deliveredAt: null,
          dismissedAt: null
        },
        {
          notificationId: 'notification-two',
          type: 'friend_online',
          delivery: 'toast',
          deliveredAt: null,
          dismissedAt: null
        }
      ]
    },
    async save() {
      throw new Error('atomic delivery must not save the account document');
    }
  };
  let atomicCall = null;
  const Account = {
    async updateOne(filter, update) {
      atomicCall = { filter, update };
      return { modifiedCount: 1 };
    }
  };

  const updated = await persistNotificationsDeliveredAtomically({
    Account,
    account,
    notificationIds: ['notification-one', 'notification-two'],
    updatedAt: deliveredAt
  });

  assert.equal(updated, 2);
  assert.equal(atomicCall.filter._id, 'account-one');
  assert.deepEqual(
    atomicCall.filter['gameData.notifications'].$elemMatch.notificationId.$in,
    ['notification-one', 'notification-two']
  );
  assert.equal(atomicCall.update[0].$set.__v.$add[1], 1);
  assert.match(JSON.stringify(atomicCall.update), /\$map/);
});

test('atomic notification acknowledgement remains idempotent', async () => {
  const account = {
    _id: 'account-one',
    gameData: {
      notifications: [
        {
          notificationId: 'notification-one',
          type: 'friend_request',
          readAt: null,
          dismissedAt: null
        }
      ]
    }
  };
  const Account = {
    async updateOne() {
      return { modifiedCount: 0 };
    }
  };

  const updated = await persistNotificationsReadAtomically({
    Account,
    account,
    notificationIds: ['notification-one']
  });

  assert.equal(updated, 0);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FRIEND_ONLINE_NOTIFICATION_COOLDOWN_MS,
  FRIEND_SESSION_CHECK_INTERVAL_MS,
  syncFriendActivityNotifications
} = require('../../server/services/friend-activity-notifications');

const friendId = '111111111111111111111111';

function createHarness({
  lastSeenAt = new Date('2026-07-24T12:00:00.000Z'),
  showOnlineStatus = true
} = {}) {
  const friend = {
    _id: friendId,
    username: 'alex',
    profile: {
      oeIcon: 'alex-icon',
      privacySettings: { showOnlineStatus }
    },
    analytics: { lastSeenAt }
  };
  const account = {
    gameData: {
      friendsAndBlockedUsers: [{ accountId: friend, status: 'friends' }],
      friendNotificationStates: [],
      notifications: []
    },
    markedPaths: [],
    markModified(path) {
      this.markedPaths.push(path);
    }
  };
  let session = null;

  async function sync(now) {
    return syncFriendActivityNotifications({
      account,
      defaultOeIcon: 'default-icon',
      now,
      async getAccountInviteSession() {
        return session;
      },
      decorateInviteSession(value) {
        return value;
      }
    });
  }

  return {
    account,
    friend,
    setSession(value) {
      session = value;
    },
    sync
  };
}

function getPendingNotifications(account, type) {
  return account.gameData.notifications.filter(
    (notification) =>
      notification.type === type &&
      !notification.deliveredAt &&
      !notification.dismissedAt
  );
}

test('friend online notifications require a transition and respect cooldown', async () => {
  const baselineAt = new Date('2026-07-24T12:00:00.000Z');
  const harness = createHarness({ lastSeenAt: baselineAt });

  assert.deepEqual(await harness.sync(baselineAt), {
    changed: true,
    queued: 0
  });

  const offlineAt = new Date(
    baselineAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS * 6
  );
  await harness.sync(offlineAt);
  assert.equal(
    getPendingNotifications(harness.account, 'friend_online').length,
    0
  );

  const firstOnlineAt = new Date(
    offlineAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS
  );
  harness.friend.analytics.lastSeenAt = firstOnlineAt;
  const firstOnline = await harness.sync(firstOnlineAt);
  assert.equal(firstOnline.queued, 1);
  assert.equal(
    getPendingNotifications(harness.account, 'friend_online').length,
    1
  );

  const secondOfflineAt = new Date(
    firstOnlineAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS * 6
  );
  await harness.sync(secondOfflineAt);
  const secondOnlineAt = new Date(
    secondOfflineAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS
  );
  harness.friend.analytics.lastSeenAt = secondOnlineAt;
  const suppressed = await harness.sync(secondOnlineAt);
  assert.equal(suppressed.queued, 0);

  const cooldownOnlineAt = new Date(
    firstOnlineAt.getTime() +
      FRIEND_ONLINE_NOTIFICATION_COOLDOWN_MS +
      FRIEND_SESSION_CHECK_INTERVAL_MS
  );
  await harness.sync(
    new Date(cooldownOnlineAt.getTime() - FRIEND_SESSION_CHECK_INTERVAL_MS * 6)
  );
  harness.friend.analytics.lastSeenAt = cooldownOnlineAt;
  const afterCooldown = await harness.sync(cooldownOnlineAt);
  assert.equal(afterCooldown.queued, 1);
});

test('hidden online status establishes no observable presence history', async () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const harness = createHarness({ lastSeenAt: now, showOnlineStatus: false });

  await harness.sync(now);
  const state = harness.account.gameData.friendNotificationStates[0];
  assert.equal(state.presenceInitialized, false);
  assert.equal(state.wasOnline, false);
  assert.equal(
    getPendingNotifications(harness.account, 'friend_online').length,
    0
  );

  harness.friend.profile.privacySettings.showOnlineStatus = true;
  await harness.sync(
    new Date(now.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS)
  );
  assert.equal(
    getPendingNotifications(harness.account, 'friend_online').length,
    0
  );
});

test('joinable session notifications require a new session fingerprint', async () => {
  const baselineAt = new Date('2026-07-24T12:00:00.000Z');
  const harness = createHarness({
    lastSeenAt: new Date('2026-07-24T10:00:00.000Z')
  });

  await harness.sync(baselineAt);
  harness.setSession({
    type: 'party_game',
    key: 'truth-or-dare',
    code: 'ABC-123',
    lobbyPath: '/ABC-123',
    modeName: 'Truth or Dare'
  });
  const startedAt = new Date(
    baselineAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS
  );
  const started = await harness.sync(startedAt);
  assert.equal(started.queued, 1);

  const pending = getPendingNotifications(
    harness.account,
    'friend_joinable_session_started'
  );
  assert.equal(pending.length, 1);
  assert.equal(pending[0].metadata.lobbyPath, '/ABC-123');

  const unchanged = await harness.sync(
    new Date(startedAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS)
  );
  assert.equal(unchanged.queued, 0);

  harness.setSession(null);
  await harness.sync(
    new Date(startedAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS * 2)
  );
  assert.equal(
    getPendingNotifications(harness.account, 'friend_joinable_session_started')
      .length,
    0
  );

  harness.setSession({
    type: 'party_game',
    key: 'paranoia',
    code: 'XYZ-789',
    lobbyPath: '/XYZ-789',
    modeName: 'Paranoia'
  });
  const restarted = await harness.sync(
    new Date(startedAt.getTime() + FRIEND_SESSION_CHECK_INTERVAL_MS * 3)
  );
  assert.equal(restarted.queued, 1);
});

test('an already active session is only recorded as the first baseline', async () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  const harness = createHarness();
  harness.setSession({
    type: 'oling_battle',
    key: 'battle-olings',
    code: 'BAT-123',
    lobbyPath: '/olings/battle/BAT-123'
  });

  const result = await harness.sync(now);
  assert.equal(result.queued, 0);
  assert.equal(
    getPendingNotifications(harness.account, 'friend_joinable_session_started')
      .length,
    0
  );
});

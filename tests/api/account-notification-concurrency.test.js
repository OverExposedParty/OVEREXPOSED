const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountNotificationRoutes
} = require('../../server/routes/api-account-auth/notification-routes');
const {
  registerAccountControlsRoutes
} = require('../../server/routes/api-account-auth/controls-routes');
const {
  importLegacyProgressionNotifications,
  serializePendingAccountNotifications
} = require('../../server/services/account-notifications');

function createRouteHarness(registerRoutes, context) {
  const handlers = new Map();
  const app = {};
  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (path, handler) => handlers.set(`${method}:${path}`, handler);
  });
  registerRoutes({ app, ...context });
  return handlers;
}

function createResponseHarness() {
  return {
    error: null,
    success: null,
    apiError(payload) {
      this.error = payload;
    },
    apiSuccess(payload) {
      this.success = payload;
    }
  };
}

test('notification polling reloads the account after a version conflict', async () => {
  let loadCount = 0;
  const accounts = [
    {
      async save() {
        const error = new Error('stale account');
        error.name = 'VersionError';
        throw error;
      }
    },
    { async save() {} }
  ];
  const handlers = createRouteHarness(registerAccountNotificationRoutes, {
    async getCurrentAccount() {
      const account = accounts[loadCount];
      loadCount += 1;
      return account;
    },
    async populateFriendRelationships() {},
    importLegacyNotifications() {
      return 1;
    },
    async syncFriendActivityNotifications() {
      return { changed: false, queued: 0 };
    },
    serializePendingNotifications() {
      return [];
    },
    serializeInboxNotifications() {
      return [];
    },
    countUnreadNotifications() {
      return 0;
    }
  });
  const handler = handlers.get('get:/api/accounts/notifications');
  const res = createResponseHarness();

  await handler({ id: 'request-one' }, res);

  assert.equal(loadCount, 2);
  assert.equal(res.error, null);
  assert.deepEqual(res.success, {
    notifications: [],
    inboxNotifications: [],
    unreadCount: 0
  });
});

test('progression notification polling ignores unrelated dirty account paths', async () => {
  let saveCount = 0;
  const account = {
    gameData: {
      achievements: [],
      opalTransactions: [],
      notifications: []
    },
    isModified() {
      return true;
    },
    async save() {
      saveCount += 1;
    }
  };
  const handlers = createRouteHarness(registerAccountControlsRoutes, {
    async getCurrentAccount() {
      return account;
    },
    importLegacyProgressionNotifications,
    serializePendingAccountNotifications
  });
  const handler = handlers.get('get:/api/accounts/me/notifications');
  const res = createResponseHarness();

  await handler({ id: 'request-two' }, res);

  assert.equal(saveCount, 0);
  assert.equal(res.error, null);
  assert.deepEqual(res.success, { notifications: [] });
});

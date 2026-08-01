const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelUserAdminRoutes
} = require('../../server/routes/api-oe-panel-user-admin');
const {
  createApiRouteContext
} = require('../../server/routes/api-route-context');

test('OE Panel user-admin routes preserve their endpoint contract and order', () => {
  const registered = [];
  const app = {
    get(path) {
      registered.push(`GET ${path}`);
    },
    post(path) {
      registered.push(`POST ${path}`);
    },
    delete(path) {
      registered.push(`DELETE ${path}`);
    }
  };

  registerOePanelUserAdminRoutes({ app });

  assert.deepEqual(registered, [
    'GET /api/oe-panel/admin-logs',
    'GET /api/oe-panel/admin-logs/export',
    'POST /api/oe-panel/admin-logs/archive',
    'GET /api/oe-panel/users/search',
    'GET /api/oe-panel/users',
    'POST /api/oe-panel/users/opals/add',
    'POST /api/oe-panel/users/opals/remove',
    'DELETE /api/oe-panel/users/:accountId'
  ]);
});

test('GET /api/oe-panel/users serializes users after route-context composition', async () => {
  const handlers = new Map();
  const app = {
    get(path, handler) {
      handlers.set(`GET ${path}`, handler);
    },
    post() {},
    delete() {}
  };
  const lastSeenAt = new Date('2026-07-17T12:34:00.000Z');
  const account = {
    _id: 'account-1',
    username: 'panel-user',
    email: 'panel-user@example.com',
    createdAt: new Date('2026-07-01T09:00:00.000Z'),
    analytics: { lastSeenAt },
    gameData: { totalPlaytimeSeconds: 3660 }
  };
  const createQuery = (rows) => ({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    async lean() {
      return rows;
    }
  });
  let accountFindCount = 0;
  const Account = {
    find() {
      accountFindCount += 1;
      return createQuery(accountFindCount === 1 ? [account] : []);
    },
    async aggregate() {
      return [];
    },
    async countDocuments() {
      return 0;
    }
  };
  const Report = {
    find() {
      return createQuery([]);
    }
  };
  const AdminLog = {
    find() {
      return createQuery([]);
    }
  };
  const context = createApiRouteContext({
    app,
    models: { Account, Report, AdminLog },
    runtime: {}
  });
  context.requireOePanelAccount = async () => ({ _id: 'admin-1' });

  registerOePanelUserAdminRoutes(context);
  const usersHandler = handlers.get('GET /api/oe-panel/users');
  assert.equal(typeof usersHandler, 'function');

  let result;
  let routeError;
  await usersHandler(
    { id: 'user-list-test' },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(routeError, undefined);
  assert.equal(result.data.users.length, 1);
  assert.equal(result.data.users[0].playtime, '1h 1m');
  assert.equal(result.data.users[0].lastSeen, lastSeenAt.toLocaleString());
});

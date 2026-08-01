const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountSessionsRoutes
} = require('../../server/routes/api-account-auth/sessions-routes');

test('account activity updates the matching session last-used timestamp', async () => {
  const handlers = new Map();
  const updates = [];
  const app = {};
  ['get', 'post'].forEach((method) => {
    app[method] = (path, handler) => handlers.set(`${method}:${path}`, handler);
  });

  registerAccountSessionsRoutes({
    app,
    Account: {
      async updateOne(filter, update, options) {
        updates.push({ filter, update, options });
      }
    },
    async getCurrentAccount() {
      return { _id: 'account-one' };
    },
    getCookieValue() {
      return 'session-token';
    },
    hashSessionToken(token) {
      return `hashed:${token}`;
    }
  });

  let payload;
  await handlers.get('post:/api/accounts/activity')(
    { headers: { cookie: 'oe_session=session-token' } },
    {
      apiSuccess(value) {
        payload = value;
      }
    }
  );

  assert.ok(payload.lastSeenAt instanceof Date);
  assert.deepEqual(updates[0].filter, { _id: 'account-one' });
  assert.equal(
    updates[0].update.$set['analytics.lastSeenAt'],
    payload.lastSeenAt
  );
  assert.equal(
    updates[0].update.$set['security.sessions.$[session].lastUsedAt'],
    payload.lastSeenAt
  );
  assert.deepEqual(updates[0].options, {
    arrayFilters: [{ 'session.tokenHash': 'hashed:session-token' }]
  });
});

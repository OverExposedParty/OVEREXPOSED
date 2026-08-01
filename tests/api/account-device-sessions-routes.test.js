const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountDeviceSessionsRoutes
} = require('../../server/routes/api-account-auth/device-sessions-routes');

function createRouteFixture() {
  const handlers = new Map();
  const updates = [];
  const app = {};
  ['get', 'post', 'delete'].forEach((method) => {
    app[method] = (path, handler) => handlers.set(`${method}:${path}`, handler);
  });

  const account = {
    _id: 'account-one',
    security: {
      sessions: [
        {
          sessionId: 'current-session-id-1',
          tokenHash: 'hashed:current-token',
          device: {
            browser: 'Chrome 126',
            os: 'Windows',
            deviceType: 'Desktop'
          },
          createdAt: new Date('2026-07-30T12:00:00.000Z'),
          lastUsedAt: new Date('2026-07-31T12:00:00.000Z'),
          expiresAt: new Date('2026-08-30T12:00:00.000Z')
        },
        {
          sessionId: 'another-session-id1',
          tokenHash: 'hashed:another-token',
          device: { browser: 'Safari 18', os: 'iOS 18', deviceType: 'Mobile' },
          createdAt: new Date('2026-07-29T12:00:00.000Z'),
          lastUsedAt: new Date('2026-07-31T11:00:00.000Z'),
          expiresAt: new Date('2026-08-29T12:00:00.000Z')
        }
      ]
    }
  };

  registerAccountDeviceSessionsRoutes({
    app,
    Account: {
      async updateOne(filter, update, options) {
        updates.push({ filter, update, options });
      }
    },
    async getCurrentAccount() {
      return account;
    },
    getCookieValue() {
      return 'current-token';
    },
    hashSessionToken(token) {
      return `hashed:${token}`;
    }
  });

  return { account, handlers, updates };
}

function createResponseRecorder() {
  const result = {};
  return {
    result,
    response: {
      apiSuccess(payload) {
        result.success = payload;
      },
      apiError(payload) {
        result.error = payload;
      }
    }
  };
}

test('session list marks the current device without exposing secrets', async () => {
  const { handlers } = createRouteFixture();
  const { response, result } = createResponseRecorder();

  await handlers.get('get:/api/accounts/sessions')(
    { headers: { cookie: 'oe_session=current-token' } },
    response
  );

  assert.equal(result.success.sessions.length, 2);
  assert.equal(result.success.sessions[0].current, true);
  assert.equal('tokenHash' in result.success.sessions[0], false);
  assert.equal('ipAddress' in result.success.sessions[0], false);
});

test('individual session revocation removes only the requested other session', async () => {
  const { handlers, updates } = createRouteFixture();
  const { response, result } = createResponseRecorder();

  await handlers.get('delete:/api/accounts/sessions/:sessionId')(
    {
      headers: { cookie: 'oe_session=current-token' },
      params: { sessionId: 'another-session-id1' }
    },
    response
  );

  assert.equal(result.success.message, 'Device signed out');
  assert.deepEqual(updates[0].update, {
    $pull: {
      'security.sessions': {
        sessionId: 'another-session-id1',
        tokenHash: { $ne: 'hashed:current-token' }
      }
    }
  });
});

test('individual session revocation rejects the current session', async () => {
  const { handlers, updates } = createRouteFixture();
  const { response, result } = createResponseRecorder();

  await handlers.get('delete:/api/accounts/sessions/:sessionId')(
    {
      headers: { cookie: 'oe_session=current-token' },
      params: { sessionId: 'current-session-id-1' }
    },
    response
  );

  assert.equal(result.error.status, 409);
  assert.equal(result.error.code, 'current_session_requires_logout');
  assert.equal(updates.length, 0);
});

test('logout-others preserves the current token hash', async () => {
  const { handlers, updates } = createRouteFixture();
  const { response, result } = createResponseRecorder();

  await handlers.get('post:/api/accounts/sessions/logout-others')(
    { headers: { cookie: 'oe_session=current-token' } },
    response
  );

  assert.equal(result.success.message, 'Other devices signed out');
  assert.deepEqual(updates[0].update, {
    $pull: {
      'security.sessions': { tokenHash: { $ne: 'hashed:current-token' } }
    }
  });
});

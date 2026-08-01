const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createApiRouteContext
} = require('../../server/routes/api-route-context');

test('API route context preserves its public helper contract', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  assert.equal(Object.keys(context).length, 227);
  assert.equal(Object.hasOwn(context, 'EmailTemplate'), true);
  assert.equal(Object.hasOwn(context, 'emailConnection'), true);
  [
    'createGamePackUpdatePayload',
    'createGameRoleUpdatePayload',
    'buildOverexposurePostReport',
    'serializeOePanelUser',
    'assertAuthThrottle',
    'establishAccountSession',
    'serializeAccount',
    'serializeActiveRoom'
  ].forEach((key) => assert.equal(typeof context[key], 'function', key));
});

test('role panel payloads preserve nullable descriptions and validate selection integers', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  assert.deepEqual(
    context.createGameRoleUpdatePayload({
      description: '  ',
      faction: 'civilian',
      defaultCount: '2',
      fillRemaining: 'no'
    }),
    {
      update: {
        description: null,
        faction: 'civilian',
        'selection.fillRemaining': false,
        'selection.defaultCount': 2
      }
    }
  );
  assert.match(
    context.createGameRoleUpdatePayload({ increment: 0 }).error,
    /valid integers/
  );
});

test('party content panel serializers retain descriptions as metadata', () => {
  const context = createApiRouteContext({
    app: {},
    models: {},
    runtime: {}
  });

  const role = context.serializePartyRoleForPanel({
    gameType: 'mafia',
    key: 'inspector',
    title: 'Inspector',
    description: null,
    faction: 'civilian',
    enabled: true,
    status: 'published',
    selection: {
      defaultCount: 1,
      increment: 1,
      minimum: 0,
      maximum: 15,
      fillRemaining: false
    },
    assets: {}
  });

  assert.equal(role.description, '');
  assert.equal(role.details.description, '');
  assert.equal(role.defaultCount, '1');
});

test('OAuth session establishment receives account helpers after composition', async () => {
  const updates = [];
  const Account = {
    async updateOne(filter, update) {
      updates.push({ filter, update });
    }
  };
  const context = createApiRouteContext({
    app: {},
    models: { Account },
    runtime: {}
  });
  const cookies = [];
  const account = {
    _id: 'account-1',
    profile: {},
    security: { sessions: [], loginHistory: [] }
  };

  await context.establishAccountSession(
    {
      id: 'request-1',
      headers: {},
      ip: '127.0.0.1',
      secure: false,
      get(name) {
        return name === 'user-agent' ? 'route-context-test' : null;
      }
    },
    {
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      }
    },
    account
  );

  assert.equal(updates.length, 2);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'oe_session');
  assert.equal(typeof cookies[0].value, 'string');
  assert.ok(cookies[0].value.length > 20);
});

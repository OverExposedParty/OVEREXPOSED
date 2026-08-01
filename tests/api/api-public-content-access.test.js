const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerPublicContentRoutes
} = require('../../server/routes/api-public-content');

function createQuery(items) {
  return {
    sort() {
      return {
        lean: async () => items
      };
    }
  };
}

function createRouteHarness(hostAccount, { activePartyOnly = false } = {}) {
  const handlers = new Map();
  const rules = [
    {
      gameType: 'truth-or-dare',
      scope: 'gamemode',
      appliesTo: ['truth-or-dare'],
      key: 'prompt-heist',
      title: 'Prompt Heist',
      enabled: true,
      status: 'published',
      buttonType: 'toggle'
    },
    {
      gameType: 'truth-or-dare',
      scope: 'gamemode',
      appliesTo: ['truth-or-dare'],
      key: 'rounds',
      title: 'Rounds',
      enabled: true,
      status: 'published',
      buttonType: 'increment'
    }
  ];
  const packs = [
    {
      gameType: 'truth-or-dare',
      slug: 'classic',
      key: 'truth-or-dare-classic',
      title: 'Classic',
      enabled: true,
      status: 'published',
      assets: {}
    }
  ];
  const roles = [
    {
      gameType: 'mafia',
      key: 'civilian',
      title: 'Civilian',
      faction: 'civilian',
      enabled: true,
      status: 'published',
      selection: {
        defaultCount: 0,
        increment: 1,
        minimum: 0,
        maximum: 20,
        fillRemaining: true
      },
      assets: {}
    },
    {
      gameType: 'mafia',
      key: 'inspector',
      title: 'Inspector',
      faction: 'civilian',
      enabled: true,
      status: 'published',
      access: {
        type: 'feature',
        feature: 'party-games.prompt-heist'
      },
      selection: {
        defaultCount: 1,
        increment: 1,
        minimum: 0,
        maximum: 15,
        fillRemaining: false
      },
      assets: {}
    }
  ];

  registerPublicContentRoutes({
    app: {
      get(route, handler) {
        handlers.set(route, handler);
      }
    },
    models: {
      Account: {
        findById: async (accountId) => {
          assert.equal(accountId, 'original-host');
          return hostAccount;
        }
      },
      GameRule: {
        find: () => createQuery(rules)
      },
      GamePack: {
        find: () => createQuery(packs)
      },
      GameRole: {
        find: () => createQuery(roles)
      },
      waitingRoomSchema: {
        findOne: () => ({
          lean: async () =>
            activePartyOnly
              ? null
              : {
                  session: {
                    access: { originalHostAccountId: 'original-host' }
                  },
                  state: { hostComputerId: 'current-host-device' },
                  players: []
                }
        })
      },
      partyGameTruthOrDareSchema: {
        findOne: () => ({
          lean: async () => ({
            session: {
              access: { originalHostAccountId: 'original-host' }
            },
            state: { hostComputerId: 'current-host-device' },
            players: []
          })
        })
      }
    }
  });

  return { handlers };
}

async function invoke(handler, query = {}, gamemode = 'truth-or-dare') {
  let result = null;
  await handler(
    {
      id: 'request-one',
      headers: {},
      params: { gamemode },
      query
    },
    {
      apiSuccess(payload) {
        result = payload;
      },
      apiError(payload) {
        throw new Error(payload.message);
      }
    }
  );
  return result;
}

test('guest catalogs hide Prompt Heist while retaining public content', async () => {
  const { handlers } = createRouteHarness(null);
  const result = await invoke(
    handlers.get('/api/party-game-rules/:gamemode')
  );

  assert.deepEqual(
    result.data['truth-or-dare-settings'].map(
      (rule) => rule['settings-name']
    ),
    ['rounds']
  );
});

test('waiting-room catalogs use the original beta host for every viewer', async () => {
  const { handlers } = createRouteHarness({
    access: { roles: ['beta_tester'], features: [] }
  });
  const result = await invoke(
    handlers.get('/api/party-game-rules/:gamemode'),
    { partyCode: 'ABC-123' }
  );

  assert.deepEqual(
    result.data['truth-or-dare-settings'].map(
      (rule) => rule['settings-name']
    ),
    ['prompt-heist', 'rounds']
  );
});

test('all currently public packs remain visible in a regular-host room', async () => {
  const { handlers } = createRouteHarness({
    access: { roles: [], features: [] }
  });
  const result = await invoke(
    handlers.get('/api/party-game-packs/:gamemode'),
    { partyCode: 'ABC-123' }
  );

  assert.deepEqual(
    result.data['truth-or-dare-packs'].map((pack) => pack['pack-name']),
    ['classic']
  );
});

test('active games retain the original host content catalog', async () => {
  const { handlers } = createRouteHarness(
    { access: { roles: ['beta_tester'], features: [] } },
    { activePartyOnly: true }
  );
  const result = await invoke(
    handlers.get('/api/party-game-rules/:gamemode'),
    { partyCode: 'ABC-123' }
  );

  assert.deepEqual(
    result.data['truth-or-dare-settings'].map(
      (rule) => rule['settings-name']
    ),
    ['prompt-heist', 'rounds']
  );
});

test('regular hosts only receive public roles', async () => {
  const { handlers } = createRouteHarness({
    access: { roles: [], features: [] }
  });
  const result = await invoke(
    handlers.get('/api/party-game-roles/:gamemode'),
    { partyCode: 'ABC-123' },
    'mafia'
  );

  assert.deepEqual(
    result.data['mafia-roles'].map((role) => role['role-name']),
    ['civilian']
  );
});

test('eligible hosts receive restricted roles through the role catalog', async () => {
  const { handlers } = createRouteHarness({
    access: { roles: ['beta_tester'], features: [] }
  });
  const result = await invoke(
    handlers.get('/api/party-game-roles/:gamemode'),
    { partyCode: 'ABC-123' },
    'mafia'
  );

  assert.deepEqual(
    result.data['mafia-roles'].map((role) => role['role-name']),
    ['civilian', 'inspector']
  );
});

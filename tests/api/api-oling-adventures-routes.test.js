const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOlingAdventuresRoutes
} = require('../../server/routes/api-olings/adventures-routes');

function setPath(target, path, value) {
  const keys = path.split('.');
  let cursor = target;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] ||= {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

function createAccount() {
  return {
    _id: 'account-1',
    gameData: {
      level: 1,
      xp: 490,
      opals: { balance: 10, lifetimeEarned: 20, lifetimeSpent: 10 },
      opalTransactions: []
    },
    olings: {
      adventures: { active: null, history: [] },
      lab: {
        placedItems: [{ placedId: 'door-1', itemId: 'gateway' }]
      }
    },
    set(path, value) {
      setPath(this, path, value);
    },
    markModified() {},
    async save() {
      this.saveCount = Number(this.saveCount || 0) + 1;
      return this;
    }
  };
}

function createResponse() {
  return {
    payload: null,
    error: null,
    apiSuccess(payload) {
      this.payload = payload;
      return payload;
    },
    apiError(error) {
      this.error = error;
      return error;
    }
  };
}

function createHarness({ stored = false } = {}) {
  const handlers = new Map();
  const account = createAccount();
  const oling = {
    _id: 'oling-1',
    name: 'Pip',
    residency: stored ? { state: 'stored' } : { state: 'active' },
    care: { isSleeping: false }
  };
  const adventures = [
    {
      key: 'backyard-path',
      name: 'Backyard Path',
      durationMs: 300000,
      energyCost: 10,
      rewards: { accountXp: 20, opals: 2 }
    }
  ];
  const PlayerOling = {
    find(filter) {
      this.lastFindFilter = filter;
      return { sort: async () => [oling] };
    },
    async findOne() {
      return oling;
    }
  };

  registerOlingAdventuresRoutes({
    app: {
      get(path, handler) {
        handlers.set(`GET ${path}`, handler);
      },
      post(path, handler) {
        handlers.set(`POST ${path}`, handler);
      }
    },
    getCurrentAccount: async () => account,
    getOrCreateOlingState: async () => ({}),
    OlingState: {},
    PlayerOling,
    getOlingDefinitions: async () => ({}),
    models: {},
    OLING_ADVENTURES: adventures,
    serializePlayerOling: (value) => ({ id: String(value._id) }),
    OlingLabItems: {
      gateway: { type: 'door', exitGridPlacement: { row: 0, col: 0 } }
    },
    spendOlingEnergy: async ({ amount }) => ({ energyAfter: 100 - amount })
  });

  return { account, handlers, PlayerOling };
}

test('Adventure catalog exposes account rewards without Oling level requirements', async () => {
  const { handlers } = createHarness();
  const response = createResponse();

  await handlers.get('GET /api/olings/adventures')(
    { id: 'request-1' },
    response
  );

  assert.equal(response.error, null);
  assert.deepEqual(response.payload.adventures[0].rewards, {
    accountXp: 20,
    opals: 2
  });
  assert.equal('recommendedLevel' in response.payload.adventures[0], false);
  assert.equal('possibleRewards' in response.payload.adventures[0], false);
});

test('Adventure completion grants account XP and Opals exactly once', async () => {
  const { account, handlers } = createHarness();
  const startResponse = createResponse();

  await handlers.get('POST /api/olings/adventures/start')(
    {
      id: 'request-1',
      body: {
        adventureKey: 'backyard-path',
        olingId: 'oling-1',
        doorPlacedId: 'door-1'
      }
    },
    startResponse
  );

  assert.equal(startResponse.error, null);
  assert.ok(startResponse.payload.active.runId);
  assert.deepEqual(startResponse.payload.active.rewards, {
    accountXp: 20,
    opals: 2
  });

  const runId = startResponse.payload.active.runId;
  account.olings.adventures.active.completesAt = new Date(Date.now() - 1000);
  const returnResponse = createResponse();
  await handlers.get('POST /api/olings/adventures/return')(
    { id: 'request-2', body: { runId } },
    returnResponse
  );

  assert.equal(returnResponse.error, null);
  assert.equal(returnResponse.payload.alreadyClaimed, false);
  assert.deepEqual(returnResponse.payload.rewards, {
    accountXp: 20,
    opals: 2
  });
  assert.equal(account.gameData.xp, 510);
  assert.equal(account.gameData.level, 2);
  assert.equal(account.gameData.opals.balance, 12);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.olings.adventures.active, null);
  assert.equal(account.olings.adventures.history.length, 1);

  const retryResponse = createResponse();
  await handlers.get('POST /api/olings/adventures/return')(
    { id: 'request-3', body: { runId } },
    retryResponse
  );

  assert.equal(retryResponse.error, null);
  assert.equal(retryResponse.payload.alreadyClaimed, true);
  assert.equal(account.gameData.xp, 510);
  assert.equal(account.gameData.opals.balance, 12);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.olings.adventures.history.length, 1);
});

test('Adventure choices query only active Olings', async () => {
  const { handlers, PlayerOling } = createHarness();
  const response = createResponse();

  await handlers.get('GET /api/olings/adventures')(
    { id: 'request-active-filter' },
    response
  );

  assert.deepEqual(PlayerOling.lastFindFilter, {
    ownerId: 'account-1',
    'residency.state': { $ne: 'stored' }
  });
});

test('Stored Olings cannot start an adventure', async () => {
  const { handlers } = createHarness({ stored: true });
  const response = createResponse();

  await handlers.get('POST /api/olings/adventures/start')(
    {
      id: 'request-stored',
      body: {
        adventureKey: 'backyard-path',
        olingId: 'oling-1',
        doorPlacedId: 'door-1'
      }
    },
    response
  );

  assert.equal(response.error.code, 'oling_stored');
  assert.equal(response.error.status, 409);
});

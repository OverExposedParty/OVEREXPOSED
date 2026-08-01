const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOePanelOlingRoutes
} = require('../../server/routes/api-oe-panel-olings');

test('OE panel Oling routes preserve their endpoint contract and order', () => {
  const registeredRoutes = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (route) => registeredRoutes.push([method, route]);
  });

  registerOePanelOlingRoutes({
    app,
    models: {},
    parseBooleanLabel: () => null
  });

  assert.deepEqual(registeredRoutes, [
    ['get', '/api/oe-panel/olings'],
    ['post', '/api/oe-panel/olings/consumables/export'],
    ['post', '/api/oe-panel/olings/eggs'],
    ['patch', '/api/oe-panel/olings/eggs/:key'],
    ['delete', '/api/oe-panel/olings/eggs/:key'],
    ['patch', '/api/oe-panel/olings/traits/:key'],
    ['post', '/api/oe-panel/olings/simulate']
  ]);
});

function createLeanQuery(rows) {
  const query = {
    sort() {
      return query;
    },
    limit() {
      return query;
    },
    select() {
      return query;
    },
    async lean() {
      return rows;
    }
  };

  return query;
}

function createFindModel(rows = []) {
  return {
    find() {
      return createLeanQuery(rows);
    }
  };
}

test('OE panel Oling dashboard handler serializes eggs with assigned build sets', async () => {
  const routes = new Map();
  const app = {
    get(route, handler) {
      routes.set(`get ${route}`, handler);
    },
    post() {},
    patch() {},
    delete() {}
  };
  const buildSet = {
    key: 'sunny-set',
    name: 'Sunny Set',
    collection: 'base',
    rarity: 'common',
    status: 'published',
    enabled: true,
    traits: {
      flight: 'sunny-flight',
      body: 'sunny-body',
      eyes: 'sunny-eyes',
      mouth: 'sunny-mouth'
    },
    metadata: {}
  };
  const traits = Object.entries(buildSet.traits).map(([layer, key]) => ({
    key,
    name: key,
    collection: 'base',
    theme: 'sunny',
    layer,
    rarity: 'common',
    status: 'published',
    enabled: true
  }));
  const hatchReceipt = {
    _id: 'receipt-1',
    ownerId: 'owner-1',
    eggKey: 'base-egg',
    olingId: 'oling-1',
    rolls: Object.fromEntries(
      Object.entries(buildSet.traits).map(([layer, traitKey]) => [
        layer,
        { traitKey }
      ])
    ),
    inventoryChange: { eggs: -1, olings: 1 },
    request: { userAgent: 'test-agent' },
    createdAt: '2026-07-17T12:00:00.000Z'
  };
  const playerOling = {
    _id: 'oling-1',
    ownerId: 'owner-1',
    eggKey: 'base-egg',
    personalityKey: 'friendly',
    build: buildSet.traits,
    buildRarities: Object.fromEntries(
      Object.keys(buildSet.traits).map((layer) => [layer, 'common'])
    ),
    battleStats: { wins: 2 },
    hatchedAt: '2026-07-17T12:00:00.000Z'
  };
  const emptyFindModel = createFindModel();
  const models = {
    Account: createFindModel([
      { _id: 'owner-1', username: 'Oling Owner', email: 'owner@example.com' }
    ]),
    Achievement: emptyFindModel,
    GameMode: emptyFindModel,
    GamePack: emptyFindModel,
    GameRule: emptyFindModel,
    OlingBuildSet: createFindModel([buildSet]),
    OlingConsumable: emptyFindModel,
    OlingEgg: createFindModel([
      {
        key: 'base-egg',
        name: 'Base Egg',
        collection: 'base',
        status: 'published',
        enabled: true,
        setKeys: [buildSet.key],
        rarityOdds: { common: 100 },
        personalityPool: [],
        assets: {},
        metadata: {}
      }
    ]),
    OlingHatchReceipt: {
      ...createFindModel([hatchReceipt]),
      async aggregate() {
        return [{ _id: 'base-egg', count: 1 }];
      },
      async countDocuments() {
        return 1;
      }
    },
    OlingPersonality: emptyFindModel,
    OlingTrait: createFindModel(traits),
    PlayerOling: {
      ...createFindModel([playerOling]),
      async countDocuments() {
        return 1;
      }
    }
  };

  registerOePanelOlingRoutes({
    app,
    models,
    ...models,
    formatOePanelDateTime: (value) => value || '-',
    parseBooleanLabel: () => null,
    requireOePanelAccount: async () => ({ _id: 'admin-account' })
  });

  let successPayload;
  let errorPayload;
  await routes.get('get /api/oe-panel/olings')(
    { id: 'oling-dashboard-test' },
    {
      apiSuccess(payload) {
        successPayload = payload;
      },
      apiError(payload) {
        errorPayload = payload;
      }
    }
  );

  assert.equal(errorPayload, undefined);
  assert.equal(successPayload.data.stats.totalEggs, 1);
  assert.equal(successPayload.data.eggs[0].setRarities, 'common');
  assert.equal(successPayload.data.buildSets[0].setKey, buildSet.key);
  assert.equal(successPayload.data.hatchReceipts[0].owner, 'Oling Owner');
  assert.match(successPayload.data.hatchReceipts[0].summary, /sunny-flight/);
  assert.equal(successPayload.data.playerOlings[0].matchingSet, 'sunny');
  assert.equal(successPayload.data.rarityBalancer[0].rarity, 'common');
});

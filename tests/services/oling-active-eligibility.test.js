const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOlingCareRoutes
} = require('../../server/routes/api-olings/care-routes');
const {
  snapshotBattleOling
} = require('../../server/services/oling-battles/battle-players');
const {
  assertClashPlayerEligible
} = require('../../server/services/oling-clashes/match-lifecycle');
const {
  snapshotClashTeam
} = require('../../server/services/oling-clashes/snapshots');
const {
  __test: { getTransactionCompatibleModel },
  hatchOling,
  useOlingConsumable
} = require('../../server/services/olings/interactions');
const { spendOlingEnergy } = require('../../server/services/olings/energy');

function createQuery(value) {
  return {
    lean: async () => value,
    session() {
      return this;
    },
    sort() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    }
  };
}

function createStoredOling() {
  return {
    _id: 'oling-stored',
    ownerId: 'account-1',
    residency: { state: 'stored', labSlot: null },
    care: { energy: 100, isSleeping: false }
  };
}

test('stored Olings reject consumables, activities, and sleep changes', async () => {
  const storedOling = createStoredOling();
  const PlayerOling = {
    findOne: () => createQuery(storedOling)
  };
  const OlingConsumable = {
    findOne: () =>
      createQuery({
        key: 'o-juice',
        target: 'oling',
        effect: { type: 'energy', restoreToEnergy: 75 }
      })
  };

  const consumableResult = await useOlingConsumable({
    models: { OlingConsumable, PlayerOling },
    accountId: 'account-1',
    olingId: storedOling._id,
    consumableKey: 'o-juice'
  });
  assert.equal(consumableResult.error.code, 'oling_stored');

  const activityResult = await spendOlingEnergy({
    PlayerOling,
    accountId: 'account-1',
    olingId: storedOling._id,
    amount: 5
  });
  assert.equal(activityResult.error.code, 'oling_stored');

  const handlers = new Map();
  registerOlingCareRoutes({
    app: {
      get(path, handler) {
        handlers.set(`GET ${path}`, handler);
      },
      post(path, handler) {
        handlers.set(`POST ${path}`, handler);
      },
      patch(path, handler) {
        handlers.set(`PATCH ${path}`, handler);
      }
    },
    getCurrentAccount: async () => ({
      _id: 'account-1',
      olings: { adventures: { active: null } }
    }),
    PlayerOling
  });
  const response = {
    apiError(error) {
      this.error = error;
    }
  };
  await handlers.get('PATCH /api/olings/:olingId/sleep')(
    {
      id: 'request-1',
      body: { isSleeping: true },
      params: { olingId: storedOling._id }
    },
    response
  );
  assert.equal(response.error.code, 'oling_stored');
});

test('stored Olings cannot be selected for battles or Clash teams', async () => {
  const storedOling = createStoredOling();
  const PlayerOling = {
    findOne: () => createQuery(storedOling),
    find: () => createQuery([storedOling, { _id: 'two' }, { _id: 'three' }])
  };

  await assert.rejects(
    snapshotBattleOling({ PlayerOling }, { _id: 'account-1' }, storedOling._id),
    (error) => error.code === 'oling_stored' && error.status === 409
  );
  await assert.rejects(
    snapshotClashTeam(
      { PlayerOling },
      { _id: 'account-1' },
      [storedOling._id, 'two', 'three'],
      {}
    ),
    (error) => error.code === 'oling_stored' && error.status === 409
  );
});

test('Clash eligibility counts only active and legacy-active Olings', async () => {
  let countFilter = null;
  const models = {
    PlayerOling: {
      async countDocuments(filter) {
        countFilter = filter;
        return 2;
      }
    }
  };

  await assert.rejects(
    assertClashPlayerEligible(models, { _id: 'account-1' }),
    (error) => error.code === 'oling_clash_three_olings_required'
  );
  assert.deepEqual(countFilter, {
    ownerId: 'account-1',
    'residency.state': { $ne: 'stored' }
  });
});

test('hatch receipts use the transaction client while staying in the Olings database', () => {
  const compatibleReceiptModel = { modelName: 'OlingHatchReceipt' };
  const receiptSchema = { path: () => null };
  const calls = [];
  const transactionConnection = {
    useDb(databaseName, options) {
      calls.push({ databaseName, options });
      return {
        models: {},
        model(modelName, schema, collectionName) {
          calls.push({ modelName, schema, collectionName });
          return compatibleReceiptModel;
        }
      };
    }
  };
  const receiptModel = {
    db: { name: 'olings' },
    modelName: 'OlingHatchReceipt',
    schema: receiptSchema,
    collection: { name: 'oling-hatch-receipts' }
  };

  assert.equal(
    getTransactionCompatibleModel(receiptModel, transactionConnection),
    compatibleReceiptModel
  );
  assert.deepEqual(calls, [
    { databaseName: 'olings', options: { useCache: true } },
    {
      modelName: 'OlingHatchReceipt',
      schema: receiptSchema,
      collectionName: 'oling-hatch-receipts'
    }
  ]);
});

function createHatchModels(
  activeOlingCount,
  influenceSlots = [],
  consumableQuantity = 0
) {
  const transactionSession = { id: 'hatch-session' };
  let transactionReceiptModel = null;
  const connection = {
    async transaction(operation) {
      return operation(transactionSession);
    },
    useDb(databaseName) {
      assert.equal(databaseName, 'olings');
      return {
        models: { OlingHatchReceipt: transactionReceiptModel }
      };
    }
  };
  const egg = {
    key: 'base-egg',
    collection: 'base',
    setKeys: ['base-set'],
    rarityOdds: { common: 100 }
  };
  const buildSet = {
    key: 'base-set',
    rarity: 'common',
    traits: {
      body: 'body-trait',
      eyes: 'eyes-trait',
      mouth: 'mouth-trait',
      flight: 'flight-trait'
    }
  };
  const account = {
    _id: 'account-1',
    olings: {
      eggs: [{ key: 'base-egg', quantity: 1 }],
      consumables:
        consumableQuantity > 0
          ? [{ key: 'oling-blanket', quantity: consumableQuantity }]
          : [],
      furniture: [],
      pods: [],
      wallDecorations: [],
      olings: [],
      hatchHistory: [],
      adventures: { active: null, history: [] },
      lab: {
        placedItems: [
          {
            placedId: 'incubator-1',
            inventorySlots: [
              {
                slotId: 'egg',
                slotType: 'egg',
                itemKey: 'base-egg',
                placedAt: '2026-09-05T12:00:00.000Z',
                influenceSlots
              }
            ],
            containerSlots: []
          }
        ]
      }
    },
    markModified() {},
    async save() {
      return this;
    }
  };
  let createdOlingPayload = null;
  let accountUpdateSession = null;
  let receiptCreateCount = 0;
  let receiptPayload = null;
  let receiptCreateSession = null;
  const activeOlings = Array.from({ length: activeOlingCount }, (_, index) => ({
    _id: `active-${index + 1}`,
    residency: { state: 'active', labSlot: index + 1 }
  }));

  const Account = {
    db: connection,
    findById: () => createQuery(account),
    async findOneAndUpdate(_filter, _update, options) {
      accountUpdateSession = options.session;
      account.olings.eggs[0].quantity -= 1;
      return account;
    }
  };
  const OlingState = {
    db: connection,
    findOne: () => createQuery(null)
  };
  const PlayerOling = {
    db: connection,
    find: () => createQuery(activeOlings),
    async create([payload], options) {
      createdOlingPayload = payload;
      return [{ _id: 'new-oling', ...payload, createSession: options.session }];
    }
  };
  const OlingTrait = {
    findOne: (filter) =>
      createQuery({
        key: filter.key,
        layer: filter.layer,
        rarity: filter.rarity
      }),
    find: () =>
      createQuery(
        Object.entries(buildSet.traits).map(([layer, key]) => ({ key, layer }))
      )
  };
  const OlingEgg = {
    findOne: () => createQuery(egg),
    find: () => createQuery([egg])
  };
  const OlingBuildSet = {
    find: () => createQuery([buildSet])
  };
  transactionReceiptModel = {
    async create([payload], options) {
      receiptCreateCount += 1;
      receiptPayload = payload;
      receiptCreateSession = options.session;
      return [{ _id: 'receipt-1', ...payload }];
    }
  };
  const OlingHatchReceipt = {
    db: { name: 'olings' },
    modelName: 'OlingHatchReceipt',
    schema: {},
    collection: { name: 'oling-hatch-receipts' },
    async create() {
      throw new Error('Receipt used the wrong MongoDB client.');
    }
  };
  const OlingConsumable = {
    find: () =>
      createQuery([
        {
          key: 'oling-blanket',
          name: 'Oling Blanket',
          category: 'hatching',
          subcategory: 'speed',
          target: 'egg',
          effect: { type: 'hatch_speed', amount: 25 },
          assets: { icon: '/oling-blanket.svg' },
          metadata: { rarity: 'common' },
          enabled: true,
          status: 'published'
        }
      ])
  };

  return {
    models: {
      Account,
      OlingBuildSet,
      OlingConsumable,
      OlingEgg,
      OlingHatchReceipt,
      OlingState,
      OlingTrait,
      PlayerOling
    },
    account,
    get accountUpdateSession() {
      return accountUpdateSession;
    },
    get createdOlingPayload() {
      return createdOlingPayload;
    },
    get receiptCreateCount() {
      return receiptCreateCount;
    },
    get receiptPayload() {
      return receiptPayload;
    },
    get receiptCreateSession() {
      return receiptCreateSession;
    },
    transactionSession
  };
}

test('hatching is rejected before consuming an egg when six Olings are active', async () => {
  const harness = createHatchModels(6);
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg'
  });

  assert.equal(result.error.code, 'oling_lab_roster_full');
  assert.equal(harness.account.olings.eggs[0].quantity, 1);
  assert.equal(harness.createdOlingPayload, null);
  assert.equal(harness.receiptCreateCount, 0);
});

test('an inserted egg cannot hatch before its timer is started', async () => {
  const harness = createHatchModels(0);
  harness.account.olings.lab.placedItems[0].inventorySlots[0].placedAt = null;
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg'
  });

  assert.equal(result.error.code, 'oling_hatch_not_started');
  assert.equal(harness.account.olings.eggs[0].quantity, 1);
  assert.equal(harness.createdOlingPayload, null);
  assert.equal(harness.receiptCreateCount, 0);
});

test('an incubating egg cannot hatch before its ready time', async () => {
  const harness = createHatchModels(0);
  harness.account.olings.lab.placedItems[0].inventorySlots[0].placedAt =
    '2999-01-01T00:00:00.000Z';
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg'
  });

  assert.equal(result.error.code, 'oling_hatch_not_ready');
  assert.equal(harness.account.olings.eggs[0].quantity, 1);
  assert.equal(harness.createdOlingPayload, null);
  assert.equal(harness.receiptCreateCount, 0);
});

test('hatching claims the next lab slot in the egg transaction', async () => {
  const harness = createHatchModels(5);
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg'
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(harness.createdOlingPayload.residency, {
    state: 'active',
    labSlot: 6,
    pod: null
  });
  assert.equal(harness.account.olings.eggs[0].quantity, 0);
  assert.equal(harness.accountUpdateSession, harness.transactionSession);
  assert.equal(result.oling.createSession, harness.transactionSession);
  assert.equal(harness.receiptCreateCount, 1);
  assert.equal(harness.receiptCreateSession, harness.transactionSession);
});

test('hatching records the consumed influence and effective odds', async () => {
  const harness = createHatchModels(0, [
    {
      slotKey: 'influence-1',
      itemKey: 'oling-blanket',
      consumedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg',
    hatchContext: { parentPlacedId: 'incubator-1' }
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(harness.receiptPayload.influences, [
    {
      slotKey: 'influence-1',
      itemKey: 'oling-blanket',
      itemName: 'Oling Blanket',
      itemRarity: 'common',
      effect: { type: 'hatch_speed', amount: 25 },
      assets: { icon: '/oling-blanket.svg' },
      consumedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);
  assert.deepEqual(harness.receiptPayload.eggOddsSnapshot, { common: 100 });
  assert.deepEqual(harness.receiptPayload.metadata.baseEggOddsSnapshot, {
    common: 100
  });
  assert.deepEqual(result.serialized.receipt.influences, [
    {
      slotKey: 'influence-1',
      itemKey: 'oling-blanket',
      itemName: 'Oling Blanket',
      itemRarity: 'common',
      effect: { type: 'hatch_speed', amount: 25 },
      assets: { icon: '/oling-blanket.svg' },
      consumedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);
});

test('hatching consumes a newly reserved influence in the egg transaction', async () => {
  const harness = createHatchModels(
    0,
    [
      {
        slotKey: 'influence-1',
        itemKey: 'oling-blanket',
        reservedAt: '2026-09-05T12:00:00.000Z',
        consumedAt: null
      }
    ],
    1
  );
  const result = await hatchOling({
    models: harness.models,
    accountId: 'account-1',
    eggKey: 'base-egg',
    hatchContext: { parentPlacedId: 'incubator-1' }
  });

  assert.equal(result.error, undefined);
  assert.equal(harness.account.olings.consumables[0].quantity, 0);
  assert.ok(harness.receiptPayload.influences[0].consumedAt instanceof Date);
  assert.deepEqual(harness.receiptPayload.metadata.influenceInventoryChanges, [
    {
      consumableKey: 'oling-blanket',
      quantityBefore: 1,
      quantityAfter: 0,
      quantityConsumed: 1
    }
  ]);
  assert.equal(harness.receiptCreateSession, harness.transactionSession);
});

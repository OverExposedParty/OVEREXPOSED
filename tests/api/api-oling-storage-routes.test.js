const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerOlingStorageRoutes
} = require('../../server/routes/api-olings/storage-routes');
const {
  getReservedLabItemQuantity
} = require('../../server/routes/api-olings/lab-state');

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

function createHarness(overrides = {}) {
  const handlers = new Map();
  const account = {
    _id: 'account-1',
    olings: { pods: [{ key: 'oling_pod', quantity: 1 }] }
  };
  const oling = {
    _id: 'oling-1',
    name: 'Pip',
    residency: {
      state: 'stored',
      labSlot: null,
      pod: { key: 'oling_pod', releaseOutcome: 'destroy' }
    }
  };
  const baseResult = {
    account,
    oling,
    pod: {
      key: 'oling_pod',
      releaseOutcome: 'destroy',
      quantityAfter: 1
    },
    roster: {
      limit: 6,
      activeCount: 5,
      availableSlots: 1,
      nextAvailableSlot: 6,
      olings: [{ _id: 'must-not-leak' }]
    }
  };
  const calls = [];
  const diagnostics = [];

  registerOlingStorageRoutes({
    app: {
      post(path, handler) {
        handlers.set(`POST ${path}`, handler);
      }
    },
    getCurrentAccount: async () => account,
    getOlingDefinitions: async () => ({}),
    serializePlayerOling: (value) => ({
      id: String(value._id),
      name: value.name,
      residency: value.residency
    }),
    serializeAccount: (value) => ({ id: String(value._id) }),
    storeOlingInPod: async (options) => {
      calls.push(['store', options]);
      return baseResult;
    },
    releaseOlingFromPod: async (options) => {
      calls.push(['release', options]);
      return {
        ...baseResult,
        pod: { ...baseResult.pod, destroyed: true }
      };
    },
    transferStoredOling: async (options) => {
      calls.push(['transfer', options]);
      return {
        ...baseResult,
        pod: {
          ...baseResult.pod,
          containerPlacedId: options.containerPlacedId
        }
      };
    },
    recordOlingStorageDiagnostic: (diagnostic) => {
      diagnostics.push(diagnostic);
    },
    models: {},
    clampInteger: (value, min, max, fallback) =>
      Number.isFinite(Number(value)) ? Number(value) : fallback,
    getReservedLabItemQuantity: () => 0,
    getQuickSellQuote: async () => null,
    getOrCreateOlingState: async () => ({}),
    OlingState: {},
    ensureAccountOlingDocument() {},
    QUICK_SELL_RATE: 0.35,
    ...overrides
  });

  return { account, calls, diagnostics, handlers };
}

test('store endpoint delegates atomically and returns client-safe roster state', async () => {
  const { calls, diagnostics, handlers } = createHarness();
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/:olingId/store')(
    {
      id: 'request-1',
      params: { olingId: 'oling-1' },
      body: {
        podKey: 'oling_pod',
        containerPlacedId: 'pod-rack-one'
      }
    },
    response
  );

  assert.equal(response.error, null);
  assert.equal(calls[0][0], 'store');
  assert.equal(calls[0][1].accountId, 'account-1');
  assert.equal(calls[0][1].olingId, 'oling-1');
  assert.equal(calls[0][1].podKey, 'oling_pod');
  assert.equal(calls[0][1].containerPlacedId, 'pod-rack-one');
  assert.deepEqual(response.payload.roster, {
    limit: 6,
    activeCount: 5,
    availableSlots: 1,
    nextAvailableSlot: 6
  });
  assert.equal('olings' in response.payload.roster, false);
  assert.deepEqual(response.payload.inventory.pods, [
    { key: 'oling_pod', quantity: 1 }
  ]);
  assert.equal(diagnostics[0].operation, 'store');
  assert.equal(diagnostics[0].outcome, 'succeeded');
  assert.equal(diagnostics[0].accountId, 'account-1');
  assert.equal(diagnostics[0].olingId, 'oling-1');
});

test('transfer endpoint moves an occupied pod to a selected rack', async () => {
  const { calls, handlers } = createHarness();
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/:olingId/transfer')(
    {
      id: 'request-transfer',
      params: { olingId: 'oling-1' },
      body: { containerPlacedId: 'pod-rack-two' }
    },
    response
  );

  assert.equal(response.error, null);
  assert.equal(calls[0][0], 'transfer');
  assert.equal(calls[0][1].containerPlacedId, 'pod-rack-two');
  assert.equal(response.payload.pod.containerPlacedId, 'pod-rack-two');
});

test('release endpoint reports destruction for a one-use pod', async () => {
  const { calls, diagnostics, handlers } = createHarness();
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/:olingId/release')(
    { id: 'request-1', params: { olingId: 'oling-1' } },
    response
  );

  assert.equal(response.error, null);
  assert.equal(calls[0][0], 'release');
  assert.equal(response.payload.pod.destroyed, true);
  assert.match(response.payload.message, /one-use pod broke/i);
  assert.equal(diagnostics[0].operation, 'release');
  assert.equal(diagnostics[0].outcome, 'succeeded');
  assert.equal(diagnostics[0].releaseOutcome, 'destroy');
});

test('storage endpoints preserve service validation errors', async () => {
  const serviceError = {
    status: 409,
    code: 'oling_lab_roster_full',
    message: 'Your Oling lab already has 6 active Olings.'
  };
  const { diagnostics, handlers } = createHarness({
    releaseOlingFromPod: async () => ({ error: serviceError })
  });
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/:olingId/release')(
    { id: 'request-1', params: { olingId: 'oling-1' } },
    response
  );

  assert.deepEqual(response.error, serviceError);
  assert.equal(response.payload, null);
  assert.equal(diagnostics[0].outcome, 'rejected');
  assert.equal(diagnostics[0].error, serviceError);
});

test('unexpected storage failures emit a failed diagnostic', async () => {
  const { diagnostics, handlers } = createHarness({
    storeOlingInPod: async () => {
      throw new Error('database unavailable');
    }
  });
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await handlers.get('POST /api/olings/storage/:olingId/store')(
      {
        id: 'request-2',
        params: { olingId: 'oling-1' },
        body: { podKey: 'oling_pod' }
      },
      response
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.error.status, 500);
  assert.equal(response.error.code, 'oling_storage_store_failed');
  assert.equal(diagnostics[0].outcome, 'failed');
  assert.equal(diagnostics[0].error.code, 'oling_storage_store_failed');
});

test('quick sell prices load once for each unique owned item', async () => {
  const quoteCalls = [];
  const { account, handlers } = createHarness({
    getQuickSellQuote: async (itemType, itemKey, quantity) => {
      quoteCalls.push({ itemType, itemKey, quantity });
      return {
        itemType,
        itemKey,
        productName: itemKey,
        shopValue: itemType === 'egg' ? 20 : 12,
        unitPayout: itemType === 'egg' ? 7 : 4,
        payout: itemType === 'egg' ? 7 : 4
      };
    }
  });
  account.olings.eggs = [{ key: 'base-egg', quantity: 2 }];
  account.olings.consumables = [{ key: 'oling-cookie', quantity: 3 }];
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/quick-sell/prices')(
    {
      id: 'request-quick-sell-prices',
      body: {
        items: [
          { itemType: 'egg', itemKey: 'base-egg' },
          { itemType: 'egg', itemKey: 'base-egg' },
          { itemType: 'consumable', itemKey: 'oling-cookie' },
          { itemType: 'consumable', itemKey: 'not-owned' }
        ]
      }
    },
    response
  );

  assert.equal(response.error, null);
  assert.deepEqual(quoteCalls, [
    { itemType: 'egg', itemKey: 'base-egg', quantity: 1 },
    { itemType: 'consumable', itemKey: 'oling-cookie', quantity: 1 }
  ]);
  assert.deepEqual(response.payload.prices, [
    {
      itemType: 'egg',
      itemKey: 'base-egg',
      productName: 'base-egg',
      shopValue: 20,
      unitPayout: 7
    },
    {
      itemType: 'consumable',
      itemKey: 'oling-cookie',
      productName: 'oling-cookie',
      shopValue: 12,
      unitPayout: 4
    }
  ]);
});

test('quick sell excludes consumables reserved by an active hatch', async () => {
  const { account, handlers } = createHarness({
    getReservedLabItemQuantity,
    getQuickSellQuote: async () => ({ unitPayout: 1, payout: 1 })
  });
  account.olings.consumables = [{ key: 'oling-blanket', quantity: 1 }];
  account.olings.lab = {
    placedItems: [
      {
        inventorySlots: [
          {
            slotType: 'egg',
            itemKey: 'base-egg',
            placedAt: '2026-09-05T12:00:00.000Z',
            influenceSlots: [
              {
                itemKey: 'oling-blanket',
                itemType: 'consumable',
                reservedAt: '2026-09-05T12:00:00.000Z'
              }
            ]
          }
        ],
        containerSlots: []
      }
    ]
  };
  const response = createResponse();

  await handlers.get('POST /api/olings/storage/quick-sell/quote')(
    {
      id: 'request-quick-sell',
      body: {
        itemType: 'consumable',
        itemKey: 'oling-blanket',
        quantity: 1
      }
    },
    response
  );

  assert.equal(response.error.code, 'oling_quick_sell_not_owned');
  assert.equal(response.payload, null);
});

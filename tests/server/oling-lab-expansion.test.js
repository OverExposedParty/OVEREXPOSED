const test = require('node:test');
const assert = require('node:assert/strict');

const { __test } = require('../../server/routes/api-olings');
const labState = require('../../server/routes/api-olings/lab-state');
const {
  createLabPayloadNormalizer
} = require('../../server/routes/api-olings/lab-state/normalize');
const {
  OlingLabWallpapers
} = require('../../server/routes/api-olings/lab-catalog');
const {
  registerOlingLabExpansionRoutes
} = require('../../server/routes/api-olings/lab-expansion-routes');
const {
  getLabColumnCellKeys
} = require('../../server/routes/api-olings/lab-state/expansion');

function createLab(overrides = {}) {
  return {
    roomLevel: 1,
    columns: 3,
    rows: 2,
    placedItems: [],
    ...overrides
  };
}

test('legacy labs receive the brick wallpaper by default', () => {
  const serialized = __test.serializeOlingLab(createLab());

  assert.equal(serialized.appearance.wallpaperKey, 'brick');
  assert.equal(serialized.appearance.wallpaperVariantKey, null);
  assert.equal(Object.hasOwn(serialized, 'wallpaperKey'), false);
});

test('wallpaper serialization rejects inherited catalogue properties', () => {
  const serialized = __test.serializeOlingLab(
    createLab({ appearance: { wallpaperKey: 'toString' } })
  );

  assert.equal(serialized.appearance.wallpaperKey, 'brick');
});

test('wallpaper saves reject inherited catalogue properties', () => {
  const normalized = labState.normalizeLabPayload(
    createLab({ appearance: { wallpaperKey: 'constructor' } }),
    {},
    {}
  );

  assert.equal(normalized.error?.code, 'oling_lab_wallpaper_invalid');
});

test('every account implicitly owns the starter Brick wallpaper', () => {
  const owned = labState.getOwnedLabWallpapers({});

  assert.deepEqual([...owned], ['brick']);
});

test('the Lab wallpaper catalogue includes the new repeatable tiles', () => {
  assert.deepEqual(Object.keys(OlingLabWallpapers), [
    'brick',
    'concrete',
    'prototype'
  ]);
  ['concrete', 'prototype'].forEach((key) => {
    assert.equal(
      OlingLabWallpapers[key].image,
      `/images/olings/lab/wallpapers/${key}/tile.svg`
    );
    assert.equal(OlingLabWallpapers[key].render.mode, 'tile');
    assert.equal(OlingLabWallpapers[key].render.widthCells, 1);
    assert.equal(OlingLabWallpapers[key].render.heightCells, 1);
  });
  assert.deepEqual(Object.keys(OlingLabWallpapers.brick.variants), []);
  assert.deepEqual(Object.keys(OlingLabWallpapers.concrete.variants), []);
  assert.deepEqual(Object.keys(OlingLabWallpapers.prototype.variants), [
    'orange',
    'red'
  ]);
  assert.deepEqual(OlingLabWallpapers.prototype.variants.orange.colours, {
    primary: '#F28C38'
  });
  assert.deepEqual(OlingLabWallpapers.prototype.variants.red.colours, {
    primary: '#E65353'
  });
});

test('wallpaper saves reject catalogued styles the account does not own', () => {
  const normalizeLabPayload = createLabPayloadNormalizer({
    OlingLabWallpapers: { brick: {}, aurora: {} },
    DEFAULT_OLING_LAB_WALLPAPER_KEY: 'brick',
    getOwnedLabWallpapers: () => new Set(['brick'])
  });
  const normalized = normalizeLabPayload(
    { appearance: { wallpaperKey: 'aurora' } },
    {},
    {}
  );

  assert.equal(normalized.error?.code, 'oling_lab_wallpaper_not_owned');
});

test('wallpaper variant saves require a separately owned entitlement', () => {
  const normalizeLabPayload = createLabPayloadNormalizer({
    OlingLabWallpapers: {
      brick: { variants: { blue: { name: 'Blue' } } }
    },
    DEFAULT_OLING_LAB_WALLPAPER_KEY: 'brick',
    getOwnedLabWallpapers: () => new Set(['brick']),
    getOwnedLabWallpaperVariants: () => new Set()
  });
  const normalized = normalizeLabPayload(
    {
      appearance: {
        wallpaperKey: 'brick',
        wallpaperVariantKey: 'blue'
      }
    },
    {},
    {}
  );

  assert.equal(normalized.error?.code, 'oling_lab_wallpaper_variant_not_owned');
});

test('wallpaper variants can be owned without owning the base wallpaper', () => {
  const normalizeLabPayload = createLabPayloadNormalizer({
    STARTER_LAB_COLUMNS: 3,
    LAB_ROWS: 2,
    OlingLabItems: {},
    LAB_MIN_COLUMNS: 3,
    LAB_MAX_COLUMNS: 16,
    OlingLabWallpapers: {
      brick: { variants: { blue: { name: 'Blue' } } }
    },
    DEFAULT_OLING_LAB_WALLPAPER_KEY: 'brick',
    clampInteger: (value, minimum, maximum, fallback) =>
      Number.isInteger(value) ? value : fallback,
    getUnlockedLabCellKeys: () => ['0:0', '0:1', '0:2', '1:0', '1:1', '1:2'],
    getOwnedLabFurniture: () => new Set(),
    getOwnedLabWallpapers: () => new Set(),
    getOwnedLabWallpaperVariants: () => new Set(['brick:blue']),
    getOwnedEggQuantities: () => new Map(),
    getOwnedConsumableQuantities: () => new Map(),
    ensureContainerSlots: () => [],
    ensureItemInventorySlots: () => [],
    validateContainerSlotItems: () => null,
    validateItemInventorySlots: () => null,
    canUseRoomRow: () => true,
    getItemCells: () => []
  });
  const normalized = normalizeLabPayload(
    {
      appearance: {
        wallpaperKey: 'brick',
        wallpaperVariantKey: 'blue'
      },
      placedItems: []
    },
    {},
    {}
  );

  assert.deepEqual(normalized.lab.appearance, {
    wallpaperKey: 'brick',
    wallpaperVariantKey: 'blue'
  });
});

test('wallpaper variant saves reject uncatalogued colourways', () => {
  const normalizeLabPayload = createLabPayloadNormalizer({
    OlingLabWallpapers: { brick: { variants: {} } },
    DEFAULT_OLING_LAB_WALLPAPER_KEY: 'brick',
    getOwnedLabWallpapers: () => new Set(['brick'])
  });
  const normalized = normalizeLabPayload(
    {
      appearance: {
        wallpaperKey: 'brick',
        wallpaperVariantKey: 'constructor'
      }
    },
    {},
    {}
  );

  assert.equal(normalized.error?.code, 'oling_lab_wallpaper_variant_invalid');
});

test('legacy wider labs retain every previously available square', () => {
  const unlocked = __test.getUnlockedLabCellKeys(createLab({ columns: 5 }));

  assert.equal(unlocked.length, 10);
  assert.ok(unlocked.includes('0:4'));
  assert.ok(unlocked.includes('1:4'));
});

test('legacy partial lab columns are completed for free', () => {
  const unlocked = __test.getUnlockedLabCellKeys(
    createLab({ columns: 4, unlockedCells: ['0:3'] })
  );

  assert.ok(unlocked.includes('0:3'));
  assert.ok(unlocked.includes('1:3'));
});

test('lab column prices increase and use the current balance', () => {
  const expansion = __test.getLabExpansionDetails(
    createLab({ unlockedCells: [] }),
    { gameData: { opals: { balance: 200 } } }
  );
  const fourthColumn = expansion.columns.find((column) => column.col === 3);
  const fifthColumn = expansion.columns.find((column) => column.col === 4);

  assert.deepEqual(fourthColumn.cellKeys, ['0:3', '1:3']);
  assert.equal(fourthColumn.price, 150);
  assert.equal(fourthColumn.eligible, true);
  assert.equal(fourthColumn.canAfford, true);
  assert.equal(fifthColumn.price, 225);
  assert.equal(fifthColumn.eligible, false);
  assert.equal(fifthColumn.canAfford, false);
  assert.equal(expansion.frontierColumn, 3);
  assert.equal(expansion.visibleColumns, 4);
});

test('a legacy partial column advances the frontier as a complete column', () => {
  const expansion = __test.getLabExpansionDetails(
    createLab({ columns: 4, unlockedCells: ['0:3'] })
  );
  const fourthColumn = expansion.columns.find((column) => column.col === 3);
  const fifthColumn = expansion.columns.find((column) => column.col === 4);

  assert.equal(fourthColumn.unlocked, true);
  assert.equal(fourthColumn.eligible, false);
  assert.equal(fifthColumn.eligible, true);
  assert.equal(expansion.frontierColumn, 4);
  assert.equal(expansion.visibleColumns, 5);
});

test('buying a lab column charges once and unlocks both rows atomically', async () => {
  let handler;
  let purchaseFilter;
  let purchaseUpdate;
  const account = {
    _id: 'account-1',
    olings: { lab: createLab({ unlockedCells: [] }) },
    gameData: { opals: { balance: 200 } }
  };
  const serializedLab = __test.serializeOlingLab(account.olings.lab);
  const updatedAccount = {
    ...account,
    gameData: { opals: { balance: 50 } }
  };
  const Account = {
    async updateOne() {},
    async findOneAndUpdate(filter, update) {
      purchaseFilter = filter;
      purchaseUpdate = update;
      return updatedAccount;
    }
  };
  const OlingState = { async updateOne() {} };
  const response = {
    apiSuccess(payload) {
      this.payload = payload;
    },
    apiError(error) {
      assert.fail(`Unexpected API error: ${error.code}`);
    }
  };

  registerOlingLabExpansionRoutes({
    app: {
      post(path, routeHandler) {
        assert.equal(path, '/api/olings/lab/expand');
        handler = routeHandler;
      }
    },
    getCurrentAccount: async () => account,
    getOrCreateOlingState: async () => ({ lab: serializedLab }),
    OlingState,
    serializeAccount: () => ({}),
    serializeOlingLab: () => serializedLab,
    getLabExpansionDetails: __test.getLabExpansionDetails,
    ensureAccountOlingDocument() {},
    getLabColumnCellKeys,
    STARTER_LAB_COLUMNS: 3,
    Account
  });

  await handler({ body: { col: 3 }, id: 'request-1' }, response);

  assert.deepEqual(purchaseFilter['olings.lab.unlockedCells'].$nin, [
    '0:3',
    '1:3'
  ]);
  assert.deepEqual(purchaseUpdate.$addToSet['olings.lab.unlockedCells'].$each, [
    '0:3',
    '1:3'
  ]);
  assert.equal(purchaseUpdate.$inc['gameData.opals.balance'], -150);
  assert.equal(
    purchaseUpdate.$push['gameData.opalTransactions'].$each[0].metadata
      .purchaseType,
    'oling_lab_column'
  );
  assert.deepEqual(response.payload.purchase, {
    col: 3,
    cellKeys: ['0:3', '1:3'],
    price: 150,
    balanceBefore: 200,
    balanceAfter: 50
  });
});

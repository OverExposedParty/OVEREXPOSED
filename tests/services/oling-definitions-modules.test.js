const assert = require('node:assert/strict');
const test = require('node:test');

const definitions = require('../../server/services/olings/definitions');
const buildSets = require('../../server/services/olings/definitions/build-sets');
const catalog = require('../../server/services/olings/definitions/catalog');
const serializers = require('../../server/services/olings/definitions/serializers');
const sync = require('../../server/services/olings/definitions/sync');

test('Oling definitions facade delegates to focused modules', () => {
  assert.equal(definitions.getLayerPool, buildSets.getLayerPool);
  assert.equal(
    definitions.serializePlayerOling,
    serializers.serializePlayerOling
  );
  assert.equal(definitions.listOlingConsumables, catalog.listOlingConsumables);
  assert.equal(
    definitions.importOlingDefinitionsFromJson,
    sync.importOlingDefinitionsFromJson
  );
});

test('Oling consumable catalog safely reads the JSON fallback without a database model', async () => {
  const consumables = await definitions.listOlingConsumables();

  assert.deepEqual(
    consumables.map(({ key }) => key),
    ['oling-cookie', 'o-juice', 'oling-blanket', 'opal-dust', 'lucky-clover']
  );
  assert.equal(
    consumables.find(({ key }) => key === 'oling-cookie').effect
      .restoreToEnergy,
    25
  );
  assert.equal(
    consumables.find(({ key }) => key === 'oling-blanket').effect.amount,
    25
  );
  assert.equal(
    consumables.find(({ key }) => key === 'opal-dust').effect.amount,
    10
  );
  assert.equal(
    consumables.find(({ key }) => key === 'lucky-clover').effect.amount,
    20
  );
});

test('Oling consumable serialization resolves energy restore thresholds', () => {
  const consumable = definitions.serializeOlingConsumable({
    key: 'o-juice',
    effect: { type: 'energy', restoreToEnergy: 75 },
    metadata: { rarity: 'rare' }
  });

  assert.equal(consumable.energyRestoreThreshold, 75);
});

test('Oling consumable catalog rejects retired personality consumables', async () => {
  assert.equal(await catalog.getOlingConsumableByKey('chatty-tea'), null);
  assert.deepEqual(
    catalog
      .filterPublishedOlingConsumables([
        { key: 'chatty-tea', enabled: true, status: 'published' },
        { key: 'o-juice', enabled: true, status: 'published' }
      ])
      .map(({ key }) => key),
    ['o-juice']
  );
});

test('Oling consumable catalog retains supported care and hatching items', () => {
  assert.deepEqual(
    catalog
      .filterPublishedOlingConsumables([
        { key: 'oling-cookie', enabled: true, status: 'published' },
        { key: 'oling-blanket', enabled: true, status: 'published' },
        { key: 'opal-dust', enabled: true, status: 'published' },
        { key: 'lucky-clover', enabled: true, status: 'published' }
      ])
      .map(({ key }) => key),
    ['oling-cookie', 'oling-blanket', 'opal-dust', 'lucky-clover']
  );
});

test('Oling consumable catalog fills missing database definitions from JSON', async () => {
  const OlingConsumable = {
    find() {
      return {
        sort() {
          return this;
        },
        async lean() {
          return [
            {
              key: 'o-juice',
              category: 'care',
              subcategory: 'energy',
              enabled: true,
              status: 'published'
            }
          ];
        }
      };
    }
  };

  const consumables = await catalog.listOlingConsumables({ OlingConsumable });
  assert.deepEqual(
    consumables.map(({ key }) => key).sort(),
    [
      'oling-cookie',
      'o-juice',
      'oling-blanket',
      'opal-dust',
      'lucky-clover'
    ].sort()
  );
});

test('single consumable lookups fall back when the database record is missing', async () => {
  const OlingConsumable = {
    findOne() {
      return { lean: async () => null };
    },
    async countDocuments() {
      return 0;
    }
  };

  const cookie = await catalog.getOlingConsumableByKey('oling-cookie', {
    OlingConsumable
  });
  assert.equal(cookie.effect.type, 'energy');
  assert.equal(cookie.effect.restoreToEnergy, 25);
});

test('legacy O-Juice records are normalized to the current Energy effect', () => {
  const oJuice = catalog.normalizeOlingConsumable({
    key: 'o-juice',
    effect: { type: 'retired_hatch_influence' }
  });

  assert.deepEqual(oJuice.effect, { type: 'energy', restoreToEnergy: 75 });
  assert.equal(oJuice.subcategory, 'energy');
});

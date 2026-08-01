const assert = require('node:assert/strict');
const test = require('node:test');

const definitions = require('../../server/services/olings/definitions');
const buildSets = require('../../server/services/olings/definitions/build-sets');
const catalog = require('../../server/services/olings/definitions/catalog');
const serializers = require('../../server/services/olings/definitions/serializers');
const sync = require('../../server/services/olings/definitions/sync');

test('Oling definitions facade delegates to focused modules', () => {
  assert.equal(definitions.getLayerPool, buildSets.getLayerPool);
  assert.equal(definitions.serializePlayerOling, serializers.serializePlayerOling);
  assert.equal(definitions.listOlingConsumables, catalog.listOlingConsumables);
  assert.equal(
    definitions.importOlingDefinitionsFromJson,
    sync.importOlingDefinitionsFromJson
  );
});

test('Oling consumable catalog safely reads the JSON fallback without a database model', async () => {
  const consumables = await definitions.listOlingConsumables();

  assert.deepEqual(consumables, []);
});

test('Oling consumable serialization resolves energy restore thresholds', () => {
  const consumable = definitions.serializeOlingConsumable({
    key: 'rare-energy-cookie',
    effect: { type: 'energy' },
    metadata: { rarity: 'rare' }
  });

  assert.equal(consumable.energyRestoreThreshold, 75);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const eggs = require('../../public/json-files/olings/eggs.json');
const traits = require('../../public/json-files/olings/traits.json');
const {
  CURRENT_BASE_TRAIT_KEYS,
  TRAIT_KEY_RENAMES,
  renameTraitKey,
  renameTraitReferences
} = require('../../scripts/migrate-oling-trait-keys');

test('base collection trait keys no longer repeat the collection prefix', () => {
  const baseTraitKeys = traits.traits
    .filter((trait) => trait.collection === 'base')
    .map((trait) => trait.key)
    .sort();

  assert.equal(TRAIT_KEY_RENAMES.size, 37);
  assert.deepEqual(baseTraitKeys, [...CURRENT_BASE_TRAIT_KEYS].sort());
  assert.ok(baseTraitKeys.every((key) => !key.startsWith('base-')));
});

test('every egg build-set trait reference resolves to a canonical trait key', () => {
  const traitKeys = new Set(traits.traits.map((trait) => trait.key));
  const referencedKeys = eggs.eggs.flatMap((egg) =>
    (egg.sets || []).flatMap((set) => Object.values(set.traits || {}))
  );

  assert.ok(referencedKeys.length > 0);
  assert.ok(referencedKeys.every((key) => traitKeys.has(key)));
  assert.ok(referencedKeys.every((key) => !key.startsWith('base-')));
  assert.equal(eggs.eggs[0].key, 'base-egg');
  assert.equal(eggs.eggs[0].collection, 'base');
});

test('trait-key migration changes exact references without touching other base keys', () => {
  const createdAt = new Date('2026-08-11T00:00:00.000Z');
  const source = {
    build: {
      mouth: 'base-moss-mouth',
      body: 'base-stone-body'
    },
    eggKey: 'base-egg',
    asset: '/images/olings/builds/mouth/base/moss-mouth.svg',
    createdAt,
    values: ['base-soft-ears', 'base-olings'],
    traitsByKey: {
      'base-moss-mouth': { enabled: true }
    }
  };

  const renamed = renameTraitReferences(source);

  assert.equal(renamed.changed, true);
  assert.deepEqual(renamed.value.build, {
    mouth: 'moss-mouth',
    body: 'stone-body'
  });
  assert.equal(renamed.value.eggKey, 'base-egg');
  assert.equal(renamed.value.asset, source.asset);
  assert.equal(renamed.value.createdAt, createdAt);
  assert.deepEqual(renamed.value.values, ['soft-ears', 'base-olings']);
  assert.deepEqual(renamed.value.traitsByKey, {
    'moss-mouth': { enabled: true }
  });
  assert.equal(renameTraitKey('base-trash-balloons'), 'trash-balloons');
});

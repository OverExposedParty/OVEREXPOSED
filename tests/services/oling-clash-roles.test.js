const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getProminentClashRoles,
  scoreClashRoles
} = require('../../server/services/olings/clash-roles');
const {
  getOlingDefinitions
} = require('../../server/services/olings/definitions/catalog');
const {
  serializePlayerOling
} = require('../../server/services/olings/definitions/serializers');

const build = {
  mouth: 'moss-mouth',
  body: 'stone-body',
  flight: 'moss-wings',
  eyes: 'stone-eyes'
};

const abilities = new Map([
  ['moss-mouth', { roleTags: ['striker'] }],
  ['stone-body', { roleTags: ['guardian', 'support'] }],
  ['moss-wings', { roleTags: ['support'] }],
  ['stone-eyes', { roleTags: ['guardian'] }]
]);

function createFindModel(rows, onFind = () => {}) {
  return {
    find(filter) {
      onFind(filter);
      return { lean: async () => rows };
    }
  };
}

test('Clash roles combine primary and secondary tags across all four parts', () => {
  assert.deepEqual(scoreClashRoles(build, abilities), [
    { key: 'guardian', score: 4 },
    { key: 'support', score: 3 },
    { key: 'striker', score: 2 }
  ]);
  assert.deepEqual(getProminentClashRoles(build, abilities), [
    'guardian',
    'support'
  ]);
});

test('Clash roles return one role when the build has one classification', () => {
  const supportAbilities = new Map(
    Object.values(build).map((traitKey) => [
      traitKey,
      { roleTags: ['support', 'support', 'unknown-role'] }
    ])
  );

  assert.deepEqual(getProminentClashRoles(build, supportAbilities), [
    'support'
  ]);
});

test('Clash role ties use the canonical role order', () => {
  assert.deepEqual(
    getProminentClashRoles(
      { mouth: 'attack-part', body: 'guard-part' },
      new Map([
        ['attack-part', { roleTags: ['striker'] }],
        ['guard-part', { roleTags: ['guardian'] }]
      ])
    ),
    ['striker', 'guardian']
  );
});

test('Oling definitions load only current published Clash abilities', async () => {
  let abilityFilter = null;
  const definitions = await getOlingDefinitions(
    {
      OlingTrait: createFindModel([]),
      OlingEgg: createFindModel([]),
      OlingBuildSet: createFindModel([]),
      OlingClashAbility: createFindModel(
        [{ traitKey: 'moss-mouth', roleTags: ['support'] }],
        (filter) => {
          abilityFilter = filter;
        }
      )
    },
    [{ build, equipment: { headwear: 'party-hat' } }]
  );

  const { traitKey, ...abilityStatusFilter } = abilityFilter;
  assert.deepEqual(new Set(traitKey.$in), new Set(Object.values(build)));
  assert.deepEqual(abilityStatusFilter, {
    isCurrent: true,
    enabled: true,
    status: 'published'
  });
  assert.deepEqual(definitions.clashAbilitiesByTraitKey.get('moss-mouth'), {
    traitKey: 'moss-mouth',
    roleTags: ['support']
  });
});

test('serialized player Olings expose their two prominent Clash roles', () => {
  const serialized = serializePlayerOling(
    {
      _id: 'oling-1',
      ownerId: 'account-1',
      eggKey: 'base-egg',
      collection: 'base',
      name: 'Mossling',
      level: 9,
      xp: 75,
      battleStats: { wins: 12 },
      build,
      buildRarities: {},
      care: { energy: 100 }
    },
    {
      traitsByKey: new Map(),
      eggsByKey: new Map(),
      clashAbilitiesByTraitKey: abilities
    }
  );

  assert.deepEqual(serialized.clashRoles, ['guardian', 'support']);
  assert.equal('level' in serialized, false);
  assert.equal('xp' in serialized, false);
  assert.equal('battleStats' in serialized, false);
});

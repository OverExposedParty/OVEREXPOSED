const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeMafiaRoleCounts
} = require('../../server/services/mafia-role-counts');

const roles = [
  {
    key: 'civilian',
    selection: {
      defaultCount: 0,
      minimum: 0,
      maximum: 20,
      fillRemaining: true
    }
  },
  {
    key: 'mafioso',
    selection: { defaultCount: 1, minimum: 0, maximum: 15 }
  },
  {
    key: 'inspector',
    selection: { defaultCount: 1, minimum: 0, maximum: 15 }
  }
];

test('roleCounts are normalized independently from game rules', () => {
  const result = normalizeMafiaRoleCounts(
    {
      roleCounts: { mafioso: 2, inspector: 0 },
      gameRules: { mafioso: 9, 'death-reveal': true }
    },
    roles
  );

  assert.deepEqual(result, {
    civilian: 0,
    mafioso: 2,
    inspector: 0
  });
});

test('Mafia configuration requires the definitive roleCounts field', () => {
  assert.throws(
    () =>
      normalizeMafiaRoleCounts(
        {
          gameRules: {
            mafioso: 3,
            inspector: 0
          }
        },
        roles
      ),
    {
      code: 'invalid_role_counts',
      details: { field: 'roleCounts' }
    }
  );
});

test('unknown, noncanonical, and out-of-range role counts are rejected', () => {
  assert.throws(
    () => normalizeMafiaRoleCounts({ roleCounts: { unknown: 1 } }, roles),
    { code: 'invalid_role_counts' }
  );
  assert.throws(
    () =>
      normalizeMafiaRoleCounts(
        { roleCounts: { Inspector: 1, 'serial killer': 1 } },
        roles
      ),
    { code: 'invalid_role_counts' }
  );
  assert.throws(
    () => normalizeMafiaRoleCounts({ roleCounts: { mafioso: 16 } }, roles),
    { code: 'invalid_role_counts' }
  );
});

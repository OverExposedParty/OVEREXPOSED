const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMafiaRoleAssignment
} = require('../../server/services/mafia-role-assignment');

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
    selection: {
      defaultCount: 1,
      minimum: 0,
      maximum: 15,
      fillRemaining: false
    }
  },
  {
    key: 'inspector',
    selection: {
      defaultCount: 1,
      minimum: 0,
      maximum: 15,
      fillRemaining: false
    }
  }
];

test('server assignment fills unused seats with the catalog fill role', () => {
  const assignment = buildMafiaRoleAssignment({
    config: {
      roleCounts: {
        mafioso: 1,
        inspector: 1
      }
    },
    roles,
    playerCount: 5,
    randomInt: () => 0
  });

  assert.equal(assignment.length, 5);
  assert.deepEqual(
    assignment.reduce((counts, roleKey) => {
      counts[roleKey] = (counts[roleKey] || 0) + 1;
      return counts;
    }, {}),
    {
      civilian: 3,
      inspector: 1,
      mafioso: 1
    }
  );
});

test('server assignment rejects configured roles above the player count', () => {
  assert.throws(
    () =>
      buildMafiaRoleAssignment({
        config: {
          roleCounts: {
            mafioso: 3,
            inspector: 2
          }
        },
        roles,
        playerCount: 4,
        randomInt: () => 0
      }),
    { code: 'mafia_role_count_exceeds_players' }
  );
});

test('published roles need a registered code behavior before assignment', () => {
  assert.throws(
    () =>
      buildMafiaRoleAssignment({
        config: {},
        roles: [
          ...roles,
          {
            key: 'unimplemented-role',
            selection: {
              defaultCount: 1,
              minimum: 0,
              maximum: 1,
              fillRemaining: false
            }
          }
        ],
        playerCount: 4,
        randomInt: () => 0
      }),
    { code: 'mafia_role_behaviour_missing' }
  );
});

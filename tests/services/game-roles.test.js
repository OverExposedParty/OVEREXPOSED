const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertValidRoleCatalog,
  getPublishedRoles,
  normalizeRoleFromJson,
  serializeRoleForApi
} = require('../../server/services/game-roles');

test('role JSON normalization preserves hidden descriptions and fixes legacy faction spelling', () => {
  const role = normalizeRoleFromJson(
    {
      'role-name': 'serial-killer',
      'role-title': 'Serial Killer',
      'role-description': '  A neutral role with its own victory condition.  ',
      'role-faction': 'neautral',
      'role-default-count': 0,
      'role-minimum': 0,
      'role-maximum': 1,
      'role-active': true
    },
    'mafia'
  );

  assert.equal(role.key, 'serial-killer');
  assert.equal(
    role.description,
    'A neutral role with its own victory condition.'
  );
  assert.equal(role.faction, 'neutral');
});

test('role API serialization exposes metadata but no executable behaviour', () => {
  const serialized = serializeRoleForApi({
    key: 'inspector',
    title: 'Inspector',
    description: 'Investigates suspicious players.',
    faction: 'civilian',
    enabled: true,
    status: 'published',
    selection: {
      defaultCount: 1,
      increment: 1,
      minimum: 0,
      maximum: 15,
      fillRemaining: false
    },
    assets: {},
    sortOrder: 20
  });

  assert.equal(
    serialized['role-description'],
    'Investigates suspicious players.'
  );
  assert.equal(serialized['role-faction'], 'civilian');
  assert.equal(serialized.behaviour, undefined);
  assert.equal(serialized.actions, undefined);
});

test('role descriptions remain nullable metadata', () => {
  const role = normalizeRoleFromJson(
    {
      'role-name': 'civilian',
      'role-title': 'Civilian',
      'role-description': null,
      'role-faction': 'civilian',
      'role-fill-remaining': true,
      'role-active': true
    },
    'mafia'
  );
  const serialized = serializeRoleForApi(role);

  assert.equal(role.description, null);
  assert.equal(serialized['role-description'], null);
});

test('role catalogs reject multiple published fill-remaining roles', () => {
  const baseRole = {
    faction: 'civilian',
    enabled: true,
    status: 'published',
    selection: {
      defaultCount: 0,
      increment: 1,
      minimum: 0,
      maximum: 20,
      fillRemaining: true
    }
  };

  assert.throws(
    () =>
      assertValidRoleCatalog(
        [
          { ...baseRole, key: 'civilian' },
          { ...baseRole, key: 'villager' }
        ],
        'mafia'
      ),
    /more than one published fill-remaining role/
  );
});

test('Mafia JSON fallback publishes the migrated active role catalog', async () => {
  const GameRole = {
    find() {
      return {
        sort() {
          return {
            lean: async () => []
          };
        }
      };
    }
  };

  const roles = await getPublishedRoles(GameRole, 'mafia');

  assert.deepEqual(
    roles.map((role) => role.key),
    ['civilian', 'mafioso', 'inspector']
  );
  assert.equal(roles[0].selection.fillRemaining, true);
  assert.deepEqual(
    Object.fromEntries(roles.map((role) => [role.key, role.description])),
    {
      civilian:
        'A regular town member who must investigate suspicious behaviour, question other players and help identify the Mafia before the town is eliminated.',
      inspector:
        'An investigative town role centred around uncovering suspicious players and helping the group identify members of the Mafia.',
      mafioso:
        'A deceptive Mafia role focused on secretly working with its allies to remove the town while avoiding suspicion.'
    }
  );
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyRoleUpdate,
  validateRoleUpdateCatalog
} = require('../../server/routes/api-oe-panel-party-games/game-role-routes');
const GamemodeSettingsAlert = require('../../models/game-config/gamemode-settings-alert-schema');

const roles = [
  {
    gameType: 'mafia',
    key: 'civilian',
    title: 'Civilian',
    faction: 'civilian',
    enabled: true,
    status: 'published',
    selection: {
      defaultCount: 0,
      increment: 1,
      minimum: 0,
      maximum: 20,
      fillRemaining: true
    },
    assets: {}
  },
  {
    gameType: 'mafia',
    key: 'inspector',
    title: 'Inspector',
    description: null,
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
    assets: {}
  }
];

test('role panel updates apply nested selection and asset fields', () => {
  const updated = applyRoleUpdate(roles[1], {
    description: 'Investigates another player.',
    'selection.defaultCount': 2,
    'assets.colour': '#ffffff'
  });

  assert.equal(updated.description, 'Investigates another player.');
  assert.equal(updated.selection.defaultCount, 2);
  assert.equal(updated.assets.colour, '#ffffff');
});

test('role panel prevents removing the only published fill role', () => {
  assert.throws(
    () =>
      validateRoleUpdateCatalog(roles, roles[0], {
        'selection.fillRemaining': false
      }),
    /must retain one published fill-remaining role/
  );
});

test('role panel validates selection ranges before database updates', () => {
  assert.throws(
    () =>
      validateRoleUpdateCatalog(roles, roles[1], {
        'selection.minimum': 4,
        'selection.maximum': 2
      }),
    /invalid selection range/
  );
});

test('gamemode settings alerts accept role changes for export tracking', () => {
  const alert = new GamemodeSettingsAlert({
    action: 'updated',
    itemType: 'role',
    title: 'Inspector',
    gamemode: 'mafia'
  });

  assert.equal(alert.validateSync(), undefined);
  assert.equal(alert.exportNeeded, true);
});

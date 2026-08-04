const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptsDirectory = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'general',
  'online'
);
const templatePath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'html-templates',
  'core-template',
  'registry.js'
);
const iconModules = [
  'user-customisation-icon/state.js',
  'user-customisation-icon/data.js',
  'user-customisation-icon/avatar-rendering.js',
  'user-customisation-icon/social-actions.js',
  'user-customisation-icon/public-profile.js',
  'user-customisation-icon/action-menus.js',
  'user-customisation-icon/lobby-icons.js',
  'user-customisation-icon/utilities.js'
];

test('user customisation icon modules load before their startup script', () => {
  const template = fs.readFileSync(templatePath, 'utf8');
  const startupIndex = template.indexOf(
    "'/scripts/general/online/user-customisation-icon.js'"
  );

  assert.ok(startupIndex > -1);
  iconModules.forEach((filename) => {
    const moduleIndex = template.indexOf(
      `'/scripts/general/online/${filename}'`
    );
    assert.ok(moduleIndex > -1, `${filename} should be configured`);
    assert.ok(moduleIndex < startupIndex, `${filename} should load first`);
  });
});

test('user customisation icon modules preserve their shared global API', () => {
  const context = {
    LoadStylesheet() {},
    window: null
  };
  context.window = context;

  iconModules.forEach((filename) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8'),
      context,
      { filename }
    );
  });

  [
    'getUserIconString',
    'createUserIconPartyGames',
    'openOnlinePublicProfile',
    'syncOnlineUserActionMenu',
    'UpdateUserIcons',
    'parseCustomisationString'
  ].forEach((name) => {
    assert.equal(typeof context[name], 'function', name);
  });
});

test('getUserIconString prefers the signed-in account OE icon', () => {
  const store = new Map([
    [
      'user-customisation',
      JSON.stringify({
        colourSlotId: '0000',
        headSlotId: '0100',
        eyesSlotId: '0200',
        mouthSlotId: '0300'
      })
    ],
    [
      'oe-account',
      JSON.stringify({
        oeIcon: 'base-blue:cap:wide-eyes:smile'
      })
    ]
  ]);
  const context = {
    LoadStylesheet() {},
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      }
    },
    window: null
  };
  context.window = context;

  [
    'user-customisation-icon/state.js',
    'user-customisation-icon/data.js'
  ].forEach((filename) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, filename), 'utf8'),
      context,
      { filename }
    );
  });

  assert.equal(context.getUserIconString(), 'base-blue:cap:wide-eyes:smile');
});

test('UpdateUserIcons does not require the gamemode settings globals', async () => {
  const usersContainer = {
    classList: {
      add() {},
      remove() {}
    },
    querySelectorAll() {
      return [];
    }
  };
  let rendered = false;
  const context = {
    canCurrentUserKickPlayers() {
      return false;
    },
    deviceId: 'host-device',
    document: {
      getElementById(id) {
        return id === 'users' ? usersContainer : null;
      },
      querySelector() {
        return null;
      }
    },
    window: {
      OELobbyPlayerList: {
        render(container, players) {
          rendered = container === usersContainer && players.length === 0;
        }
      }
    }
  };

  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'user-customisation-icon/lobby-icons.js'),
      'utf8'
    ),
    context,
    { filename: 'user-customisation-icon/lobby-icons.js' }
  );

  await context.UpdateUserIcons({ players: [] });
  assert.equal(rendered, true);
});

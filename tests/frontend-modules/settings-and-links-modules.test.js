const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const generalDirectory = path.join(__dirname, '../../public/scripts/general');
const supportScripts = [
  'settings-and-links/achievement-events.js',
  'settings-and-links/account-access.js',
  'settings-and-links/sound-settings.js',
  'settings-and-links/console-shell.js',
  'settings-and-links/console-commands.js',
  'settings-and-links/console-interactions.js',
  'settings-and-links/console-settings.js'
];

test('settings-and-links support modules load before their coordinator', () => {
  const registry = fs.readFileSync(
    path.join(generalDirectory, '../html-templates/core-template/registry.js'),
    'utf8'
  );
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = registry.indexOf(`/scripts/general/${scriptPath}`);
    assert.ok(
      index > previousIndex,
      `${scriptPath} should have ordered registry entry`
    );
    previousIndex = index;
  });

  assert.ok(
    registry.indexOf(
      '/scripts/general/settings-and-links/settings-and-links.js'
    ) > previousIndex,
    'the settings coordinator should load after support modules'
  );
});

test('settings-and-links support modules preserve their shared browser helpers', () => {
  const context = vm.createContext({
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    window: {
      addEventListener() {}
    }
  });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(generalDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  [
    'recordAccountAchievementEvent',
    'initialiseSettingsAchievementEvents',
    'getStoredSettingsAccount',
    'syncSoundSettingFromAccount',
    'canShowSettingsConsole',
    'createOverexposureConsoleMessage',
    'ensureOverexposureConsoleCommands',
    'initialiseOverexposureConsoleInteractions',
    'syncSettingsConsoleState'
  ].forEach((helper) => {
    assert.equal(
      typeof context[helper],
      'function',
      `${helper} should remain public`
    );
  });
});

test('applying the NSFW preference announces its authoritative state', () => {
  const events = [];
  const stored = new Map();
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    document: {
      getElementById() {
        return null;
      }
    },
    localStorage: {
      getItem(key) {
        return stored.get(key) ?? null;
      },
      setItem(key, value) {
        stored.set(key, String(value));
      }
    },
    window: {
      dispatchEvent(event) {
        events.push(event);
      }
    }
  });

  vm.runInContext(
    fs.readFileSync(
      path.join(generalDirectory, 'settings-and-links', 'sound-settings.js'),
      'utf8'
    ),
    context,
    { filename: 'settings-and-links/sound-settings.js' }
  );

  context.applyNsfwSetting(false);
  assert.equal(context.isNsfwContentEnabled(), false);
  context.applyNsfwSetting(true);
  assert.equal(context.isNsfwContentEnabled(), true);

  assert.equal(stored.get('settings-nsfw'), 'true');
  assert.deepEqual(
    events.map((event) => ({
      type: event.type,
      enabled: event.detail.enabled,
      changed: event.detail.changed
    })),
    [
      { type: 'oe-nsfw-setting-changed', enabled: false, changed: true },
      { type: 'oe-nsfw-setting-changed', enabled: true, changed: true }
    ]
  );
});

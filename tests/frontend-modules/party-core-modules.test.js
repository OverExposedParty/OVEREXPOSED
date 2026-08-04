const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const onlineDirectory = path.join(
  __dirname,
  '../../public/scripts/party-games/online'
);
const corePath = path.join(onlineDirectory, 'party-core.js');
const onlineSettingsPath = path.join(onlineDirectory, 'online-settings.js');
const moduleNames = [
  'state.js',
  'routing.js',
  'error-reporting.js',
  'core-ready.js',
  'identity.js',
  'status-ui.js',
  'sync.js'
];

test('party core support modules load before the compatibility script', () => {
  const settingsSource = fs.readFileSync(onlineSettingsPath, 'utf8');
  const moduleIndexes = moduleNames.map((filename) =>
    settingsSource.indexOf(
      `'/scripts/party-games/online/party-core/${filename}'`
    )
  );
  const coreIndex = settingsSource.indexOf(
    "'/scripts/party-games/online/party-core.js'"
  );
  const apiIndex = settingsSource.indexOf(
    "'/scripts/party-games/online/party-api.js'"
  );

  assert.ok(moduleIndexes.every((index) => index > -1));
  assert.ok(moduleIndexes.every((index) => index < coreIndex));
  assert.ok(coreIndex < apiIndex);
  assert.ok(
    moduleIndexes.every(
      (index, moduleIndex) =>
        moduleIndex === 0 || index > moduleIndexes[moduleIndex - 1]
    )
  );
});

test('party core modules preserve the shared browser API', () => {
  const storage = new Map();
  const context = {
    Blob: class Blob {},
    URLSearchParams,
    clearTimeout() {},
    console: { error() {}, log() {}, warn() {} },
    debugLog() {},
    document: {
      addEventListener() {},
      createElement() {
        return { getContext: () => null };
      },
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    fetch: async () => ({ json: async () => ({}) }),
    io: () => ({ id: 'socket-1', on() {} }),
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    navigator: { language: 'en-GB', userAgent: 'test' },
    screen: { colorDepth: 24, height: 1080, width: 1920 },
    setTimeout,
    window: null
  };
  context.window = context;
  context.location = {
    hostname: 'overexposed.app',
    href: 'https://overexposed.app/most-likely-to/ABC-123',
    pathname: '/most-likely-to/ABC-123',
    protocol: 'https:',
    search: ''
  };
  context.matchMedia = () => ({ matches: false });
  context.addEventListener = () => {};

  const sandbox = vm.createContext(context);
  for (const filename of moduleNames) {
    vm.runInContext(
      fs.readFileSync(
        path.join(onlineDirectory, 'party-core', filename),
        'utf8'
      ),
      sandbox,
      { filename }
    );
  }
  vm.runInContext(fs.readFileSync(corePath, 'utf8'), sandbox, {
    filename: 'party-core.js'
  });

  for (const functionName of [
    'getOnlinePartyLobbyDestination',
    'redirectOnlinePartyToLobby',
    'reportOnlineGameError',
    'waitForOnlineCore',
    'resolveOnlineUsername',
    'PartyDisbanded',
    'waitForOnlinePartySnapshot',
    'runOnlineFetchInstructions',
    'checkAndMaybeBecomeHost',
    'SendPlayerDataToParty'
  ]) {
    assert.equal(typeof sandbox[functionName], 'function');
  }
});

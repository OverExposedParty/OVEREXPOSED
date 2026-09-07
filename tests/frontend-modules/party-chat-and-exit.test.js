const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(
  __dirname,
  '../../public/scripts/party-games/online/party-chat-and-exit.js'
);

test('party exit handlers tolerate shared party state not loading first', () => {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const context = {
    Blob: class Blob {},
    console: { error() {}, log() {}, warn() {} },
    document: {
      addEventListener(name, listener) {
        documentListeners.set(name, listener);
      },
      querySelectorAll() {
        return [];
      }
    },
    navigator: { sendBeacon: () => true },
    window: null
  };
  context.window = context;
  context.addEventListener = (name, listener) => {
    windowListeners.set(name, listener);
  };

  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context, {
    filename: 'party-chat-and-exit.js'
  });

  assert.equal(context.currentPartyData, null);
  assert.equal(
    vm.runInNewContext(
      'JSON.stringify(getCurrentPartyStateSnapshot())',
      context
    ),
    '{}'
  );
  assert.equal(documentListeners.has('visibilitychange'), true);
  assert.equal(windowListeners.has('pagehide'), true);
  assert.equal(windowListeners.has('beforeunload'), true);

  context.currentPartyData = { state: { phase: 'lobby', isPlaying: false } };
  assert.equal(
    vm.runInNewContext('getCurrentPartyStateSnapshot().phase', context),
    'lobby'
  );
});

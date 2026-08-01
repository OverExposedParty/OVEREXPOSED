const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const debugSource = fs.readFileSync(
  path.join(__dirname, '../../public/scripts/general/debug/debug-service.js'),
  'utf8'
);
const commandRegistrySource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/commands/command-registry.js'
  ),
  'utf8'
);
const consoleShellSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/settings-and-links/console-shell.js'
  ),
  'utf8'
);

function createDebugContext(storedValues = {}) {
  const values = new Map(Object.entries(storedValues));
  const consoleEntries = [];
  const context = {
    console: {
      debug(...args) {
        consoleEntries.push(['debug', ...args]);
      },
      info(...args) {
        consoleEntries.push(['info', ...args]);
      },
      log(...args) {
        consoleEntries.push(['log', ...args]);
      },
      warn(...args) {
        consoleEntries.push(['warn', ...args]);
      },
      error(...args) {
        consoleEntries.push(['error', ...args]);
      }
    },
    Date,
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      }
    },
    window: null
  };
  context.window = context;
  vm.runInNewContext(debugSource, context, { filename: 'debug-service.js' });
  return { consoleEntries, context, values };
}

test('debug service filters browser output and subscribers', () => {
  const { consoleEntries, context, values } = createDebugContext({
    'oe-debug-filter': 'audio',
    'oe-debug-level': 'info'
  });
  const received = [];
  context.OEDebug.subscribe((entry) => received.push(entry), {
    replay: false
  });

  context.OEDebug.debug('audio.playback', 'hidden by level');
  context.OEDebug.info('audio.queue', 'queued');
  context.OEDebug.error('network', 'hidden by category');

  assert.deepEqual(
    received.map((entry) => [entry.level, entry.category, entry.message]),
    [['info', 'audio.queue', 'queued']]
  );
  assert.deepEqual(consoleEntries, [['info', '[OE:audio.queue] queued']]);

  context.OEDebug.setFilter('audio.playback');
  context.OEDebug.setMinimumLevel('warn');
  assert.equal(values.get('oe-debug-filter'), 'audio.playback');
  assert.equal(values.get('oe-debug-level'), 'warn');

  context.OEDebug.info('audio.playback.stream', 'hidden');
  context.OEDebug.warn('audio.playback.stream', 'visible');
  context.OEDebug.error('audio.queue', 'outside branch');
  assert.equal(received.at(-1).message, 'visible');
});

test('debug service caps and sanitises history and preserves legacy wrappers', () => {
  const { context } = createDebugContext({
    'oe-debug-filter': 'off'
  });

  for (let index = 0; index < 275; index += 1) {
    context.OEDebug.debug('test.history', `entry-${index}`);
  }
  context.debugWarn('legacy warning', {
    password: 'do-not-log',
    nested: { token: 'also-secret' },
    long: 'x'.repeat(700)
  });

  const history = context.OEDebug.getHistory();
  const legacyEntry = history.at(-1);
  assert.equal(history.length, 250);
  assert.equal(legacyEntry.category, 'legacy');
  assert.equal(legacyEntry.level, 'warn');
  assert.equal(legacyEntry.data.password, '[redacted]');
  assert.equal(legacyEntry.data.nested.token, '[redacted]');
  assert.ok(legacyEntry.data.long.length <= 501);
});

test('debug filter changes replay matching early entries once consumers deduplicate', () => {
  const { context } = createDebugContext({
    'oe-debug-filter': 'off'
  });
  context.OEDebug.info('audio.preload', 'early preload');
  context.OEDebug.info('network', 'early request');

  const received = [];
  context.OEDebug.subscribe((entry) => received.push(entry), {
    replay: true
  });
  assert.equal(received.length, 0);

  context.OEDebug.setFilter('audio');
  assert.deepEqual(
    received.map((entry) => entry.message),
    ['early preload']
  );
});

test('debug service publishes configuration and history status changes', () => {
  const { context } = createDebugContext({
    'oe-debug-filter': 'off'
  });
  const statuses = [];
  const unsubscribe = context.OEDebug.subscribeStatus((status) => {
    statuses.push({
      filter: status.filter,
      minimumLevel: status.minimumLevel,
      historySize: status.historySize,
      historyLimit: status.historyLimit
    });
  });

  context.OEDebug.info('audio.preload', 'queued');
  context.OEDebug.setFilter('audio');
  context.OEDebug.setMinimumLevel('warn');
  unsubscribe();
  context.OEDebug.warn('audio.preload', 'ready');

  assert.deepEqual(statuses, [
    {
      filter: 'off',
      minimumLevel: 'debug',
      historySize: 0,
      historyLimit: 250
    },
    {
      filter: 'off',
      minimumLevel: 'debug',
      historySize: 1,
      historyLimit: 250
    },
    {
      filter: 'audio',
      minimumLevel: 'debug',
      historySize: 1,
      historyLimit: 250
    },
    {
      filter: 'audio',
      minimumLevel: 'warn',
      historySize: 1,
      historyLimit: 250
    }
  ]);
});

test('debug service exposes reusable filter suggestions', () => {
  const { context } = createDebugContext();

  [
    'audio.playback',
    'loader.scripts',
    'notifications.active-lobby',
    'party.chat',
    'runtime.errors'
  ].forEach((filter) => {
    assert.ok(context.OEDebug.filterSuggestions.includes(filter));
  });
});

test('global debug command reports and persists filters and levels', async () => {
  const { context, values } = createDebugContext({
    'oe-debug-filter': 'off'
  });
  vm.runInNewContext(commandRegistrySource, context, {
    filename: 'command-registry.js'
  });
  const messages = [];
  const writeConsoleMessage = (_name, message, eventType) => {
    messages.push({ message, eventType });
  };

  await context.OverexposedCommands.runCommand('/debug audio.queue', {
    pageType: 'overexposure',
    writeConsoleMessage
  });
  await context.OverexposedCommands.runCommand('/debug level warn', {
    pageType: 'overexposure',
    writeConsoleMessage
  });
  await context.OverexposedCommands.runCommand('/debug status', {
    pageType: 'overexposure',
    writeConsoleMessage
  });

  assert.equal(values.get('oe-debug-filter'), 'audio.queue');
  assert.equal(values.get('oe-debug-level'), 'warn');
  assert.match(messages.at(-1).message, /audio\.queue/);
  assert.match(messages.at(-1).message, /warn/);

  await context.OverexposedCommands.runCommand('/debug all', {
    pageType: 'overexposure',
    writeConsoleMessage
  });
  assert.equal(values.get('oe-debug-filter'), 'all');

  await context.OverexposedCommands.runCommand('/debug off', {
    pageType: 'overexposure',
    writeConsoleMessage
  });
  assert.equal(values.get('oe-debug-filter'), 'off');
});

test('OverExposed console does not subscribe to structured debug entries', () => {
  assert.doesNotMatch(consoleShellSource, /OEDebug\??\.subscribe/);
  assert.doesNotMatch(debugSource, /createOverexposureConsoleMessage/);
  assert.doesNotMatch(debugSource, /\bdocument\b/);
});

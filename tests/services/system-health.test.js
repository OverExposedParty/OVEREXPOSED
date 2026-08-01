const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatBytes,
  formatUptime,
  measureDatabaseConnection
} = require('../../server/services/system-health');

test('formatBytes presents runtime memory using readable units', () => {
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(25 * 1024 * 1024), '25 MB');
});

test('formatUptime presents days, hours, and minutes', () => {
  assert.equal(formatUptime(90061), '1d 1h 1m');
  assert.equal(formatUptime(120), '2m');
});

test('measureDatabaseConnection reports disconnected connections without pinging', async () => {
  const result = await measureDatabaseConnection({
    label: 'Accounts',
    connection: { readyState: 0 }
  });

  assert.deepEqual(result, {
    label: 'Accounts',
    state: 'Disconnected',
    connected: false,
    latencyMs: null
  });
});

test('measureDatabaseConnection verifies connected databases with a ping', async () => {
  const result = await measureDatabaseConnection({
    label: 'Accounts',
    connection: {
      readyState: 1,
      db: { admin: () => ({ ping: async () => ({ ok: 1 }) }) }
    }
  });

  assert.equal(result.label, 'Accounts');
  assert.equal(result.state, 'Connected');
  assert.equal(result.connected, true);
  assert.equal(Number.isFinite(result.latencyMs), true);
});

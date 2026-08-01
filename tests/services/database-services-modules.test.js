const assert = require('node:assert/strict');
const test = require('node:test');

const { createDatabaseServices } = require('../../server/services/database');
const {
  createRoomArchiver
} = require('../../server/services/database/room-archiver');
const {
  createChangeStreamService
} = require('../../server/services/database/change-streams');

test('database services facade preserves its startup contract', async () => {
  const services = createDatabaseServices({
    io: {},
    debugLog() {},
    models: {}
  });

  assert.deepEqual(Object.keys(services).sort(), [
    'connectDatabases',
    'ensureDatabaseIndexes',
    'startChangeStreams',
    'startRoomArchiver'
  ]);
  await assert.rejects(
    services.startChangeStreams(),
    /Cannot start change streams before database connection is ready/
  );
});

test('database modules expose focused service factories', () => {
  assert.equal(typeof createRoomArchiver, 'function');
  assert.equal(typeof createChangeStreamService, 'function');
});

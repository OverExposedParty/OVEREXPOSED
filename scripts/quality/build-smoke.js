const assert = require('node:assert/strict');

const { createAppServer } = require('../../server/app');

function main() {
  const { app, server, database } = createAppServer();

  assert.ok(app, 'Expected Express app to be created');
  assert.ok(server, 'Expected HTTP server to be created');
  assert.ok(database, 'Expected database services to be created');
  assert.equal(typeof database.connectDatabases, 'function');
  assert.equal(typeof database.ensureDatabaseIndexes, 'function');
  assert.equal(typeof database.startChangeStreams, 'function');

  server.close();
  console.log('Build smoke check passed.');
}

main();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adventureApiSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/olings/lab/explorer-gateway/adventure-api.js'
  ),
  'utf8'
);

test('Adventure return requests include the active run ID', async () => {
  let request = null;
  const window = {};
  vm.runInNewContext(adventureApiSource, {
    fetch: async (pathname, options) => {
      request = { pathname, options };
      return {
        ok: true,
        json: async () => ({ success: true })
      };
    },
    JSON,
    window
  });

  await window.createOlingLabAdventureApi().returnOling('run-1');

  assert.equal(request.pathname, '/api/olings/adventures/return');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), { runId: 'run-1' });
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  runWithFreshDocumentRetry
} = require('../../server/services/mongoose-version-retry');

test('version conflicts reload the document before retrying', async () => {
  const loadedVersions = [];
  const runVersions = [];

  const result = await runWithFreshDocumentRetry({
    async loadDocument() {
      const version = loadedVersions.length + 1;
      loadedVersions.push(version);
      return { version };
    },
    async run(document) {
      runVersions.push(document.version);
      if (document.version === 1) {
        const error = new Error('stale account');
        error.name = 'VersionError';
        throw error;
      }
      return `saved-version-${document.version}`;
    }
  });

  assert.equal(result, 'saved-version-2');
  assert.deepEqual(loadedVersions, [1, 2]);
  assert.deepEqual(runVersions, [1, 2]);
});

test('non-version errors are not retried', async () => {
  let loadCount = 0;

  await assert.rejects(
    runWithFreshDocumentRetry({
      async loadDocument() {
        loadCount += 1;
        return {};
      },
      async run() {
        throw new Error('database unavailable');
      }
    }),
    /database unavailable/
  );

  assert.equal(loadCount, 1);
});

test('version retries stop after the configured attempt limit', async () => {
  let runCount = 0;

  await assert.rejects(
    runWithFreshDocumentRetry({
      async loadDocument() {
        return {};
      },
      async run() {
        runCount += 1;
        const error = new Error('still stale');
        error.name = 'VersionError';
        throw error;
      },
      maxAttempts: 3
    }),
    (error) => error.name === 'VersionError'
  );

  assert.equal(runCount, 3);
});

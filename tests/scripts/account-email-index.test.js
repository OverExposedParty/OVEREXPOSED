const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACCOUNT_EMAIL_INDEX_OPTIONS,
  migrateAccountEmailIndex
} = require('../../scripts/lib/account-email-index');

function createCollection({ indexes, duplicate = null, createError = null }) {
  let currentIndexes = structuredClone(indexes);
  const calls = [];

  return {
    calls,
    async indexes() {
      return structuredClone(currentIndexes);
    },
    aggregate() {
      return {
        async next() {
          return duplicate;
        }
      };
    },
    async dropIndex(name) {
      calls.push(['dropIndex', name]);
      currentIndexes = currentIndexes.filter((index) => index.name !== name);
    },
    async createIndex(key, options) {
      calls.push(['createIndex', key, options]);
      if (createError) {
        const error = createError;
        createError = null;
        throw error;
      }
      currentIndexes.push({ v: 2, key, ...options });
      return options.name;
    }
  };
}

test('account email index migration replaces the legacy index without an unindexed gap', async () => {
  const collection = createCollection({
    indexes: [
      { v: 2, key: { _id: 1 }, name: '_id_' },
      { v: 2, key: { email: 1 }, name: 'email_1', unique: true }
    ]
  });

  const result = await migrateAccountEmailIndex(collection);

  assert.deepEqual(result, {
    changed: true,
    name: 'account_email_unique'
  });
  assert.deepEqual(collection.calls, [
    ['createIndex', { email: 1 }, ACCOUNT_EMAIL_INDEX_OPTIONS],
    ['dropIndex', 'email_1']
  ]);
});

test('account email index migration leaves the expected index unchanged', async () => {
  const collection = createCollection({
    indexes: [
      {
        v: 2,
        key: { email: 1 },
        ...ACCOUNT_EMAIL_INDEX_OPTIONS
      }
    ]
  });

  const result = await migrateAccountEmailIndex(collection);

  assert.deepEqual(result, {
    changed: false,
    name: 'account_email_unique'
  });
  assert.deepEqual(collection.calls, []);
});

test('account email index migration refuses duplicate string emails', async () => {
  const collection = createCollection({
    indexes: [{ v: 2, key: { email: 1 }, name: 'email_1', unique: true }],
    duplicate: { _id: 'duplicate@example.com', count: 2 }
  });

  await assert.rejects(
    migrateAccountEmailIndex(collection),
    /duplicate@example\.com.*2 times/
  );
  assert.deepEqual(collection.calls, []);
});

test('account email index migration keeps the legacy index on failure', async () => {
  const createError = new Error('create failed');
  const collection = createCollection({
    indexes: [
      {
        v: 2,
        key: { email: 1 },
        name: 'email_1',
        unique: true,
        background: true
      }
    ],
    createError
  });

  await assert.rejects(migrateAccountEmailIndex(collection), createError);
  assert.deepEqual(collection.calls, [
    ['createIndex', { email: 1 }, ACCOUNT_EMAIL_INDEX_OPTIONS]
  ]);
});

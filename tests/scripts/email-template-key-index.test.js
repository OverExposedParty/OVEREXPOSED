const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EMAIL_TEMPLATE_KEY_INDEX_OPTIONS,
  LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS,
  migrateEmailTemplateKeyIndex
} = require('../../scripts/lib/email-template-key-index');

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
      if (createError && options === EMAIL_TEMPLATE_KEY_INDEX_OPTIONS) {
        const error = createError;
        createError = null;
        throw error;
      }
      currentIndexes.push({ v: 2, key, ...options });
      return options.name;
    }
  };
}

test('email template key index migration replaces the legacy definition', async () => {
  const collection = createCollection({
    indexes: [
      {
        v: 2,
        key: { key: 1 },
        ...LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS
      }
    ]
  });

  const result = await migrateEmailTemplateKeyIndex(collection);

  assert.deepEqual(result, {
    changed: true,
    name: 'email_template_key_unique'
  });
  assert.deepEqual(collection.calls, [
    ['dropIndex', 'email_template_key_unique'],
    ['createIndex', { key: 1 }, EMAIL_TEMPLATE_KEY_INDEX_OPTIONS]
  ]);
});

test('email template key index migration leaves the expected index unchanged', async () => {
  const collection = createCollection({
    indexes: [{ v: 2, key: { key: 1 }, ...EMAIL_TEMPLATE_KEY_INDEX_OPTIONS }]
  });

  const result = await migrateEmailTemplateKeyIndex(collection);

  assert.deepEqual(result, {
    changed: false,
    name: 'email_template_key_unique'
  });
  assert.deepEqual(collection.calls, []);
});

test('email template key index migration refuses duplicate keys', async () => {
  const collection = createCollection({
    indexes: [
      {
        v: 2,
        key: { key: 1 },
        ...LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS
      }
    ],
    duplicate: { _id: 'verify-email', count: 2 }
  });

  await assert.rejects(
    migrateEmailTemplateKeyIndex(collection),
    /verify-email.*2 times/
  );
  assert.deepEqual(collection.calls, []);
});

test('email template key index migration restores the legacy index on failure', async () => {
  const createError = new Error('create failed');
  const collection = createCollection({
    indexes: [
      {
        v: 2,
        key: { key: 1 },
        ...LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS
      }
    ],
    createError
  });

  await assert.rejects(migrateEmailTemplateKeyIndex(collection), createError);
  assert.deepEqual(collection.calls, [
    ['dropIndex', 'email_template_key_unique'],
    ['createIndex', { key: 1 }, EMAIL_TEMPLATE_KEY_INDEX_OPTIONS],
    ['createIndex', { key: 1 }, LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS]
  ]);
});

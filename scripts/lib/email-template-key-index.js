const { isDeepStrictEqual } = require('node:util');

const EMAIL_TEMPLATE_KEY_INDEX_NAME = 'email_template_key_unique';
const EMAIL_TEMPLATE_KEY_INDEX_KEY = { key: 1 };
const EMAIL_TEMPLATE_KEY_INDEX_OPTIONS = {
  name: EMAIL_TEMPLATE_KEY_INDEX_NAME,
  unique: true,
  partialFilterExpression: { key: { $type: 'string' } }
};
const LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS = {
  name: EMAIL_TEMPLATE_KEY_INDEX_NAME,
  unique: true,
  partialFilterExpression: {
    key: { $type: 'string' },
    'system.archivedAt': null
  }
};

function isEmailTemplateKeyIndex(index) {
  return isDeepStrictEqual(index?.key, EMAIL_TEMPLATE_KEY_INDEX_KEY);
}

function hasExpectedOptions(index, options) {
  return (
    index?.name === options.name &&
    isEmailTemplateKeyIndex(index) &&
    index.unique === true &&
    isDeepStrictEqual(
      index.partialFilterExpression,
      options.partialFilterExpression
    )
  );
}

function isExpectedEmailTemplateKeyIndex(index) {
  return hasExpectedOptions(index, EMAIL_TEMPLATE_KEY_INDEX_OPTIONS);
}

function isLegacyEmailTemplateKeyIndex(index) {
  return hasExpectedOptions(index, LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS);
}

async function findDuplicateTemplateKey(collection) {
  return collection
    .aggregate([
      { $match: { key: { $type: 'string' } } },
      { $group: { _id: '$key', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ])
    .next();
}

async function verifyExpectedIndex(collection) {
  const index = (await collection.indexes()).find(
    (candidate) => candidate.name === EMAIL_TEMPLATE_KEY_INDEX_NAME
  );

  if (!isExpectedEmailTemplateKeyIndex(index)) {
    throw new Error('Email template key index verification failed.');
  }
}

async function restoreLegacyIndex(collection, migrationError) {
  try {
    const existing = (await collection.indexes()).find(
      (index) => index.name === EMAIL_TEMPLATE_KEY_INDEX_NAME
    );

    if (existing && !isLegacyEmailTemplateKeyIndex(existing)) {
      if (!isEmailTemplateKeyIndex(existing)) {
        throw new Error(
          `Cannot restore "${EMAIL_TEMPLATE_KEY_INDEX_NAME}" because that name now belongs to an unexpected index.`
        );
      }
      await collection.dropIndex(EMAIL_TEMPLATE_KEY_INDEX_NAME);
    }

    if (!existing || !isLegacyEmailTemplateKeyIndex(existing)) {
      await collection.createIndex(
        EMAIL_TEMPLATE_KEY_INDEX_KEY,
        LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS
      );
    }

    const restored = (await collection.indexes()).find(
      (index) => index.name === EMAIL_TEMPLATE_KEY_INDEX_NAME
    );
    if (!isLegacyEmailTemplateKeyIndex(restored)) {
      throw new Error('Legacy email template key index restoration failed.');
    }
  } catch (rollbackError) {
    throw new AggregateError(
      [migrationError, rollbackError],
      'Email template key index migration and rollback both failed.'
    );
  }

  throw migrationError;
}

async function migrateEmailTemplateKeyIndex(collection) {
  const indexes = await collection.indexes();
  const existing = indexes.find(
    (index) => index.name === EMAIL_TEMPLATE_KEY_INDEX_NAME
  );

  if (isExpectedEmailTemplateKeyIndex(existing)) {
    return { changed: false, name: EMAIL_TEMPLATE_KEY_INDEX_NAME };
  }

  if (existing && !isEmailTemplateKeyIndex(existing)) {
    throw new Error(
      `Refusing to replace "${EMAIL_TEMPLATE_KEY_INDEX_NAME}" because it does not index the template key field.`
    );
  }

  if (existing && !isLegacyEmailTemplateKeyIndex(existing)) {
    throw new Error(
      `Refusing to replace "${EMAIL_TEMPLATE_KEY_INDEX_NAME}" because its options are not the recognized legacy definition.`
    );
  }

  const duplicate = await findDuplicateTemplateKey(collection);
  if (duplicate) {
    throw new Error(
      `Cannot create the unique email template key index because "${duplicate._id}" appears ${duplicate.count} times.`
    );
  }

  if (existing) {
    await collection.dropIndex(EMAIL_TEMPLATE_KEY_INDEX_NAME);
  }

  try {
    await collection.createIndex(
      EMAIL_TEMPLATE_KEY_INDEX_KEY,
      EMAIL_TEMPLATE_KEY_INDEX_OPTIONS
    );
    await verifyExpectedIndex(collection);
  } catch (error) {
    if (existing) {
      await restoreLegacyIndex(collection, error);
    }
    throw error;
  }

  return { changed: true, name: EMAIL_TEMPLATE_KEY_INDEX_NAME };
}

module.exports = {
  EMAIL_TEMPLATE_KEY_INDEX_KEY,
  EMAIL_TEMPLATE_KEY_INDEX_NAME,
  EMAIL_TEMPLATE_KEY_INDEX_OPTIONS,
  LEGACY_EMAIL_TEMPLATE_KEY_INDEX_OPTIONS,
  isExpectedEmailTemplateKeyIndex,
  isLegacyEmailTemplateKeyIndex,
  migrateEmailTemplateKeyIndex
};

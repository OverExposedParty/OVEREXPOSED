const { isDeepStrictEqual } = require('node:util');

const ACCOUNT_EMAIL_INDEX_NAME = 'account_email_unique';
const LEGACY_ACCOUNT_EMAIL_INDEX_NAME = 'email_1';
const ACCOUNT_EMAIL_INDEX_KEY = { email: 1 };
const ACCOUNT_EMAIL_INDEX_OPTIONS = {
  name: ACCOUNT_EMAIL_INDEX_NAME,
  unique: true,
  partialFilterExpression: { email: { $type: 'string' } }
};

function isEmailIndex(index) {
  return isDeepStrictEqual(index?.key, ACCOUNT_EMAIL_INDEX_KEY);
}

function isExpectedEmailIndex(index) {
  return (
    index?.name === ACCOUNT_EMAIL_INDEX_NAME &&
    isEmailIndex(index) &&
    index.unique === true &&
    isDeepStrictEqual(
      index.partialFilterExpression,
      ACCOUNT_EMAIL_INDEX_OPTIONS.partialFilterExpression
    )
  );
}

async function findDuplicateEmail(collection) {
  return collection
    .aggregate([
      { $match: { email: { $type: 'string' } } },
      { $group: { _id: '$email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 }
    ])
    .next();
}

async function migrateAccountEmailIndex(collection) {
  const indexes = await collection.indexes();
  const existingIndex = indexes.find(
    (index) => index.name === ACCOUNT_EMAIL_INDEX_NAME
  );
  const legacyIndex = indexes.find(
    (index) => index.name === LEGACY_ACCOUNT_EMAIL_INDEX_NAME
  );

  if (existingIndex && !isEmailIndex(existingIndex)) {
    throw new Error(
      `Refusing to replace "${ACCOUNT_EMAIL_INDEX_NAME}" because it does not index the email field.`
    );
  }

  if (existingIndex && !isExpectedEmailIndex(existingIndex)) {
    throw new Error(
      `Refusing to replace "${ACCOUNT_EMAIL_INDEX_NAME}" because its options do not match the expected unique email index.`
    );
  }

  if (legacyIndex && !isEmailIndex(legacyIndex)) {
    throw new Error(
      `Refusing to remove "${LEGACY_ACCOUNT_EMAIL_INDEX_NAME}" because it does not index the email field.`
    );
  }

  if (!existingIndex) {
    const duplicate = await findDuplicateEmail(collection);
    if (duplicate) {
      throw new Error(
        `Cannot create the unique email index because "${duplicate._id}" appears ${duplicate.count} times.`
      );
    }

    await collection.createIndex(
      ACCOUNT_EMAIL_INDEX_KEY,
      ACCOUNT_EMAIL_INDEX_OPTIONS
    );

    const migratedIndex = (await collection.indexes()).find(
      (index) => index.name === ACCOUNT_EMAIL_INDEX_NAME
    );
    if (!isExpectedEmailIndex(migratedIndex)) {
      throw new Error('Account email index verification failed.');
    }
  }

  if (legacyIndex) {
    await collection.dropIndex(LEGACY_ACCOUNT_EMAIL_INDEX_NAME);
  }

  return {
    changed: !existingIndex || Boolean(legacyIndex),
    name: ACCOUNT_EMAIL_INDEX_NAME
  };
}

module.exports = {
  ACCOUNT_EMAIL_INDEX_KEY,
  ACCOUNT_EMAIL_INDEX_NAME,
  ACCOUNT_EMAIL_INDEX_OPTIONS,
  LEGACY_ACCOUNT_EMAIL_INDEX_NAME,
  isExpectedEmailIndex,
  migrateAccountEmailIndex
};

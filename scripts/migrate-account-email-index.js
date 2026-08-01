require('dotenv').config();

const mongoose = require('mongoose');
const { migrateAccountEmailIndex } = require('./lib/account-email-index');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_ACCOUNTS || process.env.MONGO_URI_OVEREXPOSURE;

  if (!baseUri) {
    throw new Error(
      'MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE is required.'
    );
  }

  const accountsUri =
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts');
  const connection = await mongoose.createConnection(accountsUri).asPromise();

  try {
    const result = await migrateAccountEmailIndex(
      connection.collection('accounts')
    );
    console.log(
      result.changed
        ? 'Migrated the Account email index successfully.'
        : 'The Account email index is already correct.'
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to migrate the Account email index:', error);
  process.exitCode = 1;
});

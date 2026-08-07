require('dotenv').config();

const mongoose = require('mongoose');
const {
  migrateEmailTemplateKeyIndex
} = require('./lib/email-template-key-index');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri =
    process.env.MONGO_URI_EMAILS || process.env.MONGO_URI_OVEREXPOSURE;

  if (!baseUri) {
    throw new Error('MONGO_URI_EMAILS or MONGO_URI_OVEREXPOSURE is required.');
  }

  const emailsUri =
    process.env.MONGO_URI_EMAILS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_EMAILS || 'emails');
  const connection = await mongoose.createConnection(emailsUri).asPromise();

  try {
    const result = await migrateEmailTemplateKeyIndex(
      connection.collection('email-templates')
    );
    console.log(
      result.changed
        ? 'Migrated the email template key index successfully.'
        : 'The email template key index is already correct.'
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to migrate the email template key index:', error);
  process.exitCode = 1;
});

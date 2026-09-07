require('dotenv').config();

const models = require('../server/models');
const {
  OlingLabWallDecorations
} = require('../server/routes/api-olings/lab-catalog');

const CONFIRM_FLAG = '--confirm';

function getArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function getAccountsUri() {
  const baseUri =
    process.env.MONGO_URI_ACCOUNTS || process.env.MONGO_URI_OVEREXPOSURE;
  if (!baseUri) throw new Error('Missing MongoDB accounts URI.');
  if (process.env.MONGO_URI_ACCOUNTS) return process.env.MONGO_URI_ACCOUNTS;
  const parsed = new URL(baseUri);
  parsed.pathname = `/${process.env.MONGO_DB_ACCOUNTS || 'accounts'}`;
  return parsed.toString();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const username = String(getArgument('--username', 'ardactic'))
    .trim()
    .replace(/^@+/, '');
  const key = String(getArgument('--key', 'oling_clash_beta_poster')).trim();
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to write without ${CONFIRM_FLAG}.`);
  }
  if (!Object.hasOwn(OlingLabWallDecorations, key)) {
    throw new Error(`Unknown wall decoration "${key}".`);
  }

  await models.accountsConnection.openUri(getAccountsUri(), {
    serverSelectionTimeoutMS: 15000
  });
  const accounts = await models.Account.find({
    username: { $regex: `^${escapeRegExp(username)}$`, $options: 'i' }
  }).limit(2);
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one exact account for "${username}", found ${accounts.length}.`
    );
  }

  const account = accounts[0];
  const inventory = Array.isArray(account.olings?.wallDecorations)
    ? account.olings.wallDecorations.map((item) => item.toObject?.() || item)
    : [];
  const existing = inventory.find((item) => item.key === key);
  const added = !existing || Number(existing.quantity || 0) < 1;
  const now = new Date();
  if (existing) {
    existing.quantity = Math.max(1, Number(existing.quantity || 0));
    existing.lastUpdatedAt = now;
  } else {
    inventory.push({
      key,
      rarity: OlingLabWallDecorations[key].rarity || 'common',
      quantity: 1,
      acquiredAt: now,
      lastUpdatedAt: now,
      metadata: { source: 'manual_wall_decoration_grant' }
    });
  }
  await models.Account.updateOne(
    { _id: account._id },
    { $set: { 'olings.wallDecorations': inventory } },
    { runValidators: false }
  );
  const verified = await models.Account.exists({
    _id: account._id,
    'olings.wallDecorations': { $elemMatch: { key, quantity: { $gte: 1 } } }
  });
  if (!verified) throw new Error('Wall-decoration grant verification failed.');

  console.log(
    JSON.stringify(
      {
        updated: added,
        accountId: String(account._id),
        username: account.username,
        key,
        quantity: 1
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await models.accountsConnection.close().catch(() => {});
  });

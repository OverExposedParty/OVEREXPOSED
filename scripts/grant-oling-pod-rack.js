require('dotenv').config();

const models = require('../server/models');
const { OlingLabItems } = require('../server/routes/api-olings/lab-catalog');
const {
  grantShopItemsToAccount
} = require('../server/services/opals/purchases');

const FURNITURE_KEY = 'pod_rack';
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
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to write without ${CONFIRM_FLAG}.`);
  }
  if (!Object.hasOwn(OlingLabItems, FURNITURE_KEY)) {
    throw new Error(`Unknown furniture "${FURNITURE_KEY}".`);
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
  const result = await grantShopItemsToAccount({
    Account: models.Account,
    OlingState: models.OlingState,
    accountId: account._id,
    grants: [
      {
        type: 'oling_furniture',
        key: FURNITURE_KEY,
        quantity: 1,
        rarity: OlingLabItems[FURNITURE_KEY].rarity,
        metadata: { source: 'manual_pod_rack_grant' }
      }
    ]
  });
  if (result.error) throw new Error(result.error.message);

  const quantity = (result.account?.olings?.furniture || [])
    .filter((item) => item?.key === FURNITURE_KEY)
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (quantity < 1) throw new Error('Pod Rack grant verification failed.');

  console.log(
    JSON.stringify(
      {
        accountId: String(account._id),
        username: account.username,
        key: FURNITURE_KEY,
        quantity
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

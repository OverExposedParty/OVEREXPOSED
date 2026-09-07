require('dotenv').config();

const models = require('../server/models');
const {
  OlingLabWallpapers,
  parseOlingLabWallpaperVariantEntitlementKey
} = require('../server/routes/api-olings/lab-catalog');
const {
  grantShopItemsToAccount
} = require('../server/services/opals/purchases');

const CONFIRM_FLAG = '--confirm';

function getArgument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

function getAccountsUri() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  const accountsBaseUri = process.env.MONGO_URI_ACCOUNTS || baseUri;
  if (!accountsBaseUri) {
    throw new Error(
      'Missing MongoDB URI. Configure MONGO_URI_ACCOUNTS or MONGO_URI_OVEREXPOSURE.'
    );
  }

  return (
    process.env.MONGO_URI_ACCOUNTS ||
    getDatabaseUri(accountsBaseUri, process.env.MONGO_DB_ACCOUNTS || 'accounts')
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const username = String(getArgument('--username')).trim().replace(/^@+/, '');
  const wallpaperKeys = [
    ...new Set(
      String(getArgument('--keys'))
        .split(',')
        .map((key) => key.trim().toLowerCase())
        .filter(Boolean)
    )
  ];

  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Refusing to write without ${CONFIRM_FLAG}.`);
  }
  if (!username) throw new Error('Provide an exact username with --username.');
  if (!wallpaperKeys.length) {
    throw new Error('Provide at least one comma-separated wallpaper key.');
  }

  const invalidKeys = wallpaperKeys.filter(
    (key) =>
      !Object.hasOwn(OlingLabWallpapers, key) &&
      !parseOlingLabWallpaperVariantEntitlementKey(key)
  );
  if (invalidKeys.length) {
    throw new Error(`Unknown wallpaper keys: ${invalidKeys.join(', ')}.`);
  }

  await models.accountsConnection.openUri(getAccountsUri(), {
    serverSelectionTimeoutMS: 15000
  });

  const accounts = await models.Account.find({
    username: {
      $regex: `^${escapeRegExp(username)}$`,
      $options: 'i'
    }
  }).limit(2);
  if (accounts.length !== 1) {
    throw new Error(
      `Expected one exact account for "${username}", found ${accounts.length}.`
    );
  }

  const account = accounts[0];
  const result = await grantShopItemsToAccount({
    Account: models.Account,
    accountId: account._id,
    grants: wallpaperKeys.map((key) => ({
      type: parseOlingLabWallpaperVariantEntitlementKey(key)
        ? 'oling_wallpaper_variant'
        : 'oling_wallpaper',
      key,
      quantity: 1
    })),
    metadata: {
      reason: 'Manual Oling Lab wallpaper grant',
      requestedFor: username
    }
  });
  if (result.error) throw new Error(result.error.message);

  const updatedAccount = await models.Account.findById(account._id).lean();
  const verifiedKeys = (
    updatedAccount?.gameData?.inGamePurchasesAndUnlocks || []
  )
    .filter((unlock) => {
      const expectedType = parseOlingLabWallpaperVariantEntitlementKey(
        unlock?.key
      )
        ? 'oling_wallpaper_variant'
        : 'oling_wallpaper';
      return (
        unlock?.type === expectedType && wallpaperKeys.includes(unlock.key)
      );
    })
    .map((unlock) => unlock.key)
    .sort();
  if (verifiedKeys.length !== wallpaperKeys.length) {
    throw new Error('Wallpaper grant verification failed after the update.');
  }

  console.log(
    JSON.stringify(
      {
        updated: true,
        accountId: String(account._id),
        username: account.username,
        added: result.grant.addedUnlocks.map(({ key }) => key),
        alreadyOwned: result.grant.skippedUnlocks.map(({ key }) => key),
        verified: verifiedKeys
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

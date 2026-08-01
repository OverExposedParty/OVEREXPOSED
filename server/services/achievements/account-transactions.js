const { isDeepStrictEqual } = require('node:util');

const TRANSACTION_TOPOLOGY_TYPES = new Set([
  'LoadBalanced',
  'ReplicaSetNoPrimary',
  'ReplicaSetWithPrimary',
  'Sharded'
]);
const TRANSACTION_DUPLICATE_RETRIES = 3;
const TRANSACTION_DUPLICATE_RETRY_MS = 25;

const ACHIEVEMENT_ACCOUNT_SYNC_PATHS = [
  'gameData.opals',
  'gameData.opalTransactions',
  'gameData.xp',
  'gameData.level',
  'gameData.inGamePurchasesAndUnlocks',
  'gameData.achievements',
  'gameData.notifications',
  'olings.eggs',
  'olings.consumables',
  'olings.furniture'
];

function getPathValue(value, path) {
  if (typeof value?.get === 'function') return value.get(path);
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => current?.[key], value);
}

function getSyncValue(value) {
  if (value == null) return value;
  if (typeof value?.toObject === 'function') {
    return value.toObject({
      depopulate: true,
      getters: false,
      virtuals: false
    });
  }
  return value;
}

function setPathValue(value, path, nextValue) {
  const keys = String(path || '')
    .split('.')
    .filter(Boolean);
  const finalKey = keys.pop();
  if (!finalKey) return;
  const target = keys.reduce((current, key) => {
    let child =
      typeof current?.get === 'function' ? current.get(key) : current?.[key];
    if (child == null) {
      if (typeof current?.set === 'function') {
        current.set(key, {});
        child = current.get(key);
      } else {
        current[key] = {};
        child = current[key];
      }
    }
    return child;
  }, value);

  if (typeof target?.set === 'function') {
    target.set(finalKey, nextValue);
  } else {
    target[finalKey] = nextValue;
  }
}

function getAchievementAccountTransactionContext({ account, Claim }) {
  if (!account?.$__ || account.isNew || !Claim) return null;

  const Account = account.constructor;
  const connection = Account?.db;
  if (
    !Account?.findById ||
    !connection ||
    connection.readyState !== 1 ||
    typeof connection.transaction !== 'function' ||
    Claim.db !== connection
  ) {
    return null;
  }

  const topologyType = connection.client?.topology?.description?.type;
  const transactionsEnabledForTests =
    connection.$achievementRewardTransactions === true;
  if (
    !transactionsEnabledForTests &&
    !TRANSACTION_TOPOLOGY_TYPES.has(topologyType)
  ) {
    return null;
  }

  return { Account, connection };
}

function isAchievementClaimDuplicateError(error) {
  const keyPattern = error?.keyPattern || {};
  return (
    (error?.code === 11000 || error?.code === 11001) &&
    (error.achievementRewardClaimDuplicate === true ||
      keyPattern.claimKey === 1 ||
      keyPattern.achievementKey === 1)
  );
}

function pathsOverlap(left, right) {
  return (
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`)
  );
}

function assertAchievementRewardStateIsClean(account) {
  const modifiedPaths =
    account.directModifiedPaths?.() || account.modifiedPaths?.() || [];
  const conflictingPath = modifiedPaths.find((modifiedPath) =>
    ACHIEVEMENT_ACCOUNT_SYNC_PATHS.some((rewardPath) =>
      pathsOverlap(modifiedPath, rewardPath)
    )
  );
  if (!conflictingPath) return;

  const error = new Error(
    `Save pending account reward changes before unlocking an achievement (${conflictingPath}).`
  );
  error.code = 'achievement_reward_state_dirty';
  throw error;
}

function capturePendingAccountChanges(account) {
  const modifiedPaths = account.directModifiedPaths?.() || [];
  if (!modifiedPaths.length) return [];

  const accountState =
    account.toObject?.({
      depopulate: true,
      getters: false,
      virtuals: false
    }) || account;
  return modifiedPaths.map((path) => ({
    path,
    value: getPathValue(accountState, path)
  }));
}

function applyPendingAccountChanges(account, changes) {
  changes.forEach(({ path, value }) => {
    setPathValue(account, path, value);
    account.markModified?.(path);
  });
}

function clearCommittedAccountChanges(account, changes) {
  if (!account || !changes.length) return;
  const accountState =
    account.toObject?.({
      depopulate: true,
      getters: false,
      virtuals: false
    }) || account;

  changes.forEach(({ path, value }) => {
    if (isDeepStrictEqual(getPathValue(accountState, path), value)) {
      account.unmarkModified?.(path);
    }
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runAchievementAccountTransaction({ account, Claim, operation }) {
  const context = getAchievementAccountTransactionContext({ account, Claim });
  if (!context || typeof operation !== 'function') {
    return { handled: false, result: null };
  }
  assertAchievementRewardStateIsClean(account);
  const pendingChanges = capturePendingAccountChanges(account);

  for (let attempt = 0; attempt < TRANSACTION_DUPLICATE_RETRIES; attempt += 1) {
    try {
      const result = await context.connection.transaction(async (session) => {
        let query = context.Account.findById(account._id);
        if (typeof query?.select === 'function') {
          query = query.select('+security +gameData.moderationFlags');
        }
        const workingAccount =
          typeof query?.session === 'function'
            ? await query.session(session)
            : await query;
        if (!workingAccount) return { account: null, unlocked: false };
        applyPendingAccountChanges(workingAccount, pendingChanges);
        return operation({ account: workingAccount, session });
      });
      return { handled: true, result, pendingChanges };
    } catch (error) {
      if (!isAchievementClaimDuplicateError(error)) throw error;
      if (attempt === TRANSACTION_DUPLICATE_RETRIES - 1) {
        return { handled: true, result: null, pendingChanges };
      }
      await wait(TRANSACTION_DUPLICATE_RETRY_MS * (attempt + 1));
    }
  }

  return { handled: true, result: null, pendingChanges };
}

function syncAchievementAccountState(targetAccount, sourceAccount) {
  if (!targetAccount || !sourceAccount || targetAccount === sourceAccount)
    return;

  const modifiedBeforeSync = new Set(targetAccount.modifiedPaths?.() || []);

  ACHIEVEMENT_ACCOUNT_SYNC_PATHS.forEach((path) => {
    setPathValue(
      targetAccount,
      path,
      getSyncValue(getPathValue(sourceAccount, path))
    );
  });

  const version = getPathValue(sourceAccount, '__v');
  if (version !== undefined) {
    setPathValue(targetAccount, '__v', version);
  }
  const updatedAt = getPathValue(sourceAccount, 'updatedAt');
  if (updatedAt !== undefined) {
    setPathValue(targetAccount, 'updatedAt', updatedAt);
  }

  if (typeof targetAccount.modifiedPaths === 'function') {
    targetAccount.modifiedPaths().forEach((path) => {
      if (!modifiedBeforeSync.has(path)) targetAccount.unmarkModified?.(path);
    });
  } else {
    ACHIEVEMENT_ACCOUNT_SYNC_PATHS.forEach((path) => {
      targetAccount.unmarkModified?.(path);
    });
    targetAccount.unmarkModified?.('__v');
  }
}

module.exports = {
  ACHIEVEMENT_ACCOUNT_SYNC_PATHS,
  assertAchievementRewardStateIsClean,
  clearCommittedAccountChanges,
  getAchievementAccountTransactionContext,
  runAchievementAccountTransaction,
  syncAchievementAccountState
};

const { applyAccountXp } = require('./account-progression');

function toRewardAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(amount));
}

function normalizeAccountRewards(rewards = {}) {
  return {
    accountXp: toRewardAmount(rewards.accountXp),
    opals: toRewardAmount(rewards.opals)
  };
}

function ensureOpalWallet(account) {
  account.gameData ||= {};
  account.gameData.opals ||= {};
  account.gameData.opals.balance = toRewardAmount(
    account.gameData.opals.balance
  );
  account.gameData.opals.lifetimeEarned = toRewardAmount(
    account.gameData.opals.lifetimeEarned
  );
  account.gameData.opals.lifetimeSpent = toRewardAmount(
    account.gameData.opals.lifetimeSpent
  );
  account.gameData.opalTransactions ||= [];
}

function markAccountRewardPaths(account) {
  [
    'gameData.level',
    'gameData.xp',
    'gameData.opals',
    'gameData.opalTransactions'
  ].forEach((path) => account.markModified?.(path));
}

function grantAccountRewards({
  account,
  rewards,
  sourceId,
  reason,
  metadata = {},
  now = new Date()
}) {
  if (!account || typeof account !== 'object') {
    throw new TypeError('An account is required to grant rewards.');
  }

  const normalizedSourceId = String(sourceId || '').trim();
  if (!normalizedSourceId) {
    throw new TypeError('A reward source ID is required.');
  }

  const normalizedRewards = normalizeAccountRewards(rewards);
  ensureOpalWallet(account);

  const existingTransaction = account.gameData.opalTransactions.find(
    (transaction) =>
      transaction?.sourceType === 'game_reward' &&
      transaction?.sourceId === normalizedSourceId
  );
  if (existingTransaction) {
    return {
      granted: false,
      duplicate: true,
      rewards: normalizeAccountRewards(
        existingTransaction.metadata?.accountRewards || normalizedRewards
      ),
      balanceAfter: Number(existingTransaction.balanceAfter) || 0,
      progression: null,
      transaction: existingTransaction
    };
  }

  const progression = applyAccountXp(account, normalizedRewards.accountXp);
  const balanceBefore = account.gameData.opals.balance;
  const balanceAfter = balanceBefore + normalizedRewards.opals;
  const lifetimeEarnedAfter =
    account.gameData.opals.lifetimeEarned + normalizedRewards.opals;

  if (
    !Number.isSafeInteger(balanceAfter) ||
    !Number.isSafeInteger(lifetimeEarnedAfter)
  ) {
    throw new RangeError('Account reward exceeds the Opal wallet limit.');
  }

  account.gameData.opals.balance = balanceAfter;
  account.gameData.opals.lifetimeEarned = lifetimeEarnedAfter;
  const transaction = {
    type: 'earn',
    amount: normalizedRewards.opals,
    reason: String(reason || 'Account reward').trim(),
    sourceType: 'game_reward',
    sourceId: normalizedSourceId,
    balanceAfter,
    metadata: {
      ...metadata,
      accountRewards: normalizedRewards
    },
    createdAt: now
  };
  account.gameData.opalTransactions.push(transaction);
  markAccountRewardPaths(account);

  return {
    granted: true,
    duplicate: false,
    rewards: normalizedRewards,
    balanceAfter,
    progression,
    transaction
  };
}

module.exports = {
  grantAccountRewards,
  normalizeAccountRewards
};

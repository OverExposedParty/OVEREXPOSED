const { toPositiveInteger } = require('./catalog');

function serializeOpalWallet(account) {
  const wallet = account?.gameData?.opals || {};
  return {
    balance: toPositiveInteger(wallet.balance),
    lifetimeEarned: toPositiveInteger(wallet.lifetimeEarned),
    lifetimeSpent: toPositiveInteger(wallet.lifetimeSpent)
  };
}

function serializeOpalTransactions(account, limit = 20) {
  const transactions = Array.isArray(account?.gameData?.opalTransactions)
    ? account.gameData.opalTransactions
    : [];

  return transactions
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit)
    .map((transaction) => ({
      type: transaction.type,
      amount: transaction.amount,
      reason: transaction.reason || null,
      sourceType: transaction.sourceType || 'system',
      sourceId: transaction.sourceId || null,
      balanceAfter: transaction.balanceAfter,
      metadata: transaction.metadata || {},
      createdAt: transaction.createdAt
    }));
}

module.exports = {
  serializeOpalWallet,
  serializeOpalTransactions
};

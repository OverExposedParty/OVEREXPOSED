const assert = require('node:assert/strict');
const test = require('node:test');

const {
  grantAccountRewards,
  normalizeAccountRewards
} = require('../../server/services/account-rewards');

function createAccount() {
  return {
    gameData: {
      level: 1,
      xp: 490,
      opals: {
        balance: 10,
        lifetimeEarned: 20,
        lifetimeSpent: 10
      },
      opalTransactions: []
    },
    modifiedPaths: [],
    markModified(path) {
      this.modifiedPaths.push(path);
    }
  };
}

test('normalizeAccountRewards returns safe whole account reward amounts', () => {
  assert.deepEqual(normalizeAccountRewards({ accountXp: 20.9, opals: 2.8 }), {
    accountXp: 20,
    opals: 2
  });
  assert.deepEqual(normalizeAccountRewards({ accountXp: -1, opals: 'nope' }), {
    accountXp: 0,
    opals: 0
  });
});

test('grantAccountRewards applies account XP and records Opal earnings', () => {
  const account = createAccount();
  const result = grantAccountRewards({
    account,
    rewards: { accountXp: 20, opals: 2 },
    sourceId: 'oling-adventure:run-1',
    reason: 'Completed Oling adventure: Backyard Path',
    metadata: { adventureRunId: 'run-1' },
    now: new Date('2026-08-31T12:00:00.000Z')
  });

  assert.equal(result.granted, true);
  assert.equal(result.duplicate, false);
  assert.equal(account.gameData.xp, 510);
  assert.equal(account.gameData.level, 2);
  assert.equal(account.gameData.opals.balance, 12);
  assert.equal(account.gameData.opals.lifetimeEarned, 22);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.deepEqual(account.gameData.opalTransactions[0], {
    type: 'earn',
    amount: 2,
    reason: 'Completed Oling adventure: Backyard Path',
    sourceType: 'game_reward',
    sourceId: 'oling-adventure:run-1',
    balanceAfter: 12,
    metadata: {
      adventureRunId: 'run-1',
      accountRewards: { accountXp: 20, opals: 2 }
    },
    createdAt: new Date('2026-08-31T12:00:00.000Z')
  });
});

test('grantAccountRewards ignores a duplicate reward source', () => {
  const account = createAccount();
  const options = {
    account,
    rewards: { accountXp: 20, opals: 2 },
    sourceId: 'oling-adventure:run-1',
    reason: 'Completed Oling adventure: Backyard Path'
  };

  grantAccountRewards(options);
  const duplicate = grantAccountRewards(options);

  assert.equal(duplicate.granted, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(account.gameData.xp, 510);
  assert.equal(account.gameData.opals.balance, 12);
  assert.equal(account.gameData.opalTransactions.length, 1);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const Achievement = require('../../models/content/achievement-schema');
const AchievementRewardClaim = require('../../models/accounts/achievement-reward-claim-schema');
const Account = require('../../models/accounts/account-schema');
const {
  normalizeAchievementRewards
} = require('../../models/content/achievement-reward-contract');
const {
  grantAchievementRewards
} = require('../../server/services/achievements/reward-grants');
const {
  assertAchievementRewardStateIsClean,
  syncAchievementAccountState
} = require('../../server/services/achievements/account-transactions');

test('achievement rewards use a strict type-aware contract', () => {
  assert.deepEqual(
    normalizeAchievementRewards([
      { type: 'opals', amount: 35 },
      { type: 'xp', amount: 25 },
      { type: 'oling_consumable', key: 'opal-dust', quantity: 2 }
    ]),
    [
      { type: 'opals', key: null, amount: 35, quantity: 1, metadata: {} },
      { type: 'xp', key: null, amount: 25, quantity: 1, metadata: {} },
      {
        type: 'oling_consumable',
        key: 'opal-dust',
        amount: 0,
        quantity: 2,
        metadata: {}
      }
    ]
  );

  assert.throws(
    () => normalizeAchievementRewards([{ type: 'opals' }]),
    /amount must be a positive integer/
  );
  assert.throws(
    () => normalizeAchievementRewards([{ type: 'oling_egg' }]),
    /requires a key/
  );
  assert.throws(
    () =>
      normalizeAchievementRewards([
        { type: 'opals', amount: 10 },
        { type: 'opals', amount: 20 }
      ]),
    /duplicates an earlier reward/
  );
});

test('achievement mongoose validation rejects malformed rewards', () => {
  const achievement = new Achievement({
    key: 'invalid-reward',
    name: 'Invalid Reward',
    category: 'account',
    rewards: [{ type: 'xp', amount: 1.5 }]
  });

  assert.match(
    achievement.validateSync().message,
    /amount must be a positive integer/
  );
});

test('achievement reward claims enforce one claim per account and achievement', () => {
  const { schema } = AchievementRewardClaim;
  assert.equal(schema.path('rewardVersion').defaultValue, 1);
  assert.equal(schema.path('status').defaultValue, 'pending');
  assert.deepEqual(schema.path('status').enumValues, ['pending', 'applied']);

  const indexes = schema.indexes().map(([fields, options]) => ({
    fields,
    unique: options.unique === true
  }));
  assert.ok(
    indexes.some(({ fields, unique }) => fields.claimKey === 1 && unique)
  );
  assert.ok(
    indexes.some(
      ({ fields, unique }) =>
        fields.accountId === 1 && fields.achievementKey === 1 && unique
    )
  );
});

test('canonical item rewards survive account schema casting', () => {
  const account = new Account({
    username: 'reward-schema-user',
    email: 'reward-schema@example.com',
    passwordHash: 'test'
  });
  const result = grantAchievementRewards({
    account,
    achievement: {
      key: 'schema-item-reward',
      name: 'Schema Item Reward',
      rewards: [
        { type: 'badge', key: 'schema-badge' },
        { type: 'oling_furniture', key: 'schema-chair', quantity: 2 }
      ]
    }
  });

  assert.equal(result.rewardStatus, 'granted');
  assert.equal(account.validateSync(), undefined);
  assert.deepEqual(
    account.gameData.inGamePurchasesAndUnlocks.map((unlock) => ({
      type: unlock.type,
      key: unlock.key,
      rewardGranted: unlock.rewardGranted,
      rewardStatus: unlock.rewardStatus
    })),
    [
      {
        type: 'badge',
        key: 'schema-badge',
        rewardGranted: true,
        rewardStatus: 'granted'
      },
      {
        type: 'oling_furniture',
        key: 'schema-chair',
        rewardGranted: true,
        rewardStatus: 'granted'
      }
    ]
  );
  assert.equal(account.olings.furniture[0].key, 'schema-chair');
  assert.equal(account.olings.furniture[0].quantity, 2);
});

test('transaction state sync preserves unrelated pending account changes', () => {
  const base = {
    _id: new Account()._id,
    __v: 1,
    username: 'reward-sync-user',
    passwordHash: 'test',
    gameData: {
      level: 1,
      xp: 0,
      achievementStats: { games: 1 },
      opals: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
      opalTransactions: [],
      achievements: [],
      inGamePurchasesAndUnlocks: []
    },
    olings: { eggs: [], consumables: [], furniture: [] }
  };
  const target = Account.hydrate(base);
  const source = Account.hydrate({
    ...base,
    __v: 2,
    gameData: {
      ...base.gameData,
      opals: { balance: 80, lifetimeEarned: 80, lifetimeSpent: 0 },
      achievements: [{ type: 'achievement', key: 'transaction-reward' }]
    }
  });
  target.$clearModifiedPaths();
  source.$clearModifiedPaths();
  target.gameData.achievementStats.games = 2;
  target.markModified('gameData.achievementStats');

  assert.doesNotThrow(() => assertAchievementRewardStateIsClean(target));
  syncAchievementAccountState(target, source);

  assert.equal(target.gameData.opals.balance, 80);
  assert.equal(target.gameData.achievements[0].key, 'transaction-reward');
  assert.equal(target.__v, 2);
  assert.deepEqual(target.directModifiedPaths(), ['gameData.achievementStats']);

  target.markModified('gameData.opals');
  assert.throws(
    () => assertAchievementRewardStateIsClean(target),
    (error) => error.code === 'achievement_reward_state_dirty'
  );
});

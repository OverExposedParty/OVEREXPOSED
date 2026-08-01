const {
  test,
  assert,
  incrementAchievementStat,
  unlockAchievementByKey,
  createAchievementModel,
  createThresholdAchievementModel,
  createAccount
} = require('./achievements-service/helpers');

test('unlockAchievementByKey ignores disabled or draft achievements', async () => {
  const account = createAccount();
  const Achievement = createAchievementModel(null);

  const result = await unlockAchievementByKey({
    Achievement,
    account,
    key: 'welcome-to-the-party'
  });

  assert.equal(result, null);
  assert.equal(account.saveCalls, 0);
  assert.equal(account.gameData.achievements, undefined);
});

test('unlockAchievementByKey prevents duplicate unlocks', async () => {
  const achievement = {
    key: 'verified',
    enabled: true,
    status: 'published',
    rewards: []
  };
  const account = createAccount({
    achievements: [{ type: 'achievement', key: 'verified' }]
  });

  const result = await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: 'verified'
  });

  assert.equal(result, null);
  assert.equal(account.gameData.achievements.length, 1);
  assert.equal(account.saveCalls, 0);
});

test('unlockAchievementByKey grants XP and records the unlock', async () => {
  const achievement = {
    key: 'welcome-to-the-party',
    enabled: true,
    status: 'published',
    rewards: [{ type: 'xp', amount: 25 }]
  };
  const account = createAccount({ xp: 10, achievements: [] });

  const result = await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key,
    source: 'account-created'
  });

  assert.equal(result, achievement);
  assert.equal(account.gameData.xp, 35);
  assert.equal(account.gameData.level, 1);
  assert.deepEqual(
    account.gameData.achievements.map((unlock) => ({
      key: unlock.key,
      source: unlock.source,
      rewardGranted: unlock.rewardGranted
    })),
    [
      {
        key: achievement.key,
        source: 'account-created',
        rewardGranted: true
      }
    ]
  );
  assert.deepEqual(account.markedPaths, [
    'gameData.xp',
    'gameData.level',
    'gameData.notifications',
    'gameData.achievements'
  ]);
  assert.equal(account.gameData.notifications[0].type, 'achievement_unlocked');
  assert.equal(account.saveCalls, 1);
});

test('achievement XP updates account level progress', async () => {
  const achievement = {
    key: 'level-up-test',
    enabled: true,
    status: 'published',
    rewards: [{ type: 'xp', amount: 25 }]
  };
  const account = createAccount({ level: 1, xp: 490, achievements: [] });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key
  });

  assert.equal(account.gameData.xp, 515);
  assert.equal(account.gameData.level, 2);
});

test('unlockAchievementByKey can defer saving during multi-account actions', async () => {
  const achievement = {
    key: 'first-friend',
    enabled: true,
    status: 'published',
    rewards: [{ type: 'badge', key: 'friendly' }]
  };
  const account = createAccount({ achievements: [] });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key,
    source: 'friend-accepted',
    save: false
  });

  assert.equal(account.saveCalls, 0);
  assert.deepEqual(
    account.gameData.inGamePurchasesAndUnlocks.map((unlock) => ({
      type: unlock.type,
      key: unlock.key,
      source: unlock.source,
      rewardGranted: unlock.rewardGranted,
      rewardStatus: unlock.rewardStatus,
      achievementKey: unlock.metadata.achievementKey
    })),
    [
      {
        type: 'badge',
        key: 'friendly',
        source: 'achievement:first-friend',
        rewardGranted: true,
        rewardStatus: 'granted',
        achievementKey: 'first-friend'
      }
    ]
  );
  assert.equal(account.gameData.achievements[0].rewardGranted, true);
  assert.equal(account.gameData.achievements[0].rewardStatus, 'granted');
});

test('unlockAchievementByKey grants Opals and records a wallet transaction', async () => {
  const achievement = {
    key: 'opal-test',
    name: 'Opal Test',
    rarity: 'rare',
    enabled: true,
    status: 'published',
    rewards: [{ type: 'opals', amount: 35 }]
  };
  const account = createAccount({
    opals: { balance: 10, lifetimeEarned: 50, lifetimeSpent: 5 },
    opalTransactions: [],
    achievements: []
  });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key
  });

  assert.equal(account.gameData.opals.balance, 45);
  assert.equal(account.gameData.opals.lifetimeEarned, 85);
  assert.equal(account.gameData.opals.lifetimeSpent, 5);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.gameData.opalTransactions[0].type, 'earn');
  assert.equal(account.gameData.opalTransactions[0].amount, 35);
  assert.equal(account.gameData.opalTransactions[0].sourceType, 'achievement');
  assert.equal(account.gameData.opalTransactions[0].sourceId, achievement.key);
  assert.equal(
    account.gameData.opalTransactions[0].notificationPending,
    undefined
  );
  assert.deepEqual(
    account.gameData.notifications.map((notification) => notification.type),
    ['achievement_unlocked']
  );
  assert.ok(account.gameData.achievements[0].unlockedAt instanceof Date);
  assert.equal(
    account.gameData.achievements[0].unlockedAt,
    account.gameData.opalTransactions[0].createdAt
  );
  assert.deepEqual(account.gameData.achievements[0].rewardResults, [
    { type: 'opals', amount: 35, balanceAfter: 45, granted: true }
  ]);

  achievement.rewards[0].amount = 999;
  assert.equal(account.gameData.achievements[0].rewardResults[0].amount, 35);
});

test('unlockAchievementByKey grants multiple reward types once', async () => {
  const achievement = {
    key: 'reward-stack',
    enabled: true,
    status: 'published',
    rewards: [
      { type: 'opals', amount: 120 },
      { type: 'xp', amount: 50 },
      { type: 'oling_consumable', key: 'opal-dust', quantity: 2 }
    ]
  };
  const account = createAccount({
    level: 1,
    xp: 10,
    achievements: [],
    opalTransactions: []
  });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key
  });
  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key
  });

  assert.equal(account.gameData.achievements.length, 1);
  assert.equal(account.gameData.xp, 60);
  assert.equal(account.gameData.opals.balance, 120);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.deepEqual(
    account.olings.consumables.map((item) => ({
      key: item.key,
      rarity: item.rarity,
      quantity: item.quantity,
      rewardSource: item.metadata.rewardSource,
      achievementKey: item.metadata.achievementKey
    })),
    [
      {
        key: 'opal-dust',
        rarity: 'common',
        quantity: 2,
        rewardSource: 'achievement',
        achievementKey: 'reward-stack'
      }
    ]
  );
  assert.deepEqual(
    account.gameData.achievements[0].rewardResults.map((reward) => ({
      type: reward.type,
      key: reward.key,
      amount: reward.amount,
      quantity: reward.quantity,
      granted: reward.granted
    })),
    [
      {
        type: 'opals',
        key: undefined,
        amount: 120,
        quantity: undefined,
        granted: true
      },
      {
        type: 'xp',
        key: undefined,
        amount: 50,
        quantity: undefined,
        granted: true
      },
      {
        type: 'oling_consumable',
        key: 'opal-dust',
        amount: undefined,
        quantity: 2,
        granted: true
      }
    ]
  );
});

test('achievement furniture grants inventory and its ownership entitlement', async () => {
  const achievement = {
    key: 'furniture-reward',
    name: 'Furniture Reward',
    enabled: true,
    status: 'published',
    rewards: [
      {
        type: 'oling_furniture',
        key: 'review-chair',
        quantity: 2,
        metadata: { rarity: 'rare' }
      }
    ]
  };
  const account = createAccount({ achievements: [] });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key,
    save: false
  });

  assert.equal(account.olings.furniture[0].key, 'review-chair');
  assert.equal(account.olings.furniture[0].quantity, 2);
  assert.equal(account.olings.furniture[0].rarity, 'rare');
  assert.deepEqual(
    account.gameData.inGamePurchasesAndUnlocks.map((unlock) => ({
      type: unlock.type,
      key: unlock.key,
      rewardGranted: unlock.rewardGranted
    })),
    [
      {
        type: 'oling_furniture',
        key: 'review-chair',
        rewardGranted: true
      }
    ]
  );
  assert.equal(
    account.gameData.achievements[0].rewardResults[0].entitlementGranted,
    true
  );
  assert.deepEqual(account.markedPaths, [
    'olings.furniture',
    'gameData.inGamePurchasesAndUnlocks',
    'gameData.notifications',
    'gameData.achievements'
  ]);
});

test('achievements without configured rewards record a none reward status', async () => {
  const achievement = {
    key: 'no-reward',
    enabled: true,
    status: 'published',
    rewards: []
  };
  const account = createAccount({ achievements: [] });

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    account,
    key: achievement.key
  });

  assert.equal(account.gameData.achievements[0].rewardGranted, false);
  assert.equal(account.gameData.achievements[0].rewardStatus, 'none');
  assert.deepEqual(account.gameData.achievements[0].rewardResults, []);
});

test('incrementAchievementStat unlocks every newly eligible stage', async () => {
  const achievements = [
    {
      key: 'friendly-face',
      enabled: true,
      status: 'published',
      requirementType: 'stat_threshold',
      statKey: 'friendsAdded',
      requirementValue: 5,
      rewards: []
    },
    {
      key: 'social-circle',
      enabled: true,
      status: 'published',
      requirementType: 'stat_threshold',
      statKey: 'friendsAdded',
      requirementValue: 10,
      rewards: []
    }
  ];
  const account = createAccount({
    achievementStats: { friendsAdded: 4 },
    achievements: []
  });

  const unlocked = await incrementAchievementStat({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    statKey: 'friendsAdded',
    amount: 6,
    source: 'friend-accepted'
  });

  assert.equal(account.gameData.achievementStats.friendsAdded, 10);
  assert.deepEqual(
    unlocked.map((achievement) => achievement.key),
    ['friendly-face', 'social-circle']
  );
  assert.deepEqual(
    account.gameData.achievements.map((unlock) => unlock.progressAtUnlock),
    [10, 10]
  );
  assert.equal(account.saveCalls, 1);
});

test('incrementAchievementStat records progress while stages are inactive', async () => {
  const account = createAccount({ achievements: [] });

  const unlocked = await incrementAchievementStat({
    Achievement: createThresholdAchievementModel([]),
    account,
    statKey: 'oeCustomisationChanges',
    save: false
  });

  assert.deepEqual(unlocked, []);
  assert.equal(account.gameData.achievementStats.oeCustomisationChanges, 1);
  assert.equal(account.saveCalls, 0);
});

const {
  test,
  assert,
  recordAchievementCollectionItems,
  recordPackOwnershipAchievements,
  recordAchievementPlayDate,
  createThresholdAchievementModel,
  createAccount
} = require('./helpers');

test('recordAchievementCollectionItems stores unique normalized items', async () => {
  const account = createAccount({
    achievementStats: {
      differentPacksPlayed: 1,
      differentPacksPlayedItems: ['truth-or-dare:base']
    },
    achievements: []
  });

  await recordAchievementCollectionItems({
    Achievement: createThresholdAchievementModel([]),
    account,
    statKey: 'differentPacksPlayed',
    items: ['truth-or-dare:base', 'TRUTH-OR-DARE:BASE', 'paranoia:base'],
    save: false
  });

  assert.equal(account.gameData.achievementStats.differentPacksPlayed, 2);
  assert.deepEqual(
    account.gameData.achievementStats.differentPacksPlayedItems,
    ['truth-or-dare:base', 'paranoia:base']
  );
});

test('recordAchievementCollectionItems unlocks reached collection stages', async () => {
  const achievement = {
    key: 'pack-sampler',
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey: 'differentPacksPlayed',
    requirementValue: 5,
    rewards: []
  };
  const account = createAccount({ achievements: [] });

  const unlocked = await recordAchievementCollectionItems({
    Achievement: createThresholdAchievementModel([achievement]),
    account,
    statKey: 'differentPacksPlayed',
    items: ['a', 'b', 'c', 'd', 'e'],
    source: 'online-pack-played'
  });

  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['pack-sampler']
  );
  assert.equal(account.gameData.achievements[0].progressAtUnlock, 5);
  assert.equal(account.saveCalls, 1);
});

test('restricted Shop ownership does not update achievement progress', async () => {
  const achievements = [
    {
      key: 'pack-hunter',
      enabled: true,
      status: 'published',
      requirementType: 'event',
      statKey: 'packsOwned',
      requirementValue: 1,
      rewards: []
    },
    {
      key: 'collector',
      enabled: true,
      status: 'published',
      requirementType: 'stat_threshold',
      statKey: 'packsOwned',
      requirementValue: 10,
      rewards: []
    }
  ];
  const account = createAccount({
    inGamePurchasesAndUnlocks: [
      { type: 'pack', key: 'Base' },
      { type: 'pack', key: 'base' },
      { type: 'pack', key: 'party-starter' },
      { type: 'oe', key: 'party-starter-card' },
      { type: 'cosmetic', key: 'hat' }
    ],
    achievements: []
  });

  const unlocked = await recordPackOwnershipAchievements({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    source: 'shop-test'
  });

  assert.deepEqual(unlocked, []);
  assert.equal(account.gameData.achievementStats?.packsOwnedItems, undefined);
  assert.equal(account.gameData.achievementStats?.packsOwned, undefined);
  assert.deepEqual(account.gameData.achievements, []);
  assert.equal(account.saveCalls, 0);
});

test('restricted Shop milestones remain unchanged for existing owners', async () => {
  const achievements = [
    {
      key: 'pack-hunter',
      enabled: true,
      status: 'published',
      requirementType: 'event',
      statKey: 'packsOwned',
      requirementValue: 1,
      rewards: []
    },
    {
      key: 'collector',
      enabled: true,
      status: 'published',
      requirementType: 'stat_threshold',
      statKey: 'packsOwned',
      requirementValue: 10,
      rewards: []
    }
  ];
  const account = createAccount({
    inGamePurchasesAndUnlocks: Array.from({ length: 10 }, (_, index) => ({
      type: 'pack',
      key: `pack-${index + 1}`
    })),
    achievements: [{ type: 'achievement', key: 'pack-hunter' }]
  });

  const unlocked = await recordPackOwnershipAchievements({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    source: 'shop-test'
  });

  assert.deepEqual(unlocked, []);
  assert.equal(account.gameData.achievementStats?.packsOwned, undefined);
  assert.equal(account.gameData.achievements.length, 1);
});

test('recordAchievementPlayDate only counts a UTC date once', async () => {
  const account = createAccount({
    achievementStats: {
      playStreak: 3,
      playStreakLastDate: '2026-07-02'
    },
    achievements: []
  });

  await recordAchievementPlayDate({
    Achievement: createThresholdAchievementModel([]),
    account,
    playedAt: '2026-07-02T23:59:59.000Z',
    save: false
  });

  assert.equal(account.gameData.achievementStats.playStreak, 3);
  assert.equal(
    account.gameData.achievementStats.playStreakLastDate,
    '2026-07-02'
  );
});

test('recordAchievementPlayDate increments on the next UTC date', async () => {
  const achievement = {
    key: 'dedicated-player',
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey: 'playStreak',
    requirementValue: 7,
    rewards: []
  };
  const account = createAccount({
    achievementStats: {
      playStreak: 6,
      playStreakLastDate: '2026-07-01'
    },
    achievements: []
  });

  const unlocked = await recordAchievementPlayDate({
    Achievement: createThresholdAchievementModel([achievement]),
    account,
    playedAt: '2026-07-02T00:00:01.000Z',
    save: false
  });

  assert.equal(account.gameData.achievementStats.playStreak, 7);
  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['dedicated-player']
  );
});

test('recordAchievementPlayDate resets after a missed UTC date', async () => {
  const account = createAccount({
    achievementStats: {
      playStreak: 8,
      playStreakLastDate: '2026-06-29'
    },
    achievements: []
  });

  await recordAchievementPlayDate({
    Achievement: createThresholdAchievementModel([]),
    account,
    playedAt: '2026-07-02T12:00:00.000Z',
    save: false
  });

  assert.equal(account.gameData.achievementStats.playStreak, 1);
  assert.equal(
    account.gameData.achievementStats.playStreakLastDate,
    '2026-07-02'
  );
});

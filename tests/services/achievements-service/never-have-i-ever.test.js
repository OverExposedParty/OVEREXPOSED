const {
  test,
  assert,
  recordNeverHaveIEverResult,
  createThresholdAchievementModel,
  createAccount
} = require('./helpers');

test('recordNeverHaveIEverResult unlocks round vote pattern events', async () => {
  const keys = ['group-confession', 'not-a-single-soul', 'pure-as-snow'];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'event',
    rewards: []
  }));
  const Achievement = createThresholdAchievementModel(achievements);
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' },
    { playerId: 'player-three', accountId: 'account-three' },
    { playerId: 'player-four', accountId: 'account-four' }
  ];
  const account = createAccount({ achievements: [] });
  account._id = 'account-one';

  await recordNeverHaveIEverResult({
    Achievement,
    account,
    result: {
      type: 'never-have-i-ever-round',
      playerAccounts,
      votes: playerAccounts.map(({ playerId }) => ({ playerId, vote: true })),
      haveCount: 4,
      haveNotCount: 0
    },
    save: false
  });
  await recordNeverHaveIEverResult({
    Achievement,
    account,
    result: {
      type: 'never-have-i-ever-round',
      playerAccounts,
      votes: playerAccounts.map(({ playerId }) => ({
        playerId,
        vote: playerId !== 'player-one'
      })),
      haveCount: 3,
      haveNotCount: 1
    },
    save: false
  });

  const allHaveNotAccount = createAccount({ achievements: [] });
  allHaveNotAccount._id = 'account-one';
  await recordNeverHaveIEverResult({
    Achievement,
    account: allHaveNotAccount,
    result: {
      type: 'never-have-i-ever-round',
      playerAccounts,
      votes: playerAccounts.map(({ playerId }) => ({ playerId, vote: false })),
      haveCount: 0,
      haveNotCount: 4
    }
  });

  assert.deepEqual(
    account.gameData.achievements.map(({ key }) => key).sort(),
    ['group-confession', 'pure-as-snow'].sort()
  );
  assert.ok(
    allHaveNotAccount.gameData.achievements.some(
      ({ key }) => key === 'not-a-single-soul'
    )
  );
});

test('recordNeverHaveIEverResult unlocks clean ten-player session events', async () => {
  const keys = ['are-you-real', 'saint'];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'event',
    rewards: []
  }));
  const playerAccounts = Array.from({ length: 10 }, (_, index) => ({
    playerId: `player-${index + 1}`,
    accountId: `account-${index + 1}`
  }));
  const account = createAccount({ achievements: [] });
  account._id = 'account-1';

  await recordNeverHaveIEverResult({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    result: {
      type: 'never-have-i-ever-game-complete',
      playerAccounts,
      playerCount: 10
    }
  });

  assert.deepEqual(
    account.gameData.achievements.map(({ key }) => key).sort(),
    keys.sort()
  );

  const haveAccount = createAccount({
    achievements: [],
    achievementStats: { neverHaveIEverVotedHaveThisSession: true }
  });
  haveAccount._id = 'account-1';
  const blocked = await recordNeverHaveIEverResult({
    Achievement: createThresholdAchievementModel(achievements),
    account: haveAccount,
    result: {
      type: 'never-have-i-ever-game-complete',
      playerAccounts,
      playerCount: 10
    }
  });

  assert.deepEqual(blocked, []);
});

test('recordNeverHaveIEverResult unlocks vote total and majority milestones', async () => {
  const achievements = [
    ['been-there', 'beenThere', 25],
    ['too-honest', 'tooHonest', 10],
    ['relatable', 'relatable', 25]
  ].map(([key, statKey, requirementValue]) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey,
    requirementValue,
    rewards: []
  }));
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' },
    { playerId: 'player-three', accountId: 'account-three' }
  ];
  const account = createAccount({
    achievementStats: {
      beenThere: 24,
      tooHonest: 9,
      relatable: 24
    },
    achievements: []
  });
  account._id = 'account-one';

  const unlocked = await recordNeverHaveIEverResult({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    result: {
      type: 'never-have-i-ever-round',
      playerAccounts,
      votes: [
        { playerId: 'player-one', vote: true },
        { playerId: 'player-two', vote: true },
        { playerId: 'player-three', vote: false }
      ],
      haveCount: 2,
      haveNotCount: 1
    },
    save: false
  });

  assert.equal(account.gameData.achievementStats.beenThere, 25);
  assert.equal(account.gameData.achievementStats.tooHonest, 10);
  assert.equal(account.gameData.achievementStats.relatable, 25);
  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['been-there', 'too-honest', 'relatable']
  );
});

test('recordNeverHaveIEverResult unlocks have-not total and resets have streak', async () => {
  const achievement = {
    key: 'innocent-until-proven-otherwise',
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey: 'innocentUntilProvenOtherwise',
    requirementValue: 25,
    rewards: []
  };
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' },
    { playerId: 'player-three', accountId: 'account-three' }
  ];
  const account = createAccount({
    achievementStats: {
      innocentUntilProvenOtherwise: 24,
      tooHonest: 7
    },
    achievements: []
  });
  account._id = 'account-one';

  const unlocked = await recordNeverHaveIEverResult({
    Achievement: createThresholdAchievementModel([achievement]),
    account,
    result: {
      type: 'never-have-i-ever-round',
      playerAccounts,
      votes: [
        { playerId: 'player-one', vote: false },
        { playerId: 'player-two', vote: true },
        { playerId: 'player-three', vote: false }
      ],
      haveCount: 1,
      haveNotCount: 2
    },
    save: false
  });

  assert.equal(
    account.gameData.achievementStats.innocentUntilProvenOtherwise,
    25
  );
  assert.equal(account.gameData.achievementStats.tooHonest, 0);
  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['innocent-until-proven-otherwise']
  );
});

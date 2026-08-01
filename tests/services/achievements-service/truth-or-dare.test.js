const {
  test,
  assert,
  recordTruthOrDarePromptResult,
  createThresholdAchievementModel,
  createAccount
} = require('./helpers');

test('recordTruthOrDarePromptResult unlocks the truth streak independently', async () => {
  const achievement = {
    key: 'honest-soul',
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey: 'truthOrDareTruthStreak',
    requirementValue: 10,
    rewards: []
  };
  const account = createAccount({
    achievementStats: {
      truthOrDareNoSkipStreak: 9,
      truthOrDareTruthStreak: 9,
      truthOrDareDareStreak: 0
    },
    achievements: []
  });

  const unlocked = await recordTruthOrDarePromptResult({
    Achievement: createThresholdAchievementModel([achievement]),
    account,
    result: 'truth',
    save: false
  });

  assert.equal(account.gameData.achievementStats.truthOrDareNoSkipStreak, 10);
  assert.equal(account.gameData.achievementStats.truthOrDareTruthStreak, 10);
  assert.equal(account.gameData.achievementStats.truthOrDareDareStreak, 0);
  assert.deepEqual(unlocked.map((item) => item.key), ['honest-soul']);
});

test('recordTruthOrDarePromptResult tracks dare, no-skip, and NSFW milestones', async () => {
  const achievements = [
    ['balls-to-the-wall', 'truthOrDareDareStreak', 10],
    ['iron-will', 'truthOrDareNoSkipStreak', 20],
    ['no-fear', 'noFear', 10]
  ].map(([key, statKey, requirementValue]) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey,
    requirementValue,
    rewards: []
  }));
  const account = createAccount({
    achievementStats: {
      truthOrDareNoSkipStreak: 19,
      truthOrDareTruthStreak: 4,
      truthOrDareDareStreak: 9,
      noFear: 9
    },
    achievements: []
  });

  const unlocked = await recordTruthOrDarePromptResult({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    result: 'dare',
    isNsfw: true,
    save: false
  });

  assert.equal(account.gameData.achievementStats.truthOrDareNoSkipStreak, 20);
  assert.equal(account.gameData.achievementStats.truthOrDareTruthStreak, 0);
  assert.equal(account.gameData.achievementStats.truthOrDareDareStreak, 10);
  assert.equal(account.gameData.achievementStats.noFear, 10);
  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['balls-to-the-wall', 'iron-will', 'no-fear']
  );
});

test('recordTruthOrDarePromptResult unlocks truth and dare lifetime milestones', async () => {
  const achievements = [
    ['truth-teller', 'truthsCompleted', 10],
    ['daredevil', 'daresCompleted', 25]
  ].map(([key, statKey, requirementValue]) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey,
    requirementValue,
    rewards: []
  }));
  const truthAccount = createAccount({
    achievementStats: {
      truthsCompleted: 9,
      truthOrDareTruthStreak: 2,
      truthOrDareNoSkipStreak: 3
    },
    achievements: []
  });
  const dareAccount = createAccount({
    achievementStats: {
      daresCompleted: 24,
      truthOrDareDareStreak: 2,
      truthOrDareNoSkipStreak: 3
    },
    achievements: []
  });

  const truthUnlocked = await recordTruthOrDarePromptResult({
    Achievement: createThresholdAchievementModel(achievements),
    account: truthAccount,
    result: 'truth',
    save: false
  });
  const dareUnlocked = await recordTruthOrDarePromptResult({
    Achievement: createThresholdAchievementModel(achievements),
    account: dareAccount,
    result: 'dare',
    save: false
  });

  assert.equal(truthAccount.gameData.achievementStats.truthsCompleted, 10);
  assert.deepEqual(truthUnlocked.map((item) => item.key), ['truth-teller']);
  assert.equal(dareAccount.gameData.achievementStats.daresCompleted, 25);
  assert.deepEqual(dareUnlocked.map((item) => item.key), ['daredevil']);
});

test('recordTruthOrDarePromptResult tracks skip milestones and resets streaks', async () => {
  const achievements = [
    ['tiny-hesitation', 'promptsSkipped', 1],
    ['fine-i-ll-do-it-myself', 'fineILlDoItMyself', 10]
  ].map(([key, statKey, requirementValue]) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'stat_threshold',
    statKey,
    requirementValue,
    rewards: []
  }));
  const account = createAccount({
    achievementStats: {
      truthOrDareNoSkipStreak: 49,
      truthOrDareTruthStreak: 8,
      truthOrDareDareStreak: 7,
      promptsSkipped: 0,
      fineILlDoItMyself: 9,
      noFear: 3
    },
    achievements: []
  });

  const unlocked = await recordTruthOrDarePromptResult({
    Achievement: createThresholdAchievementModel(achievements),
    account,
    result: 'skip',
    save: false
  });

  assert.equal(account.gameData.achievementStats.truthOrDareNoSkipStreak, 0);
  assert.equal(account.gameData.achievementStats.truthOrDareTruthStreak, 0);
  assert.equal(account.gameData.achievementStats.truthOrDareDareStreak, 0);
  assert.equal(account.gameData.achievementStats.promptsSkipped, 1);
  assert.equal(account.gameData.achievementStats.fineILlDoItMyself, 10);
  assert.equal(account.gameData.achievementStats.noFear, 3);
  assert.deepEqual(
    unlocked.map((item) => item.key),
    ['tiny-hesitation', 'fine-i-ll-do-it-myself']
  );
});

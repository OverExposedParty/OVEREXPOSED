const {
  test,
  assert,
  recordParanoiaResult,
  createThresholdAchievementModel,
  createAccount
} = require('./helpers');

test('recordParanoiaResult tracks selection streaks and revenge history', async () => {
  const keys = [
    'public-enemy-number-one',
    'revenge-pick',
    'not-you-again',
    'vendetta'
  ];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: key === 'vendetta' ? 'stat_threshold' : 'event',
    statKey: key === 'vendetta' ? 'vendetta' : null,
    requirementValue: key === 'vendetta' ? 10 : 1,
    rewards: []
  }));
  const Achievement = createThresholdAchievementModel(achievements);
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' }
  ];
  const targetAccount = createAccount({ achievements: [] });
  targetAccount._id = 'account-one';

  for (let index = 0; index < 5; index += 1) {
    await recordParanoiaResult({
      Achievement,
      account: targetAccount,
      partyId: 'PARTY1',
      result: {
        type: 'paranoia-target-selected',
        playerAccounts,
        selectorPlayerId: 'player-two',
        targetPlayerId: 'player-one'
      },
      save: false
    });
  }

  assert.deepEqual(
    targetAccount.gameData.achievements.map(({ key }) => key).sort(),
    ['not-you-again', 'public-enemy-number-one'].sort()
  );
  assert.equal(targetAccount.gameData.achievementStats.publicEnemyNumberOne, 5);

  const selectorAccount = createAccount({
    achievements: [],
    achievementStats: {
      paranoiaLastPickedByAccountId: 'account-one',
      vendetta: 9,
      paranoiaSessionId: 'PARTY1',
      paranoiaTargetPickCounts: { 'player-one': 9 }
    }
  });
  selectorAccount._id = 'account-two';

  await recordParanoiaResult({
    Achievement,
    account: selectorAccount,
    partyId: 'PARTY1',
    result: {
      type: 'paranoia-target-selected',
      playerAccounts,
      selectorPlayerId: 'player-two',
      targetPlayerId: 'player-one'
    }
  });

  assert.deepEqual(
    selectorAccount.gameData.achievements.map(({ key }) => key).sort(),
    ['revenge-pick', 'vendetta'].sort()
  );
  assert.equal(selectorAccount.gameData.achievementStats.vendetta, 10);
});

test('recordParanoiaResult handles punishment denial and game-end awards', async () => {
  const keys = ['pinocchio-s-doppelganger', 'thick-skin', 'the-usual-suspect'];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: key === 'the-usual-suspect' ? 'stat_threshold' : 'event',
    statKey: key === 'the-usual-suspect' ? 'theUsualSuspect' : null,
    requirementValue: key === 'the-usual-suspect' ? 5 : 1,
    rewards: []
  }));
  const Achievement = createThresholdAchievementModel(achievements);
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one', score: 12 },
    { playerId: 'player-two', accountId: 'account-two', score: 7 }
  ];
  const account = createAccount({
    achievements: [],
    achievementStats: { theUsualSuspect: 4 }
  });
  account._id = 'account-one';

  await recordParanoiaResult({
    Achievement,
    account,
    partyId: 'PARTY2',
    result: {
      type: 'paranoia-punishment-denied',
      playerAccounts,
      targetPlayerId: 'player-one'
    },
    save: false
  });
  await recordParanoiaResult({
    Achievement,
    account,
    partyId: 'PARTY2',
    result: {
      type: 'paranoia-game-complete',
      playerAccounts,
      pickedCountsByPlayerId: {
        'player-one': 6,
        'player-two': 2
      }
    }
  });

  assert.deepEqual(
    account.gameData.achievements.map(({ key }) => key).sort(),
    keys.sort()
  );
  assert.equal(account.gameData.achievementStats.theUsualSuspect, 5);
});

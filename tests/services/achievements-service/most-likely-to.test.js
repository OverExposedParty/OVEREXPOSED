const {
  test,
  assert,
  recordMostLikelyToResult,
  createThresholdAchievementModel,
  createAccount
} = require('./helpers');

test('recordMostLikelyToResult tracks round patterns and session voting', async () => {
  const keys = [
    'main-character',
    'unanimous-mvp',
    'everyone-gets-it',
    'self-aware',
    'well-this-is-awkward'
  ];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: 'event',
    rewards: []
  }));
  const account = createAccount({ achievements: [] });
  account._id = 'account-one';
  const Achievement = createThresholdAchievementModel(achievements);
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' },
    { playerId: 'player-three', accountId: 'account-three' }
  ];

  await recordMostLikelyToResult({
    Achievement,
    account,
    partyId: 'PARTY1',
    result: {
      type: 'most-likely-to-round',
      playerAccounts,
      votes: [
        { playerId: 'player-one', vote: 'player-one' },
        { playerId: 'player-two', vote: 'player-one' },
        { playerId: 'player-three', vote: 'player-one' }
      ],
      highestVotedPlayerIds: ['player-one'],
      winnerPlayerId: 'player-one',
      isTie: false
    }
  });

  assert.deepEqual(
    account.gameData.achievements.map(({ key }) => key).sort(),
    ['main-character', 'self-aware', 'unanimous-mvp'].sort()
  );
  assert.equal(account.gameData.achievementStats.serialNominee, 1);
  assert.deepEqual(
    account.gameData.achievementStats.mostLikelyToVotedPlayerIds,
    ['player-one']
  );

  for (const target of ['player-two', 'player-three']) {
    await recordMostLikelyToResult({
      Achievement,
      account,
      partyId: 'PARTY1',
      result: {
        type: 'most-likely-to-round',
        playerAccounts,
        votes: [{ playerId: 'player-one', vote: target }],
        highestVotedPlayerIds: [target],
        winnerPlayerId: target,
        isTie: false
      }
    });
  }

  assert.ok(
    account.gameData.achievements.some(({ key }) => key === 'everyone-gets-it')
  );

  const awkwardAccount = createAccount({ achievements: [] });
  awkwardAccount._id = 'account-one';

  await recordMostLikelyToResult({
    Achievement,
    account: awkwardAccount,
    partyId: 'PARTY3',
    result: {
      type: 'most-likely-to-round',
      playerAccounts,
      votes: [{ playerId: 'player-one', vote: 'player-one' }],
      highestVotedPlayerIds: ['player-one'],
      winnerPlayerId: 'player-one',
      isTie: false
    }
  });

  assert.ok(
    awkwardAccount.gameData.achievements.some(
      ({ key }) => key === 'well-this-is-awkward'
    )
  );
});

test('recordMostLikelyToResult handles nomination counters and delayed tie outcomes', async () => {
  const keys = [
    'unexpected-winner',
    'split-decision',
    'serial-nominee',
    'not-my-name-again',
    'taste-maker'
  ];
  const achievements = keys.map((key) => ({
    key,
    enabled: true,
    status: 'published',
    requirementType: [
      'serial-nominee',
      'not-my-name-again',
      'taste-maker'
    ].includes(key)
      ? 'stat_threshold'
      : 'event',
    statKey:
      key === 'serial-nominee'
        ? 'serialNominee'
        : key === 'not-my-name-again'
          ? 'notMyNameAgain'
          : key === 'taste-maker'
            ? 'tasteMaker'
            : null,
    requirementValue:
      key === 'serial-nominee' || key === 'taste-maker' ? 10 : 5,
    rewards: []
  }));
  const account = createAccount({
    achievements: [],
    achievementStats: {
      mostLikelyToSessionId: 'PARTY2:play-0',
      mostLikelyToHadPreviousRound: true,
      mostLikelyToPreviousVotesReceived: 0,
      serialNominee: 9,
      mostLikelyToVotesByVoter: { 'account-two': 4 },
      tasteMaker: 9
    }
  });
  account._id = 'account-one';
  const Achievement = createThresholdAchievementModel(achievements);
  const result = {
    type: 'most-likely-to-round',
    playerAccounts: [
      { playerId: 'player-one', accountId: 'account-one' },
      { playerId: 'player-two', accountId: 'account-two' }
    ],
    votes: [
      { playerId: 'player-one', vote: 'player-one' },
      { playerId: 'player-two', vote: 'player-one' }
    ],
    highestVotedPlayerIds: ['player-one', 'player-two'],
    winnerPlayerId: null,
    isTie: true
  };

  await recordMostLikelyToResult({
    Achievement,
    account,
    partyId: 'PARTY2',
    result,
    save: false
  });
  await recordMostLikelyToResult({
    Achievement,
    account,
    partyId: 'PARTY2',
    result: {
      ...result,
      type: 'most-likely-to-outcome',
      winnerPlayerId: 'player-one'
    }
  });

  assert.deepEqual(
    account.gameData.achievements.map(({ key }) => key).sort(),
    keys.sort()
  );
  assert.equal(account.gameData.achievementStats.serialNominee, 10);
  assert.equal(account.gameData.achievementStats.tasteMaker, 10);
});

test('recordMostLikelyToResult does not carry unexpected winner eligibility into a new session', async () => {
  const Achievement = createThresholdAchievementModel([
    {
      key: 'unexpected-winner',
      enabled: true,
      status: 'published',
      requirementType: 'event',
      rewards: []
    }
  ]);
  const account = createAccount({
    achievements: [],
    achievementStats: {
      mostLikelyToSessionId: 'SAME-PARTY:old-game',
      mostLikelyToHadPreviousRound: true,
      mostLikelyToPreviousVotesReceived: 0,
      mostLikelyToWinnerAfterZeroPreviousEligible: true
    }
  });
  account._id = 'account-one';
  const playerAccounts = [
    { playerId: 'player-one', accountId: 'account-one' },
    { playerId: 'player-two', accountId: 'account-two' }
  ];

  const recordRound = ({ votes, winnerPlayerId }) =>
    recordMostLikelyToResult({
      Achievement,
      account,
      partyId: 'SAME-PARTY',
      gameId: 'new-game',
      result: {
        type: 'most-likely-to-round',
        playerAccounts,
        votes,
        winnerPlayerId,
        isTie: false
      }
    });

  await recordRound({
    votes: [{ playerId: 'player-two', vote: 'player-one' }],
    winnerPlayerId: 'player-one'
  });

  assert.equal(
    account.gameData.achievements.some(
      ({ key }) => key === 'unexpected-winner'
    ),
    false
  );

  await recordRound({ votes: [], winnerPlayerId: null });
  await recordRound({
    votes: [{ playerId: 'player-two', vote: 'player-one' }],
    winnerPlayerId: 'player-one'
  });

  assert.equal(
    account.gameData.achievements.filter(
      ({ key }) => key === 'unexpected-winner'
    ).length,
    1
  );
});

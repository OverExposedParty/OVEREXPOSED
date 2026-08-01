const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPartyGameRewardSummaries,
  grantPendingPartyGameReward,
  grantPartyGameRewards
} = require('../../server/services/party-game-rewards');

const ACCOUNT_ONE = '64f000000000000000000001';
const ACCOUNT_TWO = '64f000000000000000000002';

function createParty({
  now = new Date('2026-07-08T12:00:00.000Z'),
  startedAt = new Date('2026-07-08T11:54:00.000Z'),
  progress = {
    [ACCOUNT_ONE]: { actionsAvailable: 8, actionsTaken: 6 },
    [ACCOUNT_TWO]: { actionsAvailable: 8, actionsTaken: 1 }
  }
} = {}) {
  return {
    partyId: 'ABC123',
    session: {
      createdAt: startedAt,
      playtimeStartedAt: null,
      playtimeAccumulatedMilliseconds: Math.max(
        0,
        now.getTime() - startedAt.getTime()
      )
    },
    config: { gamemode: 'most-likely-to' },
    state: {
      phase: 'game-over',
      phaseData: { rewardProgress: progress }
    },
    players: [
      {
        identity: {
          computerId: 'player-one',
          accountId: ACCOUNT_ONE,
          username: 'One',
          userIcon: ''
        },
        state: { score: 10 }
      },
      {
        identity: {
          computerId: 'player-two',
          accountId: ACCOUNT_TWO,
          username: 'Two',
          userIcon: ''
        },
        state: { score: 0 }
      }
    ],
    now
  };
}

function createAccount({
  id = ACCOUNT_ONE,
  balance = 0,
  transactions = [],
  xp = 0,
  level = 1
} = {}) {
  return {
    _id: id,
    gameData: {
      xp,
      level,
      opals: {
        balance,
        lifetimeEarned: balance,
        lifetimeSpent: 0
      },
      opalTransactions: transactions
    },
    saveCalls: 0,
    markModified() {},
    async save() {
      this.saved = true;
      this.saveCalls += 1;
      return this;
    }
  };
}

function createRewardClaimModel(initialClaims = []) {
  const claims = new Map(
    initialClaims.map((claim) => [claim.claimKey, { ...claim }])
  );
  const PartyGameRewardClaim = {
    findOne: ({ claimKey }) => ({
      lean: async () => claims.get(claimKey) || null
    }),
    create: async (claim) => {
      if (claims.has(claim.claimKey)) {
        const error = new Error('Duplicate claim');
        error.code = 11000;
        throw error;
      }
      claims.set(claim.claimKey, claim);
      return claim;
    },
    findOneAndUpdate: async ({ claimKey, accountId }, update) => {
      const claim = claims.get(claimKey);
      if (!claim || String(claim.accountId) !== String(accountId)) return null;
      Object.assign(claim, update.$set || {});
      return claim;
    }
  };

  return { claims, PartyGameRewardClaim };
}

test('party game reward summaries enforce duration and activity requirements', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({ now });

  const summaries = buildPartyGameRewardSummaries(party, { now });

  assert.equal(summaries.byAccountId[ACCOUNT_ONE].eligible, true);
  assert.deepEqual(summaries.byAccountId[ACCOUNT_ONE].rows, {
    gameCompleted: 5,
    activeParticipation: 3,
    objectiveBonus: 7
  });
  assert.equal(summaries.byAccountId[ACCOUNT_ONE].earnedBeforeCap, 15);
  assert.equal(summaries.byAccountId[ACCOUNT_ONE].xp.earnedTotal, 30);

  assert.equal(summaries.byAccountId[ACCOUNT_TWO].eligible, false);
  assert.deepEqual(summaries.byAccountId[ACCOUNT_TWO].failedRequirements, [
    'minimum_activity'
  ]);
  assert.equal(summaries.byAccountId[ACCOUNT_TWO].xp.earnedTotal, 0);
});

test('party game XP makes one substantial game worth more than repeated short games', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const createMaxXpParty = (durationMinutes) => {
    const party = createParty({
      now,
      startedAt: new Date(now.getTime() - durationMinutes * 60 * 1000),
      progress: {
        [ACCOUNT_ONE]: {
          actionsAvailable: 8,
          actionsTaken: 8,
          objectivePoints: 12
        }
      }
    });
    party.players = [party.players[0]];
    return party;
  };

  const shortSummary = buildPartyGameRewardSummaries(createMaxXpParty(5), {
    now
  }).byAccountId[ACCOUNT_ONE];
  const substantialSummary = buildPartyGameRewardSummaries(
    createMaxXpParty(25),
    { now }
  ).byAccountId[ACCOUNT_ONE];

  assert.equal(shortSummary.xp.earnedTotal, 25);
  assert.equal(substantialSummary.xp.earnedTotal, 138);
  assert.ok(
    substantialSummary.xp.earnedTotal > shortSummary.xp.earnedTotal * 5
  );
});

test('party game XP participation multipliers use the agreed boundaries', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const getXpAtActivity = (actionsTaken) => {
    const party = createParty({
      now,
      startedAt: new Date(now.getTime() - 5 * 60 * 1000),
      progress: {
        [ACCOUNT_ONE]: { actionsAvailable: 4, actionsTaken }
      }
    });
    party.players = [party.players[0]];
    party.players[0].state.score = 0;
    return buildPartyGameRewardSummaries(party, { now }).byAccountId[
      ACCOUNT_ONE
    ].xp;
  };

  assert.equal(getXpAtActivity(1).participationMultiplier, 0.6);
  assert.equal(getXpAtActivity(1).earnedTotal, 12);
  assert.equal(getXpAtActivity(2).participationMultiplier, 0.8);
  assert.equal(getXpAtActivity(2).earnedTotal, 16);
  assert.equal(getXpAtActivity(3).participationMultiplier, 1);
  assert.equal(getXpAtActivity(3).earnedTotal, 20);
});

test('party game XP objective multiplier scales from zero to twenty-five percent', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const getXpAtObjectivePoints = (objectivePoints) => {
    const party = createParty({
      now,
      startedAt: new Date(now.getTime() - 5 * 60 * 1000),
      progress: {
        [ACCOUNT_ONE]: {
          actionsAvailable: 4,
          actionsTaken: 4,
          objectivePoints
        }
      }
    });
    party.players = [party.players[0]];
    party.players[0].state.score = 0;
    return buildPartyGameRewardSummaries(party, { now }).byAccountId[
      ACCOUNT_ONE
    ].xp;
  };

  assert.equal(getXpAtObjectivePoints(0).objectiveMultiplier, 1);
  assert.equal(getXpAtObjectivePoints(0).earnedTotal, 20);
  assert.equal(getXpAtObjectivePoints(3).objectiveMultiplier, 1.125);
  assert.equal(getXpAtObjectivePoints(3).earnedTotal, 23);
  assert.equal(getXpAtObjectivePoints(6).objectiveMultiplier, 1.25);
  assert.equal(getXpAtObjectivePoints(6).earnedTotal, 25);
});

test('party game XP respects configured-round and absolute duration caps', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const roundCappedParty = createParty({
    now,
    startedAt: new Date(now.getTime() - 25 * 60 * 1000),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 4,
        actionsTaken: 4,
        objectivePoints: 10
      }
    }
  });
  roundCappedParty.config = {
    gamemode: 'truth-or-dare',
    gameRules: { rounds: 5 }
  };
  roundCappedParty.players = [roundCappedParty.players[0]];

  const roundCappedXp = buildPartyGameRewardSummaries(roundCappedParty, {
    now
  }).byAccountId[ACCOUNT_ONE].xp;
  assert.equal(roundCappedXp.configuredDurationCapMs, 10 * 60 * 1000);
  assert.equal(roundCappedXp.creditedDurationMs, 10 * 60 * 1000);
  assert.equal(roundCappedXp.earnedTotal, 53);

  const absoluteCappedParty = createParty({
    now,
    startedAt: new Date(now.getTime() - 60 * 60 * 1000),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 4,
        actionsTaken: 4,
        objectivePoints: 8
      }
    }
  });
  absoluteCappedParty.config = { gamemode: 'mafia' };
  absoluteCappedParty.players = [absoluteCappedParty.players[0]];

  const absoluteCappedXp = buildPartyGameRewardSummaries(absoluteCappedParty, {
    now
  }).byAccountId[ACCOUNT_ONE].xp;
  assert.equal(absoluteCappedXp.creditedDurationMs, 30 * 60 * 1000);
  assert.equal(absoluteCappedXp.matchLengthMultiplier, 1.15);
  assert.equal(absoluteCappedXp.earnedTotal, 173);
});

test('party game XP uses active playtime instead of total party age', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    startedAt: new Date(now.getTime() - 25 * 60 * 1000),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 12
      }
    }
  });
  party.players = [party.players[0]];
  party.session.playtimeAccumulatedMilliseconds = 5 * 60 * 1000;

  const summary = buildPartyGameRewardSummaries(party, { now }).byAccountId[
    ACCOUNT_ONE
  ];

  assert.equal(summary.requirements.actualDurationMs, 25 * 60 * 1000);
  assert.equal(summary.xp.activeDurationMs, 5 * 60 * 1000);
  assert.equal(summary.xp.earnedTotal, 25);
});

test('party game XP includes a currently active playtime segment', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({ now });
  party.players = [party.players[0]];
  party.state.isPlaying = true;
  party.session.playtimeAccumulatedMilliseconds = 2 * 60 * 1000;
  party.session.playtimeStartedAt = new Date(now.getTime() - 3 * 60 * 1000);

  const summary = buildPartyGameRewardSummaries(party, { now }).byAccountId[
    ACCOUNT_ONE
  ];

  assert.equal(summary.xp.activeDurationMs, 5 * 60 * 1000);
  assert.equal(summary.xp.earnedTotal, 25);
});

test('party game XP does not count paused time or missing playtime telemetry', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const pausedParty = createParty({ now });
  pausedParty.players = [pausedParty.players[0]];
  pausedParty.state.isPlaying = false;
  pausedParty.session.playtimeAccumulatedMilliseconds = 5 * 60 * 1000;
  pausedParty.session.playtimeStartedAt = new Date(
    now.getTime() - 20 * 60 * 1000
  );

  const pausedSummary = buildPartyGameRewardSummaries(pausedParty, {
    now
  }).byAccountId[ACCOUNT_ONE];
  assert.equal(pausedSummary.xp.activeDurationMs, 5 * 60 * 1000);
  assert.equal(pausedSummary.xp.earnedTotal, 25);

  const untrackedParty = createParty({ now });
  untrackedParty.players = [untrackedParty.players[0]];
  delete untrackedParty.session.playtimeAccumulatedMilliseconds;
  delete untrackedParty.session.playtimeStartedAt;

  const untrackedSummary = buildPartyGameRewardSummaries(untrackedParty, {
    now
  }).byAccountId[ACCOUNT_ONE];
  assert.equal(untrackedSummary.eligible, true);
  assert.equal(untrackedSummary.xp.activeDurationMs, 0);
  assert.equal(untrackedSummary.xp.earnedTotal, 0);
});

test('short configured round games use a scaled reward duration requirement', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    startedAt: new Date('2026-07-08T11:57:30.000Z'),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 5,
        actionsTaken: 5,
        objectivePoints: 10
      }
    }
  });
  party.config = {
    gamemode: 'truth-or-dare',
    gameRules: { rounds: 5 }
  };
  party.players = [party.players[0]];

  const summaries = buildPartyGameRewardSummaries(party, { now });
  const summary = summaries.byAccountId[ACCOUNT_ONE];

  assert.equal(summary.eligible, true);
  assert.equal(summary.requirements.minimumDurationMs, 100000);
  assert.equal(summary.requirements.actualDurationMs, 150000);
});

test('party game objective bonus uses gamemode objective points before score share', () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 12
      },
      [ACCOUNT_TWO]: {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 2
      }
    }
  });
  party.players[0].state.score = 1;
  party.players[1].state.score = 10;

  const summaries = buildPartyGameRewardSummaries(party, { now });

  assert.equal(summaries.byAccountId[ACCOUNT_ONE].rows.objectiveBonus, 7);
  assert.equal(
    summaries.byAccountId[ACCOUNT_ONE].requirements.objective.source,
    'gamemode_objective'
  );
  assert.equal(summaries.byAccountId[ACCOUNT_TWO].rows.objectiveBonus, 1);
});

test('party game rewards are reduced after the daily soft cap', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const existing = {
    type: 'earn',
    amount: 124,
    sourceType: 'game_reward',
    sourceId: 'OLDER',
    balanceAfter: 124,
    createdAt: new Date('2026-07-08T09:00:00.000Z')
  };
  const account = createAccount({
    balance: 124,
    transactions: [existing]
  });
  const accounts = new Map([[ACCOUNT_ONE, account]]);
  const Account = {
    findById: async (accountId) => accounts.get(String(accountId)) || null
  };

  const summaries = await grantPartyGameRewards({
    Account,
    party: createParty({ now }),
    now
  });

  const summary = summaries.byAccountId[ACCOUNT_ONE];
  assert.equal(summary.earnedBeforeCap, 15);
  assert.equal(summary.earnedTotal, 4);
  assert.deepEqual(summary.capReduction, {
    applied: true,
    percentage: 80,
    amount: 11
  });
  assert.equal(account.gameData.opals.balance, 128);
  assert.equal(account.gameData.xp, 30);
  assert.equal(account.gameData.level, 1);
  assert.equal(summary.xp.grantedTotal, 30);
  assert.equal(summary.xp.grantApplied, true);
  assert.deepEqual(summary.xp.progression, {
    xpBefore: 0,
    xpAdded: 30,
    xpAfter: 30,
    levelBefore: 1,
    levelAfter: 1,
    levelsGained: 0,
    levelledUp: false,
    currentLevelXp: 30,
    xpRequiredForNextLevel: 500,
    xpRemaining: 470,
    currentLevelProgress: 0.06
  });
  assert.equal(
    account.gameData.opalTransactions.at(-1).metadata.accountXp.amount,
    30
  );
  assert.equal(
    account.gameData.opalTransactions.at(-1).sourceType,
    'game_reward'
  );
});

test('legacy party game rewards are not retroactively granted XP', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const account = createAccount({
    balance: 15,
    transactions: [
      {
        type: 'earn',
        amount: 15,
        sourceType: 'game_reward',
        sourceId: `ABC123:${ACCOUNT_ONE}`,
        balanceAfter: 15,
        metadata: {
          rewardSummary: {
            capReduction: { applied: false, percentage: 80, amount: 0 }
          }
        },
        createdAt: new Date('2026-07-08T11:00:00.000Z')
      }
    ]
  });
  const Account = {
    findById: async (accountId) =>
      String(accountId) === ACCOUNT_ONE ? account : null
  };

  const summaries = await grantPartyGameRewards({
    Account,
    party: createParty({ now }),
    now
  });

  assert.equal(summaries.byAccountId[ACCOUNT_ONE].alreadyGranted, true);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.gameData.opals.balance, 15);
  assert.equal(account.gameData.xp, 0);
  assert.equal(summaries.byAccountId[ACCOUNT_ONE].xp.grantedTotal, 0);
  assert.equal(
    summaries.byAccountId[ACCOUNT_ONE].xp.grantSkippedReason,
    'legacy_reward'
  );
  assert.equal(account.saveCalls, 0);
});

test('party game rewards do not grant Opals or XP twice', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const progression = {
    xpBefore: 0,
    xpAdded: 30,
    xpAfter: 30,
    levelBefore: 1,
    levelAfter: 1,
    levelsGained: 0,
    levelledUp: false,
    currentLevelXp: 30,
    xpRequiredForNextLevel: 500,
    xpRemaining: 470,
    currentLevelProgress: 0.06
  };
  const account = createAccount({
    balance: 15,
    xp: 30,
    transactions: [
      {
        type: 'earn',
        amount: 15,
        sourceType: 'game_reward',
        sourceId: 'ABC123:player-one',
        balanceAfter: 15,
        metadata: {
          accountXp: { granted: true, amount: 30, progression },
          rewardSummary: {
            capReduction: { applied: false, percentage: 80, amount: 0 },
            xp: {
              earnedTotal: 30,
              grantedTotal: 30,
              grantApplied: true,
              progression
            }
          }
        },
        createdAt: new Date('2026-07-08T11:00:00.000Z')
      }
    ]
  });
  const Account = {
    findById: async (accountId) =>
      String(accountId) === ACCOUNT_ONE ? account : null
  };

  const summaries = await grantPartyGameRewards({
    Account,
    party: createParty({ now }),
    now
  });
  const summary = summaries.byAccountId[ACCOUNT_ONE];

  assert.equal(summary.alreadyGranted, true);
  assert.equal(summary.xp.alreadyGranted, true);
  assert.equal(summary.xp.grantedTotal, 30);
  assert.deepEqual(summary.xp.progression, progression);
  assert.equal(account.gameData.opals.balance, 15);
  assert.equal(account.gameData.xp, 30);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.saveCalls, 0);
});

test('party game XP can level an account during the shared reward save', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    startedAt: new Date(now.getTime() - 5 * 60 * 1000),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 12
      }
    }
  });
  party.players = [party.players[0]];
  const account = createAccount({ xp: 490 });
  const Account = {
    findById: async () => account
  };

  const summaries = await grantPartyGameRewards({ Account, party, now });
  const summary = summaries.byAccountId[ACCOUNT_ONE];

  assert.equal(summary.xp.earnedTotal, 25);
  assert.equal(summary.xp.grantedTotal, 25);
  assert.equal(summary.xp.progression.levelBefore, 1);
  assert.equal(summary.xp.progression.levelAfter, 2);
  assert.equal(summary.xp.progression.levelledUp, true);
  assert.equal(account.gameData.xp, 515);
  assert.equal(account.gameData.level, 2);
  assert.equal(account.saveCalls, 1);
});

test('guest party rewards can be claimed once by one linked account', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    progress: {
      'player-one': {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 8
      }
    }
  });
  party.players[0].identity.accountId = null;
  party.players[1].identity.accountId = null;
  party.players = [party.players[0]];

  const accountOne = createAccount({ id: ACCOUNT_ONE });
  const accountTwo = createAccount({ id: ACCOUNT_TWO });
  const accounts = new Map([
    [ACCOUNT_ONE, accountOne],
    [ACCOUNT_TWO, accountTwo]
  ]);
  const { claims, PartyGameRewardClaim } = createRewardClaimModel();
  const Account = {
    findById: async (accountId) => accounts.get(String(accountId)) || null
  };

  const summaries = buildPartyGameRewardSummaries(party, { now });
  assert.equal(summaries.byPlayerId['player-one'].eligible, true);
  assert.equal(summaries.byPlayerId['player-one'].accountId, null);
  assert.equal(Object.keys(summaries.byAccountId).length, 0);

  const firstClaim = await grantPendingPartyGameReward({
    Account,
    PartyGameRewardClaim,
    party,
    playerId: 'player-one',
    accountId: ACCOUNT_ONE,
    now
  });

  assert.equal(firstClaim.summary.earnedTotal, 12);
  assert.equal(accountOne.gameData.opals.balance, 12);
  assert.equal(firstClaim.summary.xp.grantedTotal, 28);
  assert.equal(accountOne.gameData.xp, 28);
  assert.equal(
    accountOne.gameData.opalTransactions.at(-1).sourceId,
    'ABC123:player-one'
  );
  const storedClaim = claims.get('ABC123:player-one');
  assert.equal(storedClaim.rewardVersion, 2);
  assert.equal(storedClaim.status, 'applied');
  assert.equal(storedClaim.amount, 12);
  assert.equal(storedClaim.opalAmount, 12);
  assert.equal(storedClaim.xpAmount, 28);
  assert.equal(storedClaim.levelBefore, 1);
  assert.equal(storedClaim.levelAfter, 1);
  assert.equal(storedClaim.appliedAt, now);

  const secondClaim = await grantPendingPartyGameReward({
    Account,
    PartyGameRewardClaim,
    party,
    playerId: 'player-one',
    accountId: ACCOUNT_TWO,
    now
  });

  assert.equal(secondClaim.summary.alreadyGranted, true);
  assert.equal(accountTwo.gameData.opals.balance, 0);
  assert.equal(accountTwo.gameData.xp, 0);
  assert.equal(accountTwo.gameData.opalTransactions.length, 0);
});

test('pending party reward claims resume after an interrupted account save', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const party = createParty({
    now,
    startedAt: new Date(now.getTime() - 5 * 60 * 1000),
    progress: {
      [ACCOUNT_ONE]: {
        actionsAvailable: 8,
        actionsTaken: 8,
        objectivePoints: 12
      }
    }
  });
  party.players = [party.players[0]];
  const account = createAccount({ xp: 490 });
  const Account = { findById: async () => account };
  const claimKey = 'ABC123:player-one';
  const { claims, PartyGameRewardClaim } = createRewardClaimModel([
    {
      claimKey,
      partyId: party.partyId,
      playerId: 'player-one',
      accountId: ACCOUNT_ONE,
      rewardVersion: 2,
      status: 'pending',
      amount: 15,
      opalAmount: 15,
      xpAmount: 25,
      levelBefore: 1,
      levelAfter: 2,
      rewardSummary: {
        capReduction: { applied: false, percentage: 80, amount: 0 },
        xp: { earnedTotal: 25 }
      },
      createdAt: new Date('2026-07-08T11:59:00.000Z'),
      appliedAt: null
    }
  ]);

  const summaries = await grantPartyGameRewards({
    Account,
    PartyGameRewardClaim,
    party,
    now
  });
  const summary = summaries.byAccountId[ACCOUNT_ONE];
  const storedClaim = claims.get(claimKey);

  assert.equal(summary.earnedTotal, 15);
  assert.equal(summary.xp.grantedTotal, 25);
  assert.equal(summary.xp.progression.levelBefore, 1);
  assert.equal(summary.xp.progression.levelAfter, 2);
  assert.equal(account.gameData.opals.balance, 15);
  assert.equal(account.gameData.xp, 515);
  assert.equal(account.gameData.level, 2);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.saveCalls, 1);
  assert.equal(storedClaim.status, 'applied');
  assert.equal(storedClaim.levelBefore, 1);
  assert.equal(storedClaim.levelAfter, 2);
  assert.equal(storedClaim.appliedAt, now);
});

test('pending claims are reconciled when the account reward already saved', async () => {
  const now = new Date('2026-07-08T12:00:00.000Z');
  const progression = {
    xpBefore: 490,
    xpAdded: 25,
    xpAfter: 515,
    levelBefore: 1,
    levelAfter: 2,
    levelsGained: 1,
    levelledUp: true,
    currentLevelXp: 15,
    xpRequiredForNextLevel: 600,
    xpRemaining: 585,
    currentLevelProgress: 0.025
  };
  const account = createAccount({
    balance: 15,
    xp: 515,
    level: 2,
    transactions: [
      {
        type: 'earn',
        amount: 15,
        sourceType: 'game_reward',
        sourceId: 'ABC123:player-one',
        balanceAfter: 15,
        metadata: {
          accountXp: { granted: true, amount: 25, progression },
          rewardSummary: {
            capReduction: { applied: false, percentage: 80, amount: 0 },
            xp: { earnedTotal: 25, grantedTotal: 25, grantApplied: true }
          }
        },
        createdAt: new Date('2026-07-08T11:59:30.000Z')
      }
    ]
  });
  const Account = { findById: async () => account };
  const claimKey = 'ABC123:player-one';
  const { claims, PartyGameRewardClaim } = createRewardClaimModel([
    {
      claimKey,
      partyId: 'ABC123',
      playerId: 'player-one',
      accountId: ACCOUNT_ONE,
      rewardVersion: 2,
      status: 'pending',
      amount: 15,
      opalAmount: 15,
      xpAmount: 25,
      levelBefore: 1,
      levelAfter: 2,
      rewardSummary: null,
      createdAt: new Date('2026-07-08T11:59:00.000Z'),
      appliedAt: null
    }
  ]);

  const summaries = await grantPartyGameRewards({
    Account,
    PartyGameRewardClaim,
    party: createParty({ now }),
    now
  });
  const summary = summaries.byAccountId[ACCOUNT_ONE];
  const storedClaim = claims.get(claimKey);

  assert.equal(summary.alreadyGranted, true);
  assert.equal(summary.xp.grantedTotal, 25);
  assert.deepEqual(summary.xp.progression, progression);
  assert.equal(account.gameData.opals.balance, 15);
  assert.equal(account.gameData.xp, 515);
  assert.equal(account.gameData.opalTransactions.length, 1);
  assert.equal(account.saveCalls, 0);
  assert.equal(storedClaim.status, 'applied');
  assert.equal(storedClaim.levelBefore, 1);
  assert.equal(storedClaim.levelAfter, 2);
  assert.equal(
    storedClaim.appliedAt.getTime(),
    new Date('2026-07-08T11:59:30.000Z').getTime()
  );
});

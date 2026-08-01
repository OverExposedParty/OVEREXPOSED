const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyActionStatEventTools
} = require('../../server/game-engine/party-runtime/route-handlers/action-stat-events');
const {
  queueAccountNotification
} = require('../../server/services/account-notifications');

test('completed playtime updates overall and per-gamemode account statistics once per run', async () => {
  const createdEventKeys = new Set();
  const account = {
    _id: 'account-one',
    gameData: { totalPlaytimeSeconds: 20, perGameStats: [] },
    markModified() {},
    async save() {}
  };
  const noOp = async () => {};
  const { applyPartyAccountStatEvents } = createPartyActionStatEventTools({
    Account: {
      async findById(accountId) {
        return accountId === account._id ? account : null;
      }
    },
    Achievement: {},
    partyGameEventSchema: {
      async create({ partyId, eventKey }) {
        const key = `${partyId}:${eventKey}`;
        if (createdEventKeys.has(key)) {
          const error = new Error('duplicate event');
          error.code = 11000;
          throw error;
        }
        createdEventKeys.add(key);
      }
    },
    incrementAchievementStat: noOp,
    recordAchievementCollectionItems: noOp,
    recordAchievementPlayDate: noOp,
    recordMostLikelyToResult: noOp,
    recordNeverHaveIEverResult: noOp,
    recordParanoiaResult: noOp,
    recordTruthOrDarePromptResult: noOp,
    unlockAchievementByKey: noOp,
    unlockEligiblePartyAchievements: noOp
  });
  const events = [
    {
      gameMode: 'most-likely-to',
      increments: [
        {
          accountId: 'account-one',
          paths: { totalPlaytimeSeconds: 45 }
        }
      ]
    }
  ];
  const eventContext = {
    partyId: 'ABC-123',
    action: 'end-game',
    phase: 'results',
    playerTurn: 3,
    playSequence: 1
  };

  await applyPartyAccountStatEvents(events, eventContext);
  await applyPartyAccountStatEvents(events, eventContext);

  assert.equal(account.gameData.totalPlaytimeSeconds, 65);
  assert.equal(account.gameData.perGameStats[0].totalPlaytimeSeconds, 45);

  await applyPartyAccountStatEvents(events, {
    ...eventContext,
    playSequence: 2
  });

  assert.equal(account.gameData.totalPlaytimeSeconds, 110);
  assert.equal(account.gameData.perGameStats[0].totalPlaytimeSeconds, 90);
});

test('new progression notifications are returned only after the account is saved', async () => {
  let saved = false;
  const account = {
    _id: 'account-one',
    gameData: {
      notifications: [
        {
          notificationId: 'existing-notification',
          type: 'achievement_unlocked',
          category: 'progression',
          metadata: { achievementKey: 'existing' },
          createdAt: new Date()
        }
      ],
      perGameStats: []
    },
    markModified() {},
    async save() {
      saved = true;
    }
  };
  const noOp = async () => {};
  const { applyPartyAccountStatEvents } = createPartyActionStatEventTools({
    Account: {
      async findById() {
        return account;
      }
    },
    Achievement: {},
    partyGameEventSchema: {
      async create() {}
    },
    incrementAchievementStat: noOp,
    recordAchievementCollectionItems: noOp,
    recordAchievementPlayDate: noOp,
    recordMostLikelyToResult: noOp,
    recordNeverHaveIEverResult: noOp,
    recordParanoiaResult: noOp,
    recordTruthOrDarePromptResult: noOp,
    async unlockAchievementByKey({ account: targetAccount }) {
      queueAccountNotification(targetAccount, {
        id: 'new-achievement-notification',
        type: 'achievement_unlocked',
        metadata: { achievementKey: 'no-skips-given' }
      });
    },
    unlockEligiblePartyAchievements: noOp
  });

  const deliveries = await applyPartyAccountStatEvents(
    [
      {
        gameMode: 'truth-or-dare',
        increments: [
          {
            accountId: 'account-one',
            paths: { 'achievement.noSkipsGiven': 1 }
          }
        ]
      }
    ],
    {
      partyId: 'ABC-123',
      action: 'end-game',
      playSequence: 1
    }
  );

  assert.equal(saved, true);
  assert.deepEqual(deliveries, [
    {
      accountId: 'account-one',
      notifications: [
        {
          id: 'new-achievement-notification',
          type: 'achievement_unlocked',
          achievementKey: 'no-skips-given',
          rewardStatus: undefined,
          rewardResults: undefined,
          createdAt: account.gameData.notifications[1].createdAt
        }
      ]
    }
  ]);
});

test('restricted gamemodes do not persist account progression events', async () => {
  let accountLookupCount = 0;
  let storedEventCount = 0;
  const noOp = async () => {};
  const { applyPartyAccountStatEvents } = createPartyActionStatEventTools({
    Account: {
      async findById() {
        accountLookupCount += 1;
        return null;
      }
    },
    Achievement: {},
    partyGameEventSchema: {
      async create() {
        storedEventCount += 1;
      }
    },
    incrementAchievementStat: noOp,
    recordAchievementCollectionItems: noOp,
    recordAchievementPlayDate: noOp,
    recordMostLikelyToResult: noOp,
    recordNeverHaveIEverResult: noOp,
    recordParanoiaResult: noOp,
    recordTruthOrDarePromptResult: noOp,
    unlockAchievementByKey: noOp,
    unlockEligiblePartyAchievements: noOp
  });

  const deliveries = await applyPartyAccountStatEvents(
    [
      {
        gameMode: 'imposter',
        increments: [
          {
            accountId: 'account-one',
            paths: { gamesPlayed: 1, roundsPlayed: 5 }
          }
        ]
      }
    ],
    { partyId: 'ABC-123', action: 'end-game', playSequence: 1 }
  );

  assert.deepEqual(deliveries, []);
  assert.equal(accountLookupCount, 0);
  assert.equal(storedEventCount, 0);
});

test('restricted features inside standard gamemodes do not persist account stats', async () => {
  let accountLookupCount = 0;
  let storedEventCount = 0;
  const noOp = async () => {};
  const { applyPartyAccountStatEvents } = createPartyActionStatEventTools({
    Account: {
      async findById() {
        accountLookupCount += 1;
        return null;
      }
    },
    Achievement: {},
    partyGameEventSchema: {
      async create() {
        storedEventCount += 1;
      }
    },
    incrementAchievementStat: noOp,
    recordAchievementCollectionItems: noOp,
    recordAchievementPlayDate: noOp,
    recordMostLikelyToResult: noOp,
    recordNeverHaveIEverResult: noOp,
    recordParanoiaResult: noOp,
    recordTruthOrDarePromptResult: noOp,
    unlockAchievementByKey: noOp,
    unlockEligiblePartyAchievements: noOp
  });

  const deliveries = await applyPartyAccountStatEvents(
    [
      {
        gameMode: 'truth-or-dare',
        feature: 'party-games.prompt-heist',
        increments: [
          {
            accountId: 'account-one',
            paths: { 'stats.promptHeists': 1 }
          }
        ]
      }
    ],
    { partyId: 'ABC-123', action: 'claim-prompt-heist', playSequence: 1 }
  );

  assert.deepEqual(deliveries, []);
  assert.equal(accountLookupCount, 0);
  assert.equal(storedEventCount, 0);
});

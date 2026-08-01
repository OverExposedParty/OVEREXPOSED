const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyActionStatEventTools
} = require('../../server/game-engine/party-runtime/route-handlers/action-stat-events');

test('completed games update pack counts and preserve the current favourite during ties', async () => {
  const createdEventKeys = new Set();
  const account = {
    _id: 'account-one',
    gameData: {
      perGameStats: [
        {
          gameMode: 'truth-or-dare',
          packPlayCounts: { 'pack-one': 2, 'pack-two': 1 },
          favouritePack: 'pack-one'
        }
      ]
    },
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
  const event = {
    gameMode: 'truth-or-dare',
    selectedPacks: ['pack-two', 'pack-two', '', '__proto__'],
    increments: [
      {
        accountId: 'account-one',
        paths: { 'achievement.completedParty': 1 }
      }
    ]
  };
  const eventContext = {
    partyId: 'ABC-123',
    action: 'end-game',
    phase: 'results',
    playerTurn: 3,
    playSequence: 1
  };

  await applyPartyAccountStatEvents([event], eventContext);
  await applyPartyAccountStatEvents([event], eventContext);

  const gameStats = account.gameData.perGameStats[0];
  assert.deepEqual(gameStats.packPlayCounts, {
    'pack-one': 2,
    'pack-two': 2
  });
  assert.equal(gameStats.favouritePack, 'pack-one');

  await applyPartyAccountStatEvents([event], {
    ...eventContext,
    playSequence: 2
  });

  assert.deepEqual(gameStats.packPlayCounts, {
    'pack-one': 2,
    'pack-two': 3
  });
  assert.equal(gameStats.favouritePack, 'pack-two');

  await applyPartyAccountStatEvents(
    [{ ...event, selectedPacks: ['pack-one'] }],
    { ...eventContext, playSequence: 3 }
  );

  assert.deepEqual(gameStats.packPlayCounts, {
    'pack-one': 3,
    'pack-two': 3
  });
  assert.equal(gameStats.favouritePack, 'pack-two');
});

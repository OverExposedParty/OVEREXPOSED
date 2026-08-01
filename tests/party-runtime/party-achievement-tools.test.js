const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyAchievementTools
} = require('../../server/game-engine/party-runtime/route-handlers/achievement-tools');

test('party achievement XP updates lifetime XP and account level', async () => {
  const achievement = {
    key: 'sherlock',
    requirementValue: 1,
    rewards: [{ type: 'xp', amount: 25 }]
  };
  const account = {
    gameData: {
      level: 1,
      xp: 490,
      achievements: [],
      inGamePurchasesAndUnlocks: []
    }
  };
  const { unlockEligiblePartyAchievements } = createPartyAchievementTools({
    Achievement: {},
    async getPublishedAchievements() {
      return [achievement];
    }
  });

  await unlockEligiblePartyAchievements(
    account,
    { stats: { correctImposterVotes: 1 } },
    { gameMode: 'imposter', partyId: 'PARTY-ONE' }
  );

  assert.equal(account.gameData.xp, 515);
  assert.equal(account.gameData.level, 2);
  assert.equal(account.gameData.achievements.length, 1);
  assert.equal(account.gameData.achievements[0].key, achievement.key);
  assert.equal(account.gameData.achievements[0].rewardGranted, true);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const partyGameRewards = require('../../server/services/party-game-rewards');
const rules = require('../../server/services/party-game-rewards/rules');
const grants = require('../../server/services/party-game-rewards/grants');

test('party-game reward facade preserves its public contract', () => {
  assert.deepEqual(Object.keys(partyGameRewards).sort(), [
    'PARTY_GAME_REWARD_RULES',
    'PARTY_GAME_XP_RULES',
    'applyPartyGameSoftCap',
    'buildPartyGameRewardSummaries',
    'calculatePartyGameXpReward',
    'grantPartyGameRewardSummary',
    'grantPartyGameRewards',
    'grantPendingPartyGameReward'
  ]);
});

test('party-game reward facade delegates to focused modules', () => {
  assert.equal(
    partyGameRewards.PARTY_GAME_REWARD_RULES,
    rules.PARTY_GAME_REWARD_RULES
  );
  assert.equal(partyGameRewards.PARTY_GAME_XP_RULES, rules.PARTY_GAME_XP_RULES);
  assert.equal(
    partyGameRewards.applyPartyGameSoftCap,
    rules.applyPartyGameSoftCap
  );
  assert.equal(
    partyGameRewards.buildPartyGameRewardSummaries,
    rules.buildPartyGameRewardSummaries
  );
  assert.equal(
    partyGameRewards.calculatePartyGameXpReward,
    rules.calculatePartyGameXpReward
  );
  assert.equal(
    partyGameRewards.grantPartyGameRewardSummary,
    grants.grantPartyGameRewardSummary
  );
  assert.equal(
    partyGameRewards.grantPartyGameRewards,
    grants.grantPartyGameRewards
  );
  assert.equal(
    partyGameRewards.grantPendingPartyGameReward,
    grants.grantPendingPartyGameReward
  );
});

const assert = require('node:assert/strict');
const test = require('node:test');

const opals = require('../../server/services/opals');
const catalog = require('../../server/services/opals/catalog');
const wallet = require('../../server/services/opals/wallet');
const partyGameRewards = require('../../server/services/party-game-rewards');
const partyRewardRules = require('../../server/services/opals/party-reward-rules');
const partyRewardGrants = require('../../server/services/opals/party-reward-grants');
const purchases = require('../../server/services/opals/purchases');

test('Opal service facade preserves its public contract', () => {
  assert.deepEqual(Object.keys(opals).sort(), [
    'PARTY_GAME_REWARD_RULES',
    'buildPartyGameRewardSummaries',
    'findProductVariant',
    'getEntitlementConfig',
    'grantPartyGameOpalRewards',
    'grantPendingPartyGameOpalReward',
    'grantShopItemsToAccount',
    'serializeOpalTransactions',
    'serializeOpalWallet',
    'spendOpalsForProduct'
  ]);
});

test('Opal service facade delegates to focused modules', () => {
  assert.equal(opals.findProductVariant, catalog.findProductVariant);
  assert.equal(opals.getEntitlementConfig, catalog.getEntitlementConfig);
  assert.equal(opals.serializeOpalWallet, wallet.serializeOpalWallet);
  assert.equal(
    opals.serializeOpalTransactions,
    wallet.serializeOpalTransactions
  );
  assert.equal(
    opals.buildPartyGameRewardSummaries,
    partyGameRewards.buildPartyGameRewardSummaries
  );
  assert.equal(
    opals.PARTY_GAME_REWARD_RULES,
    partyGameRewards.PARTY_GAME_REWARD_RULES
  );
  assert.equal(
    opals.grantPartyGameOpalRewards,
    partyGameRewards.grantPartyGameRewards
  );
  assert.equal(
    opals.grantPendingPartyGameOpalReward,
    partyGameRewards.grantPendingPartyGameReward
  );
  assert.equal(
    partyRewardRules,
    require('../../server/services/party-game-rewards/rules')
  );
  assert.equal(
    partyRewardGrants.grantPartyGameOpalRewards,
    partyGameRewards.grantPartyGameRewards
  );
  assert.equal(
    partyRewardGrants.grantPendingPartyGameOpalReward,
    partyGameRewards.grantPendingPartyGameReward
  );
  assert.equal(opals.spendOpalsForProduct, purchases.spendOpalsForProduct);
  assert.equal(
    opals.grantShopItemsToAccount,
    purchases.grantShopItemsToAccount
  );
});

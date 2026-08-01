const { getEntitlementConfig, findProductVariant } = require('./opals/catalog');
const {
  serializeOpalWallet,
  serializeOpalTransactions
} = require('./opals/wallet');
const {
  PARTY_GAME_REWARD_RULES,
  buildPartyGameRewardSummaries,
  grantPartyGameRewards,
  grantPendingPartyGameReward
} = require('./party-game-rewards');
const {
  spendOpalsForProduct,
  grantShopItemsToAccount
} = require('./opals/purchases');

module.exports = {
  buildPartyGameRewardSummaries,
  findProductVariant,
  grantPendingPartyGameOpalReward: grantPendingPartyGameReward,
  grantPartyGameOpalRewards: grantPartyGameRewards,
  getEntitlementConfig,
  grantShopItemsToAccount,
  PARTY_GAME_REWARD_RULES,
  serializeOpalTransactions,
  serializeOpalWallet,
  spendOpalsForProduct
};

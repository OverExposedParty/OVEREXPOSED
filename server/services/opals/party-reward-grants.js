const {
  grantPartyGameRewardSummary,
  grantPartyGameRewards,
  grantPendingPartyGameReward
} = require('../party-game-rewards/grants');

module.exports = {
  grantPartyGameRewardSummary,
  grantPartyGameOpalRewards: grantPartyGameRewards,
  grantPendingPartyGameOpalReward: grantPendingPartyGameReward
};

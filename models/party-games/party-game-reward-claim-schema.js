const mongoose = require('mongoose');

const partyGameRewardClaimSchema = new mongoose.Schema(
  {
    claimKey: { type: String, required: true, unique: true },
    partyId: { type: String, required: true, index: true },
    gameId: { type: String, default: null, index: true },
    playerId: { type: String, required: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true
    },
    gamemode: { type: String, default: null },
    rewardVersion: { type: Number, min: 1, default: 1 },
    status: {
      type: String,
      enum: ['pending', 'applied'],
      default: 'pending'
    },
    amount: { type: Number, min: 0, required: true },
    opalAmount: { type: Number, min: 0, default: 0 },
    xpAmount: { type: Number, min: 0, default: 0 },
    levelBefore: { type: Number, min: 1, default: null },
    levelAfter: { type: Number, min: 1, default: null },
    rewardSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
    appliedAt: { type: Date, default: null }
  },
  { versionKey: false }
);

partyGameRewardClaimSchema.index(
  { gameId: 1, playerId: 1 },
  {
    unique: true,
    partialFilterExpression: { gameId: { $type: 'string' } }
  }
);

module.exports = mongoose.model(
  'PartyGameRewardClaim',
  partyGameRewardClaimSchema,
  'party-game-reward-claims'
);

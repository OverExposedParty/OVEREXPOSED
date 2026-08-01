const mongoose = require('mongoose');

const achievementRewardClaimSchema = new mongoose.Schema(
  {
    claimKey: { type: String, required: true, unique: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true
    },
    achievementKey: { type: String, required: true, trim: true },
    rewardVersion: { type: Number, min: 1, default: 1 },
    status: {
      type: String,
      enum: ['pending', 'applied'],
      default: 'pending'
    },
    grantToken: { type: String, required: true },
    leaseExpiresAt: { type: Date, required: true },
    source: { type: String, trim: true, default: null },
    gamemode: { type: String, trim: true, default: null },
    partyId: { type: String, trim: true, default: null },
    rewardResults: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    appliedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

achievementRewardClaimSchema.index(
  { accountId: 1, achievementKey: 1 },
  { unique: true }
);
achievementRewardClaimSchema.index({ status: 1, leaseExpiresAt: 1 });

module.exports = mongoose.model(
  'AchievementRewardClaim',
  achievementRewardClaimSchema,
  'achievement-reward-claims'
);

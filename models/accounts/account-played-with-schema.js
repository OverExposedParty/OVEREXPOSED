const mongoose = require('mongoose');

const { Schema } = mongoose;

const accountPlayedWithSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    otherAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    gamesPlayedTogether: { type: Number, min: 0, default: 1 },
    gamemodes: { type: [String], default: [] },
    firstPlayedAt: { type: Date, default: Date.now },
    lastPlayedAt: { type: Date, default: Date.now },
    lastPartyId: { type: String, trim: true, default: null }
  },
  {
    timestamps: true
  }
);

accountPlayedWithSchema.index(
  { accountId: 1, otherAccountId: 1 },
  { unique: true }
);
accountPlayedWithSchema.index({ accountId: 1, lastPlayedAt: -1 });
accountPlayedWithSchema.index({ accountId: 1, gamesPlayedTogether: -1 });

module.exports = mongoose.model(
  'AccountPlayedWith',
  accountPlayedWithSchema,
  'account-played-with'
);

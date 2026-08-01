const mongoose = require('mongoose');

const { Schema } = mongoose;

const olingBattleEventSchema = new Schema(
  {
    matchId: {
      type: Schema.Types.ObjectId,
      ref: 'OlingBattleMatch',
      required: true,
      index: true
    },
    matchCode: { type: String, required: true, index: true },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true
    },
    sequence: { type: Number, min: 1, required: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    payload: { type: Schema.Types.Mixed, default: () => ({}) },
    createdAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false,
    suppressReservedKeysWarning: true
  }
);

olingBattleEventSchema.index({ matchId: 1, sequence: 1 }, { unique: true });
olingBattleEventSchema.index({ matchCode: 1, createdAt: 1 });

module.exports = mongoose.model(
  'OlingBattleEvent',
  olingBattleEventSchema,
  'oling-battle-events'
);

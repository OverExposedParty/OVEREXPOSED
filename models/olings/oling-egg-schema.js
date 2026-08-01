const mongoose = require('mongoose');

const { Schema } = mongoose;

const OLING_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
];

const olingEggSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    collection: { type: String, required: true, trim: true, lowercase: true },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    rarityOdds: {
      common: { type: Number, min: 0, default: 0.8 },
      uncommon: { type: Number, min: 0, default: 0.15 },
      rare: { type: Number, min: 0, default: 0.04 },
      epic: { type: Number, min: 0, default: 0.009 },
      legendary: { type: Number, min: 0, default: 0.0009 },
      mythic: { type: Number, min: 0, default: 0.0001 }
    },
    setKeys: { type: [String], default: [] },
    personalityPool: { type: [String], default: [] },
    assets: { type: Schema.Types.Mixed, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingEggSchema.index({ key: 1 }, { unique: true });
olingEggSchema.index({ enabled: 1, status: 1 });
olingEggSchema.index({ collection: 1 });

module.exports = mongoose.model('OlingEgg', olingEggSchema, 'oling-eggs');
module.exports.OLING_RARITIES = OLING_RARITIES;

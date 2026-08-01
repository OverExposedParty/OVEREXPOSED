const mongoose = require('mongoose');

const { Schema } = mongoose;

const OLING_LAYERS = ['body', 'eyes', 'mouth', 'flight', 'headwear'];
const OLING_RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
];

const attackSchema = new Schema(
  {
    name: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: '' },
    damage: { type: Number, min: 0, default: 0 },
    baseCooldown: { type: Number, min: 0, default: 1 },
    accuracy: { type: Number, min: 0, max: 1, default: 0.9 },
    effect: { type: Schema.Types.Mixed, default: () => ({}) },
    animation: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const bodyStatsSchema = new Schema(
  {
    health: { type: Number, min: 1, default: 100 },
    defense: { type: Number, min: 0, default: 0 },
    speedMultiplier: { type: Number, min: 0.1, default: 1 },
    luck: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const olingTraitSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    collection: { type: String, required: true, trim: true, lowercase: true },
    theme: { type: String, required: true, trim: true, lowercase: true },
    layer: {
      type: String,
      enum: OLING_LAYERS,
      required: true
    },
    flightType: { type: String, trim: true, lowercase: true, default: '' },
    flightMotion: { type: String, trim: true, lowercase: true, default: '' },
    flightSpeed: { type: Number, min: 0.01, default: 1 },
    rarity: {
      type: String,
      enum: OLING_RARITIES,
      required: true
    },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    assets: { type: Schema.Types.Mixed, default: () => ({}) },
    body: { type: bodyStatsSchema, default: undefined },
    attack: { type: attackSchema, default: undefined },
    modifiers: { type: Schema.Types.Mixed, default: () => ({}) },
    passive: { type: Schema.Types.Mixed, default: () => ({}) },
    flavor: { type: String, trim: true, default: '' },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingTraitSchema.index({ key: 1 }, { unique: true });
olingTraitSchema.index({ collection: 1, theme: 1 });
olingTraitSchema.index({ collection: 1, layer: 1, rarity: 1 });
olingTraitSchema.index({ enabled: 1, status: 1 });

module.exports = mongoose.model('OlingTrait', olingTraitSchema, 'oling-traits');
module.exports.OLING_LAYERS = OLING_LAYERS;
module.exports.OLING_RARITIES = OLING_RARITIES;

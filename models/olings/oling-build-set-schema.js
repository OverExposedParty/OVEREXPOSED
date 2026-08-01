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

const olingSetTraitsSchema = new Schema(
  {
    body: { type: String, trim: true, required: true },
    eyes: { type: String, trim: true, required: true },
    mouth: { type: String, trim: true, required: true },
    flight: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const olingBuildSetSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    collection: { type: String, required: true, trim: true, lowercase: true },
    rarity: {
      type: String,
      enum: OLING_RARITIES,
      required: true
    },
    traits: { type: olingSetTraitsSchema, required: true },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    assets: { type: Schema.Types.Mixed, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingBuildSetSchema.index({ key: 1 }, { unique: true });
olingBuildSetSchema.index({ enabled: 1, status: 1 });
olingBuildSetSchema.index({ collection: 1, rarity: 1 });

module.exports = mongoose.model(
  'OlingBuildSet',
  olingBuildSetSchema,
  'oling-build-sets'
);
module.exports.OLING_RARITIES = OLING_RARITIES;

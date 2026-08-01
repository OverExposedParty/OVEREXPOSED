const mongoose = require('mongoose');

const { Schema } = mongoose;

const olingConsumableSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, lowercase: true, default: null },
    subcategory: { type: String, trim: true, lowercase: true, default: null },
    target: {
      type: String,
      enum: ['oling', 'egg', 'lab', null],
      default: 'oling'
    },
    effect: { type: Schema.Types.Mixed, default: () => ({}) },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    stackable: { type: Boolean, default: true },
    maxStack: { type: Number, min: 0, default: null },
    cooldownSeconds: { type: Number, min: 0, default: 0 },
    assets: { type: Schema.Types.Mixed, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true
  }
);

olingConsumableSchema.index({ key: 1 }, { unique: true });
olingConsumableSchema.index({ enabled: 1, status: 1, category: 1 });

module.exports = mongoose.model(
  'OlingConsumable',
  olingConsumableSchema,
  'oling-consumables'
);

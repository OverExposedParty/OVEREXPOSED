const mongoose = require('mongoose');

const { Schema } = mongoose;

const olingPersonalitySchema = new Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    flavor: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    effects: { type: [Schema.Types.Mixed], default: [] },
    moments: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true
  }
);

olingPersonalitySchema.index({ key: 1 }, { unique: true });
olingPersonalitySchema.index({ enabled: 1, status: 1 });

module.exports = mongoose.model(
  'OlingPersonality',
  olingPersonalitySchema,
  'oling-personalities'
);

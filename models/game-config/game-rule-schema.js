const mongoose = require('mongoose');
const {
  gameContentAvailabilitySchema
} = require('./game-content-availability-schema');

const gameRuleSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true, trim: true },
    scope: {
      type: String,
      enum: ['global', 'gamemode'],
      default: 'gamemode'
    },
    appliesTo: { type: [String], default: [] },
    key: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    availability: {
      type: gameContentAvailabilitySchema,
      default: () => ({ mode: 'always' })
    },
    access: {
      type: {
        type: String,
        enum: ['public', 'feature', 'owner'],
        default: 'public'
      },
      feature: { type: String, default: null }
    },
    buttonType: { type: String, required: true, trim: true },
    restriction: { type: [String], default: [] },
    requiredSetting: { type: String, default: null },
    colour: { type: String, default: '' },
    secondaryColour: { type: String, default: '' },
    designation: { type: String, default: null },
    initialValue: { type: Number, default: null },
    incrementValue: { type: Number, default: null },
    minimumValue: { type: Number, default: null },
    maximumValue: { type: Number, default: null },
    gameRuleTimeLimit: { type: Number, default: null }
  },
  {
    timestamps: true
  }
);

gameRuleSchema.index({ gameType: 1, key: 1 }, { unique: true });
gameRuleSchema.index({ gameType: 1, enabled: 1, status: 1 });
gameRuleSchema.index({ scope: 1, appliesTo: 1, enabled: 1, status: 1 });

module.exports = mongoose.model('GameRule', gameRuleSchema, 'game-rules');

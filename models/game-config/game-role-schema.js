const mongoose = require('mongoose');
const {
  gameContentAvailabilitySchema
} = require('./game-content-availability-schema');

const roleSelectionSchema = new mongoose.Schema(
  {
    defaultCount: { type: Number, min: 0, default: 0 },
    increment: { type: Number, min: 1, default: 1 },
    minimum: { type: Number, min: 0, default: 0 },
    maximum: { type: Number, min: 0, default: 20 },
    fillRemaining: { type: Boolean, default: false }
  },
  { _id: false }
);

roleSelectionSchema.pre('validate', function validateSelectionRange() {
  const integerFields = ['defaultCount', 'increment', 'minimum', 'maximum'];

  for (const field of integerFields) {
    if (!Number.isInteger(this[field])) {
      this.invalidate(field, `${field} must be an integer`);
    }
  }

  if (this.minimum > this.maximum) {
    this.invalidate(
      'maximum',
      'maximum must be greater than or equal to minimum'
    );
  }

  if (this.defaultCount < this.minimum || this.defaultCount > this.maximum) {
    this.invalidate(
      'defaultCount',
      'defaultCount must be between minimum and maximum'
    );
  }
});

const roleAssetSchema = new mongoose.Schema(
  {
    colour: { type: String, trim: true, default: '' },
    secondaryColour: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const gameRoleSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true, trim: true, lowercase: true },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    title: { type: String, required: true, trim: true },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },
    faction: {
      type: String,
      enum: ['civilian', 'mafioso', 'neutral'],
      required: true
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
      feature: { type: String, trim: true, default: null }
    },
    selection: { type: roleSelectionSchema, default: () => ({}) },
    assets: { type: roleAssetSchema, default: () => ({}) },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

gameRoleSchema.index({ gameType: 1, key: 1 }, { unique: true });
gameRoleSchema.index({ gameType: 1, enabled: 1, status: 1, sortOrder: 1 });
gameRoleSchema.index(
  { gameType: 1, 'selection.fillRemaining': 1 },
  {
    unique: true,
    partialFilterExpression: {
      enabled: true,
      status: 'published',
      'selection.fillRemaining': true
    }
  }
);

module.exports = mongoose.model('GameRole', gameRoleSchema, 'game-roles');

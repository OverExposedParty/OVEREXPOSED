const mongoose = require('mongoose');
const {
  gameContentAvailabilitySchema
} = require('./game-content-availability-schema');

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['truth', 'dare', null],
      default: null
    },
    alternatives: { type: [String], default: [] },
    punishment: { type: String, default: null }
  },
  { _id: false }
);

const packAssetSchema = new mongoose.Schema(
  {
    colour: { type: String, default: '' },
    secondaryColour: { type: String, default: '' }
  },
  { _id: false }
);

const gamePackSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
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
    difficulty: { type: String, default: '' },
    restriction: { type: String, default: null },
    assets: { type: packAssetSchema, default: () => ({}) },
    questions: { type: [questionSchema], default: [] }
  },
  {
    timestamps: true
  }
);

gamePackSchema.index({ gameType: 1, slug: 1 }, { unique: true });
gamePackSchema.index({ gameType: 1, enabled: 1, status: 1 });

module.exports = mongoose.model('GamePack', gamePackSchema, 'game-packs');

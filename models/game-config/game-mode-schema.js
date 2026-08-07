const mongoose = require('mongoose');

const gamemodeCardImagesSchema = new mongoose.Schema(
  {
    front: { type: String, default: '' },
    back: { type: String, default: '' }
  },
  { _id: false }
);

const gamemodeColoursSchema = new mongoose.Schema(
  {
    primary: { type: String, default: '' },
    secondary: { type: String, default: '' }
  },
  { _id: false }
);

const gameModeReleaseHistorySchema = new mongoose.Schema(
  {
    version: { type: String, required: true, trim: true },
    releasedAt: { type: Date, default: Date.now },
    releaseNote: { type: String, required: true, trim: true, maxlength: 500 },
    releasedBy: {
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null
      },
      usernameSnapshot: { type: String, default: '-' }
    }
  },
  { _id: false }
);

const gameModeSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true, trim: true, unique: true },
    version: {
      type: String,
      required: true,
      trim: true,
      match: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
      default: '1.0.0'
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    cardImages: { type: gamemodeCardImagesSchema, default: () => ({}) },
    colours: { type: gamemodeColoursSchema, default: () => ({}) },
    link: { type: String, default: '' },
    textUpdates: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    sortOrder: { type: Number, default: 0 },
    releaseHistory: { type: [gameModeReleaseHistorySchema], default: [] }
  },
  {
    timestamps: true
  }
);

gameModeSchema.index({ enabled: 1, status: 1, sortOrder: 1 });

module.exports = mongoose.model('GameMode', gameModeSchema, 'gamemodes');

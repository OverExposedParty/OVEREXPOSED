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

const gameModeSchema = new mongoose.Schema(
  {
    gameType: { type: String, required: true, trim: true, unique: true },
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
    sortOrder: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

gameModeSchema.index({ enabled: 1, status: 1, sortOrder: 1 });

module.exports = mongoose.model('GameMode', gameModeSchema, 'gamemodes');

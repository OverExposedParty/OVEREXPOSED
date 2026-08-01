const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildSchema = new Schema(
  {
    body: { type: String, trim: true, required: true },
    eyes: { type: String, trim: true, required: true },
    mouth: { type: String, trim: true, required: true },
    flight: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const buildRaritySchema = new Schema(
  {
    body: { type: String, trim: true, required: true },
    eyes: { type: String, trim: true, required: true },
    mouth: { type: String, trim: true, required: true },
    flight: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const equipmentSchema = new Schema(
  {
    headwear: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const olingBattleStatsSchema = new Schema(
  {
    wins: { type: Number, min: 0, default: 0 },
    losses: { type: Number, min: 0, default: 0 },
    draws: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const olingCareSchema = new Schema(
  {
    energy: { type: Number, min: 0, max: 100, default: 100 },
    energyUpdatedAt: { type: Date, default: Date.now },
    isSleeping: { type: Boolean, default: false },
    sleepUpdatedAt: { type: Date, default: null },
    sleepBedPlacedId: { type: String, trim: true, default: null },
    sleepBedSlotId: { type: String, trim: true, default: null },
    sleepBedRarity: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    sleepDurationMs: { type: Number, min: 1, default: null }
  },
  { _id: false }
);

const playerOlingSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    eggKey: { type: String, required: true, trim: true, lowercase: true },
    collection: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, maxlength: 40, default: null },
    personalityKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    build: { type: buildSchema, required: true },
    buildRarities: { type: buildRaritySchema, required: true },
    equipment: { type: equipmentSchema, default: () => ({}) },
    level: { type: Number, min: 1, default: 1 },
    xp: { type: Number, min: 0, default: 0 },
    care: { type: olingCareSchema, default: () => ({}) },
    favorite: { type: Boolean, default: false },
    displayOnProfile: { type: Boolean, default: false },
    battleStats: { type: olingBattleStatsSchema, default: () => ({}) },
    hatchedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

playerOlingSchema.index({ ownerId: 1, hatchedAt: -1 });
playerOlingSchema.index({ ownerId: 1, favorite: 1 });
playerOlingSchema.index({ eggKey: 1 });

module.exports = mongoose.model(
  'PlayerOling',
  playerOlingSchema,
  'player-olings'
);

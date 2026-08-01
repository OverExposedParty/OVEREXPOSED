const mongoose = require('mongoose');

const { Schema } = mongoose;

const MATCH_STATUSES = [
  'waiting',
  'ready',
  'active',
  'overtime',
  'completed',
  'abandoned'
];
const MATCH_PHASES = ['waiting', 'countdown', 'active', 'overtime', 'complete'];
const PLAYER_SLOTS = ['player-one', 'player-two'];
const END_REASONS = [
  'knockout',
  'timeout',
  'surrender',
  'disconnect',
  'abandoned',
  'admin',
  'unknown'
];

const olingSnapshotSchema = new Schema(
  {
    id: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: null },
    level: { type: Number, min: 1, default: 1 },
    personalityKey: { type: String, trim: true, lowercase: true, default: '' },
    build: { type: Schema.Types.Mixed, default: () => ({}) },
    equipment: { type: Schema.Types.Mixed, default: () => ({}) },
    traits: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const playerSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true
    },
    socketId: { type: String, trim: true, default: null },
    slot: { type: String, enum: PLAYER_SLOTS, required: true },
    ready: { type: Boolean, default: false },
    connected: { type: Boolean, default: true },
    isAi: { type: Boolean, default: false },
    aiDifficulty: { type: Number, min: 0, max: 1, default: null },
    playerName: { type: String, trim: true, default: '' },
    oeIcon: { type: String, trim: true, default: '0000:0100:0200:0300' },
    olingId: {
      type: Schema.Types.ObjectId,
      ref: 'PlayerOling',
      required: true
    },
    olingSnapshot: { type: olingSnapshotSchema, required: true },
    currentHealth: { type: Number, min: 0, required: true },
    maxHealth: { type: Number, min: 1, required: true },
    stunUntil: { type: Date, default: null },
    lastActionAt: { type: Date, default: null }
  },
  { _id: false }
);

const markerSchema = new Schema(
  {
    position: { type: Number, min: 0, max: 100, default: 50 },
    direction: { type: Number, enum: [-1, 1], default: 1 },
    updatedAt: { type: Date, default: Date.now },
    isFullDisruption: { type: Boolean, default: false }
  },
  { _id: false }
);

const hitHistorySchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    zone: {
      type: String,
      enum: ['critical', 'strike', 'disruption'],
      required: true
    },
    result: { type: String, trim: true, required: true },
    multiplier: { type: Number, min: 1, default: 1 },
    sequence: { type: Number, min: 1, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const configSchema = new Schema(
  {
    matchLengthSeconds: { type: Number, min: 1, default: 30 }
  },
  { _id: false }
);

const stateSchema = new Schema(
  {
    startedAt: { type: Date, default: null },
    countdownStartedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    phase: { type: String, enum: MATCH_PHASES, default: 'waiting' },
    timeMultiplier: { type: Number, min: 1, default: 1 },
    marker: { type: markerSchema, default: () => ({}) },
    hitHistory: { type: [hitHistorySchema], default: [] },
    winnerAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    endReason: { type: String, enum: END_REASONS, default: null }
  },
  { _id: false }
);

const olingBattleMatchSchema = new Schema(
  {
    matchCode: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: MATCH_STATUSES, default: 'waiting' },
    config: { type: configSchema, default: () => ({}) },
    players: { type: [playerSchema], default: [] },
    state: { type: stateSchema, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingBattleMatchSchema.index({ status: 1, updatedAt: -1 });
olingBattleMatchSchema.index({ 'players.accountId': 1, status: 1 });

module.exports = mongoose.model(
  'OlingBattleMatch',
  olingBattleMatchSchema,
  'oling-battle-matches'
);
module.exports.MATCH_STATUSES = MATCH_STATUSES;
module.exports.PLAYER_SLOTS = PLAYER_SLOTS;

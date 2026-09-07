const mongoose = require('mongoose');
const {
  OLING_BATTLE_GAME_ID_PATTERN,
  createOlingBattleGameId
} = require('./oling-battle-game-id');

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
const MAX_EMBEDDED_EVENTS = 500;

const olingSnapshotSchema = new Schema(
  {
    id: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: null },
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

const battleEventSchema = new Schema(
  {
    sequence: { type: Number, min: 1, required: true },
    type: { type: String, required: true, trim: true, lowercase: true },
    actorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    actorSlot: { type: String, enum: PLAYER_SLOTS, default: null },
    payload: { type: Schema.Types.Mixed, default: () => ({}) },
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
    gameId: {
      type: String,
      required: true,
      default: () => createOlingBattleGameId(),
      match: OLING_BATTLE_GAME_ID_PATTERN
    },
    matchCode: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: MATCH_STATUSES, default: 'waiting' },
    config: { type: configSchema, default: () => ({}) },
    players: { type: [playerSchema], default: [] },
    state: { type: stateSchema, default: () => ({}) },
    events: {
      type: [battleEventSchema],
      validate: {
        validator: (events) =>
          Array.isArray(events) &&
          events.length <= MAX_EMBEDDED_EVENTS &&
          new Set(events.map((event) => event.sequence)).size === events.length,
        message: `Oling Battle matches require unique event sequences and cannot exceed ${MAX_EMBEDDED_EVENTS} events.`
      },
      default: []
    }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingBattleMatchSchema.index({ status: 1, updatedAt: -1 });
olingBattleMatchSchema.index({ 'players.accountId': 1, status: 1 });
olingBattleMatchSchema.index(
  { gameId: 1 },
  {
    unique: true,
    partialFilterExpression: { gameId: { $type: 'string' } }
  }
);

module.exports = mongoose.model(
  'OlingBattleMatch',
  olingBattleMatchSchema,
  'oling-battle-matches'
);
module.exports.MATCH_STATUSES = MATCH_STATUSES;
module.exports.PLAYER_SLOTS = PLAYER_SLOTS;
module.exports.END_REASONS = END_REASONS;
module.exports.MAX_EMBEDDED_EVENTS = MAX_EMBEDDED_EVENTS;
module.exports.battleEventSchema = battleEventSchema;
module.exports.configSchema = configSchema;
module.exports.olingSnapshotSchema = olingSnapshotSchema;
module.exports.playerSchema = playerSchema;
module.exports.stateSchema = stateSchema;

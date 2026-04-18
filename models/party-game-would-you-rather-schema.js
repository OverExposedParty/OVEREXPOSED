const mongoose = require('mongoose');

/* ──────────────────────────────────────────────
   PLAYER SUB-SCHEMAS
────────────────────────────────────────────── */

const identitySchema = new mongoose.Schema({
  computerId: { type: String, required: true },
  username:   { type: String, required: true },
  userIcon:   { type: String, required: true }
}, { _id: false });

const connectionSchema = new mongoose.Schema({
  socketId: { type: String, default: null },
  lastPing: { type: Date, default: Date.now }
}, { _id: false });

const playerStateSchema = new mongoose.Schema({
  isReady:      { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },
  vote: {
    type: String,
    enum: ['A', 'B'],
    default: null
  },
  score: { type: Number, default: 0 }
}, { _id: false });

const playerSchema = new mongoose.Schema({
  identity:   identitySchema,
  connection: connectionSchema,
  state:      playerStateSchema
}, { _id: false });

/* ──────────────────────────────────────────────
   GAME CONFIG & STATE
────────────────────────────────────────────── */

const configSchema = new mongoose.Schema({
  gamemode:        { type: String, required: true },
  gameRules:     { type: Map, of: mongoose.Schema.Types.Mixed, required: true },
  selectedPacks: { type: [String], required: true },
  userInstructions:{ type: String },
  shuffleSeed:     { type: Number, required: true }
}, { _id: false });

const stateSchema = new mongoose.Schema({
  isPlaying:  { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  timer:      { type: Date, default: null },
  phase:      { type: String, default: null },
  phaseData:  { type: mongoose.Schema.Types.Mixed, default: null },
  hostComputerId:    { type: String, default: null },
  hostComputerIdList:{ type: [String], default: [] }
}, { _id: false });

/* ──────────────────────────────────────────────
   DECK
────────────────────────────────────────────── */

const deckSchema = new mongoose.Schema({
  currentCardIndex: { type: Number, default: 0 }
}, { _id: false });

/* ──────────────────────────────────────────────
   MAIN SCHEMA
────────────────────────────────────────────── */

const partyGameWouldYouRatherSchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true },

  config: configSchema,
  state:  stateSchema,
  deck:   deckSchema,

  players: { type: [playerSchema], default: [] }
});

module.exports = mongoose.model(
  'partyGameWouldYouRather',
  partyGameWouldYouRatherSchema,
  'party-game-would-you-rather'
);

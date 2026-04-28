const mongoose = require('mongoose');

const identitySchema = new mongoose.Schema(
  {
    computerId: { type: String, required: true },
    username: { type: String, required: true },
    userIcon: { type: String, required: true }
  },
  { _id: false }
);

const connectionSchema = new mongoose.Schema(
  {
    socketId: { type: String, default: null },
    lastPing: { type: Date, default: Date.now }
  },
  { _id: false }
);

const gameStateSchema = new mongoose.Schema(
  {
    isReady: { type: Boolean, default: false },
    hasConfirmed: { type: Boolean, default: false },
    score: { type: Number, default: 0 }
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    identity: identitySchema,
    connection: connectionSchema,
    state: gameStateSchema
  },
  { _id: false }
);

const configSchema = new mongoose.Schema(
  {
    gamemode: { type: String, required: true },
    gameRules: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true
    },
    selectedPacks: {
      type: [String],
      required: true
    },
    userInstructions: { type: String, default: '' },
    shuffleSeed: { type: Number, required: true }
  },
  { _id: false }
);

const runtimeStateSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, required: true },
    lastPinged: { type: Date, default: Date.now },
    playerTurn: { type: Number, required: true },
    playerTurnOrder: { type: [String], default: [] },
    timer: { type: Date, default: null },
    phase: { type: String, default: null },
    phaseData: { type: mongoose.Schema.Types.Mixed, default: null },
    hostComputerId: { type: String, default: null },
    hostComputerIdList: { type: [String], default: [] }
  },
  { _id: false }
);

const deckStateSchema = new mongoose.Schema(
  {
    currentCardIndex: { type: Number, default: 0 },
    currentCardSecondIndex: { type: Number, default: 0 },
    questionType: {
      type: String,
      enum: ['truth', 'dare'],
      default: 'truth'
    }
  },
  { _id: false }
);

const partyGameTruthOrDareSchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true },
  config: configSchema,
  state: runtimeStateSchema,
  deck: deckStateSchema,
  players: { type: [playerSchema], default: [] }
});

module.exports = mongoose.model(
  'partyGameTruthOrDare',
  partyGameTruthOrDareSchema,
  'party-game-truth-or-dare'
);

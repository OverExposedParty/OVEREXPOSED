const mongoose = require('mongoose');

const identitySchema = new mongoose.Schema({
  username: { type: String, required: true },
  computerId: { type: String, required: true },
  userIcon: { type: String, required: true }
}, { _id: false });

const connectionSchema = new mongoose.Schema({
  socketId: { type: String, default: null },
  lastPing: { type: Date, default: Date.now }
}, { _id: false });

const phaseSchema = new mongoose.Schema({
  scenarioFileName: { type: String, default: 'N/A' }, // e.g. civilian-watch-01
  index: { type: Number, default: 1 },     // which area/step they’re on
  state: { type: String, default: 'N/A' }, // e.g. 'pending', 'resolved', etc.
  option : { type: String, default: 'N/A' },
  optionList: { type: [String], default: [] },
  timer: { type: Date, default: null },
}, { _id: false });


const stateSchema = new mongoose.Schema({
  isReady: { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },

  role: { type: String, default: 'N/A' },
  status: { type: String, enum: ['dead', 'alive'], default: 'alive' },
  vote: { type: String, default: 'N/A'},

  phase: { type: phaseSchema, default: () => ({}) }

}, { _id: false });


const playerSchema = new mongoose.Schema({
  identity: identitySchema,
  connection: connectionSchema,
  state: stateSchema,
}, { _id: false });

const configSchema = new mongoose.Schema({
  gamemode: { type: String, required: true },
  gameRules:     { type: Map, of: mongoose.Schema.Types.Mixed, required: true },
  selectedPacks: { type: [String], required: true },
  userInstructions: { type: String },
  shuffleSeed: { type: Number, required: true }
}, { _id: false });

const gameStateSchema = new mongoose.Schema({
  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  phase: { type: String, default: 'lobby' },
  timer: { type: Date, default: null },
  hostComputerId:    { type: String, default: null },
  hostComputerIdList:{ type: [String], default: [] }
}, { _id: false });

const partyGameMafiaSchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true },

  config: configSchema,
  state: gameStateSchema,

  players: { type: [playerSchema], required: true }
});

module.exports = mongoose.model(
  'partyGameMafia',
  partyGameMafiaSchema,
  'party-game-mafia'
);

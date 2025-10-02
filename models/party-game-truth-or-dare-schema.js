const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  computerId: { type: String, required: true },
  username: { type: String, required: true },
  userIcon: { type: String, required: true },
  isReady: { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },
  lastPing: { type: Date, default: Date.now },
  socketId: { type: String, default: null },
  score: { type: Number, default: 0 }
}, { _id: false });

const partyGameTruthOrDareSchema = new mongoose.Schema({
  partyId: { type: String, required: true },
  gamemode: { type: String, required: true },
  gameRules: { type: String, required: true },
  selectedPacks: { type: String, required: true },
  userInstructions: { type: String},
  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  playerTurn: { type: Number, required: true },
  shuffleSeed: { type: Number, required: true },
  currentCardIndex: { type: Number, default: 0 },
  currentCardSecondIndex: { type: Number, default: 0 },
  questionType: { type: String, enum: ["truth", "dare"] },
  players: { type: [PlayerSchema], default: [] }
});

module.exports = mongoose.model('partyGameTruthOrDareSchema', partyGameTruthOrDareSchema, 'party-game-truth-or-dare');
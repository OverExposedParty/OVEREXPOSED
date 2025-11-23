const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  computerId: { type: String, required: true },
  username: { type: String, required: true },
  userIcon: { type: String, required: true },
  isReady: { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },
  vote: { type: String, default: null },
  lastPing: { type: Date, default: Date.now },
  socketId: { type: String, default: null },
  score: { type: Number, default: 0 }
}, { _id: false });

const partyGameImposterSchema = new mongoose.Schema({
  partyId: { type: String, required: true },
  gamemode: { type: String, required: true },
  gameRules: { type: String, required: true },
  selectedPacks: { type: String, required: true },
  userInstructions: { type: String },
  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  playerTurn: { type: Number, required: true },
  round: { type: Number, required: false, default: 0 },
  roundPlayerTurn: { type: Number, required: false, default: 0 },
  shuffleSeed: { type: Number },
  currentCardIndex: { type: Number, default: 0 },
  alternativeQuestionIndex: { type: Number, default: 0 },
  timer: { type: Date, default: null },
  players: { type: [PlayerSchema], default: [] }
});

module.exports = mongoose.model('partyGameImposterSchema', partyGameImposterSchema, 'party-game-imposter');
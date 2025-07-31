const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  computerId: { type: String, required: true },
  isReady: { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },
  lastPing: { type: Date, default: Date.now },
  role: { type: String, default: 'N/A' },
  status: { type: String, enum: ['dead', 'alive'], default: 'alive' },
  vote: { type: String, default: 'N/A' },
}, { _id: false });


const chatMessageSchema = new mongoose.Schema({
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });


const partyGameMafiaSchema = new mongoose.Schema({
  partyId: { type: String, required: true, unique: true },

  gamemode: { type: String, required: true },
  gameSettings: { type: String, required: true },
  selectedRoles: { type: String, required: true },

  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },

  players: { type: [playerSchema], required: true },

  userInstructions: { type: String },
  phase: { type: String, default: "lobby" },

  generalChat: { type: [chatMessageSchema], default: [] },
  mafiaChat: { type: [chatMessageSchema], default: [] },

  timer: { type: Date, default: null},
  shuffleSeed: { type: Number, required: true }
});

module.exports = mongoose.model('partyGameMafia', partyGameMafiaSchema, 'party-game-mafia');

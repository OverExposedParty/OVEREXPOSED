const mongoose = require('mongoose');

const OnlinePartySchema = new mongoose.Schema({
  partyId: { type: String, required: true },
  computerIds: { type: [String], required: true },
  gamemode: { type: String, required: true },
  usernames: { type: [String], required: true },
  gameSettings: { type: String, required: true },
  selectedPacks: { type: String, required: true },
  usersReady: { type: [Boolean], required: true },
  usersConfirmation: { type: [Boolean], required: true },
  userInstructions: { type: String, required: true },
  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  usersLastPing: { type: [Date], required: true },
  playerTurn: { type: Number, required: true },
  shuffleSeed: { type: Number, required: true },
  currentCardIndex: { type: Number, default: 0 },
});


module.exports = mongoose.model('OnlineParty', OnlinePartySchema, 'party-games');

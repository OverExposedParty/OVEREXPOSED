const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  username: { type: String, required: true },
  computerId: { type: String, required: true },
  userIcon: { type: String, required: true },
  isReady: { type: Boolean, default: false },
  hasConfirmed: { type: Boolean, default: false },
  lastPing: { type: Date, default: Date.now },
  socketId: { type: String, default: null }
}, { _id: false });

const WaitingRoomSchema = new mongoose.Schema({
  partyId: { type: String, required: true },
  gamemode: { type: String, required: true },
  isPlaying: { type: Boolean, required: true },
  lastPinged: { type: Date, default: Date.now },
  players: { type: [playerSchema], required: true },
  gameSettings: { type: String, required: true },
  selectedPacks: { type: String, required: false },
  selectedRoles: { type: String, required: false }
}, {
  versionKey: false
});

// Optional: remove _id and __v from response
WaitingRoomSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('WaitingRoom', WaitingRoomSchema, 'waiting-room');

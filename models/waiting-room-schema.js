const mongoose = require('mongoose');

const identitySchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    computerId: { type: String, required: true },
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

const playerStateSchema = new mongoose.Schema(
  {
    isReady: { type: Boolean, default: false },
    hasConfirmed: { type: Boolean, default: false }
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    identity: identitySchema,
    connection: connectionSchema,
    state: playerStateSchema
  },
  { _id: false }
);

const waitingRoomConfigSchema = new mongoose.Schema(
  {
    gamemode: { type: String, required: true },
    gameRules: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      required: true
    },
    selectedPacks: {
      type: [String],
      default: []
    },
    selectedRoles: {
      type: [String],
      default: []
    }
  },
  { _id: false }
);

const waitingRoomStateSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, required: true },
    lastPinged: { type: Date, default: Date.now },
    hostComputerId: { type: String, default: null },
    hostComputerIdList: { type: [String], default: [] }
  },
  { _id: false }
);

const WaitingRoomSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true, unique: true },
    config: waitingRoomConfigSchema,
    state: waitingRoomStateSchema,
    players: { type: [playerSchema], default: [] }
  },
  {
    versionKey: false
  }
);

WaitingRoomSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model(
  'WaitingRoom',
  WaitingRoomSchema,
  'waiting-room'
);

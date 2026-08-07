const mongoose = require('mongoose');
const partySessionMetadataSchema = require('./party-session-metadata-schema');
const partyGameErrorSchema = require('./party-game-error-schema');

const identitySchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    computerId: { type: String, required: true },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    guestIdHash: { type: String, select: false, default: null },
    partyOwnerIdHash: { type: String, select: false, default: null },
    accountLinkedAt: { type: Date, default: null },
    accountLinkSource: { type: String, default: null },
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
    hasConfirmed: { type: Boolean, default: false },
    participationStatus: {
      type: String,
      enum: ['active', 'reconnecting', 'disconnected', 'pending_next_round'],
      default: 'active'
    },
    reconnectDeadline: { type: Date, default: null }
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
    roleCounts: {
      type: Map,
      of: Number,
      default: () => ({})
    },
    userInstructions: { type: String, default: '' },
    shuffleSeed: { type: Number, default: null }
  },
  { _id: false }
);

const waitingRoomStateSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, required: true },
    phase: { type: String, default: 'lobby' },
    lastPinged: { type: Date, default: Date.now },
    hostComputerId: { type: String, default: null },
    hostComputerIdList: { type: [String], default: [] }
  },
  { _id: false }
);

const WaitingRoomSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true, unique: true },
    session: { type: partySessionMetadataSchema, default: () => ({}) },
    config: waitingRoomConfigSchema,
    state: waitingRoomStateSchema,
    players: { type: [playerSchema], default: [] },
    errors: { type: [partyGameErrorSchema], default: [] }
  },
  {
    versionKey: false,
    suppressReservedKeysWarning: true
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

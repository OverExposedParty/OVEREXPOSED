const mongoose = require('mongoose');
const partySessionMetadataSchema = require('./party-session-metadata-schema');
const partyGameErrorSchema = require('./party-game-error-schema');

const identitySchema = new mongoose.Schema(
  {
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

const playerStateSchema = new mongoose.Schema(
  {
    isReady: { type: Boolean, default: false },
    hasConfirmed: { type: Boolean, default: false },
    vote: { type: String, default: null },
    score: { type: Number, default: 0 },
    participationStatus: {
      type: String,
      enum: ['active', 'pending_next_round', 'reconnecting', 'disconnected'],
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

const configSchema = new mongoose.Schema(
  {
    gamemode: { type: String, required: true },
    gameRules: { type: Map, of: mongoose.Schema.Types.Mixed, required: true },
    selectedPacks: { type: [String], required: true },
    userInstructions: { type: String, default: '' },
    shuffleSeed: { type: Number, required: true }
  },
  { _id: false }
);

const stateSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, required: true },
    completedRounds: { type: Number, default: 0 },
    lastPinged: { type: Date, default: Date.now },
    playerTurn: { type: Number, required: true },
    playerTurnOrder: { type: [String], default: [] },
    timer: { type: Date, default: null },
    phase: { type: String, default: null },
    phaseData: { type: mongoose.Schema.Types.Mixed, default: null },
    achievementData: { type: mongoose.Schema.Types.Mixed, default: null },
    hostComputerId: { type: String, default: null },
    hostComputerIdList: { type: [String], default: [] },
    roundParticipantIds: { type: [String], default: [] },
    roundTimeline: {
      type: [
        {
          type: { type: String, required: true },
          at: { type: Date, default: Date.now },
          playerId: { type: String, default: null },
          playerName: { type: String, default: null },
          playerIcon: { type: String, default: null },
          targetIds: { type: [String], default: undefined },
          punishmentType: { type: String, default: null }
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const deckSchema = new mongoose.Schema(
  {
    currentCardIndex: { type: Number, default: 0 }
  },
  { _id: false }
);

const partyGameParanoiaSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true, unique: true },
    session: { type: partySessionMetadataSchema, default: () => ({}) },
    config: configSchema,
    state: stateSchema,
    deck: deckSchema,
    players: { type: [playerSchema], default: [] },
    errors: { type: [partyGameErrorSchema], default: [] }
  },
  { suppressReservedKeysWarning: true }
);

module.exports = mongoose.model(
  'partyGameParanoia',
  partyGameParanoiaSchema,
  'party-game-paranoia'
);

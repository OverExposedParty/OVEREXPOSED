const mongoose = require('mongoose');
const partySessionMetadataSchema = require('./party-session-metadata-schema');
const partyGameErrorSchema = require('./party-game-error-schema');

// --- Player sub-schemas ---

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

// --- Game-level sub-schemas ---

const configSchema = new mongoose.Schema(
  {
    gamemode: { type: String, required: true },
    gameRules: { type: Map, of: mongoose.Schema.Types.Mixed, required: true },
    selectedPacks: { type: [String], required: true },
    userInstructions: { type: String },
    shuffleSeed: { type: Number }
  },
  { _id: false }
);

const stateSchema = new mongoose.Schema(
  {
    isPlaying: { type: Boolean, required: true },
    lastPinged: { type: Date, default: Date.now },
    playerTurn: { type: Number, required: true },
    speakingRound: { type: Number },
    speakingPlayerTurn: { type: Number },
    // Legacy aliases retained only while existing in-progress parties migrate.
    round: { type: Number },
    roundPlayerTurn: { type: Number },
    completedRounds: { type: Number, default: 0 },
    roundParticipantIds: { type: [String], default: [] },
    roundTimeline: { type: [mongoose.Schema.Types.Mixed], default: [] },
    timer: { type: Date, default: null },
    phase: { type: String, default: null },
    phaseData: { type: mongoose.Schema.Types.Mixed, default: null },
    hostComputerId: { type: String, default: null },
    hostComputerIdList: { type: [String], default: [] }
  },
  { _id: false }
);

const deckSchema = new mongoose.Schema(
  {
    currentCardIndex: { type: Number, default: 0 },
    alternativeQuestionIndex: { type: Number, default: 0 }
  },
  { _id: false }
);

// --- Main schema ---

const partyGameImposterSchema = new mongoose.Schema(
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
  'partyGameImposter',
  partyGameImposterSchema,
  'party-game-imposter'
);

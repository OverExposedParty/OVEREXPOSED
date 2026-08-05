const mongoose = require('mongoose');
const partyGameErrorSchema = require('./party-game-error-schema');

const archivedPlayerSchema = new mongoose.Schema(
  {
    computerId: { type: String, default: null },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    username: { type: String, default: '' },
    isHost: { type: Boolean, default: false }
  },
  { _id: false }
);

const archivedRoomSchema = new mongoose.Schema(
  {
    partyId: { type: String, required: true, index: true },
    gameId: { type: String, required: true, unique: true },
    gamemode: { type: String, default: null, index: true },
    sourceCollection: { type: String, required: true },
    archivedAt: { type: Date, default: Date.now },
    session: {
      createdAt: { type: Date, default: null },
      endedAt: { type: Date, default: null },
      serverRegion: { type: String, default: null }
    },
    config: {
      selectedPacks: { type: [String], default: [] },
      roleCounts: { type: mongoose.Schema.Types.Mixed, default: {} },
      gameRules: { type: mongoose.Schema.Types.Mixed, default: {} },
      userInstructions: { type: String, default: '' }
    },
    state: {
      phase: { type: mongoose.Schema.Types.Mixed, default: null },
      phaseData: { type: mongoose.Schema.Types.Mixed, default: null },
      timer: { type: Date, default: null },
      userInstructions: { type: String, default: '' }
    },
    players: { type: [archivedPlayerSchema], default: [] },
    errors: { type: [partyGameErrorSchema], default: [] }
  },
  {
    versionKey: false,
    suppressReservedKeysWarning: true
  }
);

archivedRoomSchema.index({ archivedAt: -1 });
archivedRoomSchema.index({ gamemode: 1, archivedAt: -1 });

module.exports = mongoose.model(
  'ArchivedRoom',
  archivedRoomSchema,
  'archived-rooms'
);

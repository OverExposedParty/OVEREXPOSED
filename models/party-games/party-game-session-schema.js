const mongoose = require('mongoose');
const gameModeReleaseMetadataSchema = require('./game-mode-release-metadata-schema');

const partyGameSessionSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true, immutable: true },
    partyId: { type: String, required: true, index: true, immutable: true },
    gamemode: { type: String, required: true, index: true, immutable: true },
    gameModeRelease: {
      type: gameModeReleaseMetadataSchema,
      required: true,
      immutable: true
    },
    status: {
      type: String,
      enum: ['reserved', 'active', 'completed', 'released'],
      default: 'reserved',
      index: true
    },
    reservedAt: { type: Date, default: Date.now, immutable: true },
    activatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null }
  },
  { versionKey: false }
);

partyGameSessionSchema.index({ partyId: 1, reservedAt: -1 });
partyGameSessionSchema.index({ gamemode: 1, reservedAt: -1 });

module.exports = mongoose.model(
  'PartyGameSession',
  partyGameSessionSchema,
  'party-game-sessions'
);

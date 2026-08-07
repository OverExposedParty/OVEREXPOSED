const mongoose = require('mongoose');
const gameModeReleaseMetadataSchema = require('./game-mode-release-metadata-schema');

const partyGameErrorSchema = new mongoose.Schema(
  {
    occurredAt: { type: Date, default: Date.now },
    source: { type: String, default: 'server' },
    message: { type: String, default: '' },
    name: { type: String, default: '' },
    code: { type: String, default: '' },
    status: { type: Number, default: null },
    stack: { type: String, default: '' },
    route: { type: String, default: '' },
    method: { type: String, default: '' },
    action: { type: String, default: '' },
    actorId: { type: String, default: null },
    computerId: { type: String, default: null },
    username: { type: String, default: '' },
    socketId: { type: String, default: null },
    playerTurn: { type: Number, default: null },
    turnPlayerId: { type: String, default: null },
    phase: { type: String, default: null },
    instruction: { type: String, default: '' },
    gamemode: { type: String, default: null },
    gameModeRelease: {
      type: gameModeReleaseMetadataSchema,
      default: null
    },
    runtimeBuild: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

module.exports = partyGameErrorSchema;

const mongoose = require('mongoose');
const crypto = require('crypto');

function createFallbackGameId() {
  return `GAME-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

function getFallbackServerRegion() {
  return process.env.SERVER_REGION?.trim().toUpperCase() || 'LOCAL';
}

const partySessionMetadataSchema = new mongoose.Schema(
  {
    gameId: { type: String, default: createFallbackGameId },
    createdAt: { type: Date, default: Date.now },
    playSequence: { type: Number, min: 0, default: 0 },
    playtimeStartedAt: { type: Date, default: null },
    playtimeAccumulatedMilliseconds: { type: Number, min: 0, default: 0 },
    serverRegion: { type: String, default: getFallbackServerRegion },
    access: {
      originalHostAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null
      },
      originalHostComputerId: { type: String, default: null },
      createdAt: { type: Date, default: Date.now }
    }
  },
  { _id: false }
);

module.exports = partySessionMetadataSchema;

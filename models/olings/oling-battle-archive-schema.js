const mongoose = require('mongoose');

const { OLING_BATTLE_GAME_ID_PATTERN } = require('./oling-battle-game-id');
const {
  battleEventSchema,
  configSchema,
  playerSchema,
  stateSchema
} = require('./oling-battle-match-schema');

const { Schema } = mongoose;
const COMPLETION_STATUSES = Object.freeze([
  'completed',
  'abandoned',
  'lobby-closed'
]);

const olingBattleArchiveSchema = new Schema(
  {
    gameId: {
      type: String,
      required: true,
      immutable: true,
      match: OLING_BATTLE_GAME_ID_PATTERN
    },
    sourceMatchId: {
      type: Schema.Types.ObjectId,
      ref: 'OlingBattleMatch',
      required: true,
      immutable: true
    },
    matchCode: { type: String, required: true, trim: true, uppercase: true },
    completionStatus: {
      type: String,
      enum: COMPLETION_STATUSES,
      required: true,
      index: true
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, required: true },
    winnerAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    endReason: { type: String, trim: true, lowercase: true, default: null },
    config: { type: configSchema, required: true },
    players: { type: [playerSchema], default: [] },
    finalState: { type: stateSchema, required: true },
    events: { type: [battleEventSchema], default: [] },
    archivedAt: { type: Date, default: Date.now }
  },
  {
    versionKey: false,
    suppressReservedKeysWarning: true
  }
);

olingBattleArchiveSchema.index({ gameId: 1 }, { unique: true });
olingBattleArchiveSchema.index({ archivedAt: -1 });
olingBattleArchiveSchema.index({ 'players.accountId': 1, archivedAt: -1 });
olingBattleArchiveSchema.index({ matchCode: 1, archivedAt: -1 });

module.exports = mongoose.model(
  'OlingBattleArchive',
  olingBattleArchiveSchema,
  'oling-battle-archives'
);
module.exports.COMPLETION_STATUSES = COMPLETION_STATUSES;

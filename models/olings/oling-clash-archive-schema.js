const mongoose = require('mongoose');

const { OLING_CLASH_GAME_ID_PATTERN } = require('./oling-clash-game-id');
const {
  END_REASONS,
  clashEventSchema,
  playerSchema,
  rulesetReferenceSchema,
  statusDefinitionReferenceSchema
} = require('./oling-clash-match-schema');

const { Schema } = mongoose;
const COMPLETION_STATUSES = Object.freeze([
  'completed',
  'abandoned',
  'lobby-closed'
]);

const finalStateSchema = new Schema(
  {
    status: { type: String, required: true },
    phase: { type: String, required: true },
    round: { type: Number, min: 0, required: true },
    winnerAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    endReason: { type: String, enum: END_REASONS, default: null }
  },
  { _id: false }
);

const olingClashArchiveSchema = new Schema(
  {
    gameId: {
      type: String,
      required: true,
      immutable: true,
      match: OLING_CLASH_GAME_ID_PATTERN
    },
    sourceMatchId: {
      type: Schema.Types.ObjectId,
      ref: 'OlingClashMatch',
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
    endReason: { type: String, enum: END_REASONS, default: null },
    roundsPlayed: { type: Number, min: 0, required: true },
    ruleset: { type: rulesetReferenceSchema, required: true },
    statusDefinitions: {
      type: [statusDefinitionReferenceSchema],
      default: []
    },
    players: { type: [playerSchema], default: [] },
    finalState: { type: finalStateSchema, required: true },
    events: { type: [clashEventSchema], default: [] },
    archivedAt: { type: Date, default: Date.now }
  },
  { versionKey: false, suppressReservedKeysWarning: true }
);

olingClashArchiveSchema.index({ gameId: 1 }, { unique: true });
olingClashArchiveSchema.index({ archivedAt: -1 });
olingClashArchiveSchema.index({ 'players.accountId': 1, archivedAt: -1 });
olingClashArchiveSchema.index({ matchCode: 1, archivedAt: -1 });

module.exports = mongoose.model(
  'OlingClashArchive',
  olingClashArchiveSchema,
  'oling-clash-archives'
);
module.exports.COMPLETION_STATUSES = COMPLETION_STATUSES;
module.exports.finalStateSchema = finalStateSchema;

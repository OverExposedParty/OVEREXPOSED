const mongoose = require('mongoose');
const { Schema } = mongoose;

const overexposurePostSummarySchema = new Schema(
  {
    post: {
      postId: {
        type: Schema.Types.ObjectId,
        ref: 'OverexposurePost',
        required: true
      },
      publicId: { type: String, trim: true, required: true }
    },
    snapshot: {
      tag: {
        type: String,
        enum: ['confessions', 'stories', 'thoughts', 'feelings'],
        default: 'confessions'
      },
      title: { type: String, trim: true, maxlength: 120, default: null }
    },
    status: {
      createdAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null }
    },
    publicId: { type: String, trim: true, select: false }
  },
  { _id: false }
);

const overexposureSchema = new Schema(
  {
    postsCreated: { type: [overexposurePostSummarySchema], default: [] },
    postsDeleted: {
      type: [overexposurePostSummarySchema],
      select: false,
      default: []
    }
  },
  { _id: false }
);

const matchSummarySchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, required: true },
    gameMode: { type: String, trim: true, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    result: {
      type: String,
      enum: ['win', 'loss', 'draw', 'abandoned', 'unknown'],
      default: 'unknown'
    },
    role: { type: String, trim: true, default: null },
    score: { type: Number, default: 0 },
    players: { type: [Schema.Types.ObjectId], default: [] },
    packsOrRulesSelected: { type: [String], default: [] },
    roundsPlayed: { type: Number, min: 0, default: 0 },
    wasImposter: { type: Boolean, default: false },
    wonAsImposter: { type: Boolean, default: false },
    kicks: { type: Number, min: 0, default: 0 },
    bans: { type: Number, min: 0, default: 0 },
    disconnects: { type: Number, min: 0, default: 0 },
    abandonedAt: { type: Date, default: null },
    replayLogId: { type: Schema.Types.ObjectId, default: null },
    reportsCreated: { type: [Schema.Types.ObjectId], default: [] }
  },
  { _id: false }
);

module.exports = { overexposureSchema, matchSummarySchema };

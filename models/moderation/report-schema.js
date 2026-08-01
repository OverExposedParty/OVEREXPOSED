const mongoose = require('mongoose');

const { Schema } = mongoose;

const REPORT_SOURCES = ['overexposure', 'party_games'];
const REPORT_TARGET_TYPES = [
  'overexposure_post',
  'party_game_player',
  'party_game_chat_message',
  'party_game_room',
  'party_game_content',
  'account',
  'other'
];
const REPORT_REASONS = [
  'harassment',
  'hate_or_abuse',
  'violence_or_threats',
  'self_harm',
  'spam',
  'impersonation',
  'inappropriate_content',
  'other'
];
const REPORT_STATUSES = ['open', 'reviewing', 'dismissed', 'actioned'];
const REPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const actorSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    usernameSnapshot: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    },
    computerId: { type: String, trim: true, maxlength: 160, default: null },
    sessionId: { type: String, trim: true, maxlength: 160, default: null },
    ipHash: {
      type: String,
      trim: true,
      maxlength: 160,
      select: false,
      default: null
    }
  },
  { _id: false }
);

const targetSchema = new Schema(
  {
    type: { type: String, enum: REPORT_TARGET_TYPES, required: true },
    id: { type: String, trim: true, required: true },
    objectId: { type: Schema.Types.ObjectId, default: null },
    collectionName: { type: String, trim: true, maxlength: 120, default: null },
    labelSnapshot: { type: String, trim: true, maxlength: 160, default: null }
  },
  { _id: false }
);

const contextSchema = new Schema(
  {
    source: { type: String, enum: REPORT_SOURCES, required: true },
    postId: {
      type: Schema.Types.ObjectId,
      ref: 'OverexposurePost',
      default: null
    },
    postPublicId: { type: String, trim: true, maxlength: 120, default: null },
    partyId: { type: String, trim: true, maxlength: 80, default: null },
    gameId: { type: String, trim: true, maxlength: 120, default: null },
    gamemode: { type: String, trim: true, maxlength: 80, default: null },
    messageId: { type: String, trim: true, maxlength: 120, default: null },
    pageUrl: { type: String, trim: true, maxlength: 2000, default: null }
  },
  { _id: false }
);

const moderationSchema = new Schema(
  {
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    reviewedAt: { type: Date, default: null },
    actionTaken: { type: String, trim: true, maxlength: 160, default: null },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      select: false,
      default: null
    }
  },
  { _id: false }
);

const systemSchema = new Schema(
  {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ReportSchema = new Schema(
  {
    target: { type: targetSchema, required: true },
    reporter: { type: actorSchema, default: () => ({}) },
    reportedUser: { type: actorSchema, default: () => ({}) },
    context: { type: contextSchema, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 3000, default: '' },
    status: { type: String, enum: REPORT_STATUSES, default: 'open' },
    priority: { type: String, enum: REPORT_PRIORITIES, default: 'normal' },
    moderation: { type: moderationSchema, default: () => ({}) },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    system: { type: systemSchema, default: () => ({}) }
  },
  { timestamps: false }
);

ReportSchema.pre('validate', function normalizeReportTarget(next) {
  if (this.target?.objectId && !this.target.id) {
    this.target.id = String(this.target.objectId);
  }

  if (this.context?.postId && !this.target?.objectId) {
    this.target.objectId = this.context.postId;
  }

  next();
});

ReportSchema.pre('save', function setReportTimestamps(next) {
  const now = new Date();

  if (!this.system) {
    this.system = {};
  }

  if (!this.system.createdAt) {
    this.system.createdAt = now;
  }

  this.system.updatedAt = now;
  next();
});

ReportSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setReportUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

ReportSchema.index({ status: 1, priority: -1, 'system.createdAt': -1 });
ReportSchema.index({ 'context.source': 1, status: 1, 'system.createdAt': -1 });
ReportSchema.index({ 'target.type': 1, 'target.id': 1, status: 1 });
ReportSchema.index({ 'context.postId': 1, 'system.createdAt': -1 });
ReportSchema.index({ 'context.partyId': 1, 'system.createdAt': -1 });
ReportSchema.index({ 'reporter.accountId': 1, 'system.createdAt': -1 });
ReportSchema.index({ 'reportedUser.accountId': 1, 'system.createdAt': -1 });
ReportSchema.index(
  { 'target.type': 1, 'target.id': 1, 'reporter.accountId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'reporter.accountId': { $type: 'objectId' }
    }
  }
);
ReportSchema.index(
  { 'target.type': 1, 'target.id': 1, 'reporter.computerId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'reporter.computerId': { $type: 'string' }
    }
  }
);

ReportSchema.statics.SOURCES = REPORT_SOURCES;
ReportSchema.statics.TARGET_TYPES = REPORT_TARGET_TYPES;
ReportSchema.statics.REASONS = REPORT_REASONS;
ReportSchema.statics.STATUSES = REPORT_STATUSES;
ReportSchema.statics.PRIORITIES = REPORT_PRIORITIES;

module.exports = mongoose.model('Report', ReportSchema, 'reports');

const mongoose = require('mongoose');

const { Schema } = mongoose;

const SOCIAL_PLATFORMS = ['tiktok', 'instagram', 'youtube-shorts', 'x'];
const SOCIAL_CONTENT_STATUSES = [
  'idea',
  'draft',
  'ready',
  'scheduled',
  'uploaded'
];

const socialContentLogSchema = new Schema(
  {
    action: { type: String, trim: true, maxlength: 120, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const SocialContentItemSchema = new Schema(
  {
    platforms: {
      type: [{ type: String, enum: SOCIAL_PLATFORMS }],
      default: []
    },
    status: {
      type: String,
      enum: SOCIAL_CONTENT_STATUSES,
      default: 'idea',
      index: true
    },
    type: { type: String, trim: true, maxlength: 160, default: '' },
    idea: {
      title: { type: String, trim: true, maxlength: 160, default: '' },
      hook: { type: String, trim: true, maxlength: 500, default: '' },
      angle: { type: String, trim: true, maxlength: 500, default: '' },
      prompt: { type: String, trim: true, maxlength: 5000, default: '' },
      notes: { type: String, trim: true, maxlength: 5000, default: '' },
      sourceType: { type: String, trim: true, maxlength: 80, default: '' },
      sourceId: { type: Schema.Types.ObjectId, default: null },
      sourceUrl: { type: String, trim: true, maxlength: 2000, default: '' }
    },
    content: {
      caption: { type: String, trim: true, maxlength: 5000, default: '' },
      script: { type: String, trim: true, maxlength: 12000, default: '' },
      hashtags: { type: [String], default: [] },
      callToAction: { type: String, trim: true, maxlength: 500, default: '' },
      generatedText: { type: String, trim: true, maxlength: 12000, default: '' }
    },
    schedule: {
      plannedFor: { type: Date, default: null },
      postTime: { type: String, trim: true, maxlength: 10, default: '' },
      timezone: { type: String, trim: true, maxlength: 80, default: 'UTC' },
      completedAt: { type: Date, default: null }
    },
    log: { type: [socialContentLogSchema], default: [] },
    system: {
      createdBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      archivedAt: { type: Date, default: null }
    }
  },
  { timestamps: false }
);

SocialContentItemSchema.pre('save', function setSocialContentTimestamps(next) {
  const now = new Date();

  if (!Array.isArray(this.platforms) || this.platforms.length === 0) {
    this.platforms = [];
  } else {
    this.platforms = [...new Set(this.platforms.filter(Boolean))];
  }

  if (!this.system) {
    this.system = {};
  }

  if (!this.system.createdAt) {
    this.system.createdAt = now;
  }

  this.system.updatedAt = now;
  next();
});

SocialContentItemSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setSocialContentUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

SocialContentItemSchema.index({ 'schedule.plannedFor': 1 });
SocialContentItemSchema.index({ platforms: 1, 'schedule.plannedFor': 1 });
SocialContentItemSchema.index({ status: 1, 'schedule.plannedFor': 1 });
SocialContentItemSchema.index({ 'system.createdAt': -1 });

SocialContentItemSchema.statics.PLATFORMS = SOCIAL_PLATFORMS;
SocialContentItemSchema.statics.STATUSES = SOCIAL_CONTENT_STATUSES;

module.exports = mongoose.model(
  'SocialContentItem',
  SocialContentItemSchema,
  'social-content-items'
);

const mongoose = require('mongoose');

const TAGS = ['confessions', 'stories', 'thoughts', 'feelings'];

const OverexposurePostSchema = new mongoose.Schema(
  {
    public: {
      id: { type: String, trim: true, required: true, index: true },
      tag: {
        type: String,
        enum: TAGS,
        default: 'confessions'
      },
      visibility: {
        type: String,
        enum: ['public', 'hidden', 'deleted'],
        default: 'public'
      }
    },
    content: {
      title: { type: String, trim: true, default: '' },
      text: { type: String, trim: true, default: '' }
    },
    author: {
      accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        default: null,
        index: true
      },
      usernameSnapshot: {
        type: String,
        trim: true,
        default: null
      },
      isAnonymous: {
        type: Boolean,
        default: true
      },
      icon: {
        type: String,
        default: '0000:0100:0200:0300'
      }
    },
    placement: {
      x: { type: Number, required: true },
      y: { type: Number, required: true }
    },
    lifecycle: {
      postedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date, default: null },
      hiddenAt: { type: Date, default: null }
    },
    security: {
      deleteCodeHash: { type: String, required: true, select: false }
    },
    system: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    },
    createdAt: { type: Date, select: false },
    updatedAt: { type: Date, select: false },
    title: { type: String, select: false },
    text: { type: String, select: false },
    id: { type: String, trim: true, select: false },
    date: { type: String, select: false },
    userIcon: { type: String, select: false },
    x: { type: String, select: false },
    y: { type: String, select: false },
    tag: { type: String, select: false },
    visibility: { type: String, select: false },
    deleteCodeHash: { type: String, select: false }
  },
  { timestamps: false }
);

OverexposurePostSchema.pre('save', function setSystemTimestamps(next) {
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

OverexposurePostSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setSystemUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

module.exports = mongoose.model(
  'OverexposurePost',
  OverexposurePostSchema,
  'overexposure-posts'
);

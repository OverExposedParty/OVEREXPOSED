const mongoose = require('mongoose');

const { Schema } = mongoose;

const EMAIL_SUPPRESSION_REASONS = [
  'unsubscribed',
  'bounced',
  'complaint',
  'blocked',
  'manual'
];
const EMAIL_SUPPRESSION_SOURCES = ['user', 'provider', 'admin', 'system'];

const emailSuppressionSchema = new Schema(
  {
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      required: true
    },
    reason: {
      type: String,
      enum: EMAIL_SUPPRESSION_REASONS,
      default: 'manual'
    },
    source: {
      type: String,
      enum: EMAIL_SUPPRESSION_SOURCES,
      default: 'admin'
    },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    createdAt: { type: Date, default: Date.now },
    removedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    removedAt: { type: Date, default: null }
  },
  { timestamps: false, versionKey: false }
);

emailSuppressionSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { removedAt: null },
    name: 'email_suppression_active_email_unique'
  }
);
emailSuppressionSchema.index({ createdAt: -1, removedAt: 1 });

emailSuppressionSchema.statics.REASONS = EMAIL_SUPPRESSION_REASONS;
emailSuppressionSchema.statics.SOURCES = EMAIL_SUPPRESSION_SOURCES;

module.exports = mongoose.model(
  'EmailSuppression',
  emailSuppressionSchema,
  'email-suppressions'
);

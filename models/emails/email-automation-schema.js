const mongoose = require('mongoose');
const {
  EMAIL_AUTOMATION_STATUSES,
  EMAIL_AUTOMATION_TRIGGERS
} = require('./email-automation-constants');

const { Schema } = mongoose;

const emailAutomationSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 160, required: true },
    trigger: {
      type: String,
      enum: EMAIL_AUTOMATION_TRIGGERS,
      required: true
    },
    templateKey: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      match: /^[a-z0-9][a-z0-9-]*$/,
      required: true
    },
    status: {
      type: String,
      enum: EMAIL_AUTOMATION_STATUSES,
      default: 'active'
    },
    systemManaged: { type: Boolean, default: false },
    system: {
      createdBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      archivedAt: { type: Date, default: null }
    }
  },
  { timestamps: false, versionKey: false }
);

emailAutomationSchema.pre('save', function setEmailAutomationTimestamps(next) {
  const now = new Date();
  if (!this.system) this.system = {};
  if (!this.system.createdAt) this.system.createdAt = now;
  this.system.updatedAt = now;
  next();
});

emailAutomationSchema.index(
  { trigger: 1 },
  {
    unique: true,
    partialFilterExpression: { 'system.archivedAt': null },
    name: 'email_automation_trigger_unique'
  }
);
emailAutomationSchema.index({ status: 1, 'system.updatedAt': -1 });

emailAutomationSchema.statics.TRIGGERS = EMAIL_AUTOMATION_TRIGGERS;
emailAutomationSchema.statics.STATUSES = EMAIL_AUTOMATION_STATUSES;

module.exports = mongoose.model(
  'EmailAutomation',
  emailAutomationSchema,
  'email-automations'
);

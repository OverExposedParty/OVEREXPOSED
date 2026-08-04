const mongoose = require('mongoose');
const {
  EMAIL_AUDIENCE_CONDITION_FIELDS,
  EMAIL_AUDIENCE_CONDITION_OPERATORS,
  EMAIL_AUDIENCE_MATCH_MODES,
  EMAIL_AUDIENCE_STATUSES,
  EMAIL_AUDIENCE_TYPES
} = require('./email-audience-constants');

const { Schema } = mongoose;

const emailAudienceConditionSchema = new Schema(
  {
    field: {
      type: String,
      enum: EMAIL_AUDIENCE_CONDITION_FIELDS,
      required: true
    },
    operator: {
      type: String,
      enum: EMAIL_AUDIENCE_CONDITION_OPERATORS,
      required: true
    },
    value: { type: Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const emailAudienceSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 160, required: true },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    type: { type: String, enum: EMAIL_AUDIENCE_TYPES, default: 'dynamic' },
    status: {
      type: String,
      enum: EMAIL_AUDIENCE_STATUSES,
      default: 'active'
    },
    match: {
      type: String,
      enum: EMAIL_AUDIENCE_MATCH_MODES,
      default: 'all'
    },
    requireMarketingConsent: { type: Boolean, default: true },
    conditions: {
      type: [emailAudienceConditionSchema],
      validate: {
        validator: (conditions) => conditions.length <= 20,
        message: 'An audience can contain no more than 20 conditions'
      },
      default: []
    },
    recipientIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Account' }],
      validate: {
        validator: (recipientIds) => recipientIds.length <= 100000,
        message: 'An audience can contain no more than 100000 recipients'
      },
      default: []
    },
    estimatedRecipients: { type: Number, min: 0, default: 0 },
    lastEvaluatedAt: { type: Date, default: null },
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

emailAudienceSchema.index({ status: 1, 'system.updatedAt': -1 });
emailAudienceSchema.index({ type: 1, 'system.archivedAt': 1 });

emailAudienceSchema.statics.TYPES = EMAIL_AUDIENCE_TYPES;
emailAudienceSchema.statics.STATUSES = EMAIL_AUDIENCE_STATUSES;
emailAudienceSchema.statics.MATCH_MODES = EMAIL_AUDIENCE_MATCH_MODES;
emailAudienceSchema.statics.CONDITION_FIELDS = EMAIL_AUDIENCE_CONDITION_FIELDS;
emailAudienceSchema.statics.CONDITION_OPERATORS =
  EMAIL_AUDIENCE_CONDITION_OPERATORS;

module.exports = mongoose.model(
  'EmailAudience',
  emailAudienceSchema,
  'email-audiences'
);

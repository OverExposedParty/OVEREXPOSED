const mongoose = require('mongoose');
const {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_RETENTION_DAYS
} = require('./analytics-event-contract');

const { Schema } = mongoose;

const analyticsContextSchema = new Schema(
  {
    pagePath: { type: String, trim: true, maxlength: 500, default: null },
    gameMode: { type: String, trim: true, maxlength: 80, default: null },
    playMode: {
      type: String,
      enum: ['offline', 'online', 'website', null],
      default: null
    },
    timezoneOffsetMinutes: {
      type: Number,
      min: -14 * 60,
      max: 14 * 60,
      default: null
    }
  },
  { _id: false }
);

const analyticsEventSchema = new Schema(
  {
    eventId: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 100,
      required: true
    },
    eventName: {
      type: String,
      enum: ANALYTICS_EVENT_NAMES,
      required: true
    },
    schemaVersion: { type: Number, min: 1, max: 10, default: 1 },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    anonymousIdHash: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null
    },
    sessionIdHash: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null
    },
    context: { type: analyticsContextSchema, default: () => ({}) },
    properties: { type: Schema.Types.Mixed, default: () => ({}) },
    occurredAt: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () =>
        new Date(Date.now() + ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    }
  },
  { versionKey: false }
);

analyticsEventSchema.index({ eventId: 1 }, { unique: true });
analyticsEventSchema.index({ eventName: 1, occurredAt: -1 });
analyticsEventSchema.index({ 'context.gameMode': 1, occurredAt: -1 });
analyticsEventSchema.index({ accountId: 1, occurredAt: -1 });
analyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  'AnalyticsEvent',
  analyticsEventSchema,
  'analytics-events'
);

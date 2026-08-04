const mongoose = require('mongoose');
const { CONSENT_STATUSES } = require('./constants');
const { Schema } = mongoose;

const conversionEventSchema = new Schema(
  {
    event: { type: String, trim: true, required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const experimentAssignmentSchema = new Schema(
  {
    key: { type: String, trim: true, required: true },
    variant: { type: String, trim: true, required: true },
    assignedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const signupContextSchema = new Schema(
  {
    referrerPath: { type: String, trim: true, maxlength: 2000, default: null },
    referrerUrl: { type: String, trim: true, maxlength: 2000, default: null },
    source: { type: String, trim: true, maxlength: 80, default: null },
    capturedAt: { type: Date, default: null }
  },
  { _id: false }
);

const analyticsSchema = new Schema(
  {
    featureUsage: { type: Map, of: Number, default: () => new Map() },
    pagesVisitedInsideApp: { type: [String], default: [] },
    shopBrowsingBehaviour: { type: Schema.Types.Mixed, default: () => ({}) },
    gameModePreferences: { type: Map, of: Number, default: () => new Map() },
    conversionEvents: { type: [conversionEventSchema], default: [] },
    notificationEngagement: { type: Schema.Types.Mixed, default: () => ({}) },
    abGroupTesting: { type: [experimentAssignmentSchema], default: [] },
    experimentsAssigned: { type: [experimentAssignmentSchema], default: [] },
    featureFlagsAssigned: { type: [String], default: [] },
    referralSource: { type: String, trim: true, default: null },
    firstLandingPage: { type: String, trim: true, default: null },
    utm: { type: Schema.Types.Mixed, default: () => ({}) },
    cohortDate: { type: Date, default: null },
    retentionMarkers: { type: Schema.Types.Mixed, default: () => ({}) },
    searchQueries: { type: [String], default: [] },
    signupContext: { type: signupContextSchema, default: null },
    lastSeenAt: { type: Date, default: null }
  },
  { _id: false }
);

const consentRecordSchema = new Schema(
  {
    type: { type: String, trim: true, required: true },
    version: { type: String, trim: true, required: true },
    status: { type: String, enum: CONSENT_STATUSES, default: 'accepted' },
    recordedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    withdrawnAt: { type: Date, default: null },
    source: { type: String, trim: true, maxlength: 50, default: null },
    ipAddress: { type: String, trim: true, select: false, default: null },
    userAgent: { type: String, trim: true, select: false, default: null }
  },
  { _id: false }
);

const dataRequestSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['export', 'deletion', 'correction'],
      required: true
    },
    status: { type: String, trim: true, default: 'requested' },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null }
  },
  { _id: false }
);

const legalConsentSchema = new Schema(
  {
    termsAcceptedVersion: { type: String, trim: true, default: null },
    privacyPolicyAcceptedVersion: { type: String, trim: true, default: null },
    cookieConsentPreferences: { type: Schema.Types.Mixed, default: () => ({}) },
    marketingConsentStatus: {
      type: String,
      enum: CONSENT_STATUSES,
      default: 'declined'
    },
    marketingConsentTimestamp: { type: Date, default: null },
    consentHistory: { type: [consentRecordSchema], select: false, default: [] },
    dataExportRequests: {
      type: [dataRequestSchema],
      select: false,
      default: []
    },
    accountDeletionRequests: {
      type: [dataRequestSchema],
      select: false,
      default: []
    },
    ageConfirmation: { type: Boolean, default: false },
    ageConfirmedAt: { type: Date, default: null },
    guardianConsent: {
      type: consentRecordSchema,
      select: false,
      default: null
    },
    dataProcessingRegion: { type: String, trim: true, default: null }
  },
  { _id: false }
);

module.exports = { analyticsSchema, legalConsentSchema };

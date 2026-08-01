const mongoose = require('mongoose');
const { ACCOUNT_STATUSES, LOGIN_PROVIDERS } = require('./constants');
const { Schema } = mongoose;

const providerSchema = new Schema(
  {
    name: { type: String, enum: LOGIN_PROVIDERS, default: 'email' },
    providerUserId: { type: String, trim: true, default: null },
    linkedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const notificationPreferencesSchema = new Schema(
  {
    marketingEmail: { type: Boolean, default: false },
    accountEmail: { type: Boolean, default: true },
    shopEmail: { type: Boolean, default: true },
    gameEmail: { type: Boolean, default: true },
    push: { type: Boolean, default: false }
  },
  { _id: false }
);

const privacySettingsSchema = new Schema(
  {
    profileVisibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    showGameStats: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    allowFriendRequests: { type: Boolean, default: true }
  },
  { _id: false }
);

const sitePreferencesSchema = new Schema(
  {
    soundEnabled: { type: Boolean, default: true },
    nsfwEnabled: { type: Boolean, default: false },
    consoleEnabled: { type: Boolean, default: false }
  },
  { _id: false }
);

const customisationPreferencesSchema = new Schema(
  {
    showLockedOes: { type: Boolean, default: true },
    disabledOes: { type: [String], default: [] },
    disabledPacks: { type: [String], default: [] }
  },
  { _id: false }
);

const profileHistorySchema = new Schema(
  {
    value: { type: String, trim: true, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null }
  },
  { _id: false }
);

const coreProfileSchema = new Schema(
  {
    displayName: { type: String, trim: true, maxlength: 60, default: null },
    oeIcon: { type: String, trim: true, default: null },
    avatarUrl: { type: String, trim: true, default: null },
    profileBannerUrl: { type: String, trim: true, default: null },
    country: { type: String, trim: true, uppercase: true, maxlength: 2 },
    preferredLanguage: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 12,
      default: 'en'
    },
    dateOfBirth: { type: Date, select: false, default: null },
    ageBracket: { type: String, trim: true, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    accountStatus: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: 'pending_verification'
    },
    suspensionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },
    suspensionExpiresAt: { type: Date, default: null },
    deletionRequestedAt: { type: Date, default: null },
    deletionScheduledAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastProfileUpdatedAt: { type: Date, default: null },
    loginProviders: {
      type: [providerSchema],
      default: () => [{ name: 'email' }]
    },
    usernameHistory: { type: [profileHistorySchema], default: [] },
    emailHistory: { type: [profileHistorySchema], select: false, default: [] },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({})
    },
    privacySettings: { type: privacySettingsSchema, default: () => ({}) },
    sitePreferences: { type: sitePreferencesSchema, default: () => ({}) }
  },
  { _id: false }
);

module.exports = { providerSchema, customisationPreferencesSchema, profileHistorySchema, coreProfileSchema };

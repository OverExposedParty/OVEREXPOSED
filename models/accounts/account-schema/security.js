const mongoose = require('mongoose');
const { LOGIN_PROVIDERS } = require('./constants');
const { profileHistorySchema } = require('./identity');
const { Schema } = mongoose;

const deviceInfoSchema = new Schema(
  {
    userAgent: { type: String, trim: true, select: false, default: null },
    browser: { type: String, trim: true, default: null },
    os: { type: String, trim: true, default: null },
    deviceType: { type: String, trim: true, default: null },
    fingerprintHash: { type: String, select: false, default: null }
  },
  { _id: false }
);

const loginEventSchema = new Schema(
  {
    provider: { type: String, enum: LOGIN_PROVIDERS, default: 'email' },
    ipAddress: { type: String, trim: true, select: false, default: null },
    ipHash: { type: String, select: false, default: null },
    approximateLocation: { type: String, trim: true, default: null },
    device: { type: deviceInfoSchema, default: () => ({}) },
    successful: { type: Boolean, default: true },
    failureReason: { type: String, trim: true, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const passwordResetSchema = new Schema(
  {
    tokenHash: { type: String, select: false, default: null },
    requestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    ipAddress: { type: String, trim: true, select: false, default: null }
  },
  { _id: false }
);

const emailVerificationSchema = new Schema(
  {
    tokenHash: { type: String, select: false, default: null },
    requestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    ipAddress: { type: String, trim: true, select: false, default: null }
  },
  { _id: false }
);

const emailChangeRequestSchema = new Schema(
  {
    tokenHash: { type: String, select: false, default: null },
    requestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    ipAddress: { type: String, trim: true, select: false, default: null }
  },
  { _id: false }
);

const sessionSchema = new Schema(
  {
    sessionId: { type: String, trim: true, default: null },
    tokenHash: { type: String, select: false, required: true },
    refreshTokenHash: { type: String, select: false, default: null },
    device: { type: deviceInfoSchema, default: () => ({}) },
    ipAddress: { type: String, trim: true, select: false, default: null },
    approximateLocation: { type: String, trim: true, default: null },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const securitySchema = new Schema(
  {
    loginHistory: { type: [loginEventSchema], select: false, default: [] },
    ipAddressesUsed: { type: [String], select: false, default: [] },
    ipHashesUsed: { type: [String], select: false, default: [] },
    deviceBrowserInfo: { type: [deviceInfoSchema], select: false, default: [] },
    failedLoginAttempts: { type: Number, min: 0, default: 0 },
    lockoutExpiresAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    passwordResetRequests: {
      type: [passwordResetSchema],
      select: false,
      default: []
    },
    emailVerification: {
      type: emailVerificationSchema,
      select: false,
      default: () => ({})
    },
    emailChangeRequest: {
      type: emailChangeRequestSchema,
      select: false,
      default: () => ({})
    },
    emailChangeHistory: {
      type: [profileHistorySchema],
      select: false,
      default: []
    },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecretHash: { type: String, select: false, default: null },
    twoFactorBackupCodeHashes: { type: [String], select: false, default: [] },
    trustedDevices: { type: [deviceInfoSchema], select: false, default: [] },
    sessions: { type: [sessionSchema], select: false, default: [] },
    suspiciousActivityFlag: { type: Boolean, default: false },
    compromisedPasswordFlag: { type: Boolean, default: false },
    securityNotificationsSent: { type: [String], select: false, default: [] }
  },
  { _id: false }
);

module.exports = { securitySchema };

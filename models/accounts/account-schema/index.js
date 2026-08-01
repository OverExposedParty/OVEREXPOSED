const mongoose = require('mongoose');
const { Schema } = mongoose;
const {
  coreProfileSchema,
  customisationPreferencesSchema
} = require('./identity');
const { shopSchema } = require('./commerce');
const { accountOlingsSchema } = require('./olings');
const { gameDataSchema } = require('./progression');
const { overexposureSchema, matchSummarySchema } = require('./platform');
const { adminSchema, accessSchema } = require('./admin');
const { securitySchema } = require('./security');
const { analyticsSchema, legalConsentSchema } = require('./governance');
const {
  finalizeQueuedAchievementClaims
} = require('../achievement-reward-claim-queue');

const accountSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-z0-9_.-]+$/,
      unique: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      default: null
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    profile: { type: coreProfileSchema, default: () => ({}) },
    customisationPreferences: {
      type: customisationPreferencesSchema,
      default: () => ({})
    },
    shop: { type: shopSchema, default: () => ({}) },
    olings: { type: accountOlingsSchema, default: () => ({}) },
    gameData: { type: gameDataSchema, default: () => ({}) },
    overexposure: { type: overexposureSchema, default: () => ({}) },
    matchHistory: { type: [matchSummarySchema], default: [] },
    admin: { type: adminSchema, default: () => ({}) },
    access: { type: accessSchema, default: () => ({}) },
    security: { type: securitySchema, select: false, default: () => ({}) },
    analytics: { type: analyticsSchema, default: () => ({}) },
    legalConsent: { type: legalConsentSchema, default: () => ({}) }
  },
  {
    timestamps: true
  }
);

accountSchema.index(
  { email: 1 },
  {
    name: 'account_email_unique',
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } }
  }
);
accountSchema.index({ 'profile.accountStatus': 1 });
accountSchema.index({ 'profile.lastLoginAt': -1 });
accountSchema.index({ 'shop.orderHistory.orderId': 1 });
accountSchema.index({ 'gameData.friendsAndBlockedUsers.accountId': 1 });
accountSchema.index({ 'gameData.notifications.createdAt': -1 });
accountSchema.index({ 'gameData.inGamePurchasesAndUnlocks.key': 1 });
accountSchema.index({ 'gameData.opalTransactions.createdAt': -1 });
accountSchema.index({ 'overexposure.postsCreated.post.postId': 1 });
accountSchema.index({ 'matchHistory.matchId': 1 });
accountSchema.index({ 'analytics.lastSeenAt': -1 });

accountSchema.post('save', async function finalizeAchievementClaims() {
  await finalizeQueuedAchievementClaims({ account: this });
});

module.exports = mongoose.model('Account', accountSchema, 'accounts');

const mongoose = require('mongoose');
const {
  friendRelationshipSchema,
  reportSummarySchema,
  partyNotificationSchema,
  accountNotificationSchema,
  friendNotificationStateSchema,
  gameModeSettingsSchema
} = require('./social');
const { olingInventorySchema, olingLabSchema } = require('./olings');
const { Schema } = mongoose;

const opalWalletSchema = new Schema(
  {
    balance: { type: Number, min: 0, default: 0 },
    lifetimeEarned: { type: Number, min: 0, default: 0 },
    lifetimeSpent: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const opalTransactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['earn', 'spend', 'refund', 'admin_adjustment', 'purchase'],
      required: true
    },
    amount: { type: Number, required: true },
    reason: { type: String, trim: true, maxlength: 200, default: null },
    sourceType: {
      type: String,
      enum: [
        'achievement',
        'daily_reward',
        'shop_purchase',
        'admin',
        'game_reward',
        'refund',
        'system'
      ],
      default: 'system'
    },
    sourceId: { type: String, trim: true, default: null },
    balanceAfter: { type: Number, min: 0, required: true },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    notificationId: { type: String, trim: true, default: null },
    notificationPending: { type: Boolean, default: false },
    notificationDeliveredAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const unlockSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        'oe',
        'pack',
        'cosmetic',
        'achievement',
        'badge',
        'oling_egg',
        'oling_consumable',
        'oling_headwear',
        'oling_furniture'
      ],
      required: true
    },
    key: { type: String, trim: true, required: true },
    source: { type: String, trim: true, default: null },
    gamemode: { type: String, trim: true, default: null },
    partyId: { type: String, trim: true, default: null },
    progressAtUnlock: { type: Number, min: 0, default: null },
    unlockedAt: { type: Date, default: Date.now },
    notificationId: { type: String, trim: true, default: null },
    notificationPending: { type: Boolean, default: false },
    notifiedAt: { type: Date, default: null },
    seenAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    rewardGranted: { type: Boolean, default: false },
    rewardStatus: {
      type: String,
      enum: ['none', 'granted', 'partial', 'failed'],
      default: 'none'
    },
    rewardResults: { type: [Schema.Types.Mixed], default: undefined },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const perGameStatsSchema = new Schema(
  {
    gameMode: { type: String, trim: true, required: true },
    gamesPlayed: { type: Number, min: 0, default: 0 },
    roundsPlayed: { type: Number, min: 0, default: 0 },
    imposterWins: { type: Number, min: 0, default: 0 },
    imposterGames: { type: Number, min: 0, default: 0 },
    totalPlaytimeSeconds: { type: Number, min: 0, default: 0 },
    lastPlayedAt: { type: Date, default: null },
    favouritePack: { type: String, trim: true, default: null },
    packPlayCounts: { type: Schema.Types.Mixed, default: () => ({}) },
    stats: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const gameDataSchema = new Schema(
  {
    gamesPlayed: { type: Number, min: 0, default: 0 },
    roundsPlayed: { type: Number, min: 0, default: 0 },
    totalPlaytimeSeconds: { type: Number, min: 0, default: 0 },
    level: { type: Number, min: 1, default: 1 },
    xp: { type: Number, min: 0, default: 0 },
    rank: { type: String, trim: true, default: null },
    streaks: { type: Schema.Types.Mixed, default: () => ({}) },
    lastActiveGameMode: { type: String, trim: true, default: null },
    lastPlayedAt: { type: Date, default: null },
    achievementStats: { type: Schema.Types.Mixed, default: () => ({}) },
    perGameStats: { type: [perGameStatsSchema], default: [] },
    matchHistory: { type: [Schema.Types.ObjectId], default: [] },
    partyLobbyHistory: { type: [Schema.Types.ObjectId], default: [] },
    friendsAndBlockedUsers: { type: [friendRelationshipSchema], default: [] },
    friendNotificationStates: {
      type: [friendNotificationStateSchema],
      default: []
    },
    notifications: { type: [accountNotificationSchema], default: [] },
    partyNotifications: { type: [partyNotificationSchema], default: [] },
    reports: { type: [reportSummarySchema], default: [] },
    moderationFlags: { type: [String], select: false, default: [] },
    moderationStrikes: { type: Number, min: 0, default: 0 },
    reputationScore: { type: Number, min: 0, max: 100, default: 100 },
    muteCooldownExpiresAt: { type: Date, default: null },
    reportCooldownExpiresAt: { type: Date, default: null },
    customGameSettings: { type: [gameModeSettingsSchema], default: [] },
    opals: { type: opalWalletSchema, default: () => ({}) },
    opalTransactions: { type: [opalTransactionSchema], default: [] },
    olingInventory: { type: olingInventorySchema, default: undefined },
    olingLab: { type: olingLabSchema, default: undefined },
    inGamePurchasesAndUnlocks: { type: [unlockSchema], default: [] },
    achievements: { type: [unlockSchema], default: [] },
    customContentCreated: { type: [Schema.Types.ObjectId], default: [] }
  },
  { _id: false }
);

module.exports = {
  opalWalletSchema,
  opalTransactionSchema,
  unlockSchema,
  perGameStatsSchema,
  gameDataSchema
};

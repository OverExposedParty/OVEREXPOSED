const mongoose = require('mongoose');
const { Schema } = mongoose;

const friendRelationshipSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    status: {
      type: String,
      enum: ['pending_sent', 'pending_received', 'friends', 'blocked'],
      required: true
    },
    reason: { type: String, trim: true, maxlength: 300, default: null },
    createdAt: { type: Date, default: Date.now },
    notificationType: {
      type: String,
      enum: [
        'friend_request',
        'friend_accepted',
        'session_invite',
        'session_invite_declined'
      ],
      default: null
    },
    notificationLobbyPath: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null
    },
    notificationSessionType: {
      type: String,
      enum: ['party_game', 'oling_battle'],
      default: null
    },
    notificationSessionKey: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null
    },
    notificationSessionCode: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null
    },
    notificationDeliveredAt: { type: Date, default: null }
  },
  { _id: false }
);

const reportSummarySchema = new Schema(
  {
    reportId: { type: Schema.Types.ObjectId, default: null },
    matchId: { type: Schema.Types.ObjectId, default: null },
    direction: {
      type: String,
      enum: ['submitted', 'received'],
      required: true
    },
    reason: { type: String, trim: true, maxlength: 300, default: null },
    status: { type: String, trim: true, default: 'open' },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const partyNotificationSchema = new Schema(
  {
    notificationId: {
      type: String,
      trim: true,
      required: true
    },
    type: {
      type: String,
      enum: [
        'party_player_joined',
        'party_player_kicked',
        'party_player_disconnected',
        'party_player_reconnected',
        'party_disbanded'
      ],
      required: true
    },
    partyId: { type: String, trim: true, maxlength: 20, default: null },
    modeName: { type: String, trim: true, maxlength: 80, default: null },
    actorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    actorUsername: { type: String, trim: true, maxlength: 40, default: null },
    actorOeIcon: { type: String, trim: true, maxlength: 200, default: null },
    createdAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null }
  },
  { _id: false }
);

const accountNotificationSchema = new Schema(
  {
    notificationId: {
      type: String,
      trim: true,
      required: true
    },
    type: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true
    },
    category: {
      type: String,
      enum: ['social', 'party', 'progression', 'system'],
      required: true
    },
    delivery: {
      type: String,
      enum: ['toast', 'inbox', 'both'],
      default: null
    },
    actorAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    actorUsername: { type: String, trim: true, maxlength: 40, default: null },
    actorOeIcon: { type: String, trim: true, maxlength: 200, default: null },
    title: { type: String, trim: true, maxlength: 120, default: null },
    body: { type: String, trim: true, maxlength: 300, default: null },
    action: {
      type: Schema.Types.Mixed,
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    createdAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null }
  },
  { _id: false }
);

const friendNotificationStateSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    presenceInitialized: { type: Boolean, default: false },
    wasOnline: { type: Boolean, default: false },
    lastPresenceObservedAt: { type: Date, default: null },
    lastOnlineNotifiedAt: { type: Date, default: null },
    sessionInitialized: { type: Boolean, default: false },
    sessionFingerprint: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null
    },
    lastSessionCheckedAt: { type: Date, default: null },
    lastSessionNotifiedAt: { type: Date, default: null }
  },
  { _id: false }
);

const gameModeSettingsSchema = new Schema(
  {
    gameMode: { type: String, trim: true, required: true },
    settings: { type: Schema.Types.Mixed, default: () => ({}) },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

module.exports = {
  friendRelationshipSchema,
  reportSummarySchema,
  partyNotificationSchema,
  accountNotificationSchema,
  friendNotificationStateSchema,
  gameModeSettingsSchema
};

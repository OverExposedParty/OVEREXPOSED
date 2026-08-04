const mongoose = require('mongoose');
const { ADMIN_ROLES, ACCESS_ROLES } = require('./constants');
const { Schema } = mongoose;

const adminActionSchema = new Schema(
  {
    action: { type: String, trim: true, required: true },
    targetType: { type: String, trim: true, default: null },
    targetId: { type: Schema.Types.ObjectId, default: null },
    reason: { type: String, trim: true, maxlength: 500, default: null },
    before: { type: Schema.Types.Mixed, select: false, default: null },
    after: { type: Schema.Types.Mixed, select: false, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const adminSchema = new Schema(
  {
    roles: { type: [String], enum: ADMIN_ROLES, default: [] },
    permissionSet: { type: [String], default: [] },
    permissionsExpireAt: { type: Date, default: null },
    adminCreatedAt: { type: Date, default: null },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    lastAdminLoginAt: { type: Date, default: null },
    emailTemplateTestRecipient: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      default: null
    },
    disabled: { type: Boolean, default: false },
    actionLogs: { type: [adminActionSchema], select: false, default: [] },
    contentChangesMade: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    productsCreatedEditedDeleted: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    ordersViewedModified: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    refundsIssued: { type: [adminActionSchema], select: false, default: [] },
    userBansSuspensionsModerationActions: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    questionCategoryModerationActions: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    systemSettingsChanged: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    failedAdminLoginAttempts: { type: Number, min: 0, default: 0 },
    twoFactorEnabled: { type: Boolean, default: false },
    impersonationLogs: {
      type: [adminActionSchema],
      select: false,
      default: []
    },
    notes: { type: [String], select: false, default: [] },
    internalSupportResponses: {
      type: [adminActionSchema],
      select: false,
      default: []
    }
  },
  { _id: false }
);

const accessSchema = new Schema(
  {
    roles: { type: [String], enum: ACCESS_ROLES, default: [] },
    features: { type: [String], default: [] },
    grantedAt: { type: Date, default: null },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    disabled: { type: Boolean, default: false }
  },
  { _id: false }
);

module.exports = { adminActionSchema, adminSchema, accessSchema };

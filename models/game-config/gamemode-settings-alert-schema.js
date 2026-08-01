const mongoose = require('mongoose');

const { Schema } = mongoose;
const GAMEMODE_SETTINGS_ALERT_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'drafted',
  'published',
  'archived',
  'enabled',
  'disabled'
];
const GAMEMODE_SETTINGS_ALERT_ITEM_TYPES = ['pack', 'rule', 'role'];

const gamemodeSettingsAlertSchema = new Schema(
  {
    action: {
      type: String,
      enum: GAMEMODE_SETTINGS_ALERT_ACTIONS,
      required: true
    },
    itemType: {
      type: String,
      enum: GAMEMODE_SETTINGS_ALERT_ITEM_TYPES,
      required: true
    },
    itemKey: { type: String, trim: true, default: '-' },
    title: { type: String, trim: true, required: true },
    gamemode: { type: String, trim: true, default: '-' },
    severity: {
      type: String,
      enum: ['info', 'warning', 'danger', 'success'],
      default: 'info'
    },
    changes: { type: [String], default: [] },
    exportNeeded: { type: Boolean, default: true },
    resolvedAt: { type: Date, default: null },
    admin: {
      accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      usernameSnapshot: { type: String, trim: true, default: '-' }
    },
    system: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: false }
);

gamemodeSettingsAlertSchema.index({ 'system.createdAt': -1 });
gamemodeSettingsAlertSchema.index({ itemType: 1, 'system.createdAt': -1 });
gamemodeSettingsAlertSchema.index({
  itemType: 1,
  exportNeeded: 1,
  resolvedAt: 1,
  'system.createdAt': -1
});
gamemodeSettingsAlertSchema.statics.ACTIONS = GAMEMODE_SETTINGS_ALERT_ACTIONS;
gamemodeSettingsAlertSchema.statics.ITEM_TYPES =
  GAMEMODE_SETTINGS_ALERT_ITEM_TYPES;

module.exports = mongoose.model(
  'GamemodeSettingsAlert',
  gamemodeSettingsAlertSchema,
  'gamemode-settings-alerts'
);

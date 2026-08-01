const mongoose = require('mongoose');

const { Schema } = mongoose;

const ADMIN_LOG_RESULTS = ['success', 'failed'];
const ADMIN_LOG_SEVERITIES = ['low', 'medium', 'high', 'critical'];

const AdminLogSchema = new Schema(
  {
    admin: {
      accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      usernameSnapshot: {
        type: String,
        trim: true,
        maxlength: 80,
        default: '-'
      }
    },
    action: { type: String, trim: true, maxlength: 160, required: true },
    area: { type: String, trim: true, maxlength: 80, required: true },
    target: {
      type: { type: String, trim: true, maxlength: 80, default: '-' },
      id: { type: String, trim: true, maxlength: 160, default: '-' },
      label: { type: String, trim: true, maxlength: 160, default: '-' }
    },
    previousValue: { type: String, trim: true, maxlength: 500, default: '-' },
    newValue: { type: String, trim: true, maxlength: 500, default: '-' },
    result: { type: String, enum: ADMIN_LOG_RESULTS, default: 'success' },
    severity: { type: String, enum: ADMIN_LOG_SEVERITIES, default: 'low' },
    note: { type: String, trim: true, maxlength: 1000, default: '-' },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    system: {
      createdAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: false }
);

AdminLogSchema.index({ 'system.createdAt': -1 });
AdminLogSchema.index({ area: 1, result: 1, 'system.createdAt': -1 });
AdminLogSchema.index({ severity: 1, 'system.createdAt': -1 });
AdminLogSchema.index({ 'admin.accountId': 1, 'system.createdAt': -1 });

AdminLogSchema.statics.RESULTS = ADMIN_LOG_RESULTS;
AdminLogSchema.statics.SEVERITIES = ADMIN_LOG_SEVERITIES;

module.exports = mongoose.model('AdminLog', AdminLogSchema, 'admin-logs');

const mongoose = require('mongoose');

const { Schema } = mongoose;

const SystemConfigSchema = new Schema(
  {
    key: { type: String, trim: true, required: true },
    label: { type: String, trim: true, maxlength: 120, required: true },
    value: { type: String, trim: true, maxlength: 240, default: '-' },
    area: { type: String, trim: true, maxlength: 80, default: 'Global' },
    system: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null }
    }
  },
  { timestamps: false }
);

SystemConfigSchema.pre('save', function setSystemConfigTimestamps(next) {
  const now = new Date();

  if (!this.system) {
    this.system = {};
  }

  if (!this.system.createdAt) {
    this.system.createdAt = now;
  }

  this.system.updatedAt = now;
  next();
});

SystemConfigSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setSystemConfigUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

SystemConfigSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model(
  'SystemConfig',
  SystemConfigSchema,
  'system-config'
);

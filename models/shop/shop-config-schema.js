const mongoose = require('mongoose');

const { Schema } = mongoose;

const ShopConfigSchema = new Schema(
  {
    key: { type: String, trim: true, required: true, unique: true },
    accountCommercePublic: { type: Boolean, default: false },
    system: {
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }
  },
  { timestamps: false }
);

ShopConfigSchema.pre('save', function setShopConfigTimestamps(next) {
  const now = new Date();

  if (!this.system) this.system = {};
  if (!this.system.createdAt) this.system.createdAt = now;
  this.system.updatedAt = now;
  next();
});

ShopConfigSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setShopConfigUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

module.exports = mongoose.model('ShopConfig', ShopConfigSchema, 'shop-config');

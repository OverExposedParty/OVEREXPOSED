const mongoose = require('mongoose');

const { Schema } = mongoose;

const layerRollSchema = new Schema(
  {
    rarityRolled: { type: String, trim: true, required: true },
    traitKey: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const olingHatchReceiptSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    eggKey: { type: String, required: true, trim: true, lowercase: true },
    olingId: { type: Schema.Types.ObjectId, ref: 'PlayerOling', default: null },
    rolls: {
      body: { type: layerRollSchema, required: true },
      eyes: { type: layerRollSchema, required: true },
      mouth: { type: layerRollSchema, required: true },
      flight: { type: layerRollSchema, required: true },
      personality: {
        personalityKey: { type: String, trim: true, required: true },
        influence: { type: Schema.Types.Mixed, default: null }
      }
    },
    eggOddsSnapshot: { type: Schema.Types.Mixed, default: () => ({}) },
    inventoryChange: {
      eggKey: { type: String, trim: true, default: '' },
      quantityBefore: { type: Number, min: 0, default: 0 },
      quantityAfter: { type: Number, min: 0, default: 0 }
    },
    request: {
      ip: { type: String, trim: true, default: null },
      userAgent: { type: String, trim: true, default: null }
    },
    createdAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

olingHatchReceiptSchema.index({ ownerId: 1, createdAt: -1 });
olingHatchReceiptSchema.index({ olingId: 1 });
olingHatchReceiptSchema.index({ eggKey: 1, createdAt: -1 });

module.exports = mongoose.model(
  'OlingHatchReceipt',
  olingHatchReceiptSchema,
  'oling-hatch-receipts'
);

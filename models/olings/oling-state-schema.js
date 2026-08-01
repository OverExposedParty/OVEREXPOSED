const mongoose = require('mongoose');

const { Schema } = mongoose;

const quantityInventoryItemSchema = new Schema(
  {
    key: { type: String, trim: true, required: true },
    rarity: { type: String, trim: true, default: 'common' },
    quantity: { type: Number, min: 0, default: 0 },
    acquiredAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const olingPetSchema = new Schema(
  {
    key: { type: String, trim: true, required: true },
    eggKey: { type: String, trim: true, default: null },
    name: { type: String, trim: true, default: null },
    rarity: { type: String, trim: true, default: null },
    hatchedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const olingHatchHistorySchema = new Schema(
  {
    eggKey: { type: String, trim: true, required: true },
    petKey: { type: String, trim: true, default: null },
    hatchedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const olingInventorySchema = new Schema(
  {
    eggs: { type: [quantityInventoryItemSchema], default: [] },
    consumables: { type: [quantityInventoryItemSchema], default: [] },
    furniture: { type: [quantityInventoryItemSchema], default: [] },
    pets: { type: [olingPetSchema], default: [] },
    hatchHistory: { type: [olingHatchHistorySchema], default: [] }
  },
  { _id: false }
);

const olingLabInventorySlotSchema = new Schema(
  {
    slotId: { type: String, trim: true, required: true },
    slotType: { type: String, trim: true, default: 'item' },
    itemKey: { type: String, trim: true, default: null },
    itemType: { type: String, trim: true, default: null },
    quantity: { type: Number, min: 0, max: 8, default: 0 },
    placedAt: { type: Date, default: null },
    readyNotificationDeliveredAt: { type: Date, default: null },
    influenceSlots: {
      type: [
        {
          slotKey: { type: String, trim: true, required: true },
          itemKey: { type: String, trim: true, default: null },
          itemType: { type: String, trim: true, default: 'consumable' },
          consumedAt: { type: Date, default: null }
        }
      ],
      default: []
    }
  },
  { _id: false }
);

const olingLabContainerSlotSchema = new Schema(
  {
    slotId: { type: String, trim: true, required: true },
    itemId: { type: String, trim: true, default: null },
    itemType: { type: String, trim: true, default: null },
    inventorySlots: { type: [olingLabInventorySlotSchema], default: [] },
    placedId: { type: String, trim: true, default: null },
    placedAt: { type: Date, default: null }
  },
  { _id: false }
);

const olingLabPlacedItemSchema = new Schema(
  {
    placedId: { type: String, trim: true, required: true },
    itemId: { type: String, trim: true, required: true },
    itemType: { type: String, trim: true, default: null },
    rarity: { type: String, trim: true, default: 'common' },
    row: { type: Number, min: 0, max: 1, required: true },
    col: { type: Number, min: 0, required: true },
    width: { type: Number, min: 1, max: 8, default: 1 },
    height: { type: Number, min: 1, max: 2, default: 1 },
    locked: { type: Boolean, default: false },
    inventorySlots: { type: [olingLabInventorySlotSchema], default: [] },
    containerSlots: { type: [olingLabContainerSlotSchema], default: [] },
    placedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const olingLabSchema = new Schema(
  {
    roomLevel: { type: Number, min: 1, default: 1 },
    columns: { type: Number, min: 3, max: 16, default: 3 },
    rows: { type: Number, min: 2, max: 2, default: 2 },
    unlockedCells: { type: [String], default: undefined },
    placedItems: { type: [olingLabPlacedItemSchema], default: [] },
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const olingStateSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true
    },
    inventory: { type: olingInventorySchema, default: () => ({}) },
    lab: { type: olingLabSchema, default: () => ({}) },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true
  }
);

olingStateSchema.index({ ownerId: 1 }, { unique: true });

module.exports = mongoose.model(
  'OlingState',
  olingStateSchema,
  'player-oling-states'
);

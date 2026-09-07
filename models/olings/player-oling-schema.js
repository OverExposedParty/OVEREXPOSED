const mongoose = require('mongoose');
const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_POD_RELEASE_OUTCOMES,
  OLING_RESIDENCY_STATES
} = require('./oling-storage-contract');

const { Schema } = mongoose;

const buildSchema = new Schema(
  {
    body: { type: String, trim: true, required: true },
    eyes: { type: String, trim: true, required: true },
    mouth: { type: String, trim: true, required: true },
    flight: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const buildRaritySchema = new Schema(
  {
    body: { type: String, trim: true, required: true },
    eyes: { type: String, trim: true, required: true },
    mouth: { type: String, trim: true, required: true },
    flight: { type: String, trim: true, required: true }
  },
  { _id: false }
);

const equipmentSchema = new Schema(
  {
    headwear: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const olingCareSchema = new Schema(
  {
    energy: { type: Number, min: 0, max: 100, default: 100 },
    energyUpdatedAt: { type: Date, default: Date.now },
    isSleeping: { type: Boolean, default: false },
    sleepUpdatedAt: { type: Date, default: null },
    sleepBedPlacedId: { type: String, trim: true, default: null },
    sleepBedSlotId: { type: String, trim: true, default: null },
    sleepBedRarity: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    sleepDurationMs: { type: Number, min: 1, default: null }
  },
  { _id: false }
);

const olingStoredPodSchema = new Schema(
  {
    key: { type: String, trim: true, lowercase: true, required: true },
    definitionRevision: { type: Number, min: 1, required: true },
    releaseOutcome: {
      type: String,
      enum: OLING_POD_RELEASE_OUTCOMES,
      required: true
    },
    storedAt: { type: Date, required: true },
    containerPlacedId: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    }
  },
  { _id: false }
);

const olingResidencySchema = new Schema(
  {
    state: {
      type: String,
      enum: OLING_RESIDENCY_STATES,
      default: 'active'
    },
    // Null is valid for legacy active Olings until the roster migration runs.
    labSlot: {
      type: Number,
      min: 1,
      max: OLING_LAB_ACTIVE_LIMIT,
      default: null
    },
    pod: { type: olingStoredPodSchema, default: null }
  },
  { _id: false }
);

const playerOlingSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    eggKey: { type: String, required: true, trim: true, lowercase: true },
    collection: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, trim: true, maxlength: 40, default: null },
    build: { type: buildSchema, required: true },
    buildRarities: { type: buildRaritySchema, required: true },
    equipment: { type: equipmentSchema, default: () => ({}) },
    care: { type: olingCareSchema, default: () => ({}) },
    residency: { type: olingResidencySchema, default: () => ({}) },
    favorite: { type: Boolean, default: false },
    displayOnProfile: { type: Boolean, default: false },
    hatchedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

playerOlingSchema.pre('validate', function validateOlingResidency() {
  const residency = this.residency;
  if (!residency || residency.state === 'active') {
    if (residency?.pod) {
      this.invalidate(
        'residency.pod',
        'Active Olings cannot be assigned to an Oling Pod.'
      );
    }
    return;
  }

  if (residency.labSlot !== null && residency.labSlot !== undefined) {
    this.invalidate(
      'residency.labSlot',
      'Stored Olings cannot occupy an active lab slot.'
    );
  }
  if (!residency.pod) {
    this.invalidate(
      'residency.pod',
      'Stored Olings must be assigned to an Oling Pod.'
    );
  }
});

playerOlingSchema.index({ ownerId: 1, hatchedAt: -1 });
playerOlingSchema.index({ ownerId: 1, favorite: 1 });
playerOlingSchema.index({ eggKey: 1 });
playerOlingSchema.index(
  { ownerId: 1, 'residency.labSlot': 1 },
  {
    unique: true,
    name: 'owner_active_oling_lab_slot',
    partialFilterExpression: {
      'residency.state': 'active',
      'residency.labSlot': { $type: 'number' }
    }
  }
);

module.exports = mongoose.model(
  'PlayerOling',
  playerOlingSchema,
  'player-olings'
);
module.exports.olingResidencySchema = olingResidencySchema;
module.exports.olingStoredPodSchema = olingStoredPodSchema;

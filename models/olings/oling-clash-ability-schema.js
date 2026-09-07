const mongoose = require('mongoose');

const {
  CLASH_CONTENT_STATUSES,
  CLASH_EFFECT_MECHANICS,
  CLASH_LAYERS,
  CLASH_ROLE_TAGS,
  CLASH_TRIGGER_BY_LAYER,
  CLASH_TRIGGERS
} = require('./oling-clash-constants');

const { Schema } = mongoose;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HANDLER_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const abilityCadenceSchema = new Schema(
  {
    every: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      required: true
    },
    mode: {
      type: String,
      enum: ['cumulative', 'consecutive'],
      default: 'cumulative'
    },
    retainWhileBenched: { type: Boolean, default: true },
    consumeWhenPrevented: { type: Boolean, default: true }
  },
  { _id: false }
);

const abilityEffectSchema = new Schema(
  {
    order: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      required: true
    },
    mechanic: {
      type: String,
      enum: CLASH_EFFECT_MECHANICS,
      required: true
    },
    handler: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: HANDLER_PATTERN
    },
    target: { type: Schema.Types.Mixed, default: () => ({}) },
    parameters: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false, suppressReservedKeysWarning: true }
);

function createAbilityFields() {
  return {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: KEY_PATTERN
    },
    revision: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger
    },
    traitKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: KEY_PATTERN
    },
    layer: { type: String, enum: CLASH_LAYERS, required: true },
    trigger: { type: String, enum: CLASH_TRIGGERS, required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    imagePath: { type: String, trim: true, maxlength: 500, default: '' },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    cadence: {
      type: abilityCadenceSchema,
      default: undefined
    },
    effects: {
      type: [abilityEffectSchema],
      validate: {
        validator: (effects) =>
          Array.isArray(effects) &&
          effects.length > 0 &&
          new Set(effects.map((effect) => effect.order)).size ===
            effects.length,
        message:
          'Clash abilities require ordered effects with unique positions.'
      },
      required: true
    },
    roleTags: {
      type: [{ type: String, enum: CLASH_ROLE_TAGS }],
      default: []
    }
  };
}

function validateLayerTrigger() {
  const expectedTrigger = CLASH_TRIGGER_BY_LAYER[this.layer];
  if (expectedTrigger && this.trigger !== expectedTrigger) {
    this.invalidate(
      'trigger',
      `Clash ${this.layer} abilities must use the "${expectedTrigger}" trigger.`
    );
  }
}

const olingClashAbilitySnapshotSchema = new Schema(createAbilityFields(), {
  _id: false,
  suppressReservedKeysWarning: true
});
olingClashAbilitySnapshotSchema.pre('validate', validateLayerTrigger);

const olingClashAbilitySchema = new Schema(
  {
    ...createAbilityFields(),
    isCurrent: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: CLASH_CONTENT_STATUSES,
      default: 'draft'
    }
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true
  }
);

olingClashAbilitySchema.pre('validate', validateLayerTrigger);
olingClashAbilitySchema.index({ key: 1, revision: 1 }, { unique: true });
olingClashAbilitySchema.index({ traitKey: 1, revision: 1 }, { unique: true });
olingClashAbilitySchema.index(
  { traitKey: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true }
  }
);
olingClashAbilitySchema.index({ enabled: 1, status: 1, isCurrent: 1 });

module.exports = mongoose.model(
  'OlingClashAbility',
  olingClashAbilitySchema,
  'oling-clash-abilities'
);
module.exports.olingClashAbilitySnapshotSchema =
  olingClashAbilitySnapshotSchema;
module.exports.abilityEffectSchema = abilityEffectSchema;
module.exports.abilityCadenceSchema = abilityCadenceSchema;

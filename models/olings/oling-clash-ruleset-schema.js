const mongoose = require('mongoose');

const {
  CLASH_ACTIONS,
  CLASH_CONTENT_STATUSES,
  CLASH_DAMAGE_SOURCES,
  CLASH_DAMAGE_TYPES,
  CLASH_HEALTH_LAYERS
} = require('./oling-clash-constants');

const { Schema } = mongoose;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CLASH_RESOLUTION_STEPS = Object.freeze([
  'base-damage',
  'last-stand',
  'defeat-check',
  'part-activation',
  'triggered-statuses',
  'tag'
]);
const EFFECT_RESOLUTION_STEPS = Object.freeze([
  'redirect',
  'block',
  'ward',
  'resolve'
]);

const actionRulesSchema = new Schema(
  {
    attackBeats: { type: String, enum: CLASH_ACTIONS, default: 'skill' },
    skillBeats: { type: String, enum: CLASH_ACTIONS, default: 'guard' },
    guardBeats: { type: String, enum: CLASH_ACTIONS, default: 'attack' }
  },
  { _id: false }
);

const healthRulesSchema = new Schema(
  {
    unitsPerHeart: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 2
    },
    startingHeartUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 6
    },
    layerOrder: {
      type: [{ type: String, enum: CLASH_HEALTH_LAYERS }],
      default: [...CLASH_HEALTH_LAYERS]
    },
    shieldStacks: { type: Boolean, default: true },
    shieldCapacityUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 2
    },
    overgrowthStacks: { type: Boolean, default: true },
    healingCannotExceedMaximumHearts: { type: Boolean, default: true },
    overgrowthCanExceedMaximumHearts: { type: Boolean, default: true }
  },
  { _id: false }
);

const damageDefaultsSchema = new Schema(
  {
    clash: { type: String, enum: CLASH_DAMAGE_TYPES, default: 'normal' },
    draw: { type: String, enum: CLASH_DAMAGE_TYPES, default: 'normal' },
    bonus: { type: String, enum: CLASH_DAMAGE_TYPES, default: 'normal' }
  },
  { _id: false }
);

const damageRoutingSchema = new Schema(
  {
    normal: {
      type: [{ type: String, enum: CLASH_HEALTH_LAYERS }],
      default: ['shields', 'overgrowth', 'hearts']
    },
    piercing: {
      type: [{ type: String, enum: CLASH_HEALTH_LAYERS }],
      default: ['overgrowth', 'hearts']
    },
    true: {
      type: [{ type: String, enum: CLASH_HEALTH_LAYERS }],
      default: ['hearts']
    }
  },
  { _id: false }
);

const damageRulesSchema = new Schema(
  {
    decisiveUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 2
    },
    drawUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 1
    },
    defaultTypes: { type: damageDefaultsSchema, default: () => ({}) },
    routing: { type: damageRoutingSchema, default: () => ({}) }
  },
  { _id: false }
);

const lastStandRulesSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    minimumHeartUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 1
    },
    preventedDamageSources: {
      type: [{ type: String, enum: CLASH_DAMAGE_SOURCES }],
      default: ['draw']
    }
  },
  { _id: false }
);

const transferRulesSchema = new Schema(
  {
    minimumDonorHeartUnits: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 1
    },
    requireFullRecipientCapacity: { type: Boolean, default: true }
  },
  { _id: false }
);

const redirectRulesSchema = new Schema(
  {
    maximumRedirectsPerEffect: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 1
    },
    currentTargetHasPriority: { type: Boolean, default: true },
    otherStealsResolveAfterTargetDeclines: { type: Boolean, default: true },
    stealAndReflectShareLimit: { type: Boolean, default: true }
  },
  { _id: false }
);

const activationRulesSchema = new Schema(
  {
    suppressionPreventsEntireActivation: { type: Boolean, default: true },
    defencesApplyToEachEffect: { type: Boolean, default: true }
  },
  { _id: false }
);

const taggingRulesSchema = new Schema(
  {
    maximumCharges: {
      type: Number,
      min: 0,
      validate: Number.isInteger,
      default: 2
    },
    decisiveClashesPerCharge: {
      type: Number,
      min: 1,
      validate: Number.isInteger,
      default: 3
    },
    queuedTargetBecomesReplacement: { type: Boolean, default: true },
    defeatReplacementTriggersTagEffects: { type: Boolean, default: false },
    preserveProtection: { type: Boolean, default: true },
    preserveStatuses: { type: Boolean, default: true },
    roundDurationsContinueWhileBenched: { type: Boolean, default: true },
    activationConditionsWaitWhileBenched: { type: Boolean, default: true },
    clashConditionsWaitWhileBenched: { type: Boolean, default: true }
  },
  { _id: false }
);

const resolutionRulesSchema = new Schema(
  {
    clash: {
      type: [{ type: String, enum: CLASH_RESOLUTION_STEPS }],
      default: [
        'base-damage',
        'last-stand',
        'defeat-check',
        'part-activation',
        'triggered-statuses',
        'defeat-check',
        'tag'
      ]
    },
    effect: {
      type: [{ type: String, enum: EFFECT_RESOLUTION_STEPS }],
      default: ['redirect', 'block', 'ward', 'resolve']
    },
    multipleEffects: {
      type: String,
      enum: ['written-order'],
      default: 'written-order'
    }
  },
  { _id: false }
);

function createRulesetFields() {
  return {
    engineVersion: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
      default: 3
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    actions: { type: actionRulesSchema, required: true, default: () => ({}) },
    health: { type: healthRulesSchema, required: true, default: () => ({}) },
    damage: { type: damageRulesSchema, required: true, default: () => ({}) },
    lastStand: {
      type: lastStandRulesSchema,
      required: true,
      default: () => ({})
    },
    transfer: {
      type: transferRulesSchema,
      required: true,
      default: () => ({})
    },
    redirect: {
      type: redirectRulesSchema,
      required: true,
      default: () => ({})
    },
    activation: {
      type: activationRulesSchema,
      required: true,
      default: () => ({})
    },
    tagging: { type: taggingRulesSchema, required: true, default: () => ({}) },
    resolution: {
      type: resolutionRulesSchema,
      required: true,
      default: () => ({})
    }
  };
}

function validateActionTriangle() {
  if (!this.actions) return;
  const outcomes = [
    this.actions.attackBeats,
    this.actions.skillBeats,
    this.actions.guardBeats
  ];
  const hasEveryAction = CLASH_ACTIONS.every((action) =>
    outcomes.includes(action)
  );
  const hasSelfWin =
    this.actions.attackBeats === 'attack' ||
    this.actions.skillBeats === 'skill' ||
    this.actions.guardBeats === 'guard';

  if (!hasEveryAction || hasSelfWin) {
    this.invalidate(
      'actions',
      'Clash actions must form a complete triangle with no action beating itself.'
    );
  }
}

function validateHealthLayers() {
  if (!this.health?.layerOrder) return;
  const layers = [...this.health.layerOrder];
  if (
    layers.length !== CLASH_HEALTH_LAYERS.length ||
    !CLASH_HEALTH_LAYERS.every((layer) => layers.includes(layer))
  ) {
    this.invalidate(
      'health.layerOrder',
      'Clash health order must contain Shields, Overgrowth, and Hearts once each.'
    );
  }
}

function validateRuleset() {
  validateActionTriangle.call(this);
  validateHealthLayers.call(this);
}

const olingClashRulesetSnapshotSchema = new Schema(createRulesetFields(), {
  _id: false,
  suppressReservedKeysWarning: true
});
olingClashRulesetSnapshotSchema.pre('validate', validateRuleset);

const olingClashRulesetSchema = new Schema(
  {
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
    ...createRulesetFields(),
    isCurrent: { type: Boolean, default: false },
    status: {
      type: String,
      enum: CLASH_CONTENT_STATUSES,
      default: 'draft'
    }
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

olingClashRulesetSchema.pre('validate', validateRuleset);
olingClashRulesetSchema.index({ key: 1, revision: 1 }, { unique: true });
olingClashRulesetSchema.index(
  { key: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true }
  }
);
olingClashRulesetSchema.index({ status: 1, isCurrent: 1 });

module.exports = mongoose.model(
  'OlingClashRuleset',
  olingClashRulesetSchema,
  'oling-clash-rulesets'
);
module.exports.CLASH_RESOLUTION_STEPS = CLASH_RESOLUTION_STEPS;
module.exports.EFFECT_RESOLUTION_STEPS = EFFECT_RESOLUTION_STEPS;
module.exports.olingClashRulesetSnapshotSchema =
  olingClashRulesetSnapshotSchema;

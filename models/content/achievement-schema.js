const mongoose = require('mongoose');
const {
  ACHIEVEMENT_REWARD_TYPES,
  MAX_REWARD_AMOUNT,
  MAX_REWARD_QUANTITY,
  getAchievementRewardValidationMessage
} = require('./achievement-reward-contract');
const { normalizeAchievementTaxonomy } = require('./achievement-taxonomy');

const { Schema } = mongoose;

const achievementRewardSchema = new Schema(
  {
    type: {
      type: String,
      enum: ACHIEVEMENT_REWARD_TYPES,
      required: true
    },
    key: { type: String, trim: true, default: null },
    amount: {
      type: Number,
      min: 0,
      max: MAX_REWARD_AMOUNT,
      validate: Number.isInteger,
      default: 0
    },
    quantity: {
      type: Number,
      min: 1,
      max: MAX_REWARD_QUANTITY,
      validate: Number.isInteger,
      default: 1
    },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const achievementSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      unique: true
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    image: { type: String, trim: true, default: '' },
    category: { type: String, required: true, trim: true, lowercase: true },
    subcategory: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    gamemode: { type: String, trim: true, lowercase: true, default: null },
    requirementType: {
      type: String,
      enum: [
        'stat_threshold',
        'per_game_stat_threshold',
        'event',
        'streak',
        'collection',
        'manual'
      ],
      default: 'event'
    },
    eventType: { type: String, trim: true, default: null },
    statPath: { type: String, trim: true, default: null },
    statKey: { type: String, trim: true, default: null },
    requirementValue: { type: Number, min: 0, default: 1 },
    minPlayers: { type: Number, min: 0, default: 0 },
    points: { type: Number, min: 0, default: 0 },
    rarity: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'],
      default: 'common'
    },
    hidden: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    sortOrder: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    rewards: {
      type: [achievementRewardSchema],
      default: [],
      validate: {
        validator(rewards) {
          return !getAchievementRewardValidationMessage(rewards);
        },
        message(props) {
          return (
            getAchievementRewardValidationMessage(props.value) ||
            'Achievement rewards are invalid.'
          );
        }
      }
    },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    timestamps: true
  }
);

achievementSchema.pre('validate', function normalizeTaxonomy() {
  const taxonomy = normalizeAchievementTaxonomy(this);
  this.category = taxonomy.category;
  this.subcategory = taxonomy.subcategory;
  this.gamemode = taxonomy.gamemode;
});

achievementSchema.index({
  enabled: 1,
  status: 1,
  category: 1,
  subcategory: 1,
  sortOrder: 1
});
achievementSchema.index({ gamemode: 1, enabled: 1, status: 1 });
achievementSchema.index({ requirementType: 1, eventType: 1 });

module.exports = mongoose.model(
  'Achievement',
  achievementSchema,
  'achievements'
);

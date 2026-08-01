const mongoose = require('mongoose');

const oeCustomisationAssetSchema = new mongoose.Schema(
  {
    colour: { type: String, default: '' },
    secondaryColour: { type: String, default: '' }
  },
  { _id: false }
);

const findTheOeSchema = new mongoose.Schema(
  {
    rgb: { type: [Number], default: [] },
    category: { type: String, default: '' },
    tone: { type: String, default: '' }
  },
  { _id: false }
);

const oeCustomisationSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: ['pack', 'image'],
      required: true
    },
    slug: { type: String, trim: true, default: '' },
    oeId: { type: String, trim: true, default: '' },
    packSlug: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    name: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    prefix: { type: String, trim: true, default: '' },
    slot: {
      type: String,
      enum: ['colour', 'head-slot', 'eyes-slot', 'mouth-slot', ''],
      default: ''
    },
    filePath: { type: String, trim: true, default: '' },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    assets: { type: oeCustomisationAssetSchema, default: () => ({}) },
    blacklist: { type: Boolean, default: false },
    findTheOe: { type: findTheOeSchema, default: () => ({}) }
  },
  { timestamps: true }
);

oeCustomisationSchema.index(
  { recordType: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { recordType: 'pack' }
  }
);
oeCustomisationSchema.index(
  { recordType: 1, oeId: 1 },
  {
    unique: true,
    partialFilterExpression: { recordType: 'image' }
  }
);
oeCustomisationSchema.index({ recordType: 1, enabled: 1, status: 1 });
oeCustomisationSchema.index({ recordType: 1, packSlug: 1, slot: 1 });

module.exports = mongoose.model(
  'OeCustomisation',
  oeCustomisationSchema,
  'oe-customisation'
);

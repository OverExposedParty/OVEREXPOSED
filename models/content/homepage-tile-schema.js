const mongoose = require('mongoose');

const homepageTileImageSchema = new mongoose.Schema(
  {
    src: { type: String, trim: true, default: '' },
    alt: { type: String, trim: true, maxlength: 120, default: '' }
  },
  { _id: false }
);

const homepageTileLayoutSchema = new mongoose.Schema(
  {
    columns: { type: [Number], default: [] },
    rows: { type: [Number], default: [] },
    mobile: {
      cols: { type: Number, min: 1, max: 2, default: 1 },
      rows: { type: Number, min: 1, default: 1 },
      order: { type: Number, min: 1, required: true }
    },
    size: {
      type: String,
      enum: ['small', 'wide', 'large', 'full', 'default'],
      default: 'default'
    }
  },
  { _id: false }
);

const homepageTileSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    kind: {
      type: String,
      enum: ['gamemode', 'page'],
      default: 'page'
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    link: { type: String, required: true, trim: true },
    colours: {
      primary: { type: String, trim: true, default: '' },
      secondary: { type: String, trim: true, default: '' }
    },
    splashScreen: { type: String, trim: true, default: '' },
    images: {
      desktop: { type: homepageTileImageSchema, default: () => ({}) },
      mobile: { type: homepageTileImageSchema, default: () => ({}) }
    },
    layout: {
      type: homepageTileLayoutSchema,
      required: true
    },
    access: {
      type: {
        type: String,
        enum: ['public', 'account', 'feature', 'owner'],
        default: 'public'
      },
      feature: { type: String, trim: true, default: null }
    },
    enabled: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published'
    },
    sortOrder: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

homepageTileSchema.index({ key: 1 }, { unique: true });
homepageTileSchema.index({ status: 1, sortOrder: 1, key: 1 });

module.exports = mongoose.model(
  'HomepageTile',
  homepageTileSchema,
  'homepage-tiles'
);

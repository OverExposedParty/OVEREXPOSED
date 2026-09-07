const mongoose = require('mongoose');

const {
  CLASH_CONTENT_STATUSES,
  CLASH_STATUS_POLARITIES
} = require('./oling-clash-constants');

const { Schema } = mongoose;
const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HANDLER_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function createStatusFields() {
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
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    polarity: {
      type: String,
      enum: CLASH_STATUS_POLARITIES,
      required: true
    },
    handler: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: HANDLER_PATTERN
    },
    parameters: { type: Schema.Types.Mixed, default: () => ({}) }
  };
}

const olingClashStatusSnapshotSchema = new Schema(createStatusFields(), {
  _id: false,
  suppressReservedKeysWarning: true
});

const olingClashStatusSchema = new Schema(
  {
    ...createStatusFields(),
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

olingClashStatusSchema.index({ key: 1, revision: 1 }, { unique: true });
olingClashStatusSchema.index(
  { key: 1, isCurrent: 1 },
  {
    unique: true,
    partialFilterExpression: { isCurrent: true }
  }
);
olingClashStatusSchema.index({ enabled: 1, status: 1, isCurrent: 1 });

module.exports = mongoose.model(
  'OlingClashStatus',
  olingClashStatusSchema,
  'oling-clash-statuses'
);
module.exports.olingClashStatusSnapshotSchema = olingClashStatusSnapshotSchema;

const mongoose = require('mongoose');

const { Schema } = mongoose;

const EMAIL_TEMPLATE_STATUSES = ['draft', 'published', 'archived'];
const EMAIL_TEMPLATE_CATEGORIES = ['transactional', 'marketing'];
const EMAIL_SECTION_TYPES = [
  'logo',
  'heading',
  'hero',
  'image',
  'content',
  'primaryAction',
  'divider',
  'spacer',
  'socialLinks',
  'footer'
];

const emailSectionSchema = new Schema(
  {
    id: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true
    },
    type: {
      type: String,
      enum: EMAIL_SECTION_TYPES,
      required: true
    },
    settings: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const emailThemeSchema = new Schema(
  {
    emailBackground: { type: String, default: '#171717' },
    contentBackground: { type: String, default: '#292929' },
    accentColour: { type: String, default: '#66ccff' },
    contentWidth: { type: Number, min: 420, max: 760, default: 640 },
    borderRadius: { type: Number, min: 0, max: 32, default: 0 }
  },
  { _id: false }
);

const publishedSnapshotSchema = new Schema(
  {
    version: { type: Number, min: 1, required: true },
    subject: { type: String, maxlength: 240, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },
    compiledAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const emailTemplateSchema = new Schema(
  {
    key: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100,
      default: undefined
    },
    name: { type: String, trim: true, maxlength: 160, required: true },
    category: {
      type: String,
      enum: EMAIL_TEMPLATE_CATEGORIES,
      default: 'transactional'
    },
    status: {
      type: String,
      enum: EMAIL_TEMPLATE_STATUSES,
      default: 'draft'
    },
    subject: { type: String, trim: true, maxlength: 240, required: true },
    preheader: { type: String, trim: true, maxlength: 500, default: '' },
    theme: { type: emailThemeSchema, default: () => ({}) },
    sections: {
      type: [emailSectionSchema],
      validate: {
        validator(sections) {
          if (!Array.isArray(sections) || sections.length > 60) return false;
          const ids = sections.map((section) => section.id);
          return new Set(ids).size === ids.length;
        },
        message:
          'Email sections must have unique IDs and contain at most 60 entries'
      },
      default: []
    },
    version: { type: Number, min: 1, default: 1 },
    publishedVersion: { type: Number, min: 1, default: undefined },
    publishedSnapshot: {
      type: publishedSnapshotSchema,
      default: undefined
    },
    system: {
      createdBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      updatedBy: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      publishedAt: { type: Date, default: null },
      archivedAt: { type: Date, default: null }
    }
  },
  { timestamps: false, versionKey: false }
);

emailTemplateSchema.pre('save', function setEmailTemplateTimestamps(next) {
  const now = new Date();
  if (!this.system) this.system = {};
  if (!this.system.createdAt) this.system.createdAt = now;
  this.system.updatedAt = now;
  next();
});

emailTemplateSchema.index(
  { key: 1 },
  {
    unique: true,
    partialFilterExpression: {
      key: { $type: 'string' },
      'system.archivedAt': null
    },
    name: 'email_template_key_unique'
  }
);
emailTemplateSchema.index({ status: 1, 'system.updatedAt': -1 });
emailTemplateSchema.index({ 'system.archivedAt': 1, 'system.updatedAt': -1 });

emailTemplateSchema.statics.STATUSES = EMAIL_TEMPLATE_STATUSES;
emailTemplateSchema.statics.CATEGORIES = EMAIL_TEMPLATE_CATEGORIES;
emailTemplateSchema.statics.SECTION_TYPES = EMAIL_SECTION_TYPES;

module.exports = mongoose.model(
  'EmailTemplate',
  emailTemplateSchema,
  'email-templates'
);

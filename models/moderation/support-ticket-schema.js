const mongoose = require('mongoose');

const { Schema } = mongoose;

const SUPPORT_SOURCES = [
  'website',
  'shop',
  'account',
  'overexposure',
  'party_games'
];
const SUPPORT_CATEGORIES = [
  'website_bug',
  'account',
  'shop_order',
  'payment',
  'refund',
  'product',
  'party_games',
  'overexposure',
  'other'
];
const SUPPORT_STATUSES = [
  'open',
  'waiting_on_user',
  'in_progress',
  'resolved',
  'closed'
];
const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const SUPPORT_SENDER_ROLES = ['user', 'support', 'system'];

const requesterSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: null
    },
    usernameSnapshot: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null
    },
    computerId: { type: String, trim: true, maxlength: 160, default: null },
    ipHash: {
      type: String,
      trim: true,
      maxlength: 160,
      select: false,
      default: null
    }
  },
  { _id: false }
);

const orderReferenceSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, default: null },
    orderNumber: { type: String, trim: true, maxlength: 120, default: null },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      maxlength: 160,
      select: false,
      default: null
    },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    variantId: { type: Schema.Types.ObjectId, default: null }
  },
  { _id: false }
);

const technicalSchema = new Schema(
  {
    pageUrl: { type: String, trim: true, maxlength: 2000, default: null },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 1000,
      select: false,
      default: null
    },
    browser: { type: String, trim: true, maxlength: 120, default: null },
    device: { type: String, trim: true, maxlength: 120, default: null },
    screenshots: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const ticketMessageSchema = new Schema(
  {
    senderAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      default: null
    },
    senderRole: { type: String, enum: SUPPORT_SENDER_ROLES, required: true },
    message: { type: String, trim: true, maxlength: 5000, required: true },
    attachments: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const systemSchema = new Schema(
  {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null }
  },
  { _id: false }
);

const SupportTicketSchema = new Schema(
  {
    requester: { type: requesterSchema, default: () => ({}) },
    source: { type: String, enum: SUPPORT_SOURCES, default: 'website' },
    category: { type: String, enum: SUPPORT_CATEGORIES, default: 'other' },
    subject: { type: String, trim: true, maxlength: 160, required: true },
    message: { type: String, trim: true, maxlength: 5000, required: true },
    order: { type: orderReferenceSchema, default: () => ({}) },
    technical: { type: technicalSchema, default: () => ({}) },
    status: { type: String, enum: SUPPORT_STATUSES, default: 'open' },
    priority: { type: String, enum: SUPPORT_PRIORITIES, default: 'normal' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    messages: { type: [ticketMessageSchema], default: [] },
    tags: { type: [String], default: [] },
    internalNotes: {
      type: String,
      trim: true,
      maxlength: 3000,
      select: false,
      default: null
    },
    system: { type: systemSchema, default: () => ({}) }
  },
  { timestamps: false }
);

SupportTicketSchema.pre('save', function setSupportTicketTimestamps(next) {
  const now = new Date();

  if (!this.system) {
    this.system = {};
  }

  if (!this.system.createdAt) {
    this.system.createdAt = now;
  }

  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.system.resolvedAt) {
      this.system.resolvedAt = now;
    }

    if (this.status === 'closed' && !this.system.closedAt) {
      this.system.closedAt = now;
    }
  }

  this.system.updatedAt = now;
  next();
});

SupportTicketSchema.pre(
  ['updateOne', 'findOneAndUpdate', 'updateMany'],
  function setSupportTicketUpdatedAt(next) {
    const update = this.getUpdate() || {};
    const nextUpdate = { ...update };
    const set = { ...(nextUpdate.$set || {}) };

    set['system.updatedAt'] = new Date();
    nextUpdate.$set = set;
    this.setUpdate(nextUpdate);
    next();
  }
);

SupportTicketSchema.index({ status: 1, priority: -1, 'system.createdAt': -1 });
SupportTicketSchema.index({ source: 1, category: 1, status: 1 });
SupportTicketSchema.index({ 'requester.accountId': 1, 'system.createdAt': -1 });
SupportTicketSchema.index({ 'requester.email': 1, 'system.createdAt': -1 });
SupportTicketSchema.index({ 'order.orderId': 1 });
SupportTicketSchema.index({ assignedTo: 1, status: 1 });

SupportTicketSchema.statics.SOURCES = SUPPORT_SOURCES;
SupportTicketSchema.statics.CATEGORIES = SUPPORT_CATEGORIES;
SupportTicketSchema.statics.STATUSES = SUPPORT_STATUSES;
SupportTicketSchema.statics.PRIORITIES = SUPPORT_PRIORITIES;
SupportTicketSchema.statics.SENDER_ROLES = SUPPORT_SENDER_ROLES;

module.exports = mongoose.model(
  'SupportTicket',
  SupportTicketSchema,
  'support-tickets'
);

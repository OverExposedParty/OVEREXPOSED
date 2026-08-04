const mongoose = require('mongoose');

const { Schema } = mongoose;

const EMAIL_DELIVERY_TYPES = ['automation', 'campaign', 'test'];
const EMAIL_DELIVERY_STATUSES = [
  'pending',
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'failed',
  'complained',
  'skipped'
];

const emailDeliverySchema = new Schema(
  {
    trackingId: {
      type: String,
      trim: true,
      maxlength: 100,
      required: true,
      unique: true
    },
    provider: { type: String, trim: true, default: 'resend' },
    providerMessageId: { type: String, trim: true, default: null },
    type: { type: String, enum: EMAIL_DELIVERY_TYPES, default: 'automation' },
    templateKey: { type: String, trim: true, lowercase: true, default: '' },
    automationTrigger: { type: String, trim: true, default: '' },
    recipient: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      required: true
    },
    subject: { type: String, trim: true, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: EMAIL_DELIVERY_STATUSES,
      default: 'pending'
    },
    isTest: { type: Boolean, default: false },
    providerEventIds: [{ type: String, trim: true }],
    failureReason: { type: String, trim: true, maxlength: 1000, default: '' },
    createdAt: { type: Date, default: Date.now },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    firstClickedAt: { type: Date, default: null },
    convertedAt: { type: Date, default: null },
    deliveryDelayedAt: { type: Date, default: null },
    bouncedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    complainedAt: { type: Date, default: null },
    lastEventAt: { type: Date, default: null }
  },
  { timestamps: false, versionKey: false }
);

emailDeliverySchema.index(
  { provider: 1, providerMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerMessageId: { $type: 'string' } },
    name: 'email_delivery_provider_message_unique'
  }
);
emailDeliverySchema.index({ isTest: 1, sentAt: -1 });
emailDeliverySchema.index({ recipient: 1, automationTrigger: 1, sentAt: -1 });
emailDeliverySchema.index({ failedAt: -1, bouncedAt: -1 });

emailDeliverySchema.statics.TYPES = EMAIL_DELIVERY_TYPES;
emailDeliverySchema.statics.STATUSES = EMAIL_DELIVERY_STATUSES;

module.exports = mongoose.model(
  'EmailDelivery',
  emailDeliverySchema,
  'email-deliveries'
);

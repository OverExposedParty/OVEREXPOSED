const mongoose = require('mongoose');
const { ORDER_STATUSES } = require('./constants');
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    name: { type: String, trim: true, default: null },
    line1: { type: String, trim: true, default: null },
    line2: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    county: { type: String, trim: true, default: null },
    postcode: { type: String, trim: true, default: null },
    country: { type: String, trim: true, uppercase: true, maxlength: 2 },
    phone: { type: String, trim: true, select: false, default: null }
  },
  { _id: false }
);

const moneySchema = new Schema(
  {
    amount: { type: Number, min: 0, default: 0 },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'GBP'
    }
  },
  { _id: false }
);

const cartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    quantity: { type: Number, min: 1, default: 1 },
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const savedProductSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    savedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const orderSummarySchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, default: null },
    orderNumber: { type: String, trim: true, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    total: { type: moneySchema, default: () => ({}) },
    placedAt: { type: Date, default: Date.now },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, trim: true, maxlength: 500, default: null },
    chargebackStatus: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const purchasedProductSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId, default: null },
    orderId: { type: Schema.Types.ObjectId, default: null },
    entitlementType: {
      type: String,
      enum: ['physical', 'digital', 'subscription', 'store_credit'],
      default: 'physical'
    },
    accessGrantedAt: { type: Date, default: Date.now },
    accessExpiresAt: { type: Date, default: null },
    licenseKeyHash: { type: String, select: false, default: null }
  },
  { _id: false }
);

const paymentStatusSchema = new Schema(
  {
    provider: { type: String, trim: true, default: null },
    providerCustomerId: {
      type: String,
      trim: true,
      select: false,
      default: null
    },
    providerPaymentMethodId: {
      type: String,
      trim: true,
      select: false,
      default: null
    },
    status: { type: String, trim: true, default: null },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const supportTicketSchema = new Schema(
  {
    ticketId: { type: String, trim: true, required: true },
    subject: { type: String, trim: true, maxlength: 200, default: null },
    status: { type: String, trim: true, default: 'open' },
    createdAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const productReviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    reviewId: { type: Schema.Types.ObjectId, default: null },
    reviewedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const shopSchema = new Schema(
  {
    customerId: { type: String, trim: true, select: false, default: null },
    cart: { type: [cartItemSchema], default: [] },
    wishlist: { type: [savedProductSchema], default: [] },
    savedItems: { type: [savedProductSchema], default: [] },
    recentlyViewedProducts: { type: [savedProductSchema], default: [] },
    orderHistory: { type: [orderSummarySchema], default: [] },
    purchasedProducts: { type: [purchasedProductSchema], default: [] },
    digitalProductAccess: { type: [purchasedProductSchema], default: [] },
    paymentProviderCustomerId: {
      type: String,
      trim: true,
      select: false,
      default: null
    },
    savedPaymentMethods: {
      type: [paymentStatusSchema],
      select: false,
      default: []
    },
    paymentStatusHistory: {
      type: [paymentStatusSchema],
      select: false,
      default: []
    },
    shippingAddress: {
      type: addressSchema,
      select: false,
      default: () => ({})
    },
    billingAddress: { type: addressSchema, select: false, default: () => ({}) },
    taxRegion: { type: String, trim: true, default: null },
    storeCredit: { type: moneySchema, default: () => ({}) },
    discountCodesUsed: { type: [String], default: [] },
    referrals: { type: [String], default: [] },
    refundsAndChargebacks: {
      type: [orderSummarySchema],
      select: false,
      default: []
    },
    fraudReviewStatus: { type: String, trim: true, default: null },
    supportTickets: { type: [supportTicketSchema], default: [] },
    orderNotes: { type: [String], select: false, default: [] },
    productReviews: { type: [productReviewSchema], default: [] },
    preferences: {
      currency: {
        type: String,
        trim: true,
        uppercase: true,
        minlength: 3,
        maxlength: 3,
        default: 'GBP'
      }
    }
  },
  { _id: false }
);

module.exports = { shopSchema };

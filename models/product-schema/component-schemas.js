const mongoose = require('mongoose');
const {
  PRODUCT_MEDIA_TYPES,
  PRODUCT_TYPES,
  INVENTORY_SYNC_SOURCES,
  PRODUCT_STATUSES,
  PRODUCT_VISIBILITIES
} = require('./constants');

const moneySchema = new mongoose.Schema(
  {
    amount: { type: Number, min: 0, default: 0 },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
      default: 'GBP'
    },
    compareAtAmount: { type: Number, min: 0, default: null }
  },
  { _id: false }
);

const variantAttributesSchema = new mongoose.Schema(
  {
    size: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: null },
    alt: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const galleryItemSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    alt: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: PRODUCT_MEDIA_TYPES,
      default: 'image'
    }
  },
  { _id: false }
);

const mediaSchema = new mongoose.Schema(
  {
    mainImage: {
      type: imageSchema,
      default: () => ({})
    },
    gallery: {
      type: [galleryItemSchema],
      default: []
    }
  },
  { _id: false }
);

const dimensionsSchema = new mongoose.Schema(
  {
    width: { type: Number, min: 0, default: null },
    height: { type: Number, min: 0, default: null },
    depth: { type: Number, min: 0, default: null }
  },
  { _id: false }
);

const shippingSchema = new mongoose.Schema(
  {
    weight: { type: Number, min: 0, default: null },
    dimensions: {
      type: dimensionsSchema,
      default: () => ({})
    },
    shippingClass: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const stripeSchema = new mongoose.Schema(
  {
    productId: { type: String, trim: true, default: null },
    priceId: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const opalPriceSchema = new mongoose.Schema(
  {
    amount: { type: Number, min: 0, default: null },
    compareAtAmount: { type: Number, min: 0, default: null }
  },
  { _id: false }
);

const productGrantSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'oe',
        'pack',
        'cosmetic',
        'badge',
        'oling_egg',
        'oling_consumable',
        'oling_headwear',
        'oling_furniture'
      ],
      required: true
    },
    key: { type: String, trim: true, required: true },
    gamemode: { type: String, trim: true, default: null },
    quantity: { type: Number, min: 1, default: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
  },
  { _id: false }
);

const digitalEntitlementSchema = new mongoose.Schema(
  {
    purchaseMethods: {
      type: [
        {
          type: String,
          enum: ['money', 'opals']
        }
      ],
      default: ['money']
    },
    opalPrice: { type: opalPriceSchema, default: () => ({}) },
    grants: { type: [productGrantSchema], default: [] }
  },
  { _id: false }
);

const productVariantSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    price: { type: moneySchema, default: () => ({}) },
    attributes: {
      type: variantAttributesSchema,
      default: () => ({})
    },
    media: {
      type: mediaSchema,
      default: () => ({})
    },
    inventory: {
      sku: {
        type: String,
        trim: true,
        uppercase: true,
        required: true
      },
      quantity: { type: Number, min: 0, default: 0 },
      reservedQuantity: { type: Number, min: 0, default: 0 },
      trackStock: { type: Boolean, default: true },
      inStock: { type: Boolean, default: false },
      lowStockThreshold: { type: Number, min: 0, default: 0 },
      syncSource: {
        type: String,
        enum: INVENTORY_SYNC_SOURCES,
        default: 'manual'
      },
      externalInventoryId: { type: String, trim: true, default: null },
      lastSyncedAt: { type: Date, default: null }
    },
    stripe: {
      type: stripeSchema,
      default: () => ({})
    },
    digitalEntitlement: {
      type: digitalEntitlementSchema,
      default: () => ({})
    }
  },
  { timestamps: false }
);

const seoSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const analyticsSchema = new mongoose.Schema(
  {
    views: { type: Number, min: 0, default: 0 },
    salesCount: { type: Number, min: 0, default: 0 },
    wishlistCount: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

const dropReferenceSchema = new mongoose.Schema(
  {
    dropId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drop',
      default: null
    },
    name: { type: String, trim: true, default: null },
    slug: { type: String, trim: true, lowercase: true, default: null }
  },
  { _id: false }
);

const catalogSchema = new mongoose.Schema(
  {
    main: { type: String, trim: true, lowercase: true, default: null },
    sub: { type: String, trim: true, lowercase: true, default: null },
    style: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: []
    },
    audience: { type: String, trim: true, lowercase: true, default: null },
    season: { type: String, trim: true, lowercase: true, default: null }
  },
  { _id: false }
);

const purchaseLimitsSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    maxPerOrder: { type: Number, min: 1, default: null },
    maxPerCustomer: { type: Number, min: 1, default: null },
    maxPerVariant: { type: Number, min: 1, default: null }
  },
  { _id: false }
);

const detailsSchema = new mongoose.Schema(
  {
    materials: {
      type: [{ type: String, trim: true }],
      default: []
    },
    composition: { type: String, trim: true, default: null },
    careInstructions: {
      type: [{ type: String, trim: true }],
      default: []
    },
    fit: { type: String, trim: true, default: null },
    origin: { type: String, trim: true, default: null }
  },
  { _id: false }
);

const identitySchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
    shortDescription: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: PRODUCT_TYPES,
      default: 'physical'
    },
    tags: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: []
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      required: true
    },
    previousSlugs: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: []
    },
    searchKeywords: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: []
    }
  },
  { _id: false }
);

const publishingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: 'draft'
    },
    visibility: {
      type: String,
      enum: PRODUCT_VISIBILITIES,
      default: 'hidden'
    },
    isActive: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    releaseDate: { type: Date, default: null },
    deletedAt: { type: Date, default: null }
  },
  { _id: false }
);

const merchandisingSchema = new mongoose.Schema(
  {
    catalog: {
      type: catalogSchema,
      default: () => ({})
    },
    drop: {
      type: dropReferenceSchema,
      default: () => ({})
    },
    sortOrder: { type: Number, default: 0 },
    hoverPreview: { type: Number, min: 0, default: null },
    defaultVariantSku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },
    limitedEdition: { type: Boolean, default: false },
    purchaseLimits: {
      type: purchaseLimitsSchema,
      default: () => ({})
    }
  },
  { _id: false }
);

const fulfillmentSchema = new mongoose.Schema(
  {
    shipping: {
      type: shippingSchema,
      default: () => ({})
    }
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema(
  {
    seo: {
      type: seoSchema,
      default: () => ({})
    },
    details: {
      type: detailsSchema,
      default: () => ({})
    }
  },
  { _id: false }
);

const performanceSchema = new mongoose.Schema(
  {
    analytics: {
      type: analyticsSchema,
      default: () => ({})
    }
  },
  { _id: false }
);

const systemSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, default: null },
    createdAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null }
  },
  { _id: false }
);

module.exports = {
  mediaSchema,
  productVariantSchema,
  digitalEntitlementSchema,
  identitySchema,
  publishingSchema,
  merchandisingSchema,
  fulfillmentSchema,
  contentSchema,
  performanceSchema,
  systemSchema
};

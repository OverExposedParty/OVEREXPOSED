const mongoose = require('mongoose');
const {
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
} = require('./component-schemas');
const {
  PRODUCT_STATUSES,
  PRODUCT_VISIBILITIES,
  PRODUCT_TYPES,
  PRODUCT_MEDIA_TYPES,
  INVENTORY_SYNC_SOURCES
} = require('./constants');
const { applyProductIndexes } = require('./indexes');
const { attachProductHooks } = require('./hooks');

function createProductSchema() {
  const ProductSchema = new mongoose.Schema(
    {
      slug: {
        type: String,
        trim: true,
        lowercase: true,
        default: null
      },
      identity: {
        type: identitySchema,
        default: () => ({})
      },
      variants: {
        type: [productVariantSchema],
        default: []
      },
      media: {
        type: mediaSchema,
        default: () => ({})
      },
      publishing: {
        type: publishingSchema,
        default: () => ({})
      },
      merchandising: {
        type: merchandisingSchema,
        default: () => ({})
      },
      fulfillment: {
        type: fulfillmentSchema,
        default: () => ({})
      },
      digitalEntitlement: {
        type: digitalEntitlementSchema,
        default: () => ({})
      },
      content: {
        type: contentSchema,
        default: () => ({})
      },
      performance: {
        type: performanceSchema,
        default: () => ({})
      },
      system: {
        type: systemSchema,
        default: () => ({})
      }
    },
    {
      timestamps: {
        createdAt: 'system.createdAt',
        updatedAt: 'system.updatedAt'
      },
      versionKey: false
    }
  );

  applyProductIndexes(ProductSchema);
  attachProductHooks(ProductSchema);

  ProductSchema.statics.STATUSES = PRODUCT_STATUSES;
  ProductSchema.statics.VISIBILITIES = PRODUCT_VISIBILITIES;
  ProductSchema.statics.TYPES = PRODUCT_TYPES;
  ProductSchema.statics.MEDIA_TYPES = PRODUCT_MEDIA_TYPES;
  ProductSchema.statics.INVENTORY_SYNC_SOURCES = INVENTORY_SYNC_SOURCES;

  return ProductSchema;
}

module.exports = {
  createProductSchema
};

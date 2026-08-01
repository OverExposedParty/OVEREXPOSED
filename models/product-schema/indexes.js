function applyProductIndexes(ProductSchema) {
  ProductSchema.index({
    'publishing.status': 1,
    'publishing.visibility': 1,
    'publishing.isActive': 1
  });
  ProductSchema.index({
    'publishing.status': 1,
    'publishing.visibility': 1,
    'publishing.publishedAt': 1,
    'merchandising.sortOrder': 1
  });
  ProductSchema.index({
    'publishing.isFeatured': 1,
    'merchandising.sortOrder': 1
  });
  ProductSchema.index({ 'identity.slug': 1 }, { unique: true });
  ProductSchema.index({
    'merchandising.catalog.main': 1,
    'merchandising.catalog.sub': 1,
    'merchandising.sortOrder': 1
  });
  ProductSchema.index({
    'merchandising.drop.dropId': 1,
    'merchandising.sortOrder': 1
  });
  ProductSchema.index({
    'merchandising.drop.slug': 1,
    'merchandising.sortOrder': 1
  });
  ProductSchema.index({ 'identity.searchKeywords': 1 });
  ProductSchema.index({ 'identity.tags': 1 });
  ProductSchema.index(
    { 'variants.inventory.sku': 1 },
    {
      unique: true,
      partialFilterExpression: {
        'variants.inventory.sku': { $type: 'string' }
      }
    }
  );
  ProductSchema.index({ 'variants.stripe.productId': 1 }, { sparse: true });
  ProductSchema.index({ 'variants.stripe.priceId': 1 }, { sparse: true });
  ProductSchema.index({
    'identity.name': 'text',
    'identity.shortDescription': 'text',
    'identity.description': 'text',
    'identity.tags': 'text',
    'identity.searchKeywords': 'text'
  });
}

module.exports = {
  applyProductIndexes
};

function attachProductHooks(ProductSchema) {
  ProductSchema.pre('validate', function normalizeProductFields(next) {
    this.identity = this.identity || {};
    this.publishing = this.publishing || {};
    this.merchandising = this.merchandising || {};
    this.merchandising.catalog = this.merchandising.catalog || {};
    this.merchandising.drop = this.merchandising.drop || {};
    this.content = this.content || {};
    this.content.details = this.content.details || {};
    this.system = this.system || {};
    this.variants = this.variants || [];

    this.identity.tags = [
      ...new Set(
        (this.identity.tags || []).map((tag) => tag.trim()).filter(Boolean)
      )
    ];
    this.identity.previousSlugs = [
      ...new Set((this.identity.previousSlugs || []).filter(Boolean))
    ];
    this.identity.searchKeywords = [
      ...new Set((this.identity.searchKeywords || []).filter(Boolean))
    ];
    this.merchandising.catalog.style = [
      ...new Set(
        (this.merchandising.catalog.style || [])
          .map((style) => style.trim())
          .filter(Boolean)
      )
    ];
    this.content.details.materials = [
      ...new Set((this.content.details.materials || []).filter(Boolean))
    ];
    this.content.details.careInstructions = [
      ...new Set((this.content.details.careInstructions || []).filter(Boolean))
    ];

    this.system.id = this._id?.toString() || null;
    this.slug = this.identity.slug || this.slug || null;

    if (
      this.publishing.status === 'scheduled' &&
      !this.publishing.publishedAt
    ) {
      this.invalidate(
        'publishing.publishedAt',
        'publishing.publishedAt is required when status is scheduled'
      );
    }

    if (this.publishing.status === 'active' && !this.publishing.publishedAt) {
      this.publishing.publishedAt = new Date();
    }

    const variantSkus = new Set();
    this.variants.forEach((variant, index) => {
      const inventory = variant.inventory;
      const sku = inventory?.sku;
      variant.digitalEntitlement = variant.digitalEntitlement || {};

      if (!sku) {
        this.invalidate(`variants.${index}.inventory.sku`, 'SKU is required');
        return;
      }

      if (variantSkus.has(sku)) {
        this.invalidate(
          `variants.${index}.inventory.sku`,
          `Duplicate variant SKU "${sku}"`
        );
      }
      variantSkus.add(sku);

      if (this.publishing.status === 'sold-out') {
        inventory.inStock = false;
      } else if (inventory.trackStock) {
        inventory.inStock =
          Math.max(0, inventory.quantity - inventory.reservedQuantity) > 0;
      } else {
        inventory.inStock = true;
      }
    });

    const normalizePurchaseMethods = (entitlement) => {
      if (!entitlement) return;

      const methods = Array.isArray(entitlement.purchaseMethods)
        ? entitlement.purchaseMethods.filter(Boolean)
        : [];
      entitlement.purchaseMethods = [
        ...new Set(methods.length ? methods : ['money'])
      ];
    };

    normalizePurchaseMethods(this.digitalEntitlement);
    this.variants.forEach((variant) =>
      normalizePurchaseMethods(variant.digitalEntitlement)
    );

    if (
      this.merchandising.defaultVariantSku &&
      !variantSkus.has(this.merchandising.defaultVariantSku)
    ) {
      this.invalidate(
        'merchandising.defaultVariantSku',
        'merchandising.defaultVariantSku must match a variant inventory SKU'
      );
    }

    next();
  });
}

module.exports = {
  attachProductHooks
};

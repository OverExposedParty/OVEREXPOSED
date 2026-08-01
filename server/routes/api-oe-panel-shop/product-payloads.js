function createOePanelShopProductPayloads(normalizers) {
  const {
    normalizePurchaseMethodsInput,
    normalizeShopMoneyAmount,
    normalizeShopOpalAmount,
    normalizeShopProductType,
    normalizeShopSlug,
    normalizeShopStatus,
    normalizeShopVisibility,
    parseProductGrantsInput,
    parseShopBoolean,
    validateProductGrants
  } = normalizers;

function createShopProductPayload(body = {}) {
      const name = String(body.name || body.product || '').trim();
      const slug = normalizeShopSlug(body.slug || name);
      const type = normalizeShopProductType(body.type);
      const status = normalizeShopStatus(body.status);
      const visibility = normalizeShopVisibility(body.visibility);
      const isActive = parseShopBoolean(body.active, false);
      const purchaseMethods = normalizePurchaseMethodsInput(
        body.purchaseMethods
      );
      const moneyAmount = normalizeShopMoneyAmount(body.moneyAmount, 0);
      const opalAmount = normalizeShopOpalAmount(body.opalAmount, null);
      const grants = parseProductGrantsInput(body.grantsJson || body.grants);
      const grantError = validateProductGrants(grants);
      const sku = String(body.sku || '')
        .trim()
        .toUpperCase();
      const variantName = String(body.variantName || 'Default').trim();
      const quantity = normalizeShopOpalAmount(body.quantity, 0);
      const trackStock = parseShopBoolean(body.trackStock, true);
      const currency = String(body.currency || 'GBP')
        .trim()
        .toUpperCase();

      if (!name) return { error: 'Product name is required.' };
      if (!slug) return { error: 'Product slug is required.' };
      if (!type) return { error: 'Product type must be physical or digital.' };
      if (!status) return { error: 'Product status is invalid.' };
      if (!visibility) return { error: 'Product visibility is invalid.' };
      if (isActive === null) return { error: 'Active must be yes or no.' };
      if (!purchaseMethods)
        return { error: 'Purchase methods must be money, opals, or both.' };
      if (moneyAmount === null)
        return { error: 'Money amount must be a positive number.' };
      if (opalAmount === null && purchaseMethods.includes('opals')) {
        return { error: 'Opal price is required when Opals are enabled.' };
      }
      if (grantError) return { error: grantError };
      if (!sku) return { error: 'Variant SKU is required.' };
      if (quantity === null)
        return { error: 'Quantity must be a whole number.' };
      if (trackStock === null)
        return { error: 'Track stock must be yes or no.' };

      return {
        product: {
          identity: {
            name,
            description: String(body.description || '').trim(),
            shortDescription: String(
              body.shortDescription || body.description || ''
            ).trim(),
            type,
            slug,
            tags: []
          },
          publishing: {
            status,
            visibility,
            isActive,
            publishedAt: status === 'active' ? new Date() : null,
            deletedAt: null
          },
          merchandising: {
            catalog: {},
            defaultVariantSku: sku
          },
          digitalEntitlement: {
            purchaseMethods,
            opalPrice: {
              amount: opalAmount,
              compareAtAmount: null
            },
            grants
          },
          variants: [
            {
              name: variantName || 'Default',
              price: {
                amount: moneyAmount,
                currency
              },
              inventory: {
                sku,
                quantity,
                reservedQuantity: 0,
                trackStock,
                inStock: trackStock ? quantity > 0 : true,
                syncSource: 'manual'
              },
              stripe: {
                productId: String(body.stripeProductId || '').trim() || null,
                priceId: String(body.stripePriceId || '').trim() || null
              },
              digitalEntitlement: {
                purchaseMethods,
                opalPrice: {
                  amount: opalAmount,
                  compareAtAmount: null
                },
                grants
              }
            }
          ]
        }
      };
    }

    function createShopProductUpdatePayload(body = {}) {
      const set = {};

      if (Object.prototype.hasOwnProperty.call(body, 'product')) {
        const name = String(body.product || '').trim();
        if (!name) return { error: 'Product name is required.' };
        set['identity.name'] = name;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
        const slug = normalizeShopSlug(body.slug);
        if (!slug) return { error: 'Product slug is required.' };
        set['identity.slug'] = slug;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'type')) {
        const type = normalizeShopProductType(body.type);
        if (!type)
          return { error: 'Product type must be physical or digital.' };
        set['identity.type'] = type;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'description')) {
        set['identity.description'] = String(body.description || '').trim();
        set['identity.shortDescription'] = String(
          body.description || ''
        ).trim();
      }

      if (Object.prototype.hasOwnProperty.call(body, 'status')) {
        const status = normalizeShopStatus(body.status);
        if (!status) return { error: 'Product status is invalid.' };
        set['publishing.status'] = status;
        if (status === 'active') set['publishing.publishedAt'] = new Date();
      }

      if (Object.prototype.hasOwnProperty.call(body, 'visibility')) {
        const visibility = normalizeShopVisibility(body.visibility);
        if (!visibility) return { error: 'Product visibility is invalid.' };
        set['publishing.visibility'] = visibility;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'active')) {
        const isActive = parseShopBoolean(body.active, false);
        if (isActive === null) return { error: 'Active must be yes or no.' };
        set['publishing.isActive'] = isActive;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'purchaseMethods')) {
        const purchaseMethods = normalizePurchaseMethodsInput(
          body.purchaseMethods
        );
        if (!purchaseMethods) {
          return { error: 'Purchase methods must be money, opals, or both.' };
        }
        set['digitalEntitlement.purchaseMethods'] = purchaseMethods;
        set['variants.$[variant].digitalEntitlement.purchaseMethods'] =
          purchaseMethods;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'moneyAmount')) {
        const moneyAmount = normalizeShopMoneyAmount(body.moneyAmount, 0);
        if (moneyAmount === null)
          return { error: 'Money amount must be a positive number.' };
        set['variants.$[variant].price.amount'] = moneyAmount;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'currency')) {
        const currency = String(body.currency || 'GBP')
          .trim()
          .toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency))
          return { error: 'Currency must be a three-letter code.' };
        set['variants.$[variant].price.currency'] = currency;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'opalAmount')) {
        const opalAmount = normalizeShopOpalAmount(body.opalAmount, null);
        if (opalAmount === null)
          return { error: 'Opal price must be a whole number.' };
        set['digitalEntitlement.opalPrice.amount'] = opalAmount;
        set['variants.$[variant].digitalEntitlement.opalPrice.amount'] =
          opalAmount;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'grantsJson')) {
        const grants = parseProductGrantsInput(body.grantsJson);
        const grantError = validateProductGrants(grants);
        if (grantError) return { error: grantError };
        set['digitalEntitlement.grants'] = grants;
        set['variants.$[variant].digitalEntitlement.grants'] = grants;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'variantName')) {
        const variantName = String(body.variantName || '').trim();
        if (!variantName) return { error: 'Variant name is required.' };
        set['variants.$[variant].name'] = variantName;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'quantity')) {
        const quantity = normalizeShopOpalAmount(body.quantity, 0);
        if (quantity === null)
          return { error: 'Quantity must be a whole number.' };
        set['variants.$[variant].inventory.quantity'] = quantity;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'trackStock')) {
        const trackStock = parseShopBoolean(body.trackStock, true);
        if (trackStock === null)
          return { error: 'Track stock must be yes or no.' };
        set['variants.$[variant].inventory.trackStock'] = trackStock;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'stripeProductId')) {
        set['variants.$[variant].stripe.productId'] =
          String(body.stripeProductId || '').trim() || null;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'stripePriceId')) {
        set['variants.$[variant].stripe.priceId'] =
          String(body.stripePriceId || '').trim() || null;
      }

      return { set };
    }

  return { createShopProductPayload, createShopProductUpdatePayload };
}

module.exports = { createOePanelShopProductPayloads };

function toPositiveInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function getEntitlementConfig(product, variant = null) {
  const productEntitlement = product?.digitalEntitlement || {};
  const variantEntitlement = variant?.digitalEntitlement || {};
  const variantMethods = Array.isArray(variantEntitlement.purchaseMethods)
    ? variantEntitlement.purchaseMethods
    : [];
  const productMethods = Array.isArray(productEntitlement.purchaseMethods)
    ? productEntitlement.purchaseMethods
    : [];
  const variantGrants = Array.isArray(variantEntitlement.grants)
    ? variantEntitlement.grants
    : [];
  const productGrants = Array.isArray(productEntitlement.grants)
    ? productEntitlement.grants
    : [];
  const variantOpalAmount = variantEntitlement.opalPrice?.amount;
  const productOpalAmount = productEntitlement.opalPrice?.amount;

  return {
    purchaseMethods: variantMethods.length ? variantMethods : productMethods,
    opalPrice: toPositiveInteger(variantOpalAmount ?? productOpalAmount, 0),
    grants: variantGrants.length ? variantGrants : productGrants
  };
}

function findProductVariant(product, variantSku) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  if (variantSku) {
    return (
      variants.find(
        (variant) => variant.inventory?.sku === String(variantSku).trim()
      ) || null
    );
  }

  return (
    variants.find(
      (variant) =>
        variant.inventory?.sku === product.merchandising?.defaultVariantSku
    ) ||
    variants.find((variant) => variant.inventory?.inStock) ||
    variants[0]
  );
}

function normalizeGrant(grant, product, variant) {
  const key = String(grant?.key || '').trim();
  const type = String(grant?.type || '').trim();
  const quantity = toPositiveInteger(grant?.quantity, 1) || 1;

  if (!key || !type) return null;

  return {
    type,
    key,
    quantity,
    source: 'opals',
    gamemode: grant.gamemode || null,
    unlockedAt: new Date(),
    claimedAt: new Date(),
    rewardGranted: true,
    metadata: {
      ...(grant.metadata || {}),
      productId: product._id?.toString?.() || product.system?.id || null,
      productSlug: product.identity?.slug || null,
      productName: product.identity?.name || null,
      variantSku: variant?.inventory?.sku || null,
      variantName: variant?.name || null,
      purchaseMethod: 'opals'
    }
  };
}

function normalizeAdminGrant(grant, metadata = {}) {
  const key = String(grant?.key || '').trim();
  const type = String(grant?.type || '').trim();
  const quantity = toPositiveInteger(grant?.quantity, 1) || 1;

  if (!key || !type) return null;

  return {
    type,
    key,
    quantity,
    source: 'admin',
    gamemode: grant.gamemode || null,
    unlockedAt: new Date(),
    claimedAt: new Date(),
    rewardGranted: true,
    metadata: {
      ...(grant.metadata || {}),
      ...metadata,
      grantMethod: 'admin_console'
    }
  };
}

module.exports = {
  toPositiveInteger,
  getEntitlementConfig,
  findProductVariant,
  normalizeGrant,
  normalizeAdminGrant
};

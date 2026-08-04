function createOePanelShopProductNormalizers({ Product, parseBooleanLabel }) {
  function normalizeShopSlug(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeShopStatus(value, fallback = 'draft') {
    const status = String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    return Product.STATUSES.includes(status) ? status : null;
  }

  function normalizeShopVisibility(value, fallback = 'hidden') {
    const visibility = String(value || fallback)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');

    return Product.VISIBILITIES.includes(visibility) ? visibility : null;
  }

  function normalizeShopProductType(value, fallback = 'digital') {
    const type = String(value || fallback)
      .trim()
      .toLowerCase();
    return Product.TYPES.includes(type) ? type : null;
  }

  function normalizePurchaseMethodsInput(value) {
    const methods = String(value || 'money')
      .split(',')
      .map((method) => method.trim().toLowerCase())
      .filter(Boolean);
    const uniqueMethods = [...new Set(methods)];

    if (
      !uniqueMethods.length ||
      uniqueMethods.some((method) => !['money', 'opals'].includes(method))
    ) {
      return null;
    }

    return uniqueMethods;
  }

  function normalizeShopMoneyAmount(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizeShopOpalAmount(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
  }

  function parseShopBoolean(value, fallback = false) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = parseBooleanLabel(value);
    return parsed === null ? null : parsed;
  }

  function parseProductGrantsInput(value) {
    const rawValue = String(value || '').trim();
    if (!rawValue) return [];

    try {
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) return null;

      return parsed
        .map((grant) => ({
          type: String(grant?.type || '').trim(),
          key: String(grant?.key || '').trim(),
          gamemode: String(grant?.gamemode || '').trim() || null,
          quantity: normalizeShopOpalAmount(grant?.quantity, 1) || 1,
          metadata:
            grant?.metadata && typeof grant.metadata === 'object'
              ? grant.metadata
              : {}
        }))
        .filter((grant) => grant.type && grant.key);
    } catch {
      return String(rawValue)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [type, key, gamemode] = entry
            .split(':')
            .map((part) => part.trim());
          return {
            type,
            key,
            gamemode: gamemode || null,
            quantity: 1,
            metadata: {}
          };
        })
        .filter((grant) => grant.type && grant.key);
    }
  }

  function validateProductGrants(grants) {
    const validTypes = new Set([
      'oe',
      'pack',
      'cosmetic',
      'badge',
      'oling_egg',
      'oling_consumable',
      'oling_headwear'
    ]);
    if (!Array.isArray(grants))
      return 'Product grants must be JSON or comma-separated type:key entries.';

    const invalidGrant = grants.find(
      (grant) => !validTypes.has(grant.type) || !grant.key
    );
    if (invalidGrant) {
      return 'Product grants must use oe, pack, cosmetic, badge, oling_egg, oling_consumable, or oling_headwear.';
    }

    return null;
  }

  return {
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
  };
}

module.exports = { createOePanelShopProductNormalizers };

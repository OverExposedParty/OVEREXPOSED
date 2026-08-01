function createOePanelShopProductPresentation({
  formatCurrencyValue,
  formatOePanelDateTime
}) {
function getShopDefaultVariant(product) {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (!variants.length) return null;

      return (
        variants.find(
          (variant) =>
            variant.inventory?.sku === product.merchandising?.defaultVariantSku
        ) ||
        variants.find((variant) => variant.inventory?.inStock) ||
        variants[0]
      );
    }

    function getShopEntitlement(product, variant = null) {
      const productEntitlement = product.digitalEntitlement || {};
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

      return {
        purchaseMethods: variantMethods.length
          ? variantMethods
          : productMethods,
        opalPrice:
          variantEntitlement.opalPrice?.amount ??
          productEntitlement.opalPrice?.amount ??
          null,
        grants: variantGrants.length ? variantGrants : productGrants
      };
    }

    const BASIC_HANGING_LIGHT_IMAGE =
      '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg';

    function isBasicHangingLightProduct(product) {
      const identity = product?.identity || {};
      const name = String(identity.name || '')
        .trim()
        .toLowerCase();
      const slug = String(identity.slug || product?.slug || '')
        .trim()
        .toLowerCase();
      return (
        name === 'basic hanging light' ||
        slug === 'basic_hanging_light' ||
        slug === 'basic-hanging-light'
      );
    }

    function normalizeShopPreviewImagePath(image) {
      return String(image || '').replace(
        '/images/olings/furniture/ceiling-lights/basic-hanging-light.svg',
        BASIC_HANGING_LIGHT_IMAGE
      );
    }

    function getShopProductPreview(product, variant = null) {
      if (isBasicHangingLightProduct(product)) {
        return BASIC_HANGING_LIGHT_IMAGE;
      }

      const productGallery = Array.isArray(product.media?.gallery)
        ? product.media.gallery
        : [];
      const variantGallery = Array.isArray(variant?.media?.gallery)
        ? variant.media.gallery
        : [];
      const image =
        product.media?.mainImage?.url ||
        variant?.media?.mainImage?.url ||
        productGallery.find((item) => item?.type !== 'video')?.url ||
        variantGallery.find((item) => item?.type !== 'video')?.url ||
        '';

      return normalizeShopPreviewImagePath(image);
    }

    function formatShopPurchaseMethods(methods = []) {
      const labels = {
        money: 'Money',
        opals: 'Opals'
      };

      return methods.length
        ? methods.map((method) => labels[method] || method).join(' + ')
        : '-';
    }

    function formatShopGrants(grants = []) {
      return grants.length
        ? grants
            .map((grant) =>
              [grant.type, grant.key, grant.gamemode].filter(Boolean).join(':')
            )
            .join(', ')
        : '-';
    }

    function serializeProductForOePanel(product) {
      const identity = product.identity || {};
      const publishing = product.publishing || {};
      const system = product.system || {};
      const variant = getShopDefaultVariant(product);
      const entitlement = getShopEntitlement(product, variant);
      const moneyPrice = variant?.price || { amount: 0, currency: 'GBP' };
      const stockLabel = variant?.inventory?.trackStock
        ? `${Math.max(
            0,
            Number(variant.inventory.quantity || 0) -
              Number(variant.inventory.reservedQuantity || 0)
          )} left`
        : 'Untracked';
      const purchaseMethods = entitlement.purchaseMethods.length
        ? entitlement.purchaseMethods
        : ['money'];
      const grantsJson = JSON.stringify(entitlement.grants || []);

      return {
        key: String(product._id),
        productId: String(product._id),
        product: identity.name || '-',
        slug: identity.slug || '-',
        type: identity.type || '-',
        payment: formatShopPurchaseMethods(purchaseMethods),
        purchaseMethods: purchaseMethods.join(', '),
        money: purchaseMethods.includes('money')
          ? formatCurrencyValue(
              moneyPrice.amount || 0,
              moneyPrice.currency || 'GBP'
            )
          : '-',
        moneyAmount:
          moneyPrice.amount === null || moneyPrice.amount === undefined
            ? ''
            : String(moneyPrice.amount),
        currency: moneyPrice.currency || 'GBP',
        opals:
          entitlement.opalPrice === null || entitlement.opalPrice === undefined
            ? '-'
            : String(entitlement.opalPrice),
        opalAmount:
          entitlement.opalPrice === null || entitlement.opalPrice === undefined
            ? ''
            : String(entitlement.opalPrice),
        grants: formatShopGrants(entitlement.grants),
        grantsJson,
        stock: stockLabel,
        sku: variant?.inventory?.sku || '-',
        variantName: variant?.name || '-',
        quantity: String(variant?.inventory?.quantity ?? 0),
        trackStock: variant?.inventory?.trackStock === false ? 'No' : 'Yes',
        status: publishing.status || '-',
        visibility: publishing.visibility || '-',
        active: publishing.isActive ? 'Yes' : 'No',
        stripeProductId: variant?.stripe?.productId || '-',
        stripePriceId: variant?.stripe?.priceId || '-',
        publishedAt: formatOePanelDateTime(publishing.publishedAt),
        updatedAt: formatOePanelDateTime(system.updatedAt || product.updatedAt),
        preview: getShopProductPreview(product, variant),
        description: identity.shortDescription || identity.description || '-'
      };
    }

    function createShopIssueAlerts(products) {
      const alerts = [];

      products.forEach((product) => {
        const identity = product.identity || {};
        const publishing = product.publishing || {};
        const variant = getShopDefaultVariant(product);
        const entitlement = getShopEntitlement(product, variant);
        const purchaseMethods = entitlement.purchaseMethods.length
          ? entitlement.purchaseMethods
          : ['money'];
        const title = identity.name || identity.slug || String(product._id);

        if (
          purchaseMethods.includes('opals') &&
          !Number(entitlement.opalPrice)
        ) {
          alerts.push({
            title: `${title} has no Opal price`,
            roomCode: identity.slug || '-',
            detail: 'Opal purchases need a positive Opal price.',
            severity: 'high',
            containerType: 'shop-product',
            'container-type': 'shop-product',
            query: `[slug:${identity.slug || title}]`
          });
        }

        if (identity.type === 'digital' && !entitlement.grants.length) {
          alerts.push({
            title: `${title} has no grants`,
            roomCode: identity.slug || '-',
            detail:
              'Digital products should grant a pack, OE, cosmetic, badge, Oling egg, or Oling consumable.',
            severity: publishing.status === 'active' ? 'high' : 'medium',
            containerType: 'shop-product',
            'container-type': 'shop-product',
            query: `[slug:${identity.slug || title}]`
          });
        }

        if (
          purchaseMethods.includes('money') &&
          identity.type === 'digital' &&
          !variant?.stripe?.priceId &&
          publishing.status === 'active'
        ) {
          alerts.push({
            title: `${title} has no Stripe price`,
            roomCode: identity.slug || '-',
            detail: 'Money purchases should have a Stripe price before launch.',
            severity: 'medium',
            containerType: 'shop-product',
            'container-type': 'shop-product',
            query: `[slug:${identity.slug || title}]`
          });
        }

        if (
          identity.type === 'physical' &&
          purchaseMethods.length === 1 &&
          purchaseMethods.includes('opals')
        ) {
          alerts.push({
            title: `${title} is physical and Opal-only`,
            roomCode: identity.slug || '-',
            detail: 'Physical goods should usually use money checkout.',
            severity: 'medium',
            containerType: 'shop-product',
            'container-type': 'shop-product',
            query: `[slug:${identity.slug || title}]`
          });
        }

        if (!variant) {
          alerts.push({
            title: `${title} has no variant`,
            roomCode: identity.slug || '-',
            detail: 'Products need at least one variant with a SKU.',
            severity: 'high',
            containerType: 'shop-product',
            'container-type': 'shop-product',
            query: `[slug:${identity.slug || title}]`
          });
        }
      });

      return alerts.slice(0, 12);
    }

  return {
    createShopIssueAlerts,
    getShopDefaultVariant,
    serializeProductForOePanel
  };
}

module.exports = { createOePanelShopProductPresentation };

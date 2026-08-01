(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    const SECTION_RENDERERS = {
      hero: renderHeroSection,
      'category-switcher': renderCategorySwitcherSection,
      featured: renderFeaturedSection,
      'product-grid': renderProductGridSection
    };

    function collectOwnedKeys(
      value,
      owned = { layers: new Set(), furniture: new Set() }
    ) {
      if (!value || typeof value !== 'object') return owned;

      if (Array.isArray(value)) {
        value.forEach((item) => collectOwnedKeys(item, owned));
        return owned;
      }

      if (['oe', 'pack'].includes(value.type) && value.key) {
        owned.layers.add(value.key);
      }

      if (value.type === 'oling_furniture' && value.key) {
        owned.furniture.add(value.key);
      }

      Object.values(value).forEach((item) => collectOwnedKeys(item, owned));
      return owned;
    }

    function isOwnedProduct(product, ownedKeys) {
      const grants = getProductGrants(product);
      return grants.some((grant) => {
        if (['oe', 'pack'].includes(grant.type)) {
          return ownedKeys.layers.has(grant.key);
        }
        if (grant.type === 'oling_furniture') {
          return ownedKeys.furniture.has(grant.key);
        }
        return false;
      });
    }

    function renderShopSections() {
      document
        .querySelectorAll(
          '.main-container[data-template="shop"] .shop-section-container'
        )
        .forEach((section) => {
          const config = getSectionConfig(section);
          const renderer = SECTION_RENDERERS[config.type];

          if (!renderer) {
            section.dataset.sectionRenderState = 'unknown-section-type';
            return;
          }

          renderer(section, config);
        });

      initSectionPageColourTracking();
    }

    renderShopSections();

    window.addEventListener('oe-account-state-changed', () => {
      document
        .querySelectorAll(
          '.shop-section-container[data-section-type="featured"], .shop-section-container[data-section-type="product-grid"]'
        )
        .forEach((section) => {
          const config = getSectionConfig(section);
          const renderer = SECTION_RENDERERS[config.type];
          renderer?.(section, config);
        });
    });

    if (typeof window.SetScriptLoaded === 'function') {
      window.SetScriptLoaded('/scripts/shop/landing-page/start.js');
    }

    if (window.Ready && typeof window.Ready.set === 'function') {
      window.Ready.set('shop-landing-page', true);
    }

    Object.assign(shop, {
      collectOwnedKeys,
      isOwnedProduct,
      renderShopSections
    });
  }
})();

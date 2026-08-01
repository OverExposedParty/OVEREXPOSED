(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    const SHOP_PRODUCTS_ENDPOINT = '/api/shop/products';

    const OLING_EGGS_ENDPOINT = '/api/olings/eggs';

    const OLING_PERSONALITIES_ENDPOINT = '/api/olings/personalities';

    const RARITY_PALETTE_ENDPOINT = '/json-files/olings/rarities.json';

    const shopProductsCache = new Map();

    const DEFAULT_PAGE_COLOURS = {
      primary: '#FFF0E8',
      secondary: '#FFD7C7'
    };

    const PRODUCT_CARD_TAG_LIMIT = 4;

    let activePageColourKey = '';

    let scheduledPageColourUpdate = 0;

    let isPageColourTrackingInitialized = false;

    let olingEggsPromise = null;

    let olingPersonalitiesPromise = null;

    let rarityPalettePromise = null;

    let rarityPalette = {};

    let shopHatchViews = null;

    const SHOP_CATEGORY_LINKS = [
      ['OE Layers', '#oe-layers'],
      ['OE Eggs', '#oe-eggs'],
      ['Oling Furniture', '#oling-furniture'],
      ['Oling Consumables', '#oling-consumables']
    ];

    const SHOP_CATEGORY_LABELS = {
      eggs: 'OE Eggs',
      consumables: 'Oling Consumables',
      furniture: 'Oling Furniture',
      layers: 'OE Layers'
    };

    const SLOT_FILTERS = {
      colour: 'Colour',
      'head-slot': 'Head',
      head: 'Head',
      'eyes-slot': 'Eyes',
      eyes: 'Eyes',
      'mouth-slot': 'Mouth',
      mouth: 'Mouth',
      pack: 'Packs',
      packs: 'Packs'
    };

    function getSectionConfig(section) {
      return {
        type: section.dataset.sectionType || '',
        category: section.dataset.sectionCategory || '',
        filters: String(section.dataset.sectionFilters || '')
          .split(',')
          .map((filter) => filter.trim())
          .filter(Boolean),
        imageSource: section.dataset.sectionImageSource || '',
        imageAlt: section.dataset.sectionImageAlt || '',
        videoSource: section.dataset.sectionVideoSource || '',
        videoPoster: section.dataset.sectionVideoPoster || '',
        productsEndpoint: section.dataset.sectionProductsEndpoint || '',
        primaryColour: section.dataset.sectionPrimaryColour || '',
        secondaryColour: section.dataset.sectionSecondaryColour || '',
        backgroundColour: section.dataset.sectionBackgroundColour || '',
        header: section.dataset.sectionHeader || '',
        description: section.dataset.sectionDescription || '',
        actionLabel: section.dataset.sectionActionLabel || '',
        actionHref: section.dataset.sectionActionHref || ''
      };
    }

    function getVersionedAssetUrl(assetUrl) {
      const normalizedAssetUrl = String(assetUrl || '').replace(
        '/images/olings/furniture/ceiling-lights/basic-hanging-light.svg',
        '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg'
      );
      if (typeof window.versionAssetUrl === 'function') {
        return window.versionAssetUrl(normalizedAssetUrl);
      }

      return normalizedAssetUrl;
    }

    function getVideoType(videoSource) {
      const cleanSource = videoSource.split('?')[0].split('#')[0].toLowerCase();

      if (cleanSource.endsWith('.webm')) return 'video/webm';
      if (cleanSource.endsWith('.ogg') || cleanSource.endsWith('.ogv')) {
        return 'video/ogg';
      }
      return 'video/mp4';
    }

    function applySectionColours(section, config) {
      if (config.primaryColour) {
        section.style.setProperty(
          '--shop-section-primary-colour',
          config.primaryColour
        );
      }

      if (config.secondaryColour) {
        section.style.setProperty(
          '--shop-section-secondary-colour',
          config.secondaryColour
        );
      }

      if (config.backgroundColour) {
        section.style.setProperty(
          '--shop-section-background-colour',
          config.backgroundColour
        );
      }
    }

    function applyPageColours(colours, options = {}) {
      if (!colours.primary && !colours.secondary) return;

      const primary = colours.primary || DEFAULT_PAGE_COLOURS.primary;
      const secondary = colours.secondary || DEFAULT_PAGE_COLOURS.secondary;
      const headerMode = options.transparentHeader ? 'transparent' : 'solid';
      const colourKey = `${primary}|${secondary}|${headerMode}`;
      if (colourKey === activePageColourKey) return;

      const root = document.documentElement;
      root.style.setProperty('--primarypagecolour', primary);
      root.style.setProperty('--secondarypagecolour', secondary);
      root.style.setProperty('--shop-scrollbar-primary-colour', primary);
      root.style.setProperty('--shop-scrollbar-secondary-colour', secondary);
      root.style.scrollbarColor = `${primary} transparent`;
      document.body?.style.setProperty('--primarypagecolour', primary);
      document.body?.style.setProperty('--secondarypagecolour', secondary);
      document.body?.style.setProperty(
        '--shop-scrollbar-primary-colour',
        primary
      );
      document.body?.style.setProperty(
        '--shop-scrollbar-secondary-colour',
        secondary
      );
      if (document.body) {
        document.body.style.scrollbarColor = `${primary} transparent`;
      }
      updateShopScrollbarStyles(primary, secondary);
      document
        .getElementById('header')
        ?.classList.toggle(
          'shop-header-transparent',
          Boolean(options.transparentHeader)
        );
      activePageColourKey = colourKey;
    }

    function updateShopScrollbarStyles(primary, secondary) {
      if (!window.CSS || !CSS.supports('color', primary)) return;

      const hoverColour = CSS.supports('color', secondary)
        ? secondary
        : primary;
      let style = document.getElementById('shop-scrollbar-colour-styles');
      if (!style) {
        style = document.createElement('style');
        style.id = 'shop-scrollbar-colour-styles';
        document.head.appendChild(style);
      }

      style.textContent = `
    html.shop-page::-webkit-scrollbar-thumb,
    body.shop-page::-webkit-scrollbar-thumb { background-color: ${primary}; }
    html.shop-page::-webkit-scrollbar-thumb:hover,
    body.shop-page::-webkit-scrollbar-thumb:hover { background-color: ${hoverColour}; }
    `;
    }

    function getConfigSectionColours(config) {
      return {
        primary: config.primaryColour || config.backgroundColour || '',
        secondary: config.secondaryColour || ''
      };
    }

    function getSectionPageColours(section) {
      const config = getSectionConfig(section);
      const computed = window.getComputedStyle(section);
      const primary =
        config.primaryColour ||
        config.backgroundColour ||
        computed.getPropertyValue('--shop-section-primary-colour').trim() ||
        computed.getPropertyValue('--shop-section-background-colour').trim() ||
        DEFAULT_PAGE_COLOURS.primary;
      const secondary =
        config.secondaryColour ||
        computed.getPropertyValue('--shop-section-secondary-colour').trim() ||
        DEFAULT_PAGE_COLOURS.secondary;

      return { primary, secondary };
    }

    function getHeaderTouchY() {
      const header = document.getElementById('header');
      const headerRect = header?.getBoundingClientRect();
      return Math.max(1, Math.round(headerRect?.bottom || 0) + 1);
    }

    function getSectionTouchingHeader(sections) {
      const touchY = getHeaderTouchY();
      const tolerance = 3;
      const current = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return (
          rect.top <= touchY + tolerance && rect.bottom > touchY - tolerance
        );
      });

      if (current) return current;

      return (
        sections
          .map((section) => ({
            section,
            distance: Math.abs(section.getBoundingClientRect().top - touchY)
          }))
          .sort((a, b) => a.distance - b.distance)[0]?.section || null
      );
    }

    function updatePageColoursForCurrentSection() {
      scheduledPageColourUpdate = 0;

      const sections = Array.from(
        document.querySelectorAll(
          '.main-container[data-template="shop"] .shop-section-container'
        )
      );
      const activeSection = getSectionTouchingHeader(sections);

      if (!activeSection) return;
      applyPageColours(getSectionPageColours(activeSection), {
        transparentHeader: getSectionConfig(activeSection).type === 'hero'
      });
    }

    function schedulePageColourUpdate() {
      if (scheduledPageColourUpdate) return;
      scheduledPageColourUpdate = window.requestAnimationFrame(
        updatePageColoursForCurrentSection
      );
    }

    function initSectionPageColourTracking() {
      if (isPageColourTrackingInitialized) return;
      isPageColourTrackingInitialized = true;

      document.documentElement.classList.add('shop-page');
      document.body?.classList.add('shop-page');
      updatePageColoursForCurrentSection();
      window.requestAnimationFrame(updatePageColoursForCurrentSection);
      window.setTimeout(updatePageColoursForCurrentSection, 100);
      window.addEventListener('scroll', schedulePageColourUpdate, {
        passive: true
      });
      document.addEventListener('scroll', schedulePageColourUpdate, {
        passive: true,
        capture: true
      });
      document
        .querySelector('.main-container[data-template="shop"]')
        ?.addEventListener('scroll', schedulePageColourUpdate, {
          passive: true
        });
      window.addEventListener('resize', () => {
        schedulePageColourUpdate();
      });
      window.addEventListener('orientationchange', schedulePageColourUpdate);
      window.addEventListener('hashchange', schedulePageColourUpdate);
    }

    function getProductDefaultSectionColours(product) {
      if (isEggProduct(product)) {
        return { primary: '#E8FFF1', secondary: '#CFF4DC' };
      }

      if (isConsumableProduct(product)) {
        return { primary: '#FFF0E8', secondary: '#FFD7C7' };
      }

      if (isFurnitureProduct(product)) {
        return { primary: '#F0F4FF', secondary: '#CBD8FF' };
      }

      return { primary: '#DDF3F1', secondary: '#BFE7E3' };
    }

    function resolvePurchaseColours(product, sectionColours = {}) {
      const defaults = getProductDefaultSectionColours(product);
      return {
        primary: sectionColours.primary || defaults.primary,
        secondary: sectionColours.secondary || defaults.secondary
      };
    }

    Object.assign(shop, {
      SHOP_PRODUCTS_ENDPOINT,
      OLING_EGGS_ENDPOINT,
      OLING_PERSONALITIES_ENDPOINT,
      RARITY_PALETTE_ENDPOINT,
      shopProductsCache,
      DEFAULT_PAGE_COLOURS,
      PRODUCT_CARD_TAG_LIMIT,
      activePageColourKey,
      scheduledPageColourUpdate,
      isPageColourTrackingInitialized,
      olingEggsPromise,
      olingPersonalitiesPromise,
      rarityPalettePromise,
      rarityPalette,
      shopHatchViews,
      SHOP_CATEGORY_LINKS,
      SHOP_CATEGORY_LABELS,
      SLOT_FILTERS,
      getSectionConfig,
      getVersionedAssetUrl,
      getVideoType,
      applySectionColours,
      applyPageColours,
      updateShopScrollbarStyles,
      getConfigSectionColours,
      getSectionPageColours,
      getHeaderTouchY,
      getSectionTouchingHeader,
      updatePageColoursForCurrentSection,
      schedulePageColourUpdate,
      initSectionPageColourTracking,
      getProductDefaultSectionColours,
      resolvePurchaseColours
    });
  }
})();

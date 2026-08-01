(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function hasGrantType(product, type) {
      return getProductGrants(product).some((grant) => grant.type === type);
    }

    function isEggProduct(product) {
      return (
        hasGrantType(product, 'oling_egg') ||
        product?.merchandising?.catalog?.sub === 'eggs' ||
        getProductTags(product).includes('egg')
      );
    }

    function isLayerProduct(product) {
      return (
        hasGrantType(product, 'oe') ||
        hasGrantType(product, 'pack') ||
        product?.merchandising?.catalog?.sub === 'oe-customisation' ||
        getProductTags(product).includes('customisation')
      );
    }

    function isConsumableProduct(product) {
      return (
        hasGrantType(product, 'oling_consumable') ||
        product?.merchandising?.catalog?.sub === 'consumables' ||
        getProductTags(product).includes('consumable')
      );
    }

    function isFurnitureProduct(product) {
      return (
        hasGrantType(product, 'oling_furniture') ||
        product?.merchandising?.catalog?.sub === 'furniture' ||
        getProductTags(product).includes('furniture')
      );
    }

    function getLayerFilter(product) {
      const grant = getProductGrants(product).find((item) =>
        ['oe', 'pack'].includes(item.type)
      );
      const slot =
        grant?.type === 'pack'
          ? 'pack'
          : grant?.metadata?.slot || getProductStyles(product).find(Boolean);

      return SLOT_FILTERS[slot] || 'All';
    }

    function getEggFilter(product) {
      const grant = getProductGrants(product).find(
        (item) => item.type === 'oling_egg'
      );
      const values = [
        grant?.metadata?.eggType,
        grant?.metadata?.rarity,
        product?.merchandising?.catalog?.season,
        ...getProductStyles(product),
        ...getProductTags(product)
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      if (values.includes('limited')) return 'Limited';
      if (values.includes('event')) return 'Event';
      if (values.includes('rare')) return 'Rare';
      if (values.includes('base')) return 'Base';
      return 'All';
    }

    function getConsumableFilterTags(product) {
      const tags = [];
      const grants = getProductGrants(product).filter(
        (grant) => grant.type === 'oling_consumable'
      );

      grants.forEach((grant) => {
        addProductTag(tags, grant.metadata?.consumableCategory);
        addProductTag(tags, grant.metadata?.consumableSubcategory);
        addProductTag(tags, grant.metadata?.consumableType);
        addProductTag(tags, grant.metadata?.personalityKey);
      });

      return tags.filter((tag) => tag !== 'All');
    }

    function getFurnitureFilterTags(product) {
      const tags = [];
      const grants = getProductGrants(product).filter(
        (grant) => grant.type === 'oling_furniture'
      );

      grants.forEach((grant) => {
        addProductTag(tags, grant.metadata?.furnitureCategory);
        addProductTag(tags, grant.metadata?.furnitureType);
        addProductTag(tags, grant.metadata?.rarity);
      });

      return tags.filter((tag) => tag !== 'All');
    }

    function formatTagLabel(value) {
      return String(value || '')
        .trim()
        .replace(/^oling[_\s-]*/i, 'oling ')
        .replace(/^oe$/i, 'OE')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
        .replace(/^Oe\b/, 'OE');
    }

    function addProductTag(tags, label) {
      const normalized = formatTagLabel(label);
      if (!normalized) return;
      if (!tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase())) {
        tags.push(normalized);
      }
    }

    function getConsumableCardTags(product, options = {}) {
      const sectionCategory = options.category || '';
      const tags = [];
      const grants = getProductGrants(product).filter(
        (grant) => grant.type === 'oling_consumable'
      );
      const primaryGrant = grants[0] || null;

      if (sectionCategory !== 'consumables') {
        addProductTag(tags, 'Consumable');
      }
      addProductTag(tags, primaryGrant?.metadata?.consumableCategory);
      addProductTag(tags, primaryGrant?.metadata?.consumableSubcategory);
      addProductTag(tags, primaryGrant?.metadata?.consumableType);
      addProductTag(tags, primaryGrant?.metadata?.personalityKey);

      return tags
        .filter((tag) => tag !== 'All')
        .slice(0, PRODUCT_CARD_TAG_LIMIT);
    }

    function getFurnitureCardTags(product, options = {}) {
      const sectionCategory = options.category || '';
      const tags = [];
      const grants = getProductGrants(product).filter(
        (grant) => grant.type === 'oling_furniture'
      );
      const primaryGrant = grants[0] || null;

      if (sectionCategory !== 'furniture') {
        addProductTag(tags, 'Furniture');
      }
      addProductTag(tags, primaryGrant?.metadata?.furnitureCategory);
      addProductTag(tags, primaryGrant?.metadata?.furnitureType);
      addProductTag(tags, primaryGrant?.metadata?.rarity);

      return tags
        .filter((tag) => tag !== 'All')
        .slice(0, PRODUCT_CARD_TAG_LIMIT);
    }

    function getProductCardTags(product, options = {}) {
      const sectionCategory = options.category || '';

      if (Array.isArray(options.badges) && options.badges.length) {
        return options.badges
          .slice(0, PRODUCT_CARD_TAG_LIMIT)
          .map(formatTagLabel)
          .filter(Boolean);
      }

      if (options.badge) {
        return [formatTagLabel(options.badge)].filter(Boolean);
      }

      const tags = [];
      const grants = getProductGrants(product);
      const catalogSub = product?.merchandising?.catalog?.sub;

      if (isEggProduct(product)) {
        if (sectionCategory !== 'eggs') addProductTag(tags, 'Egg');
        addProductTag(tags, getEggFilter(product));
      } else if (isConsumableProduct(product)) {
        return getConsumableCardTags(product, options);
      } else if (isFurnitureProduct(product)) {
        return getFurnitureCardTags(product, options);
      } else if (isLayerProduct(product)) {
        if (sectionCategory !== 'layers') addProductTag(tags, 'OE Layer');
        addProductTag(tags, getLayerFilter(product));
      } else if (catalogSub) {
        addProductTag(tags, catalogSub);
      } else if (product?.identity?.type) {
        addProductTag(tags, product.identity.type);
      }

      grants.forEach((grant) => {
        if (tags.length >= PRODUCT_CARD_TAG_LIMIT) return;
        addProductTag(tags, grant.metadata?.rarity);
        addProductTag(tags, grant.metadata?.consumableType);
        addProductTag(tags, grant.metadata?.consumableCategory);
        addProductTag(tags, grant.metadata?.consumableSubcategory);
        addProductTag(tags, grant.metadata?.furnitureType);
        addProductTag(tags, grant.metadata?.furnitureCategory);
        addProductTag(tags, grant.metadata?.eggType);
      });

      return tags
        .filter((tag) => tag !== 'All')
        .slice(0, PRODUCT_CARD_TAG_LIMIT);
    }

    function getProductFilter(product, category) {
      if (category === 'consumables') {
        return getConsumableFilterTags(product)[0] || 'All';
      }
      if (category === 'furniture') {
        return getFurnitureFilterTags(product)[0] || 'All';
      }
      return category === 'eggs'
        ? getEggFilter(product)
        : getLayerFilter(product);
    }

    function getFilteredProducts(products, category, activeFilter = 'All') {
      const categoryProducts = products.filter((product) => {
        if (category === 'eggs') return isEggProduct(product);
        if (category === 'consumables') return isConsumableProduct(product);
        if (category === 'furniture') return isFurnitureProduct(product);
        return isLayerProduct(product);
      });

      if (activeFilter === 'All') return categoryProducts;

      return categoryProducts.filter((product) =>
        category === 'consumables'
          ? getConsumableFilterTags(product).includes(activeFilter)
          : category === 'furniture'
            ? getFurnitureFilterTags(product).includes(activeFilter)
            : getProductFilter(product, category) === activeFilter
      );
    }

    async function fetchShopProducts(endpoint = SHOP_PRODUCTS_ENDPOINT) {
      const requestEndpoint = endpoint || SHOP_PRODUCTS_ENDPOINT;
      if (shopProductsCache.has(requestEndpoint)) {
        return shopProductsCache.get(requestEndpoint);
      }

      const request = fetch(requestEndpoint, {
        headers: { Accept: 'application/json' }
      })
        .then(async (response) => {
          const payload = await response.json();

          if (!response.ok || payload.success === false) {
            throw new Error(payload.error?.message || 'Product request failed');
          }

          return Array.isArray(payload.data) ? payload.data : [];
        })
        .catch((error) => {
          shopProductsCache.delete(requestEndpoint);
          throw error;
        });

      shopProductsCache.set(requestEndpoint, request);
      return request;
    }

    function createProductMedia(media, className, productName) {
      if (!media?.url) {
        const placeholder = document.createElement('div');
        placeholder.className = `${className} shop-product-preview-placeholder`;
        placeholder.setAttribute('aria-hidden', 'true');
        return placeholder;
      }

      if (media.type === 'video') {
        const video = document.createElement('video');
        video.className = className;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-label', media.alt || `${productName} preview`);

        const source = document.createElement('source');
        source.src = getVersionedAssetUrl(media.url);
        source.type = getVideoType(media.url);
        video.appendChild(source);

        return video;
      }

      const image = document.createElement('img');
      image.className = className;
      image.src = getVersionedAssetUrl(media.url);
      image.alt = media.alt || productName;
      image.loading = 'lazy';
      return image;
    }

    function createBadge(text) {
      const badge = document.createElement('span');
      badge.className = 'shop-product-badge';
      badge.setAttribute('title', text);
      badge.textContent = text;
      return badge;
    }

    function createProductTagRow(tags) {
      const row = document.createElement('div');
      row.className = 'shop-product-badges';
      tags.forEach((tag) => row.appendChild(createBadge(tag)));
      return row;
    }

    function createProductCard(product, options = {}) {
      const owned = Object.prototype.hasOwnProperty.call(options, 'owned')
        ? options.owned
        : isOwnedProduct(product, collectOwnedKeys(getStoredAccount()));
      const card = document.createElement('article');
      card.className = options.large
        ? 'shop-product-card shop-product-card--large'
        : 'shop-product-card';
      card.classList.toggle('is-owned', owned);

      const isDigitalProduct = product?.identity?.type === 'digital';
      const isDirectPurchase = isOpalDigitalProduct(product) && !owned;
      const sectionColours = options.sectionColours || {};
      const link = document.createElement(isDigitalProduct ? 'div' : 'a');
      link.className = 'shop-product-link';
      if (!isDigitalProduct) {
        link.href = product.identity?.slug
          ? `/shop/${product.identity.slug}`
          : '/shop';
      }
      link.setAttribute(
        'aria-label',
        `${product.name} ${formatProductPrice(product)}`
      );
      if (isDirectPurchase) {
        link.setAttribute('role', 'button');
        link.setAttribute('tabindex', '0');
        link.addEventListener('click', () =>
          createPurchaseDialog(product, sectionColours)
        );
        link.addEventListener('keydown', (event) => {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          createPurchaseDialog(product, sectionColours);
        });
      }

      const mediaFrame = document.createElement('div');
      mediaFrame.className = 'shop-product-media-frame';

      mediaFrame.appendChild(
        createProductMedia(
          product.mainMedia,
          'shop-product-preview shop-product-preview--main',
          product.name
        )
      );

      if (product.hoverPreviewMedia?.url) {
        const hoverMedia = createProductMedia(
          product.hoverPreviewMedia,
          'shop-product-preview shop-product-preview--hover',
          product.name
        );

        if (hoverMedia.tagName === 'VIDEO') {
          link.addEventListener('mouseenter', () => {
            hoverMedia.play().catch(() => {});
          });
          link.addEventListener('mouseleave', () => {
            hoverMedia.pause();
            hoverMedia.currentTime = 0;
          });
        }

        mediaFrame.appendChild(hoverMedia);
      }

      const meta = document.createElement('div');
      meta.className = 'shop-product-meta';

      const name = document.createElement('h3');
      name.className = 'shop-product-name';
      name.textContent = product.name;

      const tags = getProductCardTags(product, options);

      const action = document.createElement(
        isDirectPurchase ? 'button' : 'span'
      );
      action.className = 'shop-product-action';
      if (isDirectPurchase) {
        action.type = 'button';
        action.dataset.buyShopProduct = product.identity?.slug || '';
        action.setAttribute('aria-label', `Buy ${product.name}`);

        const icon = document.createElement('img');
        icon.src = '/images/icons/currency/opal.svg';
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');

        const amount = document.createElement('span');
        amount.textContent = getProductOpalAmount(product).toLocaleString();

        action.append(icon, amount);
        action.addEventListener('click', (event) => {
          event.stopPropagation();
          createPurchaseDialog(product, sectionColours);
        });
      } else {
        action.textContent = owned ? 'Owned' : 'View';
      }

      if (tags.length) {
        meta.appendChild(createProductTagRow(tags));
      }
      meta.append(name, action);
      link.append(mediaFrame, meta);
      card.appendChild(link);

      return card;
    }

    Object.assign(shop, {
      hasGrantType,
      isEggProduct,
      isLayerProduct,
      isConsumableProduct,
      isFurnitureProduct,
      getLayerFilter,
      getEggFilter,
      getConsumableFilterTags,
      getFurnitureFilterTags,
      formatTagLabel,
      addProductTag,
      getConsumableCardTags,
      getFurnitureCardTags,
      getProductCardTags,
      getProductFilter,
      getFilteredProducts,
      fetchShopProducts,
      createProductMedia,
      createBadge,
      createProductTagRow,
      createProductCard
    });
  }
})();

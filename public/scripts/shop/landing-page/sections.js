(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function createSectionHeading(config) {
      const header = document.createElement('div');
      header.className = 'shop-section-heading';

      const heading = document.createElement('h2');
      heading.textContent = config.header || 'Shop';
      header.appendChild(heading);

      return header;
    }

    function createCollapsibleSectionShell(section, config) {
      const sectionId =
        section.id ||
        `shop-section-${String(config.header || config.type || 'section')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`;
      const bodyId = `${sectionId}-body`;
      const collapsed = section.dataset.sectionCollapsed === 'true';

      const header = document.createElement('div');
      header.className = 'shop-section-heading shop-section-heading--toggle';

      const button = document.createElement('button');
      button.className = 'shop-section-toggle';
      button.type = 'button';
      button.setAttribute('aria-controls', bodyId);
      button.setAttribute('aria-expanded', String(!collapsed));

      const text = document.createElement('span');
      text.className = 'shop-section-toggle-text';

      const heading = document.createElement('span');
      heading.className = 'shop-section-toggle-title';
      heading.textContent = config.header || 'Shop';
      text.appendChild(heading);

      const indicator = document.createElement('span');
      indicator.className = 'shop-section-toggle-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      indicator.textContent = '+';

      button.append(text, indicator);
      button.addEventListener('click', () => {
        const isCollapsed = section.classList.toggle('is-collapsed');
        section.dataset.sectionCollapsed = String(isCollapsed);
        button.setAttribute('aria-expanded', String(!isCollapsed));
        indicator.textContent = isCollapsed ? '+' : '-';
      });

      header.appendChild(button);

      const body = document.createElement('div');
      body.className = 'shop-section-body';
      body.id = bodyId;

      section.classList.toggle('is-collapsed', collapsed);
      indicator.textContent = collapsed ? '+' : '-';

      return { header, body };
    }

    function createEmptyState(message) {
      const empty = document.createElement('p');
      empty.className = 'shop-empty-state';
      empty.textContent = message;
      return empty;
    }

    function renderHeroSection(section, config) {
      section.classList.add('shop-hero-section');
      applySectionColours(section, config);
      document.documentElement.classList.add('shop-page');
      applyPageColours(
        {
          primary: config.primaryColour || config.backgroundColour,
          secondary: config.secondaryColour
        },
        { transparentHeader: true }
      );

      const media = document.createElement('div');
      media.className = 'shop-hero-media';

      if (config.imageSource) {
        const image = document.createElement('img');
        image.className = 'shop-background-image';
        image.src = getVersionedAssetUrl(config.imageSource);
        image.alt = config.imageAlt || '';
        image.loading = 'eager';
        image.decoding = 'async';
        media.appendChild(image);
      }

      const content = document.createElement('div');
      content.className = 'shop-hero-content';

      const heading = document.createElement('h1');
      heading.textContent = config.header || 'OVEREXPOSED SHOP';

      const description = document.createElement('p');
      description.textContent =
        config.description ||
        'Unlock OE layers, hatch new Olings, and stock up on Oling consumables.';

      const actions = document.createElement('div');
      actions.className = 'shop-hero-actions';

      const heroActions = config.actionHref
        ? [[config.actionLabel || 'Shop Eggs', config.actionHref]]
        : SHOP_CATEGORY_LINKS;

      heroActions.forEach(([label, href]) => {
        const link = document.createElement('a');
        link.className = 'shop-hero-action';
        link.href = href;
        link.textContent = label;
        actions.appendChild(link);
      });

      content.append(heading, description, actions);
      section.replaceChildren(media, content);
      section.dataset.sectionRenderState = 'rendered';
    }

    function renderCategorySwitcherSection(section) {
      section.classList.add('shop-category-switcher-section');

      const nav = document.createElement('nav');
      nav.className = 'shop-category-switcher';
      nav.setAttribute('aria-label', 'Shop categories');

      SHOP_CATEGORY_LINKS.forEach(([label, href]) => {
        const link = document.createElement('a');
        link.className = 'shop-category-link';
        link.href = href;
        link.textContent = label;
        nav.appendChild(link);
      });

      section.replaceChildren(nav);
      section.dataset.sectionRenderState = 'rendered';
    }

    async function renderFeaturedSection(section, config) {
      section.classList.add('shop-featured-section');
      applySectionColours(section, config);

      const shell = createCollapsibleSectionShell(section, config);
      const grid = document.createElement('div');
      grid.className = 'shop-featured-grid';
      grid.appendChild(createEmptyState('Loading featured products...'));
      shell.body.appendChild(grid);
      section.replaceChildren(shell.header, shell.body);

      try {
        const products = await fetchShopProducts(config.productsEndpoint);
        const featuredEgg =
          products.find(
            (product) =>
              product?.publishing?.isFeatured && isEggProduct(product)
          ) || products.find(isEggProduct);

        grid.replaceChildren();

        if (featuredEgg) {
          grid.appendChild(
            createProductCard(featuredEgg, {
              large: true,
              badge: 'Big Egg Promo',
              sectionColours: getConfigSectionColours(config)
            })
          );
        }

        if (!featuredEgg) {
          grid.appendChild(createEmptyState('Featured products coming soon.'));
        }

        section.dataset.sectionRenderState = 'rendered';
      } catch (error) {
        grid.replaceChildren(
          createEmptyState('Featured products are unavailable right now.')
        );
        section.dataset.sectionRenderState = 'product-load-failed';
        console.error('Failed to render featured shop products:', error);
      }
    }

    function createFilterBar(filters, onFilterChange) {
      const bar = document.createElement('div');
      bar.className = 'shop-filter-bar';
      bar.setAttribute('role', 'tablist');

      filters.forEach((filter, index) => {
        const button = document.createElement('button');
        button.className = 'shop-filter-button';
        button.type = 'button';
        button.textContent = filter;
        button.dataset.filter = filter;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        button.classList.toggle('active', index === 0);
        button.addEventListener('click', () => {
          bar.querySelectorAll('.shop-filter-button').forEach((item) => {
            const active = item === button;
            item.classList.toggle('active', active);
            item.setAttribute('aria-selected', String(active));
          });
          onFilterChange(filter);
        });
        bar.appendChild(button);
      });

      return bar;
    }

    function getProductGridFilters(products, category, configuredFilters) {
      const filters = configuredFilters.length
        ? [...configuredFilters]
        : ['All'];

      if (!['consumables', 'furniture'].includes(category)) return filters;

      const categoryProducts =
        category === 'furniture'
          ? products.filter(isFurnitureProduct)
          : products.filter(isConsumableProduct);
      const tagGetter =
        category === 'furniture'
          ? getFurnitureFilterTags
          : getConsumableFilterTags;

      categoryProducts.forEach((product) => {
        tagGetter(product).forEach((tag) => {
          if (
            !filters.some(
              (filter) => filter.toLowerCase() === tag.toLowerCase()
            )
          ) {
            filters.push(tag);
          }
        });
      });

      return filters;
    }

    function getProductSearchText(product) {
      return [
        product.name,
        product.shortDescription,
        product.identity?.name,
        product.identity?.description,
        product.identity?.shortDescription,
        product.identity?.slug,
        product.merchandising?.catalog?.sub,
        ...getProductTags(product),
        ...getProductStyles(product),
        ...getProductGrants(product).flatMap((grant) => [
          grant.type,
          grant.key,
          grant.gamemode,
          grant.metadata?.slot,
          grant.metadata?.eggType,
          grant.metadata?.rarity,
          grant.metadata?.consumableType,
          grant.metadata?.consumableCategory,
          grant.metadata?.consumableSubcategory,
          grant.metadata?.furnitureType,
          grant.metadata?.furnitureCategory,
          grant.metadata?.personalityKey,
          grant.metadata?.effectType
        ])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    }

    function createSearchContainer(category, onSearchChange) {
      const container = document.createElement('div');
      container.className = 'shop-search-container';

      const input = document.createElement('input');
      input.className = 'shop-search-input';
      input.type = 'search';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.placeholder = `Search ${SHOP_CATEGORY_LABELS[category] || 'Shop'}`;
      input.setAttribute(
        'aria-label',
        `Search ${SHOP_CATEGORY_LABELS[category] || 'shop products'}`
      );
      input.addEventListener('input', () => onSearchChange(input.value));

      container.appendChild(input);
      return container;
    }

    function renderProductGrid(
      grid,
      products,
      category,
      filter,
      searchQuery = '',
      options = {}
    ) {
      const normalizedQuery = String(searchQuery || '')
        .trim()
        .toLowerCase();
      const filteredProducts = getFilteredProducts(
        products,
        category,
        filter
      ).filter(
        (product) =>
          !normalizedQuery ||
          getProductSearchText(product).includes(normalizedQuery)
      );
      grid.replaceChildren();

      if (!filteredProducts.length) {
        grid.appendChild(
          createEmptyState(
            normalizedQuery
              ? 'No products match that search.'
              : 'No products found in this section yet.'
          )
        );
        return;
      }

      filteredProducts.forEach((product) =>
        grid.appendChild(createProductCard(product, { ...options, category }))
      );
    }

    async function renderProductGridSection(section, config) {
      section.classList.add('shop-product-grid-section');
      applySectionColours(section, config);

      const shell = createCollapsibleSectionShell(section, config);
      let filters = config.filters.length ? config.filters : ['All'];
      const grid = document.createElement('div');
      grid.className = 'shop-product-grid';
      grid.appendChild(createEmptyState('Loading products...'));

      let products = [];
      let activeFilter = filters[0];
      let searchQuery = '';
      const renderCurrentGrid = () =>
        renderProductGrid(
          grid,
          products,
          config.category,
          activeFilter,
          searchQuery,
          {
            category: config.category,
            sectionColours: getConfigSectionColours(config)
          }
        );
      const filterBar = createFilterBar(filters, (filter) => {
        activeFilter = filter;
        renderCurrentGrid();
      });
      const searchContainer = createSearchContainer(
        config.category,
        (query) => {
          searchQuery = query;
          renderCurrentGrid();
        }
      );

      shell.body.append(filterBar, searchContainer, grid);
      section.replaceChildren(shell.header, shell.body);

      try {
        products = await fetchShopProducts(config.productsEndpoint);
        filters = getProductGridFilters(
          products,
          config.category,
          config.filters
        );
        activeFilter = filters.includes(activeFilter)
          ? activeFilter
          : filters[0];
        filterBar.replaceWith(
          createFilterBar(filters, (filter) => {
            activeFilter = filter;
            renderCurrentGrid();
          })
        );
        renderCurrentGrid();
        section.dataset.sectionRenderState = 'rendered';
      } catch (error) {
        grid.replaceChildren(
          createEmptyState('Products are unavailable right now.')
        );
        section.dataset.sectionRenderState = 'product-load-failed';
        console.error('Failed to render shop product grid:', error);
      }
    }

    Object.assign(shop, {
      createSectionHeading,
      createCollapsibleSectionShell,
      createEmptyState,
      renderHeroSection,
      renderCategorySwitcherSection,
      renderFeaturedSection,
      createFilterBar,
      getProductGridFilters,
      getProductSearchText,
      createSearchContainer,
      renderProductGrid,
      renderProductGridSection
    });
  }
})();

(function () {
  function createOePanelGalleryWidgetRenderer({
    normaliseGalleryImagePath
  } = {}) {
    const palettes = window.OE_PANEL_PALETTES;
    function normalise(value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    }

    function normaliseKey(value) {
      return normalise(value).replace(/[^a-z0-9]/g, '');
    }

    function parseGallerySearch(value) {
      const filters = [];
      const plainParts = [];
      let cursor = 0;
      const filterPattern = /\[([^\]:]+)\s*:\s*([^\]]+)\]/g;
      let match;

      while ((match = filterPattern.exec(value)) !== null) {
        plainParts.push(value.slice(cursor, match.index));
        filters.push({
          field: normaliseKey(match[1]),
          value: normalise(match[2])
        });
        cursor = filterPattern.lastIndex;
      }

      plainParts.push(value.slice(cursor));

      return {
        filters,
        terms: normalise(plainParts.join(' ')).split(/\s+/).filter(Boolean)
      };
    }

    function renderGalleryWidget(container, gridConfig) {
      const items = Array.isArray(gridConfig.items) ? gridConfig.items : [];
      const fieldMap = {
        title: 'name',
        subtitle: '',
        meta: ['key'],
        status: 'status',
        preview: 'preview',
        border: '',
        alt: 'name',
        search: [],
        filters: {},
        ...(gridConfig.fieldMap || {})
      };
      const widget = document.createElement('div');
      widget.className =
        gridConfig.className ||
        'oe-panel-widget oe-panel-widget-oe-gallery oe-panel-widget-data-table';

      const header = document.createElement('div');
      header.className = 'oe-panel-table-header oe-panel-oe-gallery-header';

      const title = document.createElement('h3');
      title.className = 'oe-panel-table-title';
      title.textContent = gridConfig.title;

      const searchInput = document.createElement('input');
      searchInput.className = 'oe-panel-table-search';
      searchInput.type = 'search';
      searchInput.placeholder =
        gridConfig.searchPlaceholder || 'Search gallery';
      searchInput.setAttribute('aria-label', `Search ${gridConfig.title}`);

      const gallery = document.createElement('div');
      gallery.className = 'oe-panel-oe-gallery-grid';

      function getFilterValue(item, field) {
        const aliases = fieldMap.filters || {};
        const key = aliases[field] || field;

        return item[key] || '';
      }

      function matchesFilters(item) {
        const parsedSearch = parseGallerySearch(searchInput.value);
        const searchFields = Array.isArray(fieldMap.search)
          ? fieldMap.search
          : [];
        const haystack = normalise(
          searchFields.length
            ? searchFields.map((field) => item[field]).join(' ')
            : Object.values(item).join(' ')
        );

        return (
          parsedSearch.terms.every((term) => haystack.includes(term)) &&
          parsedSearch.filters.every((filter) =>
            normalise(getFilterValue(item, filter.field)).includes(
              filter.value
            )
          )
        );
      }

      function renderItem(item) {
        const card = document.createElement('button');
        card.className = 'oe-panel-oe-gallery-card';
        card.type = 'button';
        const paletteField = gridConfig.paletteField || '';
        const palette = paletteField
          ? palettes?.resolve(
              { type: gridConfig.paletteType || paletteField },
              item[paletteField],
              item,
              { key: paletteField },
              gridConfig.dataSource
            )
          : null;
        palettes?.decorate(card, palette);

        const preview = document.createElement('div');
        preview.className = 'oe-panel-oe-gallery-preview';
        const previewValue = item[fieldMap.preview];
        const borderValue = fieldMap.border ? item[fieldMap.border] : '';

        if (previewValue) {
          if (borderValue) {
            const borderImage = document.createElement('img');
            borderImage.className = 'oe-panel-oe-gallery-preview-border';
            borderImage.src = borderValue;
            borderImage.alt = '';
            borderImage.loading = 'lazy';
            borderImage.setAttribute('aria-hidden', 'true');
            preview.appendChild(borderImage);
          }

          const previewImages = Array.isArray(previewValue)
            ? previewValue.filter(Boolean)
            : [previewValue];

          previewImages.forEach((previewImage, index) => {
            const image = document.createElement('img');
            image.className = 'oe-panel-oe-gallery-preview-image';
            image.src = normaliseGalleryImagePath(previewImage);
            image.alt =
              index === previewImages.length - 1
                ? item[fieldMap.alt] || item[fieldMap.title] || 'Gallery item'
                : '';
            image.loading = 'lazy';
            if (index < previewImages.length - 1) {
              image.setAttribute('aria-hidden', 'true');
            }
            preview.appendChild(image);
          });
        }

        const body = document.createElement('div');
        body.className = 'oe-panel-oe-gallery-body';

        const name = document.createElement('strong');
        name.className = 'oe-panel-oe-gallery-name';
        name.textContent = item[fieldMap.title] || '-';

        const meta = document.createElement('span');
        meta.className = 'oe-panel-oe-gallery-meta';
        const metaFields = (
          Array.isArray(fieldMap.meta) ? fieldMap.meta : []
        ).filter((field) => item[field]);
        metaFields.forEach((field, index) => {
          if (index) meta.appendChild(document.createTextNode(' / '));
          const paletteValue = palettes?.createValue({
            value: item[field],
            row: item,
            fieldConfig: { key: field },
            dataSource: gridConfig.dataSource
          });
          if (paletteValue) {
            meta.appendChild(paletteValue);
          } else {
            meta.appendChild(document.createTextNode(item[field]));
          }
        });

        const status = document.createElement('span');
        status.className = 'oe-panel-oe-gallery-status';
        status.textContent = item[fieldMap.status] || '-';

        const paletteMeta = paletteField
          ? palettes?.createValue({
              value: item[paletteField],
              row: item,
              fieldConfig: {
                key: paletteField,
                palette: gridConfig.paletteType || paletteField
              },
              dataSource: gridConfig.dataSource
            })
          : null;
        body.append(name, meta);
        if (paletteMeta) body.appendChild(paletteMeta);
        body.appendChild(status);
        card.append(preview, body);
        if (gridConfig.targetGridId) {
          card.addEventListener('click', () => {
            const queryField = gridConfig.targetQueryField || fieldMap.title;
            const queryValue =
              item[gridConfig.targetQueryValue || queryField] || '';
            if (!queryValue) return;
            window.dispatchEvent(
              new CustomEvent('oe-panel-table-search-request', {
                detail: {
                  gridId: gridConfig.targetGridId,
                  series: gridConfig.targetSeries,
                  query: `[${queryField}:${queryValue}]`,
                  expandFirstMatch: true
                }
              })
            );
          });
        } else if (gridConfig.targetSection && gridConfig.targetSectionGridId) {
          card.addEventListener('click', () => {
            const queryField = gridConfig.targetQueryField || fieldMap.title;
            const queryValue =
              item[gridConfig.targetQueryValue || queryField] || '';
            if (!queryValue) return;
            window.dispatchEvent(
              new CustomEvent('oe-panel-section-link-request', {
                detail: {
                  section: gridConfig.targetSection,
                  gridId: gridConfig.targetSectionGridId,
                  series: gridConfig.targetSeries,
                  query: `[${queryField}:${queryValue}]`
                }
              })
            );
          });
        } else if (gridConfig.itemEvent) {
          card.addEventListener('click', () => {
            window.dispatchEvent(
              new CustomEvent(gridConfig.itemEvent, { detail: { item } })
            );
          });
        }
        return card;
      }

      function renderGallery() {
        const filteredItems = items.filter(matchesFilters);
        gallery.replaceChildren();

        if (!filteredItems.length) {
          const empty = document.createElement('p');
          empty.className = 'oe-panel-oe-gallery-empty';
          empty.textContent = gridConfig.emptyText || 'No items found.';
          gallery.appendChild(empty);
          return;
        }

        filteredItems.forEach((item) => {
          gallery.appendChild(renderItem(item));
        });
      }

      searchInput.addEventListener('input', renderGallery);

      header.append(title, searchInput);
      renderGallery();
      widget.append(header, gallery);
      container.appendChild(widget);
    }

    return renderGalleryWidget;
  }

  window.createOePanelGalleryWidgetRenderer =
    createOePanelGalleryWidgetRenderer;
})();

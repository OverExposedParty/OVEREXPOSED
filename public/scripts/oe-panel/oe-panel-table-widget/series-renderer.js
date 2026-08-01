(function () {
  function createOePanelTableSeriesRenderer(renderTableWidget) {
function renderTableSeriesWidget(container, gridConfig) {
    const series = Array.isArray(gridConfig.tableSeries)
      ? gridConfig.tableSeries
      : [];
    let selectedSeries =
      series.find(
        (seriesConfig) => seriesConfig.value === gridConfig.defaultSeries
      ) || series[0];

    const titleDropdown = document.createElement('div');
    titleDropdown.className = 'oe-panel-table-title-dropdown';

    const titleButton = document.createElement('button');
    titleButton.className = 'oe-panel-table-title oe-panel-table-title-button';
    titleButton.type = 'button';
    titleButton.setAttribute('aria-haspopup', 'listbox');
    titleButton.setAttribute('aria-expanded', 'false');

    const titleMenu = document.createElement('div');
    titleMenu.className = 'oe-panel-table-title-menu';
    titleMenu.setAttribute('role', 'listbox');
    titleMenu.hidden = true;

    const body = document.createElement('div');
    body.className = 'oe-panel-table-series-body';

    function seriesIncludesSearchField(seriesConfig, query) {
      const match = String(query || '').match(/\[([^\]:]+)\s*:/);
      if (!match) return false;

      const requestedField = match[1].trim().toLowerCase();
      const fields = [
        ...(Array.isArray(seriesConfig.columns) ? seriesConfig.columns : []),
        ...(Array.isArray(seriesConfig.expandedFields)
          ? seriesConfig.expandedFields
          : [])
      ];

      return fields.some((fieldConfig) => {
        const key = String(fieldConfig.key || fieldConfig.valueKey || '')
          .trim()
          .toLowerCase();
        const label = String(fieldConfig.label || '')
          .trim()
          .toLowerCase();
        return key === requestedField || label === requestedField;
      });
    }

    function getActiveGridConfig(
      initialSearchQuery = '',
      expandFirstMatch = false
    ) {
      return {
        ...gridConfig,
        ...selectedSeries,
        id: gridConfig.id,
        title: selectedSeries.label || gridConfig.title,
        backgroundColour:
          selectedSeries.backgroundColour || gridConfig.backgroundColour,
        primaryColour: selectedSeries.primaryColour || gridConfig.primaryColour,
        secondaryColour:
          selectedSeries.secondaryColour || gridConfig.secondaryColour,
        tableSeries: null,
        searchRequestEnabled: false,
        initialSearchQuery,
        expandFirstMatch
      };
    }

    function renderSelectedSeries(
      initialSearchQuery = '',
      expandFirstMatch = false
    ) {
      body.replaceChildren();
      renderTableWidget(
        body,
        getActiveGridConfig(initialSearchQuery, expandFirstMatch)
      );
      const tableTitle = body.querySelector(
        '.oe-panel-table-header .oe-panel-table-title'
      );
      if (tableTitle) {
        tableTitle.replaceWith(titleDropdown);
      }
      titleButton.textContent =
        selectedSeries.label || selectedSeries.value || '';
      titleMenu
        .querySelectorAll('[data-oe-panel-table-series]')
        .forEach((button) => {
          const isSelected =
            button.dataset.oePanelTableSeries === selectedSeries.value;
          button.classList.toggle('is-active', isSelected);
          button.setAttribute('aria-selected', String(isSelected));
        });
    }

    series.forEach((seriesConfig) => {
      const optionButton = document.createElement('button');
      optionButton.className = 'oe-panel-table-title-menu-option';
      optionButton.type = 'button';
      optionButton.dataset.oePanelTableSeries = seriesConfig.value || '';
      optionButton.textContent =
        seriesConfig.label || seriesConfig.value || 'Table';
      optionButton.setAttribute('role', 'option');
      optionButton.addEventListener('click', () => {
        selectedSeries = seriesConfig;
        titleMenu.hidden = true;
        titleButton.setAttribute('aria-expanded', 'false');
        renderSelectedSeries();
      });
      titleMenu.appendChild(optionButton);
    });

    titleButton.addEventListener('click', () => {
      titleMenu.hidden = !titleMenu.hidden;
      titleButton.setAttribute('aria-expanded', String(!titleMenu.hidden));
    });

    document.addEventListener('click', (event) => {
      if (titleDropdown.contains(event.target)) return;
      titleMenu.hidden = true;
      titleButton.setAttribute('aria-expanded', 'false');
    });

    titleDropdown.append(titleButton, titleMenu);

    window.addEventListener('oe-panel-table-search-request', (event) => {
      if (event.detail?.gridId !== gridConfig.id) return;

      const query = event.detail.query || '';
      selectedSeries =
        series.find(
          (seriesConfig) => seriesConfig.value === event.detail.series
        ) ||
        series.find((seriesConfig) =>
          seriesIncludesSearchField(seriesConfig, query)
        ) ||
        selectedSeries;
      renderSelectedSeries(query, event.detail.expandFirstMatch === true);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    });

    container.appendChild(body);
    renderSelectedSeries();
  }

    return renderTableSeriesWidget;
  }

  window.createOePanelTableSeriesRenderer = createOePanelTableSeriesRenderer;
})();

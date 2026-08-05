(function () {
  const { createWidgetElement, getVisibleItems, runSyncWarningAction } =
    window.OE_PANEL_WIDGET_HELPERS || {};
  const palettes = window.OE_PANEL_PALETTES;
  const renderTableSeriesWidget =
    window.createOePanelTableSeriesRenderer(renderTableWidget);

  function renderTableWidget(container, gridConfig) {
    if (
      Array.isArray(gridConfig.tableSeries) &&
      gridConfig.tableSeries.length
    ) {
      renderTableSeriesWidget(container, gridConfig);
      return;
    }

    const columns = Array.isArray(gridConfig.columns) ? gridConfig.columns : [];
    const rows = Array.isArray(gridConfig.rows) ? gridConfig.rows : [];
    const paletteRecordConfig = {
      partyPacks: { type: 'pack', keyField: 'title' },
      partyRules: { type: 'rule', keyField: 'rule' },
      partyRoles: { type: 'role', keyField: 'role' },
      oeCustomisationPacks: { type: 'oe-pack', keyField: 'pack' }
    }[gridConfig.dataSource];
    if (paletteRecordConfig) {
      palettes?.indexRows(paletteRecordConfig.type, rows, paletteRecordConfig);
    }

    if (!columns.length || !rows.length) {
      container.appendChild(
        createWidgetElement(
          'oe-panel-widget oe-panel-widget-table',
          gridConfig.title
        )
      );
      return;
    }

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-table oe-panel-widget-data-table';

    const header = document.createElement('div');
    header.className = 'oe-panel-table-header';

    const title = document.createElement('h3');
    title.className = 'oe-panel-table-title';
    title.textContent = gridConfig.title;

    const searchInput = document.createElement('input');
    searchInput.className = 'oe-panel-table-search';
    searchInput.type = 'search';
    searchInput.placeholder = 'Search or [field:value]';
    searchInput.setAttribute('aria-label', `Search ${gridConfig.title}`);

    const platformSelect = document.createElement('select');
    platformSelect.className = 'oe-panel-table-platform-filter';
    platformSelect.setAttribute(
      'aria-label',
      `Filter ${gridConfig.title} platform`
    );
    const platformOptions = Array.isArray(gridConfig.platformOptions)
      ? gridConfig.platformOptions
      : [];

    if (gridConfig.platformFilter && platformOptions.length) {
      platformOptions.forEach((optionConfig) => {
        const option = document.createElement('option');
        option.value = optionConfig.value;
        option.textContent = optionConfig.label;
        platformSelect.appendChild(option);
      });
      header.append(title, platformSelect, searchInput);
    } else {
      header.append(title, searchInput);
    }

    const table = document.createElement('table');
    table.className = 'oe-panel-data-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const activeRowIndexes = new Set();
    const editingRows = new Set();

    columns.forEach((column) => {
      const th = document.createElement('th');
      th.textContent = column.label;
      headerRow.appendChild(th);
    });

    const expandHeader = document.createElement('th');
    expandHeader.className = 'oe-panel-data-table-expand-header';
    expandHeader.setAttribute('aria-label', 'Expand row');
    headerRow.appendChild(expandHeader);

    thead.appendChild(headerRow);

    const tbody = document.createElement('tbody');
    const shouldFillRows =
      gridConfig.fillRows !== false && gridConfig.editable !== true;
    const displayRows =
      gridConfig.dataSource || !shouldFillRows
        ? rows
        : getVisibleItems(rows, gridConfig.visibleRows || rows.length);
    let activePlatform = 'all';
    let shouldExpandFirstMatch = gridConfig.expandFirstMatch === true;

    function getVisibleDisplayRows() {
      if (!gridConfig.platformFilter || activePlatform === 'all') {
        return displayRows;
      }

      return displayRows.filter(
        (rowConfig) =>
          Array.isArray(rowConfig.platforms) &&
          rowConfig.platforms.includes(activePlatform)
      );
    }

    const {
      parseTableSearchQuery,
      rowMatchesSearch,
      getEditableRowKey,
      getRowValue,
      getRowSaveEndpoint,
      getRowActionEndpoint,
      isEditableField
    } = window.createOePanelTableSearchTools({
      gridConfig,
      columns,
      getVisibleDisplayRows
    });

    function createRowButton(isExpanded) {
      const button = document.createElement('button');
      button.className = 'oe-panel-data-table-row-toggle';
      button.type = 'button';
      button.setAttribute(
        'aria-label',
        isExpanded ? 'Collapse row' : 'Expand row'
      );
      button.setAttribute('aria-expanded', String(isExpanded));
      return button;
    }

    const createExpandedContent = window.createOePanelTableExpandedRow({
      gridConfig,
      container,
      activeRowIndexes,
      editingRows,
      displayRows,
      getEditableRowKey,
      getRowValue,
      getRowSaveEndpoint,
      getRowActionEndpoint,
      isEditableField,
      renderTableRows
    });

    function requestWidgetExpansion() {
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    }

    function renderTableRows() {
      tbody.replaceChildren();
      const visibleDisplayRows = getVisibleDisplayRows();
      const parsedQuery = parseTableSearchQuery(searchInput.value);
      const hasSearch = parsedQuery.terms.length || parsedQuery.filters.length;
      const filteredRows = hasSearch
        ? visibleDisplayRows.filter((rowConfig) =>
            rowMatchesSearch(rowConfig, parsedQuery)
          )
        : visibleDisplayRows;

      if (shouldExpandFirstMatch && filteredRows.length) {
        activeRowIndexes.clear();
        activeRowIndexes.add(displayRows.indexOf(filteredRows[0]));
        shouldExpandFirstMatch = false;
      }

      filteredRows.forEach((rowConfig) => {
        const rowIndex = displayRows.indexOf(rowConfig);
        const row = document.createElement('tr');
        const isActiveRow = activeRowIndexes.has(rowIndex);
        row.className = 'oe-panel-data-table-row';
        row.classList.toggle('expanded', isActiveRow);
        row.classList.toggle('archived', Boolean(rowConfig.archived));
        row.tabIndex = 0;
        if (rowConfig.syncEndpoint) {
          row.title = 'Export database content to JSON backup';
        }

        columns.forEach((column) => {
          const cell = document.createElement('td');
          const linkUrl = column.linkKey ? rowConfig[column.linkKey] : '';
          const cellContent = linkUrl
            ? document.createElement('a')
            : document.createElement('span');
          cellContent.className = 'oe-panel-data-table-cell-content';
          const value = rowConfig[column.key] ?? '';
          const paletteValue = palettes?.createValue({
            value,
            row: rowConfig,
            fieldConfig: column,
            dataSource: gridConfig.dataSource
          });
          if (paletteValue) {
            cellContent.appendChild(paletteValue);
          } else {
            cellContent.textContent = value;
          }
          if (linkUrl) {
            cellContent.href = linkUrl;
            cellContent.addEventListener('click', (event) => {
              event.stopPropagation();
            });
          }
          cell.appendChild(cellContent);

          row.appendChild(cell);
        });

        const toggleCell = document.createElement('td');
        toggleCell.className = 'oe-panel-data-table-toggle-cell';
        const toggleButton = createRowButton(isActiveRow);
        toggleButton.addEventListener('click', (event) => {
          event.stopPropagation();
          if (activeRowIndexes.has(rowIndex)) {
            activeRowIndexes.delete(rowIndex);
          } else {
            activeRowIndexes.add(rowIndex);
          }
          renderTableRows();
        });
        toggleCell.appendChild(toggleButton);
        row.appendChild(toggleCell);

        row.addEventListener('click', () => {
          if (rowConfig.syncEndpoint) {
            runSyncWarningAction(rowConfig);
            return;
          }

          requestWidgetExpansion();
          if (activeRowIndexes.has(rowIndex)) {
            activeRowIndexes.delete(rowIndex);
          } else {
            activeRowIndexes.add(rowIndex);
          }
          renderTableRows();
        });

        row.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (rowConfig.syncEndpoint) {
              runSyncWarningAction(rowConfig);
              return;
            }

            requestWidgetExpansion();
            if (activeRowIndexes.has(rowIndex)) {
              activeRowIndexes.delete(rowIndex);
            } else {
              activeRowIndexes.add(rowIndex);
            }
            renderTableRows();
          }
        });

        tbody.appendChild(row);

        if (isActiveRow) {
          const expandedRow = document.createElement('tr');
          expandedRow.className = 'oe-panel-data-table-expanded-container-row';

          const expandedCell = document.createElement('td');
          expandedCell.colSpan = columns.length + 1;
          expandedCell.appendChild(createExpandedContent(rowConfig, rowIndex));

          expandedRow.appendChild(expandedCell);
          tbody.appendChild(expandedRow);
        }
      });
    }

    container.addEventListener('oe-panel-container-shrunk', () => {
      activeRowIndexes.clear();
      renderTableRows();
    });

    searchInput.addEventListener('input', () => {
      activeRowIndexes.clear();
      renderTableRows();
    });

    platformSelect.addEventListener('change', () => {
      activePlatform = platformSelect.value || 'all';
      activeRowIndexes.clear();
      renderTableRows();
    });

    if (gridConfig.searchRequestEnabled !== false) {
      window.addEventListener('oe-panel-table-search-request', (event) => {
        if (event.detail?.gridId !== gridConfig.id) return;

        searchInput.value = event.detail.query || '';
        activeRowIndexes.clear();
        shouldExpandFirstMatch = event.detail.expandFirstMatch === true;
        renderTableRows();
        container.dispatchEvent(
          new CustomEvent('oe-panel-request-expand', { bubbles: true })
        );
      });
    }

    if (gridConfig.initialSearchQuery) {
      searchInput.value = gridConfig.initialSearchQuery;
    }

    renderTableRows();

    table.append(thead, tbody);
    widget.append(header, table);
    container.appendChild(widget);
  }

  window.OE_PANEL_TABLE_WIDGET_RENDERER = renderTableWidget;
})();

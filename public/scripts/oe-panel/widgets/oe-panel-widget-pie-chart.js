(function () {
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

  function createOePanelPieChartWidget({ createWidgetElement }) {
    function renderPieChartWidget(container, gridConfig) {
      const endpoint = String(gridConfig.endpoint || '').trim();
      const configuredElements = Array.isArray(gridConfig.elements)
        ? gridConfig.elements
        : [];
      const fieldMap = {
        key: 'key',
        label: 'label',
        value: 'value',
        percentage: 'percentage',
        colour: 'colour',
        ...(gridConfig.elementFields || {})
      };
      const defaults = {
        datePreset: '30d',
        metric: 'games',
        excludedGamemodes: [],
        includeUnknown: false,
        minimumCount: 0,
        topN: 0,
        ...(gridConfig.defaultFilters || {})
      };

      if (!endpoint && !configuredElements.length) {
        container.appendChild(
          createWidgetElement(
            'oe-panel-widget oe-panel-widget-chart',
            gridConfig.title
          )
        );
        return;
      }

      const state = {
        excludedGamemodes: new Set(defaults.excludedGamemodes || []),
        availableGamemodes: [],
        requestId: 0
      };
      const widget = document.createElement('div');
      widget.className =
        'oe-panel-widget oe-panel-widget-chart oe-panel-widget-pie-chart';

      const header = document.createElement('div');
      header.className = 'oe-panel-pie-header';

      const title = document.createElement('h3');
      title.className = 'oe-panel-chart-title';
      title.textContent = gridConfig.title;

      const totalLabel = document.createElement('strong');
      totalLabel.className = 'oe-panel-pie-total';
      totalLabel.textContent = '0 games';

      const filterToggle = document.createElement('button');
      filterToggle.className = 'oe-panel-pie-filter-toggle';
      filterToggle.type = 'button';
      filterToggle.textContent = 'Filters';
      filterToggle.setAttribute('aria-expanded', 'false');

      header.append(title, totalLabel, filterToggle);

      const primaryControls = document.createElement('div');
      primaryControls.className = 'oe-panel-pie-primary-controls';

      const presetSelect = document.createElement('select');
      presetSelect.className = 'oe-panel-pie-control';
      presetSelect.setAttribute('aria-label', 'Pie chart date range');
      [
        ['today', 'Today'],
        ['7d', 'Last 7 days'],
        ['30d', 'Last 30 days'],
        ['90d', 'Last 90 days'],
        ['all', 'All time'],
        ['custom', 'Custom range']
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        presetSelect.appendChild(option);
      });
      presetSelect.value = defaults.datePreset;

      const searchInput = document.createElement('input');
      searchInput.className = 'oe-panel-pie-control oe-panel-pie-search';
      searchInput.type = 'search';
      searchInput.placeholder = 'Search gamemodes';
      searchInput.setAttribute('aria-label', 'Search chart gamemodes');

      primaryControls.append(presetSelect, searchInput);

      const filterPanel = document.createElement('div');
      filterPanel.className = 'oe-panel-pie-filter-panel';
      filterPanel.hidden = true;

      function createField(labelText, control) {
        const label = document.createElement('label');
        label.className = 'oe-panel-pie-filter-field';
        const text = document.createElement('span');
        text.textContent = labelText;
        label.append(text, control);
        return label;
      }

      const fromInput = document.createElement('input');
      fromInput.className = 'oe-panel-pie-control';
      fromInput.type = 'date';
      const toInput = document.createElement('input');
      toInput.className = 'oe-panel-pie-control';
      toInput.type = 'date';
      const customDates = document.createElement('div');
      customDates.className = 'oe-panel-pie-custom-dates';
      customDates.append(
        createField('From', fromInput),
        createField('To', toInput)
      );

      const metricSelect = document.createElement('select');
      metricSelect.className = 'oe-panel-pie-control';
      [
        ['games', 'Games played'],
        ['players', 'Players involved']
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        metricSelect.appendChild(option);
      });
      metricSelect.value = defaults.metric;

      const minimumInput = document.createElement('input');
      minimumInput.className = 'oe-panel-pie-control';
      minimumInput.type = 'number';
      minimumInput.min = '0';
      minimumInput.step = '1';
      minimumInput.value = String(defaults.minimumCount);

      const topNSelect = document.createElement('select');
      topNSelect.className = 'oe-panel-pie-control';
      [
        ['0', 'Show every gamemode'],
        ['5', 'Top 5 + Other'],
        ['8', 'Top 8 + Other'],
        ['10', 'Top 10 + Other']
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        topNSelect.appendChild(option);
      });
      topNSelect.value = String(defaults.topN);

      const includeUnknownLabel = document.createElement('label');
      includeUnknownLabel.className =
        'oe-panel-pie-filter-field oe-panel-pie-checkbox-field';
      const includeUnknown = document.createElement('input');
      includeUnknown.type = 'checkbox';
      includeUnknown.checked = defaults.includeUnknown === true;
      const includeUnknownText = document.createElement('span');
      includeUnknownText.textContent = 'Include unknown gamemodes';
      includeUnknownLabel.append(includeUnknown, includeUnknownText);

      const filterGrid = document.createElement('div');
      filterGrid.className = 'oe-panel-pie-filter-grid';
      filterGrid.append(
        createField('Measure', metricSelect),
        createField('Minimum count', minimumInput),
        createField('Display', topNSelect),
        includeUnknownLabel
      );

      const excludeGroup = document.createElement('fieldset');
      excludeGroup.className = 'oe-panel-pie-exclude-group';
      const excludeLegend = document.createElement('legend');
      excludeLegend.textContent = 'Exclude gamemodes';
      const excludeSearch = document.createElement('input');
      excludeSearch.className = 'oe-panel-pie-control';
      excludeSearch.type = 'search';
      excludeSearch.placeholder = 'Find a gamemode to exclude';
      excludeSearch.setAttribute('aria-label', 'Find a gamemode to exclude');
      const excludeOptions = document.createElement('div');
      excludeOptions.className = 'oe-panel-pie-exclude-options';
      excludeGroup.append(excludeLegend, excludeSearch, excludeOptions);

      const filterActions = document.createElement('div');
      filterActions.className = 'oe-panel-pie-filter-actions';
      const resetButton = document.createElement('button');
      resetButton.className = 'oe-panel-pie-filter-reset';
      resetButton.type = 'button';
      resetButton.textContent = 'Reset filters';
      filterActions.appendChild(resetButton);

      filterPanel.append(customDates, filterGrid, excludeGroup, filterActions);

      const status = document.createElement('p');
      status.className = 'oe-panel-pie-status';
      status.setAttribute('aria-live', 'polite');

      const content = document.createElement('div');
      content.className = 'oe-panel-pie-content';
      const chartArea = document.createElement('div');
      chartArea.className = 'oe-panel-pie-visual';
      const legend = document.createElement('div');
      legend.className = 'oe-panel-pie-legend';
      legend.setAttribute('aria-label', `${gridConfig.title} legend`);
      content.append(chartArea, legend);

      const accessibleTable = document.createElement('table');
      accessibleTable.className = 'oe-panel-visually-hidden';
      const accessibleCaption = document.createElement('caption');
      accessibleCaption.textContent = `${gridConfig.title} values`;
      const accessibleHead = document.createElement('thead');
      const accessibleHeadRow = document.createElement('tr');
      ['Gamemode', 'Value', 'Percentage'].forEach((label) => {
        const cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = label;
        accessibleHeadRow.appendChild(cell);
      });
      accessibleHead.appendChild(accessibleHeadRow);
      const accessibleBody = document.createElement('tbody');
      accessibleTable.append(accessibleCaption, accessibleHead, accessibleBody);

      function normalizeElement(element) {
        return {
          ...element,
          key: String(element[fieldMap.key] || ''),
          label: String(element[fieldMap.label] || 'Unknown'),
          value: Number(element[fieldMap.value] || 0),
          percentage: Number(element[fieldMap.percentage] || 0),
          colour: String(element[fieldMap.colour] || '#8D93A1')
        };
      }

      function getMetricNoun(total) {
        if (metricSelect.value === 'players') {
          return total === 1 ? 'player' : 'players';
        }
        return total === 1 ? 'game' : 'games';
      }

      function setFocusedElement(element) {
        status.textContent = `${element.label}: ${element.value.toLocaleString()} ${getMetricNoun(
          element.value
        )}, ${element.percentage}%`;
      }

      function requestTableFilter(element) {
        if (
          !gridConfig.targetGridId ||
          element.key === 'other' ||
          !element.label
        ) {
          return;
        }
        window.dispatchEvent(
          new CustomEvent('oe-panel-table-search-request', {
            detail: {
              gridId: gridConfig.targetGridId,
              series: gridConfig.targetSeries,
              query: `[${
                gridConfig.targetFilterField || 'gamemode'
              }:${element.label}]`
            }
          })
        );
      }

      function polarPoint(angle, radius = 42) {
        const radians = ((angle - 90) * Math.PI) / 180;
        return {
          x: 50 + radius * Math.cos(radians),
          y: 50 + radius * Math.sin(radians)
        };
      }

      function getSlicePath(startAngle, endAngle) {
        if (endAngle - startAngle >= 359.999) {
          return [
            'M 50 50',
            'L 50 8',
            'A 42 42 0 1 1 50 92',
            'A 42 42 0 1 1 50 8',
            'Z'
          ].join(' ');
        }
        const start = polarPoint(startAngle);
        const end = polarPoint(endAngle);
        const largeArc = endAngle - startAngle > 180 ? 1 : 0;
        return [
          'M 50 50',
          `L ${start.x.toFixed(3)} ${start.y.toFixed(3)}`,
          `A 42 42 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`,
          'Z'
        ].join(' ');
      }

      function createInteractiveHandler(element) {
        return (event) => {
          if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) {
            return;
          }
          if (event.type === 'keydown') event.preventDefault();
          setFocusedElement(element);
          if (event.type === 'click' || event.type === 'keydown') {
            requestTableFilter(element);
          }
        };
      }

      function renderChart(rawElements, totalValue) {
        const elements = rawElements
          .map(normalizeElement)
          .filter((element) => element.value > 0);
        const total =
          Number(totalValue) ||
          elements.reduce((sum, element) => sum + element.value, 0);
        chartArea.replaceChildren();
        legend.replaceChildren();
        accessibleBody.replaceChildren();
        legend.style.setProperty(
          '--oe-panel-pie-legend-count',
          String(Math.max(elements.length, 1))
        );
        totalLabel.textContent = `${total.toLocaleString()} ${getMetricNoun(
          total
        )}`;

        if (!elements.length || !total) {
          const empty = document.createElement('p');
          empty.className = 'oe-panel-pie-empty';
          empty.textContent = 'No gamemode activity matches these filters.';
          chartArea.appendChild(empty);
          status.textContent = 'No matching gamemode activity.';
          return;
        }

        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.classList.add('oe-panel-pie-svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('role', 'img');
        svg.setAttribute(
          'aria-label',
          `${gridConfig.title}, ${total.toLocaleString()} ${getMetricNoun(total)}`
        );
        let currentAngle = 0;

        elements.forEach((element, index) => {
          const share = element.value / total;
          const endAngle =
            index === elements.length - 1 ? 360 : currentAngle + share * 360;
          const slice = document.createElementNS(SVG_NAMESPACE, 'path');
          slice.classList.add('oe-panel-pie-slice');
          slice.setAttribute('d', getSlicePath(currentAngle, endAngle));
          slice.setAttribute('fill', element.colour);
          slice.setAttribute('tabindex', '0');
          slice.setAttribute('role', 'button');
          slice.setAttribute(
            'aria-label',
            `${element.label}: ${element.value.toLocaleString()} ${getMetricNoun(
              element.value
            )}, ${element.percentage}%`
          );
          const activate = createInteractiveHandler(element);
          slice.addEventListener('mouseenter', () =>
            setFocusedElement(element)
          );
          slice.addEventListener('focus', () => setFocusedElement(element));
          slice.addEventListener('click', activate);
          slice.addEventListener('keydown', activate);
          svg.appendChild(slice);
          currentAngle = endAngle;

          const legendButton = document.createElement('button');
          legendButton.className = 'oe-panel-pie-legend-item';
          legendButton.type = 'button';
          legendButton.style.backgroundColor = element.colour;
          const legendName = document.createElement('span');
          legendName.className = 'oe-panel-pie-legend-name';
          legendName.textContent = element.label;
          const legendValue = document.createElement('span');
          legendValue.className = 'oe-panel-pie-legend-value';
          legendValue.textContent = `${element.value.toLocaleString()} · ${
            element.percentage
          }%`;
          legendButton.append(legendName, legendValue);
          legendButton.addEventListener('mouseenter', () =>
            setFocusedElement(element)
          );
          legendButton.addEventListener('focus', () =>
            setFocusedElement(element)
          );
          legendButton.addEventListener('click', () =>
            requestTableFilter(element)
          );
          legend.appendChild(legendButton);

          const tableRow = document.createElement('tr');
          [
            element.label,
            String(element.value),
            `${element.percentage}%`
          ].forEach((value) => {
            const cell = document.createElement('td');
            cell.textContent = value;
            tableRow.appendChild(cell);
          });
          accessibleBody.appendChild(tableRow);
        });

        chartArea.appendChild(svg);
        status.textContent = 'Select a slice to filter the rooms table.';
      }

      function formatDateInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      function getDateRange() {
        if (presetSelect.value === 'all') return {};
        if (presetSelect.value === 'custom') {
          if (!fromInput.value || !toInput.value) return null;
          const from = new Date(`${fromInput.value}T00:00:00`);
          const inclusiveTo = new Date(`${toInput.value}T00:00:00`);
          const to = new Date(inclusiveTo.getTime() + DAY_IN_MILLISECONDS);
          if (from >= to) return { error: 'Choose a valid date range.' };
          return { from: from.toISOString(), to: to.toISOString() };
        }

        const from = new Date();
        from.setHours(0, 0, 0, 0);
        if (presetSelect.value !== 'today') {
          const days =
            presetSelect.value === '7d'
              ? 7
              : presetSelect.value === '90d'
                ? 90
                : 30;
          from.setDate(from.getDate() - (days - 1));
        }
        const to = new Date();
        to.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 1);
        return { from: from.toISOString(), to: to.toISOString() };
      }

      function createRequestUrl() {
        const range = getDateRange();
        if (range?.error) return range;
        if (range === null) return { pending: true };

        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('preset', presetSelect.value);
        url.searchParams.set('metric', metricSelect.value);
        url.searchParams.set('includeUnknown', String(includeUnknown.checked));
        url.searchParams.set('minimumCount', minimumInput.value || '0');
        url.searchParams.set('topN', topNSelect.value || '0');
        if (searchInput.value.trim()) {
          url.searchParams.set('search', searchInput.value.trim());
        }
        if (range.from) url.searchParams.set('from', range.from);
        if (range.to) url.searchParams.set('to', range.to);
        state.excludedGamemodes.forEach((gamemode) => {
          url.searchParams.append('exclude', gamemode);
        });
        return { url: `${url.pathname}${url.search}` };
      }

      function renderExcludeOptions() {
        const query = excludeSearch.value.trim().toLowerCase();
        excludeOptions.replaceChildren();
        const visibleModes = state.availableGamemodes.filter((gamemode) =>
          `${gamemode.key} ${gamemode.label}`.toLowerCase().includes(query)
        );

        visibleModes.forEach((gamemode) => {
          const label = document.createElement('label');
          label.className = 'oe-panel-pie-exclude-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = gamemode.key;
          checkbox.checked = state.excludedGamemodes.has(gamemode.key);
          const text = document.createElement('span');
          text.textContent = gamemode.label;
          checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
              state.excludedGamemodes.add(gamemode.key);
            } else {
              state.excludedGamemodes.delete(gamemode.key);
            }
            requestData();
          });
          label.append(checkbox, text);
          excludeOptions.appendChild(label);
        });

        if (!visibleModes.length) {
          const empty = document.createElement('span');
          empty.className = 'oe-panel-pie-exclude-empty';
          empty.textContent = 'No gamemodes found.';
          excludeOptions.appendChild(empty);
        }
      }

      async function requestData() {
        if (!endpoint) {
          renderChart(configuredElements, null);
          return;
        }

        const request = createRequestUrl();
        if (request.error) {
          status.textContent = request.error;
          return;
        }
        if (request.pending) {
          status.textContent = 'Choose both dates to apply a custom range.';
          return;
        }

        const requestId = ++state.requestId;
        widget.classList.add('is-loading');
        status.textContent = 'Loading gamemode activity...';
        try {
          const response = await fetch(request.url);
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'Failed to load gamemode activity.'
            );
          }
          if (requestId !== state.requestId) return;

          const data = payload.data || {};
          state.availableGamemodes = Array.isArray(data.availableGamemodes)
            ? data.availableGamemodes
            : [];
          renderExcludeOptions();
          renderChart(
            Array.isArray(data.elements) ? data.elements : [],
            data.total
          );
        } catch (error) {
          if (requestId !== state.requestId) return;
          chartArea.replaceChildren();
          const retry = document.createElement('button');
          retry.className = 'oe-panel-pie-filter-reset';
          retry.type = 'button';
          retry.textContent = 'Retry';
          retry.addEventListener('click', requestData);
          chartArea.appendChild(retry);
          legend.replaceChildren();
          status.textContent =
            error.message || 'Failed to load gamemode activity.';
        } finally {
          if (requestId === state.requestId) {
            widget.classList.remove('is-loading');
          }
        }
      }

      function updateCustomDateVisibility() {
        customDates.hidden = presetSelect.value !== 'custom';
      }

      filterToggle.addEventListener('click', () => {
        filterPanel.hidden = !filterPanel.hidden;
        filterToggle.setAttribute('aria-expanded', String(!filterPanel.hidden));
        if (!filterPanel.hidden) {
          container.dispatchEvent(
            new CustomEvent('oe-panel-request-expand', { bubbles: true })
          );
        }
      });
      presetSelect.addEventListener('change', () => {
        updateCustomDateVisibility();
        requestData();
      });
      fromInput.addEventListener('change', requestData);
      toInput.addEventListener('change', requestData);
      metricSelect.addEventListener('change', requestData);
      minimumInput.addEventListener('change', requestData);
      topNSelect.addEventListener('change', requestData);
      includeUnknown.addEventListener('change', requestData);
      excludeSearch.addEventListener('input', renderExcludeOptions);

      let searchTimer;
      searchInput.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(requestData, 250);
      });

      resetButton.addEventListener('click', () => {
        presetSelect.value = defaults.datePreset;
        metricSelect.value = defaults.metric;
        minimumInput.value = String(defaults.minimumCount);
        topNSelect.value = String(defaults.topN);
        includeUnknown.checked = defaults.includeUnknown === true;
        searchInput.value = '';
        excludeSearch.value = '';
        state.excludedGamemodes = new Set(defaults.excludedGamemodes || []);
        updateCustomDateVisibility();
        renderExcludeOptions();
        requestData();
      });

      const today = new Date();
      const thirtyDaysAgo = new Date(
        today.getTime() - 29 * DAY_IN_MILLISECONDS
      );
      fromInput.value = formatDateInput(thirtyDaysAgo);
      toInput.value = formatDateInput(today);
      updateCustomDateVisibility();

      widget.append(
        header,
        primaryControls,
        filterPanel,
        content,
        status,
        accessibleTable
      );
      container.appendChild(widget);
      requestData();
    }

    return { renderPieChartWidget };
  }

  window.createOePanelPieChartWidget = createOePanelPieChartWidget;
})();

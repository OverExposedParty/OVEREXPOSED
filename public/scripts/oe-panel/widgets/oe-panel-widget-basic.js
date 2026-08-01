(function () {
  function createOePanelBasicWidgets({ createWidgetElement }) {
  function renderEmptyWidget(container, gridConfig) {
    container.appendChild(
      createWidgetElement(
        'oe-panel-widget oe-panel-widget-empty',
        gridConfig.id
      )
    );
  }

  function renderStatsWidget(container, gridConfig) {
    const stats = Array.isArray(gridConfig.stats) ? gridConfig.stats : [];

    if (!stats.length) {
      container.appendChild(
        createWidgetElement(
          'oe-panel-widget oe-panel-widget-stats',
          gridConfig.title
        )
      );
      return;
    }

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-stats oe-panel-widget-stats-grid';

    function renderStatSummary(stat, statConfig) {
      stat.replaceChildren();

      stat.className = 'oe-panel-stat-card';

      const value = document.createElement('strong');
      value.className = 'oe-panel-stat-card-value';
      value.textContent = statConfig.value;
      value.style.setProperty(
        '--oe-panel-stat-value-length',
        String(String(statConfig.value || '').length || 1)
      );

      const label = document.createElement('span');
      label.className = 'oe-panel-stat-card-label';
      label.textContent = statConfig.label;

      if (statConfig.detail) {
        const detail = document.createElement('span');
        detail.className = 'oe-panel-stat-card-detail';
        detail.textContent = statConfig.detail;
        stat.append(value, label, detail);
        return;
      }

      stat.append(value, label);
    }

    function renderStatExpandedTable(stat, expandedConfig) {
      const columns = Array.isArray(expandedConfig.columns)
        ? expandedConfig.columns
        : [];
      const rows = Array.isArray(expandedConfig.rows)
        ? expandedConfig.rows
        : [];

      if (!columns.length || !rows.length) {
        return;
      }

      const table = document.createElement('table');
      table.className = 'oe-panel-stat-expanded-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      columns.forEach((column) => {
        const th = document.createElement('th');
        th.textContent = column.label;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);

      const tbody = document.createElement('tbody');
      rows.forEach((rowConfig) => {
        const row = document.createElement('tr');

        columns.forEach((column) => {
          const cell = document.createElement('td');
          cell.textContent = rowConfig[column.key] || '';
          row.appendChild(cell);
        });

        tbody.appendChild(row);
      });

      table.append(thead, tbody);
      stat.appendChild(table);
    }

    function renderStatExpandedChart(stat, expandedConfig) {
      const points = Array.isArray(expandedConfig.points)
        ? expandedConfig.points
        : [];

      if (!points.length) {
        return;
      }

      const chart = document.createElement('div');
      chart.className = 'oe-panel-stat-expanded-chart';

      const maxValue = Math.max(
        ...points.map((point) => Number(point.value) || 0),
        1
      );

      points.forEach((point) => {
        const group = document.createElement('div');
        group.className = 'oe-panel-stat-expanded-chart-group';

        const bar = document.createElement('span');
        bar.className = 'oe-panel-stat-expanded-chart-bar';
        bar.style.setProperty(
          '--oe-panel-stat-expanded-bar-height',
          `${((Number(point.value) || 0) / maxValue) * 100}%`
        );

        const label = document.createElement('span');
        label.className = 'oe-panel-stat-expanded-chart-label';
        label.textContent = point.label;

        group.append(bar, label);
        chart.appendChild(group);
      });

      stat.appendChild(chart);
    }

    function renderStatExpandedPie(stat, expandedConfig) {
      const slices = Array.isArray(expandedConfig.slices)
        ? expandedConfig.slices
        : [];
      const totalValue = slices.reduce(
        (total, slice) => total + (Number(slice.value) || 0),
        0
      );

      if (!slices.length || !totalValue) {
        return;
      }

      const pie = document.createElement('div');
      pie.className = 'oe-panel-stat-expanded-pie';

      const chart = document.createElement('span');
      chart.className = 'oe-panel-stat-expanded-pie-chart';

      let currentPercentage = 0;
      const gradientStops = slices.map((slice, index) => {
        const sliceValue = Number(slice.value) || 0;
        const slicePercentage = (sliceValue / totalValue) * 100;
        const startPercentage = currentPercentage;
        currentPercentage += slicePercentage;
        return `var(--oe-panel-stat-pie-colour-${index + 1}) ${startPercentage}% ${currentPercentage}%`;
      });

      chart.style.background = `conic-gradient(${gradientStops.join(', ')})`;

      const legend = document.createElement('div');
      legend.className = 'oe-panel-stat-expanded-pie-legend';

      slices.forEach((slice, index) => {
        const item = document.createElement('span');
        item.className = 'oe-panel-stat-expanded-pie-legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'oe-panel-stat-expanded-pie-swatch';
        swatch.style.backgroundColor = `var(--oe-panel-stat-pie-colour-${index + 1})`;

        const label = document.createElement('span');
        label.textContent = `${slice.label}: ${slice.value}`;

        item.append(swatch, label);
        legend.appendChild(item);
      });

      pie.append(chart, legend);
      stat.appendChild(pie);
    }

    function getStatExpandedConfig(statConfig, index) {
      if (statConfig.expanded) {
        return statConfig.expanded;
      }

      const hasNoData = statConfig.value === '-';
      const expandedType =
        statConfig.expandedType || statConfig.expandType || statConfig.viewType;

      if (expandedType === 'table' || hasNoData) {
        return {
          type: 'table',
          title: statConfig.label,
          columns: [
            { key: 'label', label: 'Metric' },
            { key: 'value', label: 'Value' }
          ],
          rows: [
            { label: 'Current', value: statConfig.value },
            { label: 'Detail', value: statConfig.detail || '-' }
          ]
        };
      }

      if (expandedType === 'graph' || expandedType === 'chart') {
        return {
          type: 'table',
          title: statConfig.label,
          columns: [
            { key: 'label', label: 'Metric' },
            { key: 'value', label: 'Value' }
          ],
          rows: [
            { label: 'Current', value: statConfig.value || '-' },
            { label: 'Detail', value: statConfig.detail || '-' }
          ]
        };
      }

      return {
        type: 'table',
        title: statConfig.label,
        columns: [
          { key: 'label', label: 'Metric' },
          { key: 'value', label: 'Value' }
        ],
        rows: [
          { label: 'Current', value: statConfig.value || '-' },
          { label: 'Detail', value: statConfig.detail || '-' }
        ]
      };
    }

    function renderStatExpanded(stat, statConfig, index) {
      const expandedConfig = getStatExpandedConfig(statConfig, index);

      if (!expandedConfig) {
        return;
      }

      stat.replaceChildren();
      stat.className = 'oe-panel-stat-card active';

      const title = document.createElement('strong');
      title.className = 'oe-panel-stat-expanded-title';
      title.textContent = expandedConfig.title || statConfig.label;
      stat.appendChild(title);

      if (expandedConfig.type === 'table') {
        renderStatExpandedTable(stat, expandedConfig);
        return;
      }

      if (expandedConfig.type === 'graph' || expandedConfig.type === 'chart') {
        renderStatExpandedChart(stat, expandedConfig);
        return;
      }

      if (expandedConfig.type === 'pie') {
        renderStatExpandedPie(stat, expandedConfig);
      }
    }

    stats.forEach((statConfig, index) => {
      const stat = document.createElement('button');
      stat.type = 'button';
      stat.dataset.oePanelStatIndex = String(index);

      renderStatSummary(stat, statConfig);

      stat.addEventListener('click', () => {
        const isActive = stat.classList.contains('active');

        Array.from(widget.children).forEach((card) => {
          const cardIndex = Number(card.dataset.oePanelStatIndex);
          card.classList.remove('active');
          renderStatSummary(card, stats[cardIndex]);
        });

        if (!isActive) {
          renderStatExpanded(stat, statConfig, index);
        }
      });

      widget.appendChild(stat);
    });

    container.appendChild(widget);
  }

    return {
      renderEmptyWidget,
      renderStatsWidget
    };
  }

  window.createOePanelBasicWidgets = createOePanelBasicWidgets;
})();

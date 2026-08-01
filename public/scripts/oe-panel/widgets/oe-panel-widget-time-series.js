(function () {
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  function createOePanelTimeSeriesWidget({ createWidgetElement }) {
    function renderTimeSeriesWidget(container, gridConfig) {
      const series = Array.isArray(gridConfig.series) ? gridConfig.series : [];
      const labels = Array.isArray(gridConfig.labels) ? gridConfig.labels : [];

      if (!series.length) {
        container.appendChild(
          createWidgetElement(
            'oe-panel-widget oe-panel-widget-time-series',
            gridConfig.title
          )
        );
        return;
      }

      const widget = document.createElement('div');
      widget.className =
        'oe-panel-widget oe-panel-widget-time-series oe-panel-widget-chart';

      const header = document.createElement('div');
      header.className = 'oe-panel-time-series-header';

      const title = document.createElement('h3');
      title.className = 'oe-panel-chart-title';
      title.textContent = gridConfig.title;

      const period = document.createElement('span');
      period.className = 'oe-panel-time-series-period';
      period.textContent = gridConfig.periodLabel || 'Current period';
      header.append(title, period);

      const legend = document.createElement('div');
      legend.className = 'oe-panel-time-series-legend';
      const hiddenSeries = new Set();

      const chartArea = document.createElement('div');
      chartArea.className = 'oe-panel-time-series-chart-area';

      function getNumericSeriesValues(seriesConfig) {
        return (
          Array.isArray(seriesConfig.values) ? seriesConfig.values : []
        ).map((value) => {
          if (value === null || value === undefined || value === '') {
            return null;
          }
          const numericValue = Number(value);
          return Number.isFinite(numericValue) ? numericValue : null;
        });
      }

      function renderChart() {
        chartArea.replaceChildren();
        const visibleSeries = series.filter(
          (seriesConfig) => !hiddenSeries.has(seriesConfig.key)
        );
        const numericValues = visibleSeries.flatMap((seriesConfig) =>
          getNumericSeriesValues(seriesConfig).filter((value) => value !== null)
        );

        if (!numericValues.length) {
          const empty = document.createElement('p');
          empty.className = 'oe-panel-time-series-empty';
          empty.textContent =
            gridConfig.emptyMessage || 'No performance data is available yet.';
          chartArea.appendChild(empty);
          return;
        }

        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.classList.add('oe-panel-time-series-svg');
        svg.setAttribute('viewBox', '0 0 100 60');
        svg.setAttribute('role', 'img');
        svg.setAttribute(
          'aria-label',
          gridConfig.title || 'Performance trends'
        );

        [12, 28, 44].forEach((y) => {
          const gridLine = document.createElementNS(SVG_NAMESPACE, 'line');
          gridLine.classList.add('oe-panel-time-series-grid-line');
          gridLine.setAttribute('x1', '2');
          gridLine.setAttribute('x2', '98');
          gridLine.setAttribute('y1', String(y));
          gridLine.setAttribute('y2', String(y));
          svg.appendChild(gridLine);
        });

        const maxValue = Math.max(...numericValues, 1);
        visibleSeries.forEach((seriesConfig) => {
          const values = getNumericSeriesValues(seriesConfig);
          const usableValues = values.filter((value) => value !== null);
          if (!usableValues.length) return;

          const step = values.length > 1 ? 96 / (values.length - 1) : 0;
          let isNewSegment = true;
          const pathData = values
            .map((value, index) => {
              if (value === null) {
                isNewSegment = true;
                return '';
              }

              const x = 2 + index * step;
              const y = 52 - (value / maxValue) * 44;
              const command = isNewSegment ? 'M' : 'L';
              isNewSegment = false;
              return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .filter(Boolean)
            .join(' ');

          const path = document.createElementNS(SVG_NAMESPACE, 'path');
          path.classList.add('oe-panel-time-series-line');
          path.setAttribute('d', pathData);
          path.style.stroke = seriesConfig.colour || 'currentColor';
          svg.appendChild(path);
        });

        chartArea.appendChild(svg);
      }

      series.forEach((seriesConfig) => {
        const button = document.createElement('button');
        button.className = 'oe-panel-time-series-legend-item';
        button.type = 'button';
        button.setAttribute('aria-pressed', 'true');

        const swatch = document.createElement('span');
        swatch.className = 'oe-panel-time-series-legend-swatch';
        swatch.style.backgroundColor = seriesConfig.colour || 'currentColor';

        const label = document.createElement('span');
        label.textContent = seriesConfig.label || seriesConfig.key;
        button.append(swatch, label);

        button.addEventListener('click', () => {
          if (hiddenSeries.has(seriesConfig.key)) {
            hiddenSeries.delete(seriesConfig.key);
          } else {
            hiddenSeries.add(seriesConfig.key);
          }
          const isVisible = !hiddenSeries.has(seriesConfig.key);
          button.classList.toggle('is-muted', !isVisible);
          button.setAttribute('aria-pressed', String(isVisible));
          renderChart();
        });
        legend.appendChild(button);
      });

      const axisLabels = document.createElement('div');
      axisLabels.className = 'oe-panel-time-series-labels';
      axisLabels.style.setProperty(
        '--oe-panel-time-series-label-count',
        String(Math.max(labels.length, 1))
      );
      labels.forEach((labelText) => {
        const label = document.createElement('span');
        label.textContent = labelText;
        axisLabels.appendChild(label);
      });

      widget.append(header, legend, chartArea, axisLabels);
      container.appendChild(widget);
      renderChart();
    }

    return { renderTimeSeriesWidget };
  }

  window.createOePanelTimeSeriesWidget = createOePanelTimeSeriesWidget;
})();

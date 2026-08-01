(function () {
  function createOePanelDataWidgets({ createWidgetElement }) {
  function renderChartWidget(container, gridConfig) {
    const points = Array.isArray(gridConfig.points) ? gridConfig.points : [];

    if (!points.length) {
      container.appendChild(
        createWidgetElement(
          'oe-panel-widget oe-panel-widget-chart',
          gridConfig.title
        )
      );
      return;
    }

    if (gridConfig.chartStyle === 'bar') {
      const widget = document.createElement('div');
      widget.className =
        'oe-panel-widget oe-panel-widget-chart oe-panel-widget-bar-chart';

      const title = document.createElement('h3');
      title.className = 'oe-panel-chart-title';
      title.textContent = gridConfig.title;

      const chart = document.createElement('div');
      chart.className = 'oe-panel-bar-chart';

      const maxValue = Math.max(
        ...points.flatMap((point) => [
          Number(point.previousValue) || 0,
          Number(point.currentValue) || 0
        ]),
        1
      );

      points.forEach((point) => {
        const group = document.createElement('div');
        group.className = 'oe-panel-bar-chart-group';

        const bars = document.createElement('div');
        bars.className = 'oe-panel-bar-chart-bars';

        const previousBar = document.createElement('span');
        previousBar.className =
          'oe-panel-bar-chart-bar oe-panel-bar-chart-bar-previous';
        previousBar.style.setProperty(
          '--oe-panel-bar-height',
          `${((Number(point.previousValue) || 0) / maxValue) * 100}%`
        );

        const currentBar = document.createElement('span');
        currentBar.className =
          'oe-panel-bar-chart-bar oe-panel-bar-chart-bar-current';
        currentBar.style.setProperty(
          '--oe-panel-bar-height',
          `${((Number(point.currentValue) || 0) / maxValue) * 100}%`
        );

        const label = document.createElement('span');
        label.className = 'oe-panel-bar-chart-label';
        label.textContent = point.label;

        bars.append(previousBar, currentBar);
        group.append(bars, label);
        chart.appendChild(group);
      });

      widget.append(title, chart);
      container.appendChild(widget);
      return;
    }

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-chart oe-panel-widget-line-chart';

    const title = document.createElement('h3');
    title.className = 'oe-panel-chart-title';
    title.textContent = gridConfig.title;

    const chart = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chart.classList.add('oe-panel-line-chart-svg');
    chart.setAttribute('viewBox', '0 0 100 60');
    chart.setAttribute('aria-hidden', 'true');

    const maxValue = Math.max(
      ...points.map((point) => Number(point.value) || 0),
      1
    );
    const step = points.length > 1 ? 100 / (points.length - 1) : 100;
    const pathData = points
      .map((point, index) => {
        const x = index * step;
        const y = 54 - ((Number(point.value) || 0) / maxValue) * 48;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');

    const gridLineValues = [14, 30, 46];
    gridLineValues.forEach((y) => {
      const gridLine = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
      );
      gridLine.classList.add('oe-panel-line-chart-grid-line');
      gridLine.setAttribute('x1', '0');
      gridLine.setAttribute('x2', '100');
      gridLine.setAttribute('y1', String(y));
      gridLine.setAttribute('y2', String(y));
      chart.appendChild(gridLine);
    });

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.classList.add('oe-panel-line-chart-line');
    line.setAttribute('d', pathData);
    chart.appendChild(line);

    const labels = document.createElement('div');
    labels.className = 'oe-panel-line-chart-labels';

    points.forEach((point) => {
      const label = document.createElement('span');
      label.textContent = point.label;
      labels.appendChild(label);
    });

    widget.append(title, chart, labels);
    container.appendChild(widget);
  }

  function renderCalendarWidget(container, gridConfig) {
    const series = Array.isArray(gridConfig.calendarSeries)
      ? gridConfig.calendarSeries
      : [];
    let selectedSeries =
      series.find((seriesConfig) => seriesConfig.value === gridConfig.value) ||
      series[0] ||
      null;
    let activeMonth = new Date();
    activeMonth.setDate(1);

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-calendar oe-panel-widget-signup-calendar';

    const header = document.createElement('div');
    header.className = 'oe-panel-calendar-header';

    const title = document.createElement('h3');
    title.className = 'oe-panel-calendar-title';
    title.textContent = gridConfig.title;

    const nav = document.createElement('div');
    nav.className = 'oe-panel-calendar-nav';

    const previous = document.createElement('button');
    previous.className = 'oe-panel-calendar-nav-button';
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Previous month');
    previous.textContent = '<';

    const monthLabel = document.createElement('strong');
    monthLabel.className = 'oe-panel-calendar-month';

    const next = document.createElement('button');
    next.className = 'oe-panel-calendar-nav-button';
    next.type = 'button';
    next.setAttribute('aria-label', 'Next month');
    next.textContent = '>';

    const grid = document.createElement('div');
    grid.className = 'oe-panel-calendar-grid';

    const seriesTitle = document.createElement('strong');
    seriesTitle.className = 'oe-panel-calendar-series-title';

    const seriesSelect = document.createElement('select');
    seriesSelect.className = 'oe-panel-calendar-series-select';
    seriesSelect.setAttribute('aria-label', `${gridConfig.title} data`);
    series.forEach((seriesConfig) => {
      const option = document.createElement('option');
      option.value = seriesConfig.value;
      option.textContent = seriesConfig.label;
      seriesSelect.appendChild(option);
    });
    if (selectedSeries) {
      seriesSelect.value = selectedSeries.value;
    }

    function getDateKey(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    function getMonthAverage(year, month, daysInMonth) {
      const counts = selectedSeries?.counts || gridConfig.counts || {};
      const values = Array.from({ length: daysInMonth }, (_, index) => {
        const key = getDateKey(new Date(year, month, index + 1));
        return Number(counts[key]) || 0;
      }).filter((value) => value > 0);

      if (!values.length) return 0;
      return values.reduce((total, value) => total + value, 0) / values.length;
    }

    function renderMonth() {
      const today = new Date();
      const year = activeMonth.getFullYear();
      const month = activeMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const average = getMonthAverage(year, month, daysInMonth);
      const counts = selectedSeries?.counts || gridConfig.counts || {};
      const allowFutureDates = gridConfig.allowFutureDates === true;
      const countLabel = gridConfig.countLabel || 'items';

      monthLabel.textContent = activeMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
      });
      seriesTitle.textContent = selectedSeries?.label || '';
      seriesTitle.hidden = !selectedSeries;
      grid.replaceChildren();

      Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(year, month, index + 1);
        const dateKey = getDateKey(date);
        const signupCount = Number(counts[dateKey]) || 0;
        const isFuture = !allowFutureDates && date > today;
        const block = document.createElement('button');
        block.className = 'oe-panel-calendar-day';
        block.type = 'button';
        block.disabled = isFuture;
        block.dataset.signupLevel =
          signupCount > average && average > 0
            ? 'above-average'
            : signupCount > 0
              ? 'active'
              : 'empty';
        block.setAttribute(
          'aria-label',
          `${dateKey}, ${signupCount} ${countLabel}`
        );
        block.innerHTML = `<span>${index + 1}</span>`;
        block.addEventListener('click', () => {
          if (selectedSeries?.targetSection && selectedSeries?.targetGridId) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-section-link-request', {
                detail: {
                  section: selectedSeries.targetSection,
                  gridId: selectedSeries.targetGridId,
                  query: selectedSeries.targetFilterField
                    ? `[${selectedSeries.targetFilterField}:${dateKey}]`
                    : ''
                }
              })
            );
            return;
          }

          window.dispatchEvent(
            new CustomEvent('oe-panel-table-search-request', {
              detail: {
                gridId: gridConfig.targetGridId,
                query: `[${gridConfig.targetFilterField || 'date'}:${dateKey}]`
              }
            })
          );
        });
        grid.appendChild(block);
      });

      next.disabled =
        !allowFutureDates &&
        activeMonth.getFullYear() === today.getFullYear() &&
        activeMonth.getMonth() === today.getMonth();
    }

    previous.addEventListener('click', () => {
      activeMonth = new Date(
        activeMonth.getFullYear(),
        activeMonth.getMonth() - 1,
        1
      );
      renderMonth();
    });

    next.addEventListener('click', () => {
      activeMonth = new Date(
        activeMonth.getFullYear(),
        activeMonth.getMonth() + 1,
        1
      );
      renderMonth();
    });

    seriesSelect.addEventListener('change', () => {
      selectedSeries =
        series.find(
          (seriesConfig) => seriesConfig.value === seriesSelect.value
        ) || selectedSeries;
      renderMonth();
    });

    nav.append(previous, monthLabel, next);
    header.append(title, nav);
    if (series.length) {
      header.appendChild(seriesSelect);
    }
    widget.append(header, seriesTitle, grid);
    container.appendChild(widget);
    renderMonth();
  }

    return {
      renderChartWidget,
      renderCalendarWidget
    };
  }

  window.createOePanelDataWidgets = createOePanelDataWidgets;
})();

(function () {
  const helpers = window.createOePanelWidgetHelpers();
  const formWidgets = window.createOePanelFormWidget({
    createPanelBackHeader: helpers.createPanelBackHeader
  });
  const basicWidgets = window.createOePanelBasicWidgets({
    createWidgetElement: helpers.createWidgetElement
  });
  const dataWidgets = window.createOePanelDataWidgets({
    createWidgetElement: helpers.createWidgetElement
  });
  const timeSeriesWidgets = window.createOePanelTimeSeriesWidget({
    createWidgetElement: helpers.createWidgetElement
  });
  const pieChartWidgets = window.createOePanelPieChartWidget({
    createWidgetElement: helpers.createWidgetElement
  });
  const alertWidgets = window.createOePanelAlertWidgets({
    appendCenteredBackHeaderTitle: helpers.appendCenteredBackHeaderTitle,
    attachSyncWarningAction: helpers.attachSyncWarningAction,
    createWidgetElement: helpers.createWidgetElement,
    getBackHeaderTitle: helpers.getBackHeaderTitle
  });
  const { renderFormWidget } = formWidgets;
  const { renderEmptyWidget, renderStatsWidget } = basicWidgets;
  const { renderChartWidget, renderCalendarWidget } = dataWidgets;
  const { renderTimeSeriesWidget } = timeSeriesWidgets;
  const { renderPieChartWidget } = pieChartWidgets;
  const { renderAlertsWidget } = alertWidgets;

  window.OE_PANEL_WIDGET_HELPERS = {
    ...helpers,
    renderFormWidget
  };

  const widgetRenderers = {
    empty: renderEmptyWidget,
    stats: renderStatsWidget,
    chart: renderChartWidget,
    timeSeries: renderTimeSeriesWidget,
    pieChart: renderPieChartWidget,
    calendar: renderCalendarWidget,
    table(container, gridConfig) {
      const renderer = window.OE_PANEL_TABLE_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Table unavailable'
      });
    },
    form: renderFormWidget,
    alerts: renderAlertsWidget,
    actions(container, gridConfig) {
      const renderer = window.OE_PANEL_ACTIONS_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Actions unavailable'
      });
    },
    socialCreation(container, gridConfig) {
      const renderer = window.OE_PANEL_SOCIAL_CREATION_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Social creation unavailable'
      });
    },
    databaseButtonList(container, gridConfig) {
      const renderer = window.OE_PANEL_DATABASE_BUTTON_LIST_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Database list unavailable'
      });
    },
    gallery(container, gridConfig) {
      const renderer = window.OE_PANEL_GALLERY_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Gallery unavailable'
      });
    },
    oeGallery(container, gridConfig) {
      const renderer = window.OE_PANEL_GALLERY_WIDGET_RENDERER;
      if (typeof renderer === 'function') {
        renderer(container, gridConfig);
        return;
      }

      renderEmptyWidget(container, {
        ...gridConfig,
        title: gridConfig.title || 'Gallery unavailable'
      });
    }
  };

  window.OE_PANEL_WIDGETS = {
    render(container, gridConfig) {
      const renderer = widgetRenderers[gridConfig.type] || renderEmptyWidget;
      container.replaceChildren();
      renderer(container, gridConfig);
    }
  };
})();

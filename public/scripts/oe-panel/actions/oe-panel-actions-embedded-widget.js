(function () {
  function createOePanelActionEmbeddedWidget(options) {
    const { container, widget, createActionBackHeader, showActionList } =
      options;

    function showEmbeddedWidget(actionConfig) {
      const embeddedConfig = actionConfig?.widget;
      if (!embeddedConfig || !window.OE_PANEL_WIDGETS) return;

      const title =
        actionConfig.label || embeddedConfig.title || 'Quick Action';
      const detailHeader = createActionBackHeader(
        title,
        'Back to Quick Actions',
        showActionList
      );
      const body = document.createElement('div');
      body.className = 'oe-panel-action-embedded-widget';

      widget.className =
        'oe-panel-widget oe-panel-widget-actions oe-panel-widget-action-embedded';
      widget.replaceChildren(detailHeader, body);
      window.OE_PANEL_WIDGETS.render(body, {
        ...embeddedConfig,
        id: embeddedConfig.id || `${actionConfig.value || 'action'}-widget`
      });
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
    }

    return { showEmbeddedWidget };
  }

  window.createOePanelActionEmbeddedWidget = createOePanelActionEmbeddedWidget;
})();

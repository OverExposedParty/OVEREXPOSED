(function () {
  function createOePanelActionCore(options) {
    const { container, gridConfig, widget, title, list, displayActions, getVisibleItems, getBackHeaderTitle, appendCenteredBackHeaderTitle } = options;

    let gamemodeSettingsAlerts = Array.isArray(
      gridConfig.gamemodeSettingsAlerts
    )
      ? [...gridConfig.gamemodeSettingsAlerts]
      : [];
    let gamemodeExportAlerts = Array.isArray(gridConfig.gamemodeExportAlerts)
      ? [...gridConfig.gamemodeExportAlerts]
      : [];
    const alertCounts =
      gridConfig.alertCounts && typeof gridConfig.alertCounts === 'object'
        ? { ...gridConfig.alertCounts }
        : {};
    if (Array.isArray(gridConfig.oeIssues)) {
      alertCounts.oeIssues = gridConfig.oeIssues.length;
    }

  function getActionLabel(actionConfig) {
    const label = actionConfig.label || actionConfig.value || 'Action';
    if (!actionConfig.countKey) return label;
  
    const count = Number(alertCounts[actionConfig.countKey] || 0);
    return `${label} (${count})`;
  }
  
  async function fetchGamemodeSettingsAlerts(filter = '') {
    try {
      const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
      const response = await fetch(
        `/api/oe-panel/gamemode-settings-alerts${query}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload?.error?.message ||
            'Failed to fetch gamemode settings alerts'
        );
      }
      const alerts = Array.isArray(payload.data?.alerts)
        ? payload.data.alerts
        : [];
      if (filter === 'export-needed') {
        gamemodeExportAlerts = alerts;
        alertCounts.gamemodeExportAlerts = gamemodeExportAlerts.length;
      } else {
        gamemodeSettingsAlerts = alerts;
        alertCounts.gamemodeSettingsAlerts = gamemodeSettingsAlerts.length;
      }
      refreshActionButtonLabels();
      return alerts;
    } catch (error) {
      console.error('Failed to fetch gamemode settings alerts:', error);
      return filter === 'export-needed'
        ? gamemodeExportAlerts
        : gamemodeSettingsAlerts;
    }
  }
  
  function refreshActionButtonLabels() {
    list
      .querySelectorAll('[data-oe-panel-action-index]')
      .forEach((button) => {
        const actionConfig =
          displayActions[Number(button.dataset.oePanelActionIndex)];
        if (!actionConfig || button.disabled) return;
        button.textContent = getActionLabel(actionConfig);
      });
  }
  
  function showActionList() {
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-action-list';
    widget.replaceChildren(title, list);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-shrink', { bubbles: true })
    );
  }
  
  function createDetailGroup(label, value, className = '') {
    const group = document.createElement('div');
    group.className = ['oe-panel-alert-detail-group', className]
      .filter(Boolean)
      .join(' ');
  
    const term = document.createElement('dt');
    term.textContent = label;
  
    const description = document.createElement('dd');
    description.textContent = value || '-';
  
    group.append(term, description);
    return group;
  }
  
  function createActionBackHeader(titleText, backLabel, onBack) {
    const detailHeader = document.createElement('div');
    detailHeader.className = 'oe-panel-alert-detail-header';
  
    const backButton = document.createElement('button');
    backButton.className = 'oe-panel-alert-detail-back';
    backButton.type = 'button';
    backButton.setAttribute('aria-label', backLabel);
    backButton.addEventListener('click', onBack);
  
    const detailTitle = document.createElement('h3');
    detailTitle.className = 'oe-panel-alert-detail-title';
    detailTitle.textContent = getBackHeaderTitle(backLabel, titleText);
  
    detailHeader.append(backButton, detailTitle);
    appendCenteredBackHeaderTitle(detailHeader, titleText);
    return detailHeader;
  }
  

    return { getActionLabel, fetchGamemodeSettingsAlerts, refreshActionButtonLabels, showActionList, createDetailGroup, createActionBackHeader };
  }

  window.createOePanelActionCore = createOePanelActionCore;
})();

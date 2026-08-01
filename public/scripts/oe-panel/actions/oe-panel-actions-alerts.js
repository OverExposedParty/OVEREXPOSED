(function () {
  function createOePanelActionAlerts(options) {
    const { container, gridConfig, widget, getVisibleItems, createDetailGroup, createActionBackHeader, showActionList, attachSyncWarningAction, fetchGamemodeSettingsAlerts } = options;

  function renderRoomIssueDetail(alertConfig, onBack) {
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-expand', { bubbles: true })
    );
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-alert-detail-view';
  
    const detailHeader = createActionBackHeader(
      alertConfig.title || 'Room issue',
      'Back to room issue alerts',
      onBack
    );
    const details = document.createElement('dl');
    details.className = 'oe-panel-alert-detail-grid';
    details.append(
      createDetailGroup('Issue', alertConfig.issue?.message, 'wide'),
      createDetailGroup(
        'Details',
        alertConfig.issue?.details,
        'wide content'
      ),
      createDetailGroup('Issue status', alertConfig.issueStatus || 'Open'),
      createDetailGroup('Room code', alertConfig.room?.roomCode),
      createDetailGroup('Gamemode', alertConfig.room?.gamemode),
      createDetailGroup('Room status', alertConfig.room?.roomStatus),
      createDetailGroup('Severity', alertConfig.issue?.severity),
      createDetailGroup('Occurred at', alertConfig.issue?.occurredAt),
      createDetailGroup('Source', alertConfig.issue?.source),
      createDetailGroup('Phase', alertConfig.issue?.phase),
      createDetailGroup('Action', alertConfig.issue?.action),
      createDetailGroup('Player turn', alertConfig.issue?.playerTurn),
      createDetailGroup('Actor', alertConfig.issue?.actor),
      createDetailGroup('Username', alertConfig.issue?.username),
      createDetailGroup('Computer ID', alertConfig.issue?.computerId),
      createDetailGroup('Error code', alertConfig.issue?.code),
      createDetailGroup('HTTP status', alertConfig.issue?.status),
      createDetailGroup('Player count', alertConfig.room?.playerCount),
      createDetailGroup('Host', alertConfig.room?.hostUser),
      createDetailGroup('Created', alertConfig.room?.createdAt),
      createDetailGroup('Last updated', alertConfig.room?.lastUpdated),
      createDetailGroup('Archived', alertConfig.room?.archivedAt),
      createDetailGroup('Game ID', alertConfig.room?.gameId),
      createDetailGroup('Collection', alertConfig.room?.sourceCollection)
    );
  
    widget.replaceChildren(detailHeader, details);
  }
  
  function showRoomIssueAlerts() {
    const alerts = Array.isArray(gridConfig.alerts) ? gridConfig.alerts : [];
    const visibleAlerts = getVisibleItems(
      alerts,
      gridConfig.visibleAlerts || alerts.length
    );
    const detailHeader = createActionBackHeader(
      'Room Issue Alerts',
      'Back to room issue actions',
      showActionList
    );
    const alertList = document.createElement('div');
    alertList.className = 'oe-panel-alert-list';
  
    if (!visibleAlerts.length) {
      const emptyAlert = document.createElement('article');
      emptyAlert.className = 'oe-panel-alert-item';
      emptyAlert.dataset.oePanelAlertSeverity = 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = 'No room issue alerts';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = 'No active room issues found.';
  
      emptyAlert.append(heading, meta);
      alertList.appendChild(emptyAlert);
    }
  
    visibleAlerts.forEach((alertConfig) => {
      const alert = document.createElement('article');
      alert.className = 'oe-panel-alert-item';
      alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'info';
      alert.tabIndex = 0;
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = alertConfig.title || 'Room issue';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [alertConfig.roomCode, alertConfig.detail]
        .filter(Boolean)
        .join(' - ');
  
      const openDetail = () => {
        renderRoomIssueDetail(alertConfig, showRoomIssueAlerts);
      };
      alert.addEventListener('click', openDetail);
      alert.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetail();
      });
  
      alert.append(heading, meta);
      alertList.appendChild(alert);
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-alerts oe-panel-widget-alert-list';
    widget.replaceChildren(detailHeader, alertList);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-shrink', { bubbles: true })
    );
  }
  
  function renderGamemodeSettingsAlertList(
    alerts,
    titleText,
    emptyText,
    filter = ''
  ) {
    const visibleAlerts = getVisibleItems(alerts, 12);
    const detailHeader = createActionBackHeader(
      titleText,
      'Back to quick actions',
      showActionList
    );
    const alertList = document.createElement('div');
    alertList.className = 'oe-panel-alert-list';
  
    if (!visibleAlerts.length) {
      const emptyAlert = document.createElement('article');
      emptyAlert.className = 'oe-panel-alert-item';
      emptyAlert.dataset.oePanelAlertSeverity = 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = `No ${titleText.toLowerCase()}`;
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = emptyText;
  
      emptyAlert.append(heading, meta);
      alertList.appendChild(emptyAlert);
    }
  
    visibleAlerts.forEach((alertConfig) => {
      const alert = document.createElement(
        alertConfig.syncEndpoint ? 'button' : 'article'
      );
      alert.className = 'oe-panel-alert-item';
      if (alertConfig.syncEndpoint) {
        alert.type = 'button';
      }
      alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = alertConfig.title || 'Gamemode setting changed';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [alertConfig.detail, alertConfig.createdAt]
        .filter(Boolean)
        .join(' - ');
  
      alert.append(heading, meta);
      attachSyncWarningAction(alert, alertConfig, async () => {
        await fetchGamemodeSettingsAlerts();
        await fetchGamemodeSettingsAlerts('export-needed');
        renderGamemodeSettingsAlertList(
          await fetchGamemodeSettingsAlerts(filter),
          titleText,
          emptyText,
          filter
        );
      });
      alertList.appendChild(alert);
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-alerts oe-panel-widget-alert-list';
    widget.replaceChildren(detailHeader, alertList);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-shrink', { bubbles: true })
    );
  }
  
  async function showGamemodeSettingsAlerts() {
    renderGamemodeSettingsAlertList(
      await fetchGamemodeSettingsAlerts(),
      'Gamemode Settings Alerts',
      'Pack and rule changes will appear here.',
      ''
    );
  }
  
  async function showGamemodeExportAlerts() {
    renderGamemodeSettingsAlertList(
      await fetchGamemodeSettingsAlerts('export-needed'),
      'Gamemode Export Alerts',
      'Pack and rule changes that need JSON export will appear here.',
      'export-needed'
    );
  }
  

    return { showRoomIssueAlerts, showGamemodeSettingsAlerts, showGamemodeExportAlerts };
  }

  window.createOePanelActionAlerts = createOePanelActionAlerts;
})();

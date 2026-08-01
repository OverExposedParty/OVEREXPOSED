(function () {
  function createOePanelActionQueues(options) {
    const { container, gridConfig, widget, getVisibleItems, createActionBackHeader, showActionList, attachSyncWarningAction } = options;

  function showAdminLogAlerts() {
    const alerts = Array.isArray(gridConfig.alerts) ? gridConfig.alerts : [];
    const visibleAlerts = getVisibleItems(alerts, 12);
    const detailHeader = createActionBackHeader(
      'Log Alerts',
      'Back to log tools',
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
      heading.textContent = 'No log alerts';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = 'No failed or high severity admin actions found.';
  
      emptyAlert.append(heading, meta);
      alertList.appendChild(emptyAlert);
    }
  
    visibleAlerts.forEach((alertConfig) => {
      const alert = document.createElement('button');
      alert.className = 'oe-panel-alert-item';
      alert.type = 'button';
      alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'warning';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = alertConfig.title || 'Admin log alert';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [alertConfig.roomCode, alertConfig.detail]
        .filter(Boolean)
        .join(' - ');
  
      alert.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent('oe-panel-table-search-request', {
            detail: {
              gridId: 'admin-logs-grid-1',
              query: alertConfig.log?.logId
                ? `[logId:${alertConfig.log.logId}]`
                : alertConfig.title || '',
              expandFirstMatch: true
            }
          })
        );
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
  
  function showGenericAlertSource(actionConfig) {
    const alerts = Array.isArray(gridConfig[actionConfig.alertSource])
      ? gridConfig[actionConfig.alertSource]
      : [];
    const visibleAlerts = getVisibleItems(
      alerts,
      actionConfig.visibleAlerts || 12
    );
    const detailHeader = createActionBackHeader(
      actionConfig.label || 'Review Queue',
      'Back to actions',
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
      heading.textContent = actionConfig.emptyTitle || 'No review items';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent =
        actionConfig.emptyDetail || 'Nothing needs attention right now.';
  
      emptyAlert.append(heading, meta);
      alertList.appendChild(emptyAlert);
    }
  
    visibleAlerts.forEach((alertConfig) => {
      const canOpenTarget = Boolean(
        alertConfig.targetGridId || alertConfig.targetSection
      );
      const canSync = Boolean(alertConfig.syncEndpoint);
      const alert = document.createElement(
        canOpenTarget || canSync ? 'button' : 'article'
      );
      alert.className = 'oe-panel-alert-item';
      if (canOpenTarget || canSync) {
        alert.type = 'button';
      }
      alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'info';
      alert.dataset.oePanelAlertContainerType =
        alertConfig.containerType || alertConfig['container-type'] || '';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = alertConfig.title || 'Review item';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [alertConfig.roomCode, alertConfig.detail]
        .filter(Boolean)
        .join(' - ');
  
      alert.append(heading, meta);
  
      if (canSync) {
        attachSyncWarningAction(alert, alertConfig);
      } else if (canOpenTarget) {
        alert.addEventListener('click', () => {
          const detail = {
            gridId: alertConfig.targetGridId,
            series: alertConfig.series,
            query: alertConfig.query || '',
            expandFirstMatch: Boolean(alertConfig.expandFirstMatch)
          };
  
          if (alertConfig.targetSection) {
            window.dispatchEvent(
              new CustomEvent('oe-panel-section-link-request', {
                detail: {
                  ...detail,
                  section: alertConfig.targetSection
                }
              })
            );
            return;
          }
  
          window.dispatchEvent(
            new CustomEvent('oe-panel-table-search-request', { detail })
          );
        });
      }
  
      alertList.appendChild(alert);
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-alerts oe-panel-widget-alert-list';
    widget.replaceChildren(detailHeader, alertList);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-shrink', { bubbles: true })
    );
  }
  
  function showDashboardRecentEvents() {
    const events = Array.isArray(gridConfig.dashboardEvents)
      ? gridConfig.dashboardEvents
      : [];
    const visibleEvents = getVisibleItems(events, 12);
    const detailHeader = createActionBackHeader(
      'Recent Events',
      'Back to dashboard actions',
      showActionList
    );
    const eventList = document.createElement('div');
    eventList.className = 'oe-panel-alert-list';
  
    if (!visibleEvents.length) {
      const emptyEvent = document.createElement('article');
      emptyEvent.className = 'oe-panel-alert-item';
      emptyEvent.dataset.oePanelAlertSeverity = 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = 'No recent events';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = 'Admin activity will appear here.';
  
      emptyEvent.append(heading, meta);
      eventList.appendChild(emptyEvent);
    }
  
    visibleEvents.forEach((eventConfig) => {
      const eventButton = document.createElement('button');
      eventButton.className = 'oe-panel-alert-item';
      eventButton.type = 'button';
      eventButton.dataset.oePanelAlertSeverity =
        eventConfig.severity || 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = eventConfig.title || 'Dashboard event';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [
        eventConfig.time,
        eventConfig.area,
        eventConfig.detail
      ]
        .filter(Boolean)
        .join(' - ');
  
      eventButton.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent('oe-panel-section-link-request', {
            detail: {
              section: 'Admin Logs',
              gridId: 'admin-logs-grid-1',
              query: eventConfig.log?.logId
                ? `[logId:${eventConfig.log.logId}]`
                : eventConfig.title || ''
            }
          })
        );
      });
  
      eventButton.append(heading, meta);
      eventList.appendChild(eventButton);
    });
  
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-alerts oe-panel-widget-alert-list';
    widget.replaceChildren(detailHeader, eventList);
    container.dispatchEvent(
      new CustomEvent('oe-panel-request-shrink', { bubbles: true })
    );
  }
  
  function showOeCustomisationIssues() {
    const issues = Array.isArray(gridConfig.oeIssues)
      ? gridConfig.oeIssues
      : [];
    const visibleIssues = getVisibleItems(issues, 16);
    const detailHeader = createActionBackHeader(
      'OE Issues',
      'Back to OE actions',
      showActionList
    );
    const alertList = document.createElement('div');
    alertList.className = 'oe-panel-alert-list';
  
    if (!visibleIssues.length) {
      const emptyAlert = document.createElement('article');
      emptyAlert.className = 'oe-panel-alert-item';
      emptyAlert.dataset.oePanelAlertSeverity = 'info';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = 'No OE issues';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = 'OE customisation data looks clear.';
  
      emptyAlert.append(heading, meta);
      alertList.appendChild(emptyAlert);
    }
  
    visibleIssues.forEach((issueConfig) => {
      const alert = document.createElement('button');
      alert.className = 'oe-panel-alert-item';
      alert.type = 'button';
      alert.dataset.oePanelAlertSeverity = issueConfig.severity || 'warning';
  
      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = issueConfig.issue || 'OE issue';
  
      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [issueConfig.item, issueConfig.pack]
        .filter(Boolean)
        .join(' - ');
  
      alert.addEventListener('click', () => {
        window.dispatchEvent(
          new CustomEvent('oe-panel-table-search-request', {
            detail: {
              gridId: 'oe-customisation-grid-2',
              series: issueConfig.series || 'images',
              query: issueConfig.query || '',
              expandFirstMatch: true
            }
          })
        );
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
  

    return { showAdminLogAlerts, showGenericAlertSource, showDashboardRecentEvents, showOeCustomisationIssues };
  }

  window.createOePanelActionQueues = createOePanelActionQueues;
})();

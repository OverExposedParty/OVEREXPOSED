(function () {
  function createOePanelSocialAlertsView({
    clearActiveEditLeaveGuard,
    confirmActiveEditLeave,
    createDetailHeader,
    gridConfig,
    showMainActions,
    status,
    updateActionViewContainerSize,
    widget
  }) {
    return function showSocialAlertsView(actionConfig = {}) {
      if (!confirmActiveEditLeave()) return;
      clearActiveEditLeaveGuard();

      const alerts = Array.isArray(gridConfig.alerts) ? gridConfig.alerts : [];
      const detailHeader = createDetailHeader({
        ariaLabel: 'Back to content actions',
        centeredTitle: 'Social Alerts',
        onBack: showMainActions
      });

      const alertList = document.createElement('div');
      alertList.className = 'oe-panel-alert-list';

      if (!alerts.length) {
        const emptyAlert = document.createElement('article');
        emptyAlert.className = 'oe-panel-alert-item';
        emptyAlert.dataset.oePanelAlertSeverity = 'info';

        const heading = document.createElement('strong');
        heading.className = 'oe-panel-alert-item-title';
        heading.textContent = 'No social alerts';

        const meta = document.createElement('span');
        meta.className = 'oe-panel-alert-item-meta';
        meta.textContent = 'Everything is tidy right now.';

        emptyAlert.append(heading, meta);
        alertList.appendChild(emptyAlert);
      } else {
        alerts.forEach((alertConfig) => {
          const alert = document.createElement('article');
          alert.className = 'oe-panel-alert-item';
          alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'info';

          const heading = document.createElement('strong');
          heading.className = 'oe-panel-alert-item-title';
          heading.textContent = alertConfig.title || 'Social alert';

          const meta = document.createElement('span');
          meta.className = 'oe-panel-alert-item-meta';
          meta.textContent = [alertConfig.meta, alertConfig.detail]
            .filter(Boolean)
            .join(' - ');

          alert.append(heading, meta);
          alertList.appendChild(alert);
        });
      }

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation oe-panel-social-action-view';
      status.textContent = '';
      widget.replaceChildren(detailHeader, alertList, status);
      updateActionViewContainerSize(actionConfig, false);
    };
  }

  window.createOePanelSocialAlertsView = createOePanelSocialAlertsView;
})();

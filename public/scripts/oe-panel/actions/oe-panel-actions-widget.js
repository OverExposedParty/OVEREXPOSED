(function () {
  const {
    createWidgetElement,
    getVisibleItems,
    getBackHeaderTitle,
    appendCenteredBackHeaderTitle,
    attachSyncWarningAction,
    renderFormWidget
  } = window.OE_PANEL_WIDGET_HELPERS || {};

  function renderActionsWidget(container, gridConfig) {
    const actions = Array.isArray(gridConfig.actions) ? gridConfig.actions : [];

    if (!actions.length) {
      container.appendChild(
        createWidgetElement(
          'oe-panel-widget oe-panel-widget-actions',
          gridConfig.title
        )
      );
      return;
    }

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-actions oe-panel-widget-action-list';

    const title = document.createElement('h3');
    title.className = 'oe-panel-action-list-title';
    title.textContent = gridConfig.title;

    const list = document.createElement('div');
    list.className = 'oe-panel-action-list';

    const displayActions = getVisibleItems(
      actions,
      gridConfig.visibleActions || 6
    );
    const actionCore = window.createOePanelActionCore({
      container,
      gridConfig,
      widget,
      title,
      list,
      displayActions,
      getVisibleItems,
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle
    });
    const alertViews = window.createOePanelActionAlerts({
      container,
      gridConfig,
      widget,
      getVisibleItems,
      ...actionCore,
      attachSyncWarningAction
    });
    const queueViews = window.createOePanelActionQueues({
      container,
      gridConfig,
      widget,
      getVisibleItems,
      ...actionCore,
      attachSyncWarningAction
    });
    const operations = window.createOePanelActionOperations(actionCore);
    const embeddedWidgets = window.createOePanelActionEmbeddedWidget({
      container,
      widget,
      ...actionCore
    });
    const formFields = window.createOePanelActionFormFields({});
    const adminForms = window.createOePanelActionAdminForms({
      container,
      widget,
      ...actionCore,
      ...formFields
    });
    let showActionSubmenu;
    const packForms = window.createOePanelActionPackForms({
      container,
      widget,
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      ...actionCore,
      ...formFields,
      showActionSubmenu: (...args) => showActionSubmenu(...args)
    });
    ({ showActionSubmenu } = window.createOePanelActionSubmenu({
      container,
      widget,
      ...actionCore,
      renderFormWidget,
      ...packForms
    }));
    const { getActionLabel, fetchGamemodeSettingsAlerts, showActionList } =
      actionCore;
    const {
      showRoomIssueAlerts,
      showGamemodeSettingsAlerts,
      showGamemodeExportAlerts
    } = alertViews;
    const {
      showAdminLogAlerts,
      showGenericAlertSource,
      showDashboardRecentEvents,
      showOeCustomisationIssues
    } = queueViews;
    const { runEndpointAction, runDownloadAction } = operations;
    const { showEmbeddedWidget } = embeddedWidgets;
    const { showAdminLogFilterForm, showAdminLogArchiveForm } = adminForms;
    const { showCreatePackForm, showCreateOePackForm } = packForms;

    displayActions.forEach((actionConfig, index) => {
      const button = document.createElement('button');
      button.className = 'oe-panel-action-button';
      button.type = 'button';
      button.textContent = getActionLabel(actionConfig);
      button.dataset.oePanelActionIndex = String(index);

      if (actionConfig.value) {
        button.dataset.oePanelAction = `${actionConfig.value}-${index + 1}`;
      }

      if (actionConfig.targetSection && actionConfig.targetGridId) {
        button.addEventListener('click', () => {
          window.dispatchEvent(
            new CustomEvent('oe-panel-section-link-request', {
              detail: {
                section: actionConfig.targetSection,
                gridId: actionConfig.targetGridId,
                series: actionConfig.series,
                query: actionConfig.query || ''
              }
            })
          );
        });
      }

      if (actionConfig.view === 'room-issue-alerts') {
        button.addEventListener('click', showRoomIssueAlerts);
      }

      if (actionConfig.view === 'gamemode-settings-alerts') {
        button.addEventListener('click', showGamemodeSettingsAlerts);
      }

      if (actionConfig.view === 'gamemode-export-alerts') {
        button.addEventListener('click', showGamemodeExportAlerts);
      }

      if (actionConfig.view === 'admin-log-alerts') {
        button.addEventListener('click', showAdminLogAlerts);
      }

      if (actionConfig.view === 'admin-log-filter') {
        button.addEventListener('click', showAdminLogFilterForm);
      }

      if (actionConfig.view === 'admin-log-archive') {
        button.addEventListener('click', showAdminLogArchiveForm);
      }

      if (actionConfig.view === 'dashboard-recent-events') {
        button.addEventListener('click', showDashboardRecentEvents);
      }

      if (actionConfig.view === 'oe-customisation-issues') {
        button.addEventListener('click', showOeCustomisationIssues);
      }

      if (actionConfig.alertSource) {
        button.addEventListener('click', () => {
          showGenericAlertSource(actionConfig);
        });
      }

      if (actionConfig.view === 'embedded-widget' && actionConfig.widget) {
        button.addEventListener('click', () => {
          showEmbeddedWidget(actionConfig);
        });
      }

      if (actionConfig.form) {
        button.addEventListener('click', () => {
          renderFormWidget(container, {
            ...actionConfig.form,
            onBack: () => {
              container.replaceChildren(widget);
              showActionList();
            },
            onSuccess: () => {
              container.replaceChildren(widget);
              showActionList();
            }
          });
        });
      }

      if (actionConfig.endpoint) {
        button.addEventListener('click', () => {
          runEndpointAction(actionConfig, button);
        });
      }

      if (actionConfig.downloadEndpoint) {
        button.addEventListener('click', () => {
          runDownloadAction(actionConfig, button);
        });
      }

      if (Array.isArray(actionConfig.actions)) {
        button.addEventListener('click', () => {
          showActionSubmenu(actionConfig);
        });
      }

      list.appendChild(button);
    });

    widget.append(title, list);
    container.appendChild(widget);

    if (container.__oePanelActionsShrinkListener) {
      container.removeEventListener(
        'oe-panel-container-shrunk',
        container.__oePanelActionsShrinkListener
      );
    }
    container.__oePanelActionsShrinkListener = showActionList;
    container.addEventListener(
      'oe-panel-container-shrunk',
      container.__oePanelActionsShrinkListener
    );

    if (container.__oePanelGamemodeSettingsAlertListener) {
      window.removeEventListener(
        'oe-panel-gamemode-settings-alert',
        container.__oePanelGamemodeSettingsAlertListener
      );
    }
    container.__oePanelGamemodeSettingsAlertListener = () => {
      fetchGamemodeSettingsAlerts();
      fetchGamemodeSettingsAlerts('export-needed');
    };
    window.addEventListener(
      'oe-panel-gamemode-settings-alert',
      container.__oePanelGamemodeSettingsAlertListener
    );
  }

  window.OE_PANEL_ACTIONS_WIDGET_RENDERER = renderActionsWidget;
})();

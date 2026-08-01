(function () {
  const { getBackHeaderTitle, appendCenteredBackHeaderTitle } =
    window.OE_PANEL_WIDGET_HELPERS || {};

  function renderSocialCreationWidget(container, gridConfig) {
    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation';

    const title = document.createElement('h3');
    title.className = 'oe-panel-social-creation-title';
    title.textContent = gridConfig.title;

    const quickActionConfigs = Array.isArray(gridConfig.quickActions)
      ? gridConfig.quickActions
      : [];

    const status = document.createElement('p');
    status.className = 'oe-panel-social-creation-status';
    status.setAttribute('aria-live', 'polite');

    const editSession = {
      uploadedVideoState: null,
      activeEditLeaveGuard: null
    };

    const confirmActiveEditLeave = () =>
      !editSession.activeEditLeaveGuard ||
      editSession.activeEditLeaveGuard.confirm();

    const clearActiveEditLeaveGuard = () => {
      editSession.activeEditLeaveGuard?.cleanup();
      editSession.activeEditLeaveGuard = null;
    };

    const createActionContainer = (className = '') => {
      const actionContainer = document.createElement('div');
      actionContainer.className = ['oe-panel-social-quick-actions', className]
        .filter(Boolean)
        .join(' ');
      return actionContainer;
    };

    const createDetailHeader = ({
      ariaLabel,
      backTitle = 'Back to content actions',
      centeredTitle,
      onBack
    }) => {
      const detailHeader = document.createElement('div');
      detailHeader.className = 'oe-panel-social-action-header';

      const backButton = document.createElement('button');
      backButton.className = 'oe-panel-alert-detail-back';
      backButton.type = 'button';
      backButton.setAttribute('aria-label', ariaLabel);
      backButton.addEventListener('click', onBack);

      const detailTitle = document.createElement('h3');
      detailTitle.className =
        'oe-panel-social-creation-title oe-panel-social-action-title';
      detailTitle.textContent = getBackHeaderTitle(backTitle);

      detailHeader.append(backButton, detailTitle);
      appendCenteredBackHeaderTitle(detailHeader, centeredTitle);
      return detailHeader;
    };

    const updateActionViewContainerSize = (actionConfig, defaultExpanded) => {
      const shouldExpand = actionConfig.expandView ?? defaultExpanded;
      container.dispatchEvent(
        new CustomEvent(
          shouldExpand ? 'oe-panel-request-expand' : 'oe-panel-request-shrink',
          { bubbles: true }
        )
      );
    };

    let showSocialAlertsView = null;
    let showSocialIdeaView = null;
    let showUploadVideoView = null;

    const createContentActionButton = (actionConfig, className = '') => {
      const button = document.createElement('button');
      button.className = `oe-panel-social-quick-action ${className}`.trim();
      button.type = 'button';
      button.textContent = actionConfig.label;
      button.addEventListener('click', async () => {
        if (actionConfig.view === 'social-alerts') {
          showSocialAlertsView(actionConfig);
          return;
        }

        if (actionConfig.view === 'social-idea-create') {
          showSocialIdeaView(actionConfig);
          return;
        }

        if (actionConfig.targetGridId) {
          window.dispatchEvent(
            new CustomEvent('oe-panel-table-search-request', {
              detail: {
                gridId: actionConfig.targetGridId,
                query: actionConfig.query || ''
              }
            })
          );
          return;
        }

        if (actionConfig.view === 'upload-video') {
          showUploadVideoView(actionConfig);
          return;
        }

        const originalText = button.textContent;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        button.disabled = true;
        button.textContent = 'Saving...';
        status.textContent = '';

        try {
          const isScheduledAction = actionConfig.status === 'scheduled';
          const response = await fetch('/api/oe-panel/social-media', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platforms: actionConfig.platforms || [],
              type: actionConfig.type || '',
              status: actionConfig.status || 'draft',
              title: actionConfig.title || actionConfig.label,
              postDate: isScheduledAction
                ? tomorrow.toISOString().slice(0, 10)
                : '',
              postTime: isScheduledAction
                ? actionConfig.postTime || '09:00'
                : '',
              hook: '',
              caption: ''
            })
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok || data.success === false) {
            throw new Error(
              data?.error?.message || 'Could not create content.'
            );
          }

          status.textContent = 'Content created.';
          window.dispatchEvent(
            new CustomEvent('oe-panel-social-content-created')
          );
        } catch (error) {
          status.textContent = error.message || 'Could not create content.';
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
      return button;
    };

    const showMainActions = () => {
      if (!confirmActiveEditLeave()) return;
      clearActiveEditLeaveGuard();

      const mainActions = createActionContainer();

      quickActionConfigs.forEach((actionConfig) => {
        const childActions = Array.isArray(actionConfig.actions)
          ? actionConfig.actions
          : [];

        if (!childActions.length) {
          mainActions.appendChild(createContentActionButton(actionConfig));
          return;
        }

        const button = document.createElement('button');
        button.className = 'oe-panel-social-quick-action';
        button.type = 'button';
        button.textContent = actionConfig.label;
        button.addEventListener('click', () => {
          showActionMenu(actionConfig);
        });
        mainActions.appendChild(button);
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation';
      status.textContent = '';
      widget.replaceChildren(title, mainActions, status);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-shrink', { bubbles: true })
      );
    };

    const showActionMenu = (actionConfig) => {
      if (!confirmActiveEditLeave()) return;
      clearActiveEditLeaveGuard();

      const childActions = Array.isArray(actionConfig.actions)
        ? actionConfig.actions
        : [];
      const detailHeader = createDetailHeader({
        ariaLabel: 'Back to content actions',
        centeredTitle: actionConfig.label,
        onBack: showMainActions
      });

      const menuActions = createActionContainer(
        'oe-panel-social-detail-actions'
      );
      childActions.forEach((childActionConfig) => {
        menuActions.appendChild(createContentActionButton(childActionConfig));
      });

      widget.className =
        'oe-panel-widget oe-panel-widget-social-creation oe-panel-social-creation oe-panel-social-action-view';
      status.textContent = '';
      widget.replaceChildren(detailHeader, menuActions, status);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-shrink', { bubbles: true })
      );
    };

    showSocialAlertsView = window.createOePanelSocialAlertsView({
      clearActiveEditLeaveGuard,
      confirmActiveEditLeave,
      createDetailHeader,
      gridConfig,
      showMainActions,
      status,
      updateActionViewContainerSize,
      widget
    });
    showSocialIdeaView = window.createOePanelSocialIdeaView({
      clearActiveEditLeaveGuard,
      confirmActiveEditLeave,
      createDetailHeader,
      quickActionConfigs,
      showActionMenu,
      showMainActions,
      status,
      updateActionViewContainerSize,
      widget
    });
    showUploadVideoView = window.createOePanelSocialVideoStudio({
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      quickActionConfigs,
      widget,
      status,
      container,
      session: editSession,
      showActionMenu,
      clearActiveEditLeaveGuard,
      createDownloadIcon: window.createOePanelSocialDownloadIcon
    });

    showMainActions();
    container.appendChild(widget);
  }

  window.OE_PANEL_SOCIAL_CREATION_WIDGET_RENDERER = renderSocialCreationWidget;
})();

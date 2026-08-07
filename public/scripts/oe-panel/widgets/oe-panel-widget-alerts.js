(function () {
  function createOePanelAlertWidgets({
    appendCenteredBackHeaderTitle,
    attachSyncWarningAction,
    createWidgetElement,
    getBackHeaderTitle
  }) {
  function renderAlertsWidget(container, gridConfig) {
    const alerts = Array.isArray(gridConfig.alerts) ? gridConfig.alerts : [];

    if (!alerts.length) {
      container.appendChild(
        createWidgetElement(
          'oe-panel-widget oe-panel-widget-alerts',
          gridConfig.title
        )
      );
      return;
    }

    const widget = document.createElement('div');
    widget.className =
      'oe-panel-widget oe-panel-widget-alerts oe-panel-widget-alert-list';

    const title = document.createElement('h3');
    title.className = 'oe-panel-alert-list-title';
    title.textContent = gridConfig.title;

    const list = document.createElement('div');
    list.className = 'oe-panel-alert-list';

    const displayAlerts = alerts;
    const visibleAlertCount = gridConfig.visibleAlerts || 5;

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

    function showAlertList() {
      widget.className =
        'oe-panel-widget oe-panel-widget-alerts oe-panel-widget-alert-list';
      widget.replaceChildren(title, list);
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-shrink', { bubbles: true })
      );
    }

    function createAlertDetailHeader(alertConfig, backLabel) {
      const detailHeader = document.createElement('div');
      detailHeader.className = 'oe-panel-alert-detail-header';

      const backButton = document.createElement('button');
      backButton.className = 'oe-panel-alert-detail-back';
      backButton.type = 'button';
      backButton.setAttribute('aria-label', backLabel);
      backButton.addEventListener('click', showAlertList);

      const detailTitle = document.createElement('h3');
      detailTitle.className = 'oe-panel-alert-detail-title';
      detailTitle.textContent = getBackHeaderTitle(backLabel);

      detailHeader.append(backButton, detailTitle);
      appendCenteredBackHeaderTitle(
        detailHeader,
        alertConfig.post?.title || alertConfig.title
      );
      return detailHeader;
    }

    function createAlertDetailAction(label, actionValue, onClick) {
      const action = document.createElement('button');
      action.className = 'oe-panel-alert-detail-action';
      action.type = 'button';
      action.textContent = label;
      action.dataset.oePanelAlertAction = actionValue;
      action.addEventListener('click', onClick);
      return action;
    }

    function renderModerationReport(alertConfig) {
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
      widget.className =
        'oe-panel-widget oe-panel-widget-alerts oe-panel-alert-detail-view';
      widget.replaceChildren();

      const detailHeader = createAlertDetailHeader(
        alertConfig,
        'Back to reported content'
      );

      async function submitReportAction(action, note = '') {
        const reportId = alertConfig.report?.id || alertConfig.reportId;
        if (!reportId) return;

        delete actions.dataset.oePanelActionError;
        actions
          .querySelectorAll('.oe-panel-alert-detail-action')
          .forEach((button) => {
            button.disabled = true;
          });

        try {
          const response = await fetch(`/api/oe-panel/reports/${reportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, note })
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload.success === false) {
            throw new Error(
              payload?.error?.message || 'Failed to update report'
            );
          }

          const updatedAlert = payload.data?.reportedContent;
          if (updatedAlert) {
            Object.assign(alertConfig, updatedAlert);
            renderModerationReport(alertConfig);
          }
        } catch (error) {
          console.error('Failed to update OE Panel report:', error);
          actions.dataset.oePanelActionError = error.message;
        } finally {
          actions
            .querySelectorAll('.oe-panel-alert-detail-action')
            .forEach((button) => {
              button.disabled = false;
            });
        }
      }

      const details = document.createElement('dl');
      details.className = 'oe-panel-alert-detail-grid';
      details.append(
        createDetailGroup('Title', alertConfig.post?.title, 'wide'),
        createDetailGroup('Content', alertConfig.post?.text, 'wide content'),
        createDetailGroup('Post status', alertConfig.post?.status),
        createDetailGroup('Review', alertConfig.moderation?.reviewStatus),
        createDetailGroup(
          'Reports',
          String(alertConfig.post?.reportCount || 1)
        ),
        createDetailGroup('Priority', alertConfig.report?.priority),
        createDetailGroup('Reason', alertConfig.report?.reason),
        createDetailGroup('Reporter', alertConfig.report?.reporter),
        createDetailGroup('Date', alertConfig.report?.reportedAt),
        createDetailGroup('Post date', alertConfig.post?.postedAt),
        createDetailGroup('Author', alertConfig.post?.author),
        createDetailGroup('Public ID', alertConfig.post?.publicId)
      );

      const actions = document.createElement('div');
      actions.className = 'oe-panel-alert-detail-actions';
      [
        'Mark reviewing',
        'Approve',
        'Hide',
        'Delete',
        'Dismiss report',
        'Escalate',
        'Add note'
      ].forEach((label) => {
        const action = document.createElement('button');
        action.className = 'oe-panel-alert-detail-action';
        action.type = 'button';
        action.textContent = label;
        action.dataset.oePanelReportAction = label
          .toLowerCase()
          .replace(/\s+/g, '-');
        action.addEventListener('click', () => {
          const actionType = action.dataset.oePanelReportAction;
          if (actionType === 'add-note') {
            const note = window.prompt('Add internal moderation note');
            if (note === null) return;
            submitReportAction(actionType, note);
            return;
          }

          submitReportAction(actionType);
        });
        actions.appendChild(action);
      });

      if (alertConfig.post?.url) {
        const postLink = document.createElement('a');
        postLink.className =
          'oe-panel-alert-detail-action oe-panel-alert-detail-link';
        postLink.href = alertConfig.post.url;
        postLink.textContent = 'View post';
        actions.appendChild(postLink);
      }

      widget.append(detailHeader, details, actions);
    }

    function renderRoomIssue(alertConfig) {
      container.dispatchEvent(
        new CustomEvent('oe-panel-request-expand', { bubbles: true })
      );
      widget.className =
        'oe-panel-widget oe-panel-widget-alerts oe-panel-alert-detail-view';
      widget.replaceChildren();

      const detailHeader = createAlertDetailHeader(
        alertConfig,
        'Back to room issues'
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
        createDetailGroup('Game version', alertConfig.issue?.gameModeVersion),
        createDetailGroup('Session build', alertConfig.issue?.sessionBuild),
        createDetailGroup('Error build', alertConfig.issue?.runtimeBuild),
        createDetailGroup('Build changed', alertConfig.issue?.buildChanged),
        createDetailGroup('Release ID', alertConfig.issue?.releaseId, 'wide'),
        createDetailGroup('Content hash', alertConfig.issue?.contentHash, 'wide'),
        createDetailGroup('Player count', alertConfig.room?.playerCount),
        createDetailGroup('Host', alertConfig.room?.hostUser),
        createDetailGroup('Created', alertConfig.room?.createdAt),
        createDetailGroup('Last updated', alertConfig.room?.lastUpdated),
        createDetailGroup('Archived', alertConfig.room?.archivedAt),
        createDetailGroup('Game ID', alertConfig.room?.gameId),
        createDetailGroup('Collection', alertConfig.room?.sourceCollection)
      );

      const actions = document.createElement('div');
      actions.className = 'oe-panel-alert-detail-actions';

      actions.append(
        createAlertDetailAction('Mark reviewing', 'mark-reviewing', () => {
          alertConfig.issueStatus = 'Reviewing';
          renderRoomIssue(alertConfig);
        }),
        createAlertDetailAction('Archive issue', 'archive-issue', () => {
          alertConfig.issueStatus = 'Archived';
          alertConfig.archived = true;
          showAlertList();
          updateVisibleAlerts();
        }),
        createAlertDetailAction('Copy diagnostics', 'copy-diagnostics', () => {
          const diagnostics =
            alertConfig.diagnostics || alertConfig.detail || '';
          navigator.clipboard?.writeText(diagnostics).catch(() => {});
        }),
        createAlertDetailAction('Add note', 'add-note', () => {
          const note = window.prompt('Add internal room issue note');
          if (note === null) return;
          alertConfig.note = note;
          renderRoomIssue(alertConfig);
        })
      );

      if (alertConfig.room?.roomCode && alertConfig.room.roomCode !== '-') {
        actions.append(
          createAlertDetailAction('View room', 'view-room', () => {
            window.location.href = `/party-games/waiting-room?party=${encodeURIComponent(
              alertConfig.room.roomCode
            )}`;
          })
        );
      }

      widget.append(detailHeader, details, actions);
    }

    displayAlerts.forEach((alertConfig) => {
      const alert = document.createElement('article');
      alert.className = 'oe-panel-alert-item';
      alert.dataset.oePanelAlertSeverity = alertConfig.severity || 'info';
      alert.dataset.oePanelAlertContainerType =
        alertConfig.containerType || alertConfig['container-type'] || '';

      const heading = document.createElement('strong');
      heading.className = 'oe-panel-alert-item-title';
      heading.textContent = alertConfig.title;

      const meta = document.createElement('span');
      meta.className = 'oe-panel-alert-item-meta';
      meta.textContent = [alertConfig.roomCode, alertConfig.detail]
        .filter(Boolean)
        .join(' - ');

      alert.append(heading, meta);
      const hasSyncAction = attachSyncWarningAction(alert, alertConfig);
      if (
        !hasSyncAction &&
        ['moderation-report', 'room-issue'].includes(
          alertConfig.containerType || alertConfig['container-type']
        )
      ) {
        alert.tabIndex = 0;
        alert.addEventListener('click', () => {
          if (
            (alertConfig.containerType || alertConfig['container-type']) ===
            'room-issue'
          ) {
            renderRoomIssue(alertConfig);
            return;
          }

          renderModerationReport(alertConfig);
        });
        alert.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          if (
            (alertConfig.containerType || alertConfig['container-type']) ===
            'room-issue'
          ) {
            renderRoomIssue(alertConfig);
            return;
          }

          renderModerationReport(alertConfig);
        });
      }
      list.appendChild(alert);
    });

    function updateVisibleAlerts() {
      const shouldShowAll = container.classList.contains('expanded');
      [...list.children].forEach((alert, index) => {
        alert.hidden =
          Boolean(displayAlerts[index]?.archived) ||
          (!shouldShowAll && index >= visibleAlertCount);
      });
    }

    container.addEventListener(
      'oe-panel-container-expanded',
      updateVisibleAlerts
    );
    container.addEventListener(
      'oe-panel-container-shrunk',
      updateVisibleAlerts
    );
    updateVisibleAlerts();

    widget.append(title, list);
    container.appendChild(widget);
  }

    return { renderAlertsWidget };
  }

  window.createOePanelAlertWidgets = createOePanelAlertWidgets;
})();

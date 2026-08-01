(function () {
  function createOePanelWidgetHelpers() {
    function createWidgetElement(className, text) {
      const widget = document.createElement('div');
      widget.className = className;
      widget.textContent = text;
      return widget;
    }

    function getVisibleItems(items, visibleCount) {
      if (!items.length) return [];
      if (!Number.isFinite(Number(visibleCount))) return items;

      return items.slice(0, Math.max(Number(visibleCount), 0));
    }

    function normaliseGalleryImagePath(imagePath) {
      return String(imagePath || '').replace(
        '/images/olings/furniture/ceiling-lights/basic-hanging-light.svg',
        '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg'
      );
    }

    function getBackHeaderTitle(backLabel, fallback = 'Back') {
      const target = String(backLabel || fallback)
        .replace(/^back to\s+/i, '')
        .trim();

      if (!target) return fallback;

      return target
        .split(/\s+/)
        .map((word) =>
          word
            .split('-')
            .map((part) =>
              part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part
            )
            .join('-')
        )
        .join(' ');
    }

    function appendCenteredBackHeaderTitle(detailHeader, titleText) {
      const normalizedTitle = String(titleText || '').trim();
      if (!normalizedTitle) return null;

      const centeredTitle = document.createElement('h3');
      centeredTitle.className = 'oe-panel-back-header-current-title';
      centeredTitle.textContent = normalizedTitle;
      detailHeader.appendChild(centeredTitle);
      return centeredTitle;
    }

    function clearPanelDataCache(keys = []) {
      const panelData = window.OE_PANEL_DATA;
      if (!panelData || typeof panelData.clear !== 'function') return;

      keys.forEach((key) => panelData.clear(key));
    }

    async function runSyncWarningAction(alertConfig, afterSync) {
      const endpoint = alertConfig?.syncEndpoint;
      if (!endpoint) return false;

      const confirmed = window.confirm(
        alertConfig.syncConfirmMessage ||
          'Export the database content to the JSON backup now?'
      );
      if (!confirmed) return true;

      try {
        const response = await fetch(endpoint, { method: 'POST' });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || payload.success === false) {
          throw new Error(payload?.error?.message || 'Sync failed.');
        }

        clearPanelDataCache(
          Array.isArray(alertConfig.syncRefreshKeys)
            ? alertConfig.syncRefreshKeys
            : ['system']
        );
        window.dispatchEvent(
          new CustomEvent('oe-panel-admin-logs-data-changed')
        );

        if (typeof afterSync === 'function') {
          await afterSync(payload);
        }

        window.alert(
          payload.data?.message || alertConfig.syncSuccessMessage || 'Synced.'
        );
        return true;
      } catch (error) {
        window.alert(error.message || 'Sync failed.');
        return true;
      }
    }

    function attachSyncWarningAction(alert, alertConfig, afterSync) {
      if (!alertConfig?.syncEndpoint) return false;

      if (alert.tagName !== 'BUTTON') {
        alert.tabIndex = 0;
        alert.setAttribute('role', 'button');
      }
      alert.title = 'Export database content to JSON backup';
      alert.addEventListener('click', () => {
        runSyncWarningAction(alertConfig, afterSync);
      });
      alert.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        runSyncWarningAction(alertConfig, afterSync);
      });
      return true;
    }

    function createPanelBackHeader(titleText, backLabel, onBack) {
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

    return {
      createWidgetElement,
      getVisibleItems,
      normaliseGalleryImagePath,
      getBackHeaderTitle,
      appendCenteredBackHeaderTitle,
      runSyncWarningAction,
      attachSyncWarningAction,
      createPanelBackHeader
    };
  }

  window.createOePanelWidgetHelpers = createOePanelWidgetHelpers;
})();

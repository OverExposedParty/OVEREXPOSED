(function () {
  function createPopupFeedNotifications({
    dismissPopup,
    getStoredAccountSafely,
    isSignedInAccount,
    showPopup,
    showAccountNotifications
  }) {
    let notificationPollTimer = null;
    let notificationRequestRunning = false;
    const activeSystemNotificationRows = new Map();
    const systemNotificationCleanups = new WeakMap();
    const social = window.createPopupFeedSocialNotifications({
      dismissPopup,
      getStoredAccountSafely,
      isSignedInAccount,
      showPopup
    });
    const lobby = window.createPopupFeedLobbyNotifications({
      dismissPopup,
      showPopup
    });
    const olings = window.createPopupFeedOlingNotifications({
      getStoredAccountSafely,
      isSignedInAccount,
      showPopup
    });

    function getSystemNotificationKey(notification = {}) {
      return String(
        notification.key || notification.id || notification.type || 'system'
      ).trim();
    }

    function cleanupSystemNotification(row) {
      const cleanup = systemNotificationCleanups.get(row);
      if (!cleanup) return;
      cleanup();
      systemNotificationCleanups.delete(row);
    }

    function dismissSystemNotification(key, row) {
      cleanupSystemNotification(row);
      if (activeSystemNotificationRows.get(key) === row) {
        activeSystemNotificationRows.delete(key);
      }
      dismissPopup(row);
    }

    async function openSystemNotificationSettings(notification, row) {
      const buttons = row.querySelectorAll('button');
      buttons.forEach((button) => {
        button.disabled = true;
      });

      try {
        const opened = await window.openAccountSettingsPanel?.();
        if (!opened) return;

        const targetId = String(
          notification.action?.target || 'settings-nsfw'
        ).trim();
        const target = document.getElementById(targetId);
        target?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        target?.focus?.({ preventScroll: true });
      } catch (error) {
        console.warn(error);
      } finally {
        buttons.forEach((button) => {
          button.disabled = false;
        });
      }
    }

    function renderSystemNotificationPopupRow(
      row,
      notification = {},
      key = getSystemNotificationKey(notification)
    ) {
      row.classList.add('system-notification-popup-row');
      row.classList.toggle('has-image', Boolean(notification.image));
      row.dataset.popupType = 'system-notification';
      row.dataset.notificationCategory = notification.category || 'system';
      row.dataset.notificationVariant = notification.variant || 'default';
      if (notification.id) {
        row.dataset.notificationId = String(notification.id);
      } else {
        delete row.dataset.notificationId;
      }
      row.setAttribute('role', 'alertdialog');
      row.setAttribute(
        'aria-label',
        `${notification.title || 'Notification'}. ${
          notification.body || ''
        }`.trim()
      );
      cleanupSystemNotification(row);
      if (notification.dismissWhenNsfwEnabled) {
        const handleNsfwSettingChanged = (event) => {
          if (event.detail?.enabled !== true) return;
          dismissSystemNotification(key, row);
        };
        window.addEventListener(
          'oe-nsfw-setting-changed',
          handleNsfwSettingChanged
        );
        systemNotificationCleanups.set(row, () => {
          window.removeEventListener(
            'oe-nsfw-setting-changed',
            handleNsfwSettingChanged
          );
        });
      }

      const leadingVisual = document.createElement('span');
      if (notification.image) {
        leadingVisual.className = 'system-notification-popup-image';
        const image = document.createElement('img');
        image.src = notification.image;
        image.alt = '';
        leadingVisual.appendChild(image);
      } else {
        leadingVisual.className = 'system-notification-popup-marker';
      }
      leadingVisual.setAttribute('aria-hidden', 'true');

      const content = document.createElement('span');
      content.className = 'system-notification-popup-content';

      const label = document.createElement('span');
      label.className = 'system-notification-popup-label';
      label.textContent = notification.label || 'Notice';

      const title = document.createElement('span');
      title.className = 'system-notification-popup-title';
      title.textContent =
        notification.title || 'Something needs your attention';

      const message = document.createElement('span');
      message.className = 'system-notification-popup-message';
      message.textContent = notification.body || '';

      const actions = document.createElement('span');
      actions.className =
        'friend-request-popup-actions system-notification-popup-actions';

      const dismiss = document.createElement('button');
      dismiss.className =
        'friend-request-popup-view system-notification-popup-dismiss';
      dismiss.type = 'button';
      dismiss.textContent = 'Dismiss';
      dismiss.addEventListener('click', () => {
        dismissSystemNotification(key, row);
      });

      content.append(label, title, message);
      actions.appendChild(dismiss);
      if (notification.action?.type === 'open_settings') {
        const openSettings = document.createElement('button');
        openSettings.className =
          'friend-request-popup-view system-notification-popup-open-settings';
        openSettings.type = 'button';
        openSettings.textContent = 'Open Settings';
        openSettings.addEventListener('click', () => {
          openSystemNotificationSettings(notification, row);
        });
        actions.appendChild(openSettings);
      }
      row.replaceChildren(leadingVisual, content, actions);
      return row;
    }

    function createSystemNotificationPopupRow(notification = {}) {
      const row = document.createElement('div');
      renderSystemNotificationPopupRow(row, notification);
      return row;
    }

    function showSystemNotificationPopup(notification = {}) {
      const key = getSystemNotificationKey(notification);
      const activeRow = activeSystemNotificationRows.get(key);
      if (activeRow?.isConnected) {
        renderSystemNotificationPopupRow(activeRow, notification, key);
        activeRow.classList.remove('is-refreshed');
        activeRow.getBoundingClientRect();
        activeRow.classList.add('is-refreshed');
        return activeRow;
      }
      activeSystemNotificationRows.delete(key);

      const row = createSystemNotificationPopupRow(notification);
      activeSystemNotificationRows.set(key, row);
      return showPopup(row, {
        persist: true,
        slideInSound: notification.slideInSound || 'notificationAttention'
      });
    }

    function showSystemNotifications(notifications = []) {
      const shownIds = [];
      notifications.forEach((notification) => {
        const row = showSystemNotificationPopup(notification);
        const id = String(notification?.id || '').trim();
        if (row && id) shownIds.push(id);
      });
      return shownIds;
    }

    function clearSystemNotifications() {
      activeSystemNotificationRows.forEach((row) => {
        cleanupSystemNotification(row);
      });
      activeSystemNotificationRows.clear();
    }

    async function acknowledgeNotifications(notificationIds) {
      if (!notificationIds.length) return;
      const response = await fetch('/api/accounts/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delivered',
          notificationIds
        })
      });
      if (!response.ok) {
        throw new Error('Notification acknowledgement failed');
      }
    }

    async function checkNotifications() {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account) || notificationRequestRunning) return;

      notificationRequestRunning = true;
      try {
        const response = await fetch('/api/accounts/notifications', {
          cache: 'no-store',
          credentials: 'same-origin'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) return;
        const all = Array.isArray(payload?.data?.notifications)
          ? payload.data.notifications
          : Array.isArray(payload?.notifications)
            ? payload.notifications
            : [];
        const inboxNotifications = Array.isArray(
          payload?.data?.inboxNotifications
        )
          ? payload.data.inboxNotifications
          : Array.isArray(payload?.inboxNotifications)
            ? payload.inboxNotifications
            : [];
        const unreadCount =
          payload?.data?.unreadCount ?? payload?.unreadCount ?? 0;
        const unreadMenuCounts =
          payload?.data?.unreadMenuCounts ?? payload?.unreadMenuCounts ?? null;
        window.OEAccountNotificationState?.setAccountNotifications({
          notifications: inboxNotifications,
          unreadCount,
          unreadMenuCounts
        });
        const friend = all.filter(
          (notification) => notification?.category === 'social'
        );
        const party = all.filter(
          (notification) => notification?.category === 'party'
        );
        const progression = all.filter(
          (notification) => notification?.category === 'progression'
        );
        const system = all.filter(
          (notification) => notification?.category === 'system'
        );
        const shownIds = [
          ...social.showFriendNotifications(friend),
          ...social.showPartyNotifications(party),
          ...(await showAccountNotifications(progression)),
          ...showSystemNotifications(system)
        ];
        await acknowledgeNotifications([...new Set(shownIds)]);
      } catch (error) {
        console.warn(error);
      } finally {
        notificationRequestRunning = false;
      }
    }

    function startNotificationPolling() {
      if (notificationPollTimer) return;
      window.setTimeout(checkNotifications, 1500);
      notificationPollTimer = window.setInterval(checkNotifications, 15000);
    }

    return {
      showFriendRequestPopup: social.showFriendRequestPopup,
      showFriendAcceptedPopup: social.showFriendAcceptedPopup,
      showPartyNotificationPopup: social.showPartyNotificationPopup,
      showIncubatorReadyPopup: olings.showIncubatorReadyPopup,
      showSystemNotificationPopup,
      showSystemNotifications,
      clearSystemNotifications,
      checkFriendNotifications: social.checkFriendNotifications,
      checkPartyNotifications: social.checkPartyNotifications,
      checkOlingNotifications: olings.checkOlingNotifications,
      checkActiveLobby: lobby.checkActiveLobby,
      checkNotifications,
      startNotificationPolling,
      startFriendNotificationPolling: social.startFriendNotificationPolling,
      startPartyNotificationPolling: social.startPartyNotificationPolling,
      startOlingNotificationPolling: olings.startOlingNotificationPolling,
      startActiveLobbyPolling: lobby.startActiveLobbyPolling,
      clearSignedOutNotifications() {
        social.clearSignedOutNotifications();
        olings.clearSignedOutNotifications();
      },
      resetActiveLobbyNotification: lobby.resetActiveLobbyNotification
    };
  }

  window.createPopupFeedNotifications = createPopupFeedNotifications;
})();

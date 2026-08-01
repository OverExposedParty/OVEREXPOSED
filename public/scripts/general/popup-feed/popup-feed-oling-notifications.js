(function () {
  function createPopupFeedOlingNotifications({
    getStoredAccountSafely,
    isSignedInAccount,
    showPopup
  }) {
    let olingNotificationPollTimer = null;
    let olingNotificationRequestRunning = false;
    const displayedOlingNotificationIds = new Set();

    function createIncubatorReadyPopupRow(notification = {}) {
      const row = document.createElement('button');
      row.className = 'incubator-ready-popup-row';
      row.dataset.popupType = 'incubator-ready';
      row.type = 'button';
      row.setAttribute(
        'aria-label',
        `${notification.eggName || 'Your egg'} is ready to hatch. Open Olings Lab.`
      );

      const image = document.createElement('span');
      image.className = 'incubator-ready-popup-image';
      if (notification.image) {
        const eggImage = document.createElement('img');
        eggImage.src = notification.image;
        eggImage.alt = '';
        image.appendChild(eggImage);
      } else {
        image.textContent = '🥚';
      }

      const content = document.createElement('span');
      content.className = 'friend-request-popup-content';
      const label = document.createElement('span');
      label.className = 'friend-request-popup-label';
      label.textContent = 'Ready to hatch';
      const title = document.createElement('span');
      title.className = 'friend-request-popup-username';
      title.textContent = notification.eggName || 'Your egg';
      const message = document.createElement('span');
      message.className = 'friend-request-popup-message';
      message.textContent = 'Your incubator has finished';
      content.append(label, title, message);

      const view = document.createElement('span');
      view.className = 'friend-request-popup-view';
      view.textContent = 'View';
      row.append(image, content, view);
      row.addEventListener('click', () => {
        if (typeof window.navigateFromPopupFeed === 'function') {
          window.navigateFromPopupFeed('/olings/lab');
          return;
        }
        window.location.assign('/olings/lab');
      });
      return row;
    }

    function showIncubatorReadyPopup(notification = {}) {
      return showPopup(createIncubatorReadyPopupRow(notification), {
        duration: Number(notification.duration) || 10000,
        slideInSound: 'notificationAttention'
      });
    }

    async function acknowledgeOlingNotifications(notificationIds) {
      if (!notificationIds.length) return;
      const response = await fetch('/api/olings/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds })
      });
      if (!response.ok)
        throw new Error('Oling notification acknowledgement failed');
    }

    async function checkOlingNotifications() {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account) || olingNotificationRequestRunning)
        return;
      olingNotificationRequestRunning = true;
      try {
        const response = await fetch('/api/olings/notifications', {
          cache: 'no-store',
          credentials: 'same-origin'
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) return;
        const notifications = Array.isArray(payload?.data?.notifications)
          ? payload.data.notifications
          : Array.isArray(payload?.notifications)
            ? payload.notifications
            : [];
        const shownIds = [];
        notifications.forEach((notification) => {
          const id = String(notification?.id || '');
          if (!id || displayedOlingNotificationIds.has(id)) return;
          displayedOlingNotificationIds.add(id);
          shownIds.push(id);
          showIncubatorReadyPopup(notification);
        });
        if (shownIds.length) await acknowledgeOlingNotifications(shownIds);
      } catch (error) {
        console.warn(error);
      } finally {
        olingNotificationRequestRunning = false;
      }
    }

    function startOlingNotificationPolling() {
      if (olingNotificationPollTimer) return;
      window.setTimeout(checkOlingNotifications, 3000);
      olingNotificationPollTimer = window.setInterval(
        checkOlingNotifications,
        30000
      );
    }

    return {
      showIncubatorReadyPopup,
      checkOlingNotifications,
      startOlingNotificationPolling,
      clearSignedOutNotifications() {
        displayedOlingNotificationIds.clear();
      }
    };
  }

  window.createPopupFeedOlingNotifications = createPopupFeedOlingNotifications;
})();

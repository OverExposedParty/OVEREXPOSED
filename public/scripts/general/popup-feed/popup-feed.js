(function () {
  const DEFAULT_SLIDE_IN_SOUND = 'notificationSlideIn';
  const DEFAULT_SLIDE_OUT_SOUND = 'notificationSlideOut';
  const popupTimeouts = new Set();
  const popupSounds = new WeakMap();
  const popupAnalytics = new WeakMap();
  const popupLastActions = new WeakMap();
  const popupAnalyticsBound = new WeakSet();
  const exitingPopups = new WeakSet();
  const activeStatusPopups = new Map();
  let activeSiteUpdatePopup = null;
  let siteUpdatePollTimer = null;
  let siteVersionCheckSucceeded = false;

  function playPopupSound(soundKey) {
    if (!soundKey || typeof window.playSoundEffect !== 'function') return;

    try {
      Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
    } catch {
      // A notification should still render if audio is unavailable.
    }
  }

  function normalisePopupSound(sound, fallback) {
    if (
      sound === false ||
      sound === null ||
      String(sound || '')
        .trim()
        .toLowerCase() === 'none'
    ) {
      return null;
    }
    if (typeof sound === 'string' && sound.trim()) return sound.trim();
    return fallback;
  }

  function getPopupSounds(options = {}) {
    const hasSlideInSound = Object.hasOwn(options, 'slideInSound');
    const hasSlideOutSound = Object.hasOwn(options, 'slideOutSound');
    const requestedSlideInSound =
      options.sound === false
        ? null
        : hasSlideInSound
          ? options.slideInSound
          : options.soundKey;

    return {
      slideInSound: normalisePopupSound(
        requestedSlideInSound,
        DEFAULT_SLIDE_IN_SOUND
      ),
      slideOutSound: normalisePopupSound(
        hasSlideOutSound ? options.slideOutSound : undefined,
        DEFAULT_SLIDE_OUT_SOUND
      )
    };
  }

  function getPopupFeed() {
    let feed = document.getElementById('oe-popup-feed');
    if (feed) return feed;

    feed = document.createElement('div');
    feed.className = 'oe-popup-feed';
    feed.id = 'oe-popup-feed';
    feed.setAttribute('aria-live', 'polite');
    document.body.appendChild(feed);
    return feed;
  }

  function getPopupAnalytics(row, options = {}) {
    const configured =
      options.analytics && typeof options.analytics === 'object'
        ? options.analytics
        : {};
    const popupClass = Array.from(row?.classList || []).find((className) =>
      className.endsWith('popup-row')
    );
    const notificationType =
      configured.notificationType ||
      row?.dataset?.popupType ||
      popupClass ||
      '';
    const notificationId = row?.dataset?.notificationId || '';
    const notificationKey =
      configured.key ||
      (notificationId
        ? `${notificationType || 'notification'}:${notificationId}`
        : notificationType);
    if (!notificationKey) return null;

    return {
      notificationKey,
      notificationType: notificationType || 'popup',
      category: configured.category || row?.dataset?.notificationCategory || '',
      variant: configured.variant || row?.dataset?.notificationVariant || ''
    };
  }

  function trackPopupEvent(row, eventName, properties = {}) {
    const analytics = popupAnalytics.get(row);
    if (!analytics || typeof window.OEAnalytics?.track !== 'function') return;
    window.OEAnalytics.track(eventName, {
      ...analytics,
      ...properties
    });
  }

  function getPopupAction(target) {
    const actionTarget = target?.closest?.('button, a');
    if (!actionTarget) return '';
    if (actionTarget.dataset.analyticsAction) {
      return actionTarget.dataset.analyticsAction;
    }
    if (
      [...actionTarget.classList].some((className) =>
        className.includes('dismiss')
      )
    ) {
      return 'dismiss';
    }
    return String(actionTarget.textContent || 'action')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  function bindPopupAnalytics(row) {
    if (popupAnalyticsBound.has(row)) return;
    popupAnalyticsBound.add(row);
    row.addEventListener(
      'click',
      (event) => {
        const action = getPopupAction(event.target);
        if (!action) return;
        popupLastActions.set(row, action);
        trackPopupEvent(row, 'notification.action_clicked', { action });
        const clearLastAction = () => popupLastActions.delete(row);
        if (typeof window.queueMicrotask === 'function') {
          window.queueMicrotask(clearLastAction);
        } else {
          Promise.resolve().then(clearLastAction);
        }
      },
      true
    );
  }

  function dismissPopup(row, timeoutOrOptions) {
    const options =
      timeoutOrOptions && typeof timeoutOrOptions === 'object'
        ? timeoutOrOptions
        : { timeoutId: timeoutOrOptions };
    const timeoutId = options.timeoutId;
    if (timeoutId) popupTimeouts.delete(timeoutId);
    if (!row || exitingPopups.has(row)) return false;
    exitingPopups.add(row);
    const lastAction = popupLastActions.get(row);
    const reason =
      options.reason ||
      (lastAction === 'dismiss' ? 'dismiss_button' : 'programmatic');
    trackPopupEvent(
      row,
      reason === 'dismiss_button'
        ? 'notification.dismissed'
        : 'notification.closed',
      { reason }
    );
    const sounds = popupSounds.get(row);
    playPopupSound(sounds ? sounds.slideOutSound : DEFAULT_SLIDE_OUT_SOUND);
    row.classList.add('is-exiting');
    setTimeout(() => row.remove(), 260);
    return true;
  }

  function showPopup(row, options = {}) {
    const feed = getPopupFeed();
    const duration = Number(options.duration) || 4200;
    const sounds = getPopupSounds(options);

    row.classList.add('oe-popup-row');
    popupSounds.set(row, sounds);
    const analytics = getPopupAnalytics(row, options);
    if (analytics) {
      popupAnalytics.set(row, analytics);
      bindPopupAnalytics(row);
      trackPopupEvent(row, 'notification.impression');
    }
    feed.prepend(row);
    playPopupSound(sounds.slideInSound);
    row.getBoundingClientRect();

    requestAnimationFrame(() => {
      row.classList.add('is-visible');
    });

    if (!options.persist && duration > 0) {
      const timeoutId = setTimeout(() => {
        dismissPopup(row, { timeoutId, reason: 'auto_expired' });
      }, duration);
      popupTimeouts.add(timeoutId);
    }

    return row;
  }

  function normaliseStatusPopupMessages(messages) {
    return (Array.isArray(messages) ? messages : [messages])
      .map((message) => String(message || '').trim())
      .filter(Boolean);
  }

  function renderStatusPopupAvatar(container, avatar = {}) {
    const fallbackText = String(avatar.fallbackText || 'OE').trim() || 'OE';
    const userId = String(avatar.userId || 'status-popup-avatar');
    const userCustomisationString = String(
      avatar.userCustomisationString ||
        window.USER_ICON_DEFAULT_STRING ||
        '0000:0100:0200:0300'
    );

    container.textContent = fallbackText;
    container.setAttribute(
      'aria-label',
      String(avatar.label || "Party host's OE")
    );

    const renderAvatar = () => {
      if (typeof window.createUserIconPartyGames !== 'function') {
        return false;
      }

      container.replaceChildren();
      Promise.resolve(
        window.createUserIconPartyGames({
          container,
          userId,
          userCustomisationString
        })
      ).catch(() => {
        if (container.isConnected) container.textContent = fallbackText;
      });
      return true;
    };

    if (!renderAvatar()) {
      document.addEventListener('ready:user-customisation-icon', renderAvatar, {
        once: true
      });
    }
  }

  function renderStatusPopup(row, options = {}) {
    const label = String(options.label || 'Notice').trim();
    const title = String(
      options.title || 'Something needs your attention'
    ).trim();
    const messages = normaliseStatusPopupMessages(options.messages);
    const tone = ['attention', 'error', 'success'].includes(options.tone)
      ? options.tone
      : 'attention';

    row.classList.remove('is-attention', 'is-error', 'is-success');
    row.classList.add('oe-status-popup-row', `is-${tone}`);
    row.classList.toggle('has-avatar', Boolean(options.avatar));
    row.dataset.popupType = 'status';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-atomic', 'true');

    const leadingVisual = document.createElement('span');
    if (options.avatar) {
      leadingVisual.className = 'oe-status-popup-avatar';
      renderStatusPopupAvatar(leadingVisual, options.avatar);
    } else {
      leadingVisual.className = 'oe-status-popup-marker';
      leadingVisual.setAttribute('aria-hidden', 'true');
    }

    const content = document.createElement('span');
    content.className = 'oe-status-popup-content';

    const labelElement = document.createElement('span');
    labelElement.className = 'oe-status-popup-label';
    labelElement.textContent = label;

    const titleElement = document.createElement('span');
    titleElement.className = 'oe-status-popup-title';
    titleElement.textContent = title;

    content.append(labelElement, titleElement);

    if (messages.length === 1) {
      const message = document.createElement('span');
      message.className = 'oe-status-popup-message';
      message.textContent = messages[0];
      content.appendChild(message);
    } else if (messages.length > 1) {
      const list = document.createElement('ul');
      list.className = 'oe-status-popup-list';
      messages.forEach((message) => {
        const item = document.createElement('li');
        item.textContent = message;
        list.appendChild(item);
      });
      content.appendChild(list);
    }

    row.replaceChildren(leadingVisual, content);
  }

  function dismissStatusPopup(key) {
    const normalizedKey = String(key || '').trim();
    const activePopup = activeStatusPopups.get(normalizedKey);
    if (!activePopup) return false;

    if (activePopup.timeoutId) {
      window.clearTimeout(activePopup.timeoutId);
    }
    activeStatusPopups.delete(normalizedKey);
    dismissPopup(activePopup.row);
    return true;
  }

  function showStatusPopup(options = {}) {
    const key = String(options.key || 'status').trim() || 'status';
    const requestedDuration = Number(options.duration);
    const duration = Number.isFinite(requestedDuration)
      ? Math.max(0, requestedDuration)
      : 6000;
    let activePopup = activeStatusPopups.get(key);

    if (!activePopup || !activePopup.row.isConnected) {
      const row = document.createElement('div');
      renderStatusPopup(row, options);
      showPopup(row, {
        persist: true,
        slideInSound:
          options.sound === false
            ? 'none'
            : (options.slideInSound ?? options.soundKey),
        slideOutSound: options.slideOutSound
      });
      activePopup = { row, timeoutId: null };
      activeStatusPopups.set(key, activePopup);
    } else {
      renderStatusPopup(activePopup.row, options);
      activePopup.row.classList.remove('is-refreshed');
      activePopup.row.getBoundingClientRect();
      activePopup.row.classList.add('is-refreshed');
    }

    if (activePopup.timeoutId) {
      window.clearTimeout(activePopup.timeoutId);
    }
    activePopup.timeoutId =
      duration > 0
        ? window.setTimeout(() => dismissStatusPopup(key), duration)
        : null;

    return activePopup.row;
  }

  function showEmailVerificationSuccessPopup() {
    const account = achievements.getStoredAccountSafely();
    return showStatusPopup({
      key: 'email-verification-success',
      label: 'ACCOUNT READY',
      title: 'Email confirmed',
      messages: 'You are signed in and ready to continue.',
      tone: 'success',
      avatar: {
        userId: account?.id || account?._id || 'email-verified-account',
        userCustomisationString: account?.oeIcon || '',
        label: 'Your OE'
      }
    });
  }

  const achievements = window.createPopupFeedAchievements({ showPopup });
  const accountPrompt = window.createPopupFeedAccountPrompt({
    dismissPopup,
    getStoredAccountSafely: achievements.getStoredAccountSafely,
    isSignedInAccount: achievements.isSignedInAccount,
    showPopup,
    showAccountNotifications: achievements.showAccountNotifications
  });
  const notifications = window.createPopupFeedNotifications({
    dismissPopup,
    getStoredAccountSafely: achievements.getStoredAccountSafely,
    isSignedInAccount: achievements.isSignedInAccount,
    showPopup,
    showAccountNotifications: achievements.showAccountNotifications
  });

  function createSiteUpdatePopupRow() {
    const row = document.createElement('button');
    row.className = 'site-update-popup-row';
    row.dataset.popupType = 'site-update';
    row.type = 'button';

    const status = document.createElement('span');
    status.className = 'site-update-popup-status';
    status.setAttribute('aria-hidden', 'true');

    const content = document.createElement('span');
    content.className = 'site-update-popup-content';

    const title = document.createElement('span');
    title.className = 'site-update-popup-title';

    const message = document.createElement('span');
    message.className = 'site-update-popup-message';

    content.append(title, message);
    row.append(status, content);

    row.addEventListener('click', () => {
      if (row.dataset.updateState !== 'ready') return;
      window.location.reload();
    });

    return row;
  }

  function setSiteUpdatePopupState(state) {
    const previousState = activeSiteUpdatePopup?.dataset.updateState || '';
    if (!activeSiteUpdatePopup) {
      activeSiteUpdatePopup = createSiteUpdatePopupRow();
      showPopup(activeSiteUpdatePopup, { persist: true, sound: false });
    }

    const isReady = state === 'ready';
    activeSiteUpdatePopup.dataset.updateState = isReady ? 'ready' : 'updating';
    activeSiteUpdatePopup.setAttribute(
      'aria-label',
      isReady
        ? 'Update ready. Click to refresh.'
        : 'Updating Overexposed. Almost ready.'
    );
    activeSiteUpdatePopup.classList.toggle('is-ready', isReady);
    activeSiteUpdatePopup.querySelector(
      '.site-update-popup-title'
    ).textContent = isReady ? 'Update ready' : 'Updating Overexposed';
    activeSiteUpdatePopup.querySelector(
      '.site-update-popup-message'
    ).textContent = isReady ? 'Click to refresh' : 'Almost ready';

    if (isReady && previousState !== 'ready') {
      playPopupSound('notificationAttention');
    }
  }

  function hideSiteUpdatePopup() {
    if (!activeSiteUpdatePopup) return;
    const row = activeSiteUpdatePopup;
    activeSiteUpdatePopup = null;
    dismissPopup(row);
  }

  function compareCacheVersions(a, b) {
    const left = String(a || '')
      .trim()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
    const right = String(b || '')
      .trim()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
      const leftPart = left[index] || '0';
      const rightPart = right[index] || '0';
      const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
      const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;

      if (leftNumber !== null && rightNumber !== null) {
        if (leftNumber !== rightNumber) return leftNumber - rightNumber;
        continue;
      }

      const comparison = leftPart.localeCompare(rightPart);
      if (comparison !== 0) return comparison;
    }

    return 0;
  }

  async function checkSiteVersion() {
    const currentVersion = String(window.WEBSITE_CACHE_VERSION || '').trim();
    if (!currentVersion) return;

    try {
      const response = await fetch('/api/site-version', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.success === false) {
        throw new Error('Version check failed.');
      }

      siteVersionCheckSucceeded = true;
      const latestVersion = String(
        payload?.data?.websiteCacheVersion ||
          payload?.websiteCacheVersion ||
          payload?.data?.version ||
          ''
      ).trim();

      if (
        latestVersion &&
        compareCacheVersions(latestVersion, currentVersion) > 0
      ) {
        setSiteUpdatePopupState('ready');
      } else if (activeSiteUpdatePopup?.dataset.updateState !== 'ready') {
        hideSiteUpdatePopup();
      }
    } catch {
      if (siteVersionCheckSucceeded) {
        setSiteUpdatePopupState('updating');
      }
    }
  }

  function startSiteVersionPolling() {
    if (siteUpdatePollTimer) return;

    window.setTimeout(checkSiteVersion, 5000);
    siteUpdatePollTimer = window.setInterval(checkSiteVersion, 10000);
  }

  function dismissAllPopups() {
    popupTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    popupTimeouts.clear();

    getPopupFeed()
      .querySelectorAll('.oe-popup-row, .score-impact-row')
      .forEach((row) => dismissPopup(row));
    activeStatusPopups.forEach(({ timeoutId }) => {
      if (timeoutId) window.clearTimeout(timeoutId);
    });
    activeStatusPopups.clear();
    notifications.clearSystemNotifications();
    notifications.resetActiveLobbyNotification();
    accountPrompt.resetAccountPrompt();
  }

  window.getOePopupFeed = getPopupFeed;
  window.showOePopup = showPopup;
  window.dismissOePopup = dismissPopup;
  window.showOeStatusPopup = showStatusPopup;
  window.dismissOeStatusPopup = dismissStatusPopup;
  window.showEmailVerificationSuccessPopup = showEmailVerificationSuccessPopup;
  window.showAchievementPopup = achievements.showAchievementPopup;
  window.showOpalRewardPopup = achievements.showOpalRewardPopup;
  window.handleLiveAccountNotifications =
    achievements.handleLiveAccountNotifications;
  window.showFriendRequestPopup = notifications.showFriendRequestPopup;
  window.showFriendAcceptedPopup = notifications.showFriendAcceptedPopup;
  window.showPartyNotificationPopup = notifications.showPartyNotificationPopup;
  window.showSystemNotificationPopup =
    notifications.showSystemNotificationPopup;
  window.showAccountPromptPopup = accountPrompt.showAccountPromptPopup;
  window.openAccountBenefitsDialog = accountPrompt.openAccountBenefitsDialog;
  window.showIncubatorReadyPopup = notifications.showIncubatorReadyPopup;
  window.checkFriendNotifications = notifications.checkFriendNotifications;
  window.checkPartyNotifications = notifications.checkPartyNotifications;
  window.checkOlingNotifications = notifications.checkOlingNotifications;
  window.checkActiveLobby = notifications.checkActiveLobby;
  window.dismissOePopups = dismissAllPopups;
  window.dispatchEvent(new CustomEvent('oe-popup-feed-ready'));

  window.addEventListener('oe-account-state-changed', (event) => {
    const account = event.detail?.account || null;
    if (achievements.isSignedInAccount(account)) {
      accountPrompt.clearAccountPrompt();
      achievements.checkAccountNotifications();
      notifications.checkFriendNotifications();
      notifications.checkPartyNotifications();
      notifications.checkOlingNotifications();
    } else {
      achievements.clearAccountNotifications();
      notifications.clearSignedOutNotifications();
      accountPrompt.scheduleAccountPrompt();
    }
    notifications.checkActiveLobby();
  });

  window.addEventListener('oe-achievement-unlocked', (event) => {
    achievements.showAchievementPopup(
      event.detail?.achievement || event.detail || {}
    );
  });

  const storedAccount = achievements.getStoredAccountSafely();
  if (achievements.isSignedInAccount(storedAccount)) {
    notifications.checkNotifications();
  }
  startSiteVersionPolling();
  notifications.startNotificationPolling();
  notifications.startOlingNotificationPolling();
  notifications.startActiveLobbyPolling();
  accountPrompt.scheduleAccountPrompt();

  if (typeof SetScriptLoaded === 'function') {
    SetScriptLoaded('/scripts/general/popup-feed/popup-feed.js');
  }
})();

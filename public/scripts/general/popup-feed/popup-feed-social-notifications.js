(function () {
  const PARTY_CONNECTION_SOUND_COOLDOWN_MS = 45 * 1000;

  function createPopupFeedSocialNotifications({
    dismissPopup,
    getStoredAccountSafely,
    isSignedInAccount,
    showPopup
  }) {
    let friendNotificationPollTimer = null;
    let friendNotificationRequestRunning = false;
    const displayedFriendNotificationIds = new Set();
    let partyNotificationPollTimer = null;
    let partyNotificationRequestRunning = false;
    const displayedPartyNotificationIds = new Set();
    const recentPartyNotificationKeys = new Map();
    const partyConnectionNotificationTypes = new Set([
      'party_player_disconnected',
      'party_player_reconnected'
    ]);
    const partyConnectionSoundLastEventAt = new Map();
    const activeSessionInviteRows = new Map();

    function createFriendRequestPopupRow(notification = {}) {
      const isAccepted = notification.type === 'friend_accepted';
      const isInviteAccepted = notification.type === 'session_invite_accepted';
      const isInviteDeclined = notification.type === 'session_invite_declined';
      const isSessionInvite = notification.type === 'session_invite';
      const isFriendOnline = notification.type === 'friend_online';
      const isJoinableSession =
        notification.type === 'friend_joinable_session_started';
      const row = document.createElement(
        isSessionInvite || isInviteAccepted || isInviteDeclined
          ? 'div'
          : 'button'
      );
      row.className = 'friend-request-popup-row';
      row.dataset.popupType = 'friend-request';
      if (!isSessionInvite && !isInviteAccepted && !isInviteDeclined) {
        row.type = 'button';
      }
      if (isSessionInvite) row.classList.add('is-session-invite');
      if (/^#[a-f0-9]{6}$/i.test(notification.primaryColour || '')) {
        row.style.setProperty(
          '--primarypagecolour',
          notification.primaryColour
        );
      }
      if (/^#[a-f0-9]{6}$/i.test(notification.secondaryColour || '')) {
        row.style.setProperty(
          '--secondarypagecolour',
          notification.secondaryColour
        );
      }
      row.setAttribute(
        'aria-label',
        isSessionInvite
          ? `${notification.username || 'Player'} invited you to join their session. Accept or decline.`
          : isInviteAccepted
            ? `${notification.username || 'Player'} accepted your invite.`
            : isInviteDeclined
              ? `${notification.username || 'Player'} declined your invite.`
              : isJoinableSession
                ? `${notification.username || 'Player'} started a session you can join.`
                : isFriendOnline
                  ? `${notification.username || 'Player'} is online. View profile.`
                  : isAccepted
                    ? `${notification.username || 'Player'} accepted your friend request. View profile.`
                    : `New friend request from ${notification.username || 'Player'}. View requests.`
      );

      const avatar = document.createElement('span');
      avatar.className = 'friend-request-popup-avatar';
      avatar.textContent = 'OE';

      const content = document.createElement('span');
      content.className = 'friend-request-popup-content';

      const label = document.createElement('span');
      label.className = 'friend-request-popup-label';
      label.textContent = isSessionInvite
        ? notification.sessionType === 'oling_battle'
          ? 'Oling battle invite'
          : 'Party invite'
        : isInviteAccepted
          ? 'Invite accepted'
          : isInviteDeclined
            ? 'Invite declined'
            : isJoinableSession
              ? notification.modeName || 'Joinable session'
              : isFriendOnline
                ? 'Friend online'
                : isAccepted
                  ? 'Friend request accepted'
                  : 'New friend request';

      const username = document.createElement('span');
      username.className = 'friend-request-popup-username';
      username.textContent = notification.username || 'Player';

      const message = document.createElement('span');
      message.className = 'friend-request-popup-message';
      message.textContent = isSessionInvite
        ? 'Invited you to join'
        : isInviteAccepted
          ? 'Accepted your invite'
          : isInviteDeclined
            ? 'Declined your invite'
            : isJoinableSession
              ? 'Started a session you can join'
              : isFriendOnline
                ? 'Is online now'
                : isAccepted
                  ? "You're now friends"
                  : 'Wants to add you';

      const view = document.createElement('span');
      view.className = 'friend-request-popup-view';
      view.textContent = isJoinableSession ? 'Join' : 'View';

      if (isInviteAccepted || isInviteDeclined) {
        content.append(username, message);
      } else {
        content.append(label, username, message);
      }
      if (isSessionInvite) {
        const actions = document.createElement('span');
        actions.className = 'friend-request-popup-actions';
        const decline = document.createElement('button');
        decline.className = 'friend-request-popup-view is-decline';
        decline.type = 'button';
        decline.textContent = 'Decline';
        const accept = document.createElement('button');
        accept.className = 'friend-request-popup-view is-accept';
        accept.type = 'button';
        accept.textContent = 'Accept';
        decline.addEventListener('click', () => {
          respondToSessionInvite(notification, 'decline', row);
        });
        accept.addEventListener('click', () => {
          respondToSessionInvite(notification, 'accept', row);
        });
        actions.append(decline, accept);
        row.append(avatar, content, actions);
      } else {
        if (isInviteAccepted || isInviteDeclined) {
          row.append(avatar, content);
        } else {
          row.append(avatar, content, view);
          row.addEventListener('click', () => {
            if (
              isJoinableSession &&
              /^\/[a-zA-Z0-9/?&=_-]+$/.test(notification.lobbyPath || '')
            ) {
              if (typeof window.navigateFromPopupFeed === 'function') {
                window.navigateFromPopupFeed(notification.lobbyPath);
              } else {
                window.location.assign(notification.lobbyPath);
              }
            } else if (isAccepted || isFriendOnline) {
              window.openOnlinePublicProfile?.({
                accountId: notification.accountId
              });
            } else {
              window.openAccountFriendRequests?.();
            }
          });
        }
      }

      if (typeof window.createUserIconPartyGames === 'function') {
        avatar.replaceChildren();
        window.createUserIconPartyGames({
          container: avatar,
          userId: notification.accountId || 'friend-request',
          accountId: notification.accountId || '',
          username: notification.username || 'Player',
          userCustomisationString: notification.oeIcon || ''
        });
      }

      return row;
    }

    async function respondToSessionInvite(notification, action, row) {
      const accountId = String(notification?.accountId || '');
      if (!/^[a-f0-9]{24}$/i.test(accountId)) return;
      row.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      try {
        const response = await fetch(
          `/api/accounts/friends/notifications/${encodeURIComponent(accountId)}`,
          {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error?.message || 'Invite response failed');
        }
        dismissPopup(row);
        activeSessionInviteRows.delete(accountId);
        displayedFriendNotificationIds.delete(`session_invite:${accountId}`);
        const lobbyPath = payload?.data?.lobbyPath || payload?.lobbyPath;
        if (
          action === 'accept' &&
          /^\/[a-zA-Z0-9/_-]+$/.test(lobbyPath || '')
        ) {
          if (typeof window.navigateFromPopupFeed === 'function') {
            window.navigateFromPopupFeed(lobbyPath);
          } else {
            window.location.assign(lobbyPath);
          }
        }
      } catch (error) {
        console.warn(error);
        row.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
    }

    function showFriendRequestPopup(notification = {}) {
      const row = showPopup(createFriendRequestPopupRow(notification), {
        duration: Number(notification.duration) || 7000,
        persist: notification.type === 'session_invite',
        slideInSound: getFriendNotificationSoundKey(notification.type)
      });
      if (notification.type === 'session_invite' && notification.accountId) {
        activeSessionInviteRows.set(String(notification.accountId), row);
      }
      return row;
    }

    function showFriendAcceptedPopup(notification = {}) {
      return showFriendRequestPopup({
        ...notification,
        type: 'friend_accepted'
      });
    }

    function getFriendNotificationSoundKey(type) {
      if (type === 'friend_accepted' || type === 'session_invite_accepted') {
        return 'notificationSuccess';
      }
      if (type === 'session_invite_declined') return 'notificationFailure';
      return 'notificationAttention';
    }

    function getPartyNotificationMessage(notification = {}) {
      const { type } = notification;
      if (type === 'party_player_joined') return 'JOINED YOUR PARTY';
      if (type === 'party_player_left') return 'LEFT THE PARTY';
      if (type === 'party_player_disconnected') return 'DISCONNECTED';
      if (type === 'party_disbanded') return 'DISBANDED THE PARTY';
      if (type === 'party_player_reconnected') return 'RECONNECTED';
      if (type === 'party_host_changed') return 'IS NOW THE HOST';
      if (type === 'party_player_kicked') {
        if (notification.perspective === 'lobby') {
          return 'WAS REMOVED FROM THE PARTY';
        }
        return 'REMOVED YOU FROM THE PARTY';
      }
      return 'PARTY UPDATED';
    }

    function getPartyNotificationSoundKey(type) {
      if (type === 'party_player_kicked') {
        return 'gamemodeSettingsPlayerKicked';
      }
      if (
        type === 'party_player_joined' ||
        type === 'party_player_reconnected'
      ) {
        return 'notificationPartyPositive';
      }
      if (
        type === 'party_player_disconnected' ||
        type === 'party_player_kicked' ||
        type === 'party_disbanded'
      ) {
        return 'notificationPartyNegative';
      }
      return 'notificationPartyNeutral';
    }

    function getPartyNotificationDedupeKey(notification = {}) {
      return [
        notification.type || 'party_update',
        notification.partyId || '',
        notification.actorAccountId || '',
        notification.actorUsername || ''
      ].join(':');
    }

    function getPartyNotificationId(notification = {}) {
      return String(
        notification.id || notification.notificationId || ''
      ).trim();
    }

    function canDedupePartyNotificationByOccurrenceId(notification = {}) {
      return (
        Boolean(getPartyNotificationId(notification)) &&
        partyConnectionNotificationTypes.has(notification.type)
      );
    }

    function getPartyConnectionSoundCooldownKey(notification = {}) {
      if (!partyConnectionNotificationTypes.has(notification.type)) return '';

      const partyId = String(notification.partyId || '')
        .trim()
        .toLowerCase();
      const actorId = String(
        notification.actorAccountId || notification.actorUsername || ''
      )
        .trim()
        .toLowerCase();
      if (!partyId || !actorId) return '';

      return `${partyId}:${actorId}`;
    }

    function shouldPlayPartyNotificationSound(notification = {}) {
      const key = getPartyConnectionSoundCooldownKey(notification);
      if (!key) return true;

      const now = Date.now();
      const lastEventAt = partyConnectionSoundLastEventAt.get(key);
      partyConnectionSoundLastEventAt.set(key, now);
      return (
        lastEventAt === undefined ||
        now - lastEventAt >= PARTY_CONNECTION_SOUND_COOLDOWN_MS
      );
    }

    function rememberPartyNotification(notification = {}) {
      const notificationId = getPartyNotificationId(notification);
      if (canDedupePartyNotificationByOccurrenceId(notification)) {
        displayedPartyNotificationIds.add(notificationId);
        return;
      }

      const key = getPartyNotificationDedupeKey(notification);
      if (!key) return;
      recentPartyNotificationKeys.set(key, Date.now());
    }

    function hasRecentPartyNotification(notification = {}) {
      const notificationId = getPartyNotificationId(notification);
      if (canDedupePartyNotificationByOccurrenceId(notification)) {
        return displayedPartyNotificationIds.has(notificationId);
      }

      const key = getPartyNotificationDedupeKey(notification);
      if (!key) return false;

      const shownAt = recentPartyNotificationKeys.get(key);
      if (!shownAt) return false;

      if (Date.now() - shownAt > 60000) {
        recentPartyNotificationKeys.delete(key);
        return false;
      }

      return true;
    }

    function createPartyNotificationPopupRow(notification = {}) {
      const row = document.createElement('div');
      row.className = 'friend-request-popup-row is-party-notification';
      row.dataset.popupType = 'party-notification';
      row.setAttribute(
        'aria-label',
        `${notification.actorUsername || 'Player'} ${getPartyNotificationMessage(notification).toLowerCase()}.`
      );

      const avatar = document.createElement('span');
      avatar.className = 'friend-request-popup-avatar';
      avatar.textContent = 'OE';

      const content = document.createElement('span');
      content.className = 'friend-request-popup-content';

      const label = document.createElement('span');
      label.className = 'friend-request-popup-label';
      label.textContent = notification.modeName || 'Party update';

      const username = document.createElement('span');
      username.className = 'friend-request-popup-username';
      username.textContent = notification.actorUsername || 'Player';

      const message = document.createElement('span');
      message.className = 'friend-request-popup-message';
      message.textContent = getPartyNotificationMessage(notification);

      content.append(label, username, message);
      row.append(avatar, content);

      if (typeof window.createUserIconPartyGames === 'function') {
        avatar.replaceChildren();
        window.createUserIconPartyGames({
          container: avatar,
          userId:
            notification.actorAccountId || notification.id || 'party-event',
          accountId: notification.actorAccountId || '',
          username: notification.actorUsername || 'Player',
          userCustomisationString: notification.actorOeIcon || ''
        });
      }

      return row;
    }

    function showPartyNotificationPopup(notification = {}) {
      if (
        (canDedupePartyNotificationByOccurrenceId(notification) ||
          notification.suppressIfRecent) &&
        hasRecentPartyNotification(notification)
      ) {
        return null;
      }

      rememberPartyNotification(notification);
      const usesDedicatedLobbyMembershipSound =
        (notification.type === 'party_player_joined' ||
          notification.type === 'party_player_left') &&
        typeof window
          .shouldUseDedicatedGamemodeSettingsLobbyMembershipSound ===
          'function' &&
        window.shouldUseDedicatedGamemodeSettingsLobbyMembershipSound(
          notification
        );
      return showPopup(createPartyNotificationPopupRow(notification), {
        duration: Number(notification.duration) || 7000,
        sound:
          !usesDedicatedLobbyMembershipSound &&
          shouldPlayPartyNotificationSound(notification),
        slideInSound: getPartyNotificationSoundKey(notification.type)
      });
    }

    async function acknowledgeFriendNotifications(accountIds) {
      if (!accountIds.length) return;

      const response = await fetch('/api/accounts/friends/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds })
      });
      if (!response.ok)
        throw new Error('Friend notification acknowledgement failed');
    }

    async function acknowledgePartyNotifications(notificationIds) {
      if (!notificationIds.length) return;

      const response = await fetch('/api/accounts/party-notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds })
      });
      if (!response.ok)
        throw new Error('Party notification acknowledgement failed');
    }

    function showPartyNotifications(notifications) {
      const shownNotificationIds = [];
      notifications.forEach((notification) => {
        const id = getPartyNotificationId(notification);
        if (!id) return;
        shownNotificationIds.push(id);
        showPartyNotificationPopup({
          ...notification,
          suppressIfRecent: true
        });
      });
      return shownNotificationIds;
    }

    function showFriendNotifications(notifications) {
      const shownNotificationIds = [];
      const activeInviteAccountIds = new Set();

      notifications.forEach((notification) => {
        const accountId = String(
          notification?.accountId || notification?.actorAccountId || ''
        );
        const notificationKey =
          String(notification?.id || '') ||
          `${notification?.type || 'friend_request'}:${accountId}`;
        if (notification?.type === 'session_invite' && accountId) {
          activeInviteAccountIds.add(accountId);
        }
        if (!accountId || displayedFriendNotificationIds.has(notificationKey)) {
          return;
        }

        displayedFriendNotificationIds.add(notificationKey);
        if (notification?.type !== 'session_invite' && notification?.id) {
          shownNotificationIds.push(String(notification.id));
        }
        showFriendRequestPopup({
          ...notification,
          accountId,
          username:
            notification.username || notification.actorUsername || 'Player',
          oeIcon: notification.oeIcon || notification.actorOeIcon || null
        });
      });

      activeSessionInviteRows.forEach((row, accountId) => {
        if (activeInviteAccountIds.has(accountId)) return;
        dismissPopup(row);
        activeSessionInviteRows.delete(accountId);
        for (const key of displayedFriendNotificationIds) {
          if (key === `session_invite:${accountId}`) {
            displayedFriendNotificationIds.delete(key);
          }
        }
      });
      return shownNotificationIds;
    }

    async function checkPartyNotifications() {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account) || partyNotificationRequestRunning)
        return;

      partyNotificationRequestRunning = true;
      try {
        const response = await fetch('/api/accounts/party-notifications', {
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
        const shownNotificationIds = showPartyNotifications(notifications);

        if (shownNotificationIds.length) {
          await acknowledgePartyNotifications(shownNotificationIds);
        }
      } catch (error) {
        console.warn(error);
      } finally {
        partyNotificationRequestRunning = false;
      }
    }

    async function checkFriendNotifications() {
      const account = getStoredAccountSafely();
      if (!isSignedInAccount(account) || friendNotificationRequestRunning)
        return;

      friendNotificationRequestRunning = true;
      try {
        const response = await fetch('/api/accounts/friends/notifications', {
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
        showFriendNotifications(notifications);
        const shownAccountIds = notifications
          .filter(
            (notification) =>
              notification?.type !== 'session_invite' &&
              (notification?.accountId || notification?.actorAccountId)
          )
          .map((notification) =>
            String(notification.accountId || notification.actorAccountId)
          );

        if (shownAccountIds.length) {
          await acknowledgeFriendNotifications(shownAccountIds);
        }
      } catch (error) {
        console.warn(error);
      } finally {
        friendNotificationRequestRunning = false;
      }
    }

    function startFriendNotificationPolling() {
      if (friendNotificationPollTimer) return;
      window.setTimeout(checkFriendNotifications, 2500);
      friendNotificationPollTimer = window.setInterval(
        checkFriendNotifications,
        30000
      );
    }

    function startPartyNotificationPolling() {
      if (partyNotificationPollTimer) return;
      window.setTimeout(checkPartyNotifications, 3000);
      partyNotificationPollTimer = window.setInterval(
        checkPartyNotifications,
        15000
      );
    }

    return {
      showFriendRequestPopup,
      showFriendAcceptedPopup,
      showPartyNotificationPopup,
      showFriendNotifications,
      showPartyNotifications,
      checkFriendNotifications,
      checkPartyNotifications,
      startFriendNotificationPolling,
      startPartyNotificationPolling,
      clearSignedOutNotifications() {
        displayedFriendNotificationIds.clear();
        displayedPartyNotificationIds.clear();
        recentPartyNotificationKeys.clear();
        partyConnectionSoundLastEventAt.clear();
      }
    };
  }

  window.createPopupFeedSocialNotifications =
    createPopupFeedSocialNotifications;
})();

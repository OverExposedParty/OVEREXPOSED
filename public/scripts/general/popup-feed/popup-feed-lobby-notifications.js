(function () {
  const PARTY_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
  const PARTY_GAMEMODE_STORAGE_PREFIX = 'oe-waiting-room-gamemode:';
  const PARTY_GAMEMODES = new Set([
    'truth-or-dare',
    'paranoia',
    'never-have-i-ever',
    'most-likely-to',
    'imposter',
    'would-you-rather',
    'mafia'
  ]);

  function createPopupFeedLobbyNotifications({ dismissPopup, showPopup }) {
    let activeLobbyNotificationRow = null;
    let activeLobbyNotificationKey = '';
    let activeLobbyRequestRunning = false;
    let activeLobbyPollTimer = null;

    function clearActiveLobbyNotification(partyCode = '') {
      const normalizedCode = String(partyCode || '')
        .trim()
        .toUpperCase();
      const notificationCode = String(
        activeLobbyNotificationKey.split(':').pop() || ''
      ).toUpperCase();
      if (normalizedCode && notificationCode !== normalizedCode) return false;

      if (activeLobbyNotificationRow) {
        dismissPopup(activeLobbyNotificationRow);
      }
      activeLobbyNotificationRow = null;
      activeLobbyNotificationKey = '';
      return true;
    }

    function normalizeLobbyPath(value) {
      const path = String(value || '').replace(/\/+$/, '');
      return path || '/';
    }

    function getActiveLobbyReturnPath(session = {}) {
      const path = String(session.returnPath || session.lobbyPath || '');
      return /^\/[a-zA-Z0-9/_-]+(?:\?partyCode=[a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})?$/.test(
        path
      )
        ? path
        : '';
    }

    function getPartyCodeFromReturnPath(path) {
      try {
        const url = new URL(String(path || ''), window.location.origin);
        if (url.origin !== window.location.origin) return '';

        const queryPartyCode = String(url.searchParams.get('partyCode') || '')
          .trim()
          .toUpperCase();
        if (PARTY_CODE_PATTERN.test(queryPartyCode)) return queryPartyCode;

        const pathPartyCode = String(
          url.pathname.split('/').filter(Boolean).at(-1) || ''
        )
          .trim()
          .toUpperCase();
        return PARTY_CODE_PATTERN.test(pathPartyCode) ? pathPartyCode : '';
      } catch {
        return '';
      }
    }

    function clearLobbyRedirectAfterLeave(session = {}) {
      const partyCode = String(session.code || '')
        .trim()
        .toUpperCase();
      if (!PARTY_CODE_PATTERN.test(partyCode)) return false;

      try {
        sessionStorage.removeItem(
          `${PARTY_GAMEMODE_STORAGE_PREFIX}${partyCode}`
        );
      } catch {
        // Redirect cleanup still works when browser storage is unavailable.
      }

      try {
        const currentUrl = new URL(window.location.href);
        const returnTo = currentUrl.searchParams.get('returnTo');
        let changed = false;

        if (returnTo && getPartyCodeFromReturnPath(returnTo) === partyCode) {
          const gamemode = String(session.key || '')
            .trim()
            .toLowerCase();
          if (session.isHost && PARTY_GAMEMODES.has(gamemode)) {
            currentUrl.searchParams.set('returnTo', `/${gamemode}/settings`);
          } else {
            currentUrl.searchParams.delete('returnTo');
          }
          changed = true;
        }

        const currentPartyCode = String(
          currentUrl.searchParams.get('partyCode') || ''
        )
          .trim()
          .toUpperCase();
        if (currentPartyCode === partyCode) {
          currentUrl.searchParams.delete('partyCode');
          changed = true;
        }

        if (changed) {
          window.history.replaceState(
            {},
            document.title,
            `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
          );
        }
        return changed;
      } catch {
        return false;
      }
    }

    function isViewingPartyGameSession(session) {
      if (session?.type !== 'party_game') return false;

      const party =
        window.currentPartyData ||
        (typeof currentPartyData !== 'undefined' ? currentPartyData : null);
      const state = party?.state || party || {};
      const currentCode =
        window.partyCode ||
        (typeof partyCode !== 'undefined' ? partyCode : null);

      return Boolean(
        currentCode &&
        String(currentCode).toUpperCase() ===
          String(session.code || '').toUpperCase() &&
        (state.phase || state.isPlaying !== undefined)
      );
    }

    function isViewingActiveLobby(session) {
      if (!session) return false;
      if (isViewingPartyGameSession(session)) return true;
      if (
        normalizeLobbyPath(window.location.pathname) ===
        normalizeLobbyPath(session.lobbyPath)
      ) {
        return true;
      }

      const settingsPath = `/${session.key}/settings`;
      const settingsPartyCode = new URLSearchParams(window.location.search).get(
        'partyCode'
      );
      return Boolean(
        session.isHost &&
        session.type === 'party_game' &&
        normalizeLobbyPath(window.location.pathname) === settingsPath &&
        String(settingsPartyCode || '').toUpperCase() ===
          String(session.code || '').toUpperCase()
      );
    }

    function getActiveLobbyAvatarIcon(avatarUser = {}) {
      const defaultIcon =
        window.USER_ICON_DEFAULT_STRING || '0000:0100:0200:0300';
      const payloadIcon = String(avatarUser.oeIcon || '').trim();

      return payloadIcon || defaultIcon;
    }

    function renderActiveLobbyAvatar(avatar, session = {}) {
      const avatarDebugState = {
        partyCode: session.code || '',
        hasAvatar: Boolean(avatar),
        hasRenderer: typeof window.createUserIconPartyGames === 'function',
        hasReadyHelper: Boolean(window.Ready?.isReady),
        customisationReady: window.Ready?.isReady?.('user-customisation-icon')
      };

      if (
        !avatar ||
        typeof window.createUserIconPartyGames !== 'function' ||
        window.Ready?.isReady?.('user-customisation-icon') === false
      ) {
        window.reportOEDebug?.(
          'debug',
          'notifications.active-lobby',
          'Active-lobby avatar rendering skipped.',
          avatarDebugState
        );
        return false;
      }

      const avatarUser = session.host || {};
      const userCustomisationString = getActiveLobbyAvatarIcon(avatarUser);
      window.reportOEDebug?.(
        'debug',
        'notifications.active-lobby',
        'Active-lobby avatar rendering.',
        {
          partyCode: session.code || '',
          playerComputerId: session.playerComputerId || '',
          avatarSource: 'host',
          viewer: session.viewer || null,
          host: session.host || null,
          payloadIcon: avatarUser.oeIcon || '',
          chosenIcon: userCustomisationString,
          customisationReady: window.Ready?.isReady?.(
            'user-customisation-icon'
          )
        }
      );
      avatar.replaceChildren();
      window.createUserIconPartyGames({
        container: avatar,
        userId:
          avatarUser.accountId ||
          session.hostComputerId ||
          session.code ||
          'active-lobby-host',
        accountId: avatarUser.accountId || '',
        username: avatarUser.username || 'Host',
        userCustomisationString
      });
      return true;
    }

    function createActiveLobbyPopupRow(session = {}) {
      const row = document.createElement('div');
      row.className =
        'friend-request-popup-row is-session-invite is-active-lobby';
      row.dataset.popupType = 'active-lobby';
      if (/^#[a-f0-9]{6}$/i.test(session.primaryColour || '')) {
        row.style.setProperty('--primarypagecolour', session.primaryColour);
      }
      if (/^#[a-f0-9]{6}$/i.test(session.secondaryColour || '')) {
        row.style.setProperty('--secondarypagecolour', session.secondaryColour);
      }

      const avatar = document.createElement('span');
      avatar.className = 'friend-request-popup-avatar';
      avatar.textContent = 'OE';

      const content = document.createElement('span');
      content.className = 'friend-request-popup-content';
      const label = document.createElement('span');
      label.className = 'friend-request-popup-label';
      label.textContent =
        session.type === 'oling_battle' ? 'Active battle' : 'Active party';
      const title = document.createElement('span');
      title.className = 'friend-request-popup-username';
      title.textContent = `${session.modeName || 'Online lobby'} • ${session.code || ''}`;
      const message = document.createElement('span');
      message.className = 'friend-request-popup-message';
      message.textContent = `${session.isHost ? 'Host • ' : ''}${session.statusText || "You're still in this party"}`;
      content.append(label, title, message);

      const actions = document.createElement('span');
      actions.className = 'friend-request-popup-actions';
      const leave = document.createElement('button');
      leave.className = 'friend-request-popup-view is-decline';
      leave.type = 'button';
      leave.textContent = 'Leave';
      const returnButton = document.createElement('button');
      returnButton.className = 'friend-request-popup-view is-return';
      returnButton.type = 'button';
      returnButton.textContent = 'Return';
      const returnPath = getActiveLobbyReturnPath(session);
      if (returnPath) {
        returnButton.dataset.returnPath = returnPath;
      } else {
        returnButton.disabled = true;
      }
      leave.addEventListener('click', () => leaveActiveLobby(session, row));
      returnButton.addEventListener('click', () => {
        if (!returnPath) return;
        if (typeof window.navigateFromPopupFeed === 'function') {
          window.navigateFromPopupFeed(returnPath);
          return;
        }
        window.location.assign(returnPath);
      });
      actions.append(leave, returnButton);
      row.append(avatar, content, actions);

      if (!renderActiveLobbyAvatar(avatar, session)) {
        document.addEventListener(
          'ready:user-customisation-icon',
          () => renderActiveLobbyAvatar(avatar, session),
          { once: true }
        );
      }
      return row;
    }

    async function leaveActiveLobby(session, row) {
      row.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
      });
      try {
        let endpoint = '';
        let body = '{}';
        if (session.type === 'oling_battle') {
          endpoint = `/api/olings/battles/${encodeURIComponent(session.code)}/leave`;
        } else if (session.apiRoute && session.playerComputerId) {
          endpoint = `/api/${encodeURIComponent(session.apiRoute)}/remove-user`;
          body = JSON.stringify({
            partyId: session.code,
            computerIdToRemove: session.playerComputerId,
            actorComputerId: session.playerComputerId,
            exitIntent: 'main-menu'
          });
        }
        if (!endpoint) throw new Error('This lobby cannot be left from here');

        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(payload?.error?.message || 'Failed to leave lobby');
        }
        clearLobbyRedirectAfterLeave(session);
        dismissPopup(row);
        activeLobbyNotificationRow = null;
        activeLobbyNotificationKey = '';
        window.clearActivePartyLobbyLock?.();
        window.dispatchEvent(
          new CustomEvent('oe-active-party-lobby-left', {
            detail: { session }
          })
        );
        window.refreshActivePartyLobbyLock?.();
        window.setTimeout(() => {
          window.refreshActivePartyLobbyLock?.();
        }, 250);
      } catch (error) {
        window.reportOEDebug?.(
          'warn',
          'notifications.active-lobby',
          'Active lobby could not be left.',
          { error }
        );
        row.querySelectorAll('button').forEach((button) => {
          button.disabled = false;
        });
      }
    }

    async function checkActiveLobby() {
      if (activeLobbyRequestRunning) return;
      activeLobbyRequestRunning = true;
      try {
        const response = await fetch(
          '/api/accounts/friends/invite-session?includeInProgress=true',
          {
            cache: 'no-store',
            credentials: 'same-origin'
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) return;
        const data = payload?.data || payload;
        const session = data?.active ? data.session : null;
        const isCurrentLobby = isViewingActiveLobby(session);
        const nextKey =
          session && !isCurrentLobby ? `${session.type}:${session.code}` : '';
        window.reportOEDebug?.(
          'debug',
          'notifications.active-lobby',
          'Active lobby checked.',
          {
            active: Boolean(data?.active),
            session,
            isCurrentLobby,
            nextKey,
            activeLobbyNotificationKey,
            hasExistingRow: Boolean(activeLobbyNotificationRow)
          }
        );

        if (!nextKey) {
          if (activeLobbyNotificationRow) {
            window.reportOEDebug?.(
              'debug',
              'notifications.active-lobby',
              'Active-lobby notification cleared.',
              {
                reason: session ? 'current-lobby' : 'no-active-session',
                session
              }
            );
            dismissPopup(activeLobbyNotificationRow);
            activeLobbyNotificationRow = null;
            activeLobbyNotificationKey = '';
          }
          return;
        }
        if (
          nextKey === activeLobbyNotificationKey &&
          activeLobbyNotificationRow
        ) {
          window.reportOEDebug?.(
            'debug',
            'notifications.active-lobby',
            'Active-lobby notification unchanged.',
            {
              nextKey,
              session
            }
          );
          return;
        }
        if (activeLobbyNotificationRow)
          dismissPopup(activeLobbyNotificationRow);
        activeLobbyNotificationRow = showPopup(
          createActiveLobbyPopupRow(session),
          { persist: true, slideInSound: 'notificationAttention' }
        );
        activeLobbyNotificationKey = nextKey;
      } catch (error) {
        window.reportOEDebug?.(
          'warn',
          'notifications.active-lobby',
          'Active lobby check failed.',
          { error }
        );
      } finally {
        activeLobbyRequestRunning = false;
      }
    }

    function startActiveLobbyPolling() {
      if (activeLobbyPollTimer) return;
      window.setTimeout(checkActiveLobby, 2000);
      activeLobbyPollTimer = window.setInterval(checkActiveLobby, 30000);
    }

    window.addEventListener('oe-active-party-lobby-disbanded', (event) => {
      clearActiveLobbyNotification(event.detail?.partyCode);
      window.setTimeout(checkActiveLobby, 0);
    });

    return {
      checkActiveLobby,
      clearActiveLobbyNotification,
      startActiveLobbyPolling,
      resetActiveLobbyNotification() {
        activeLobbyNotificationRow = null;
        activeLobbyNotificationKey = '';
      }
    };
  }

  window.createPopupFeedLobbyNotifications = createPopupFeedLobbyNotifications;
})();

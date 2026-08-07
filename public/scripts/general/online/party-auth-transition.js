(function initialisePartyAuthTransition() {
  const STORAGE_KEY = 'oe-party-auth-transition';
  const HEARTBEAT_INTERVAL_MS = 45 * 1000;
  const PARTY_API_ROUTE_PATTERN =
    /^party-game-(truth-or-dare|paranoia|never-have-i-ever|most-likely-to|imposter|would-you-rather|mafia)$/;
  let beginInFlight = null;
  let heartbeatTimer = null;

  function getStoredTransition() {
    try {
      const transition = JSON.parse(
        window.sessionStorage?.getItem(STORAGE_KEY) || 'null'
      );
      if (
        !transition?.transitionId ||
        !transition?.token ||
        !transition?.partyId ||
        !transition?.computerId ||
        !PARTY_API_ROUTE_PATTERN.test(transition?.apiRoute)
      ) {
        return null;
      }
      return transition;
    } catch {
      return null;
    }
  }

  function storeTransition(transition) {
    try {
      window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(transition));
      return true;
    } catch {
      return false;
    }
  }

  function clearStoredTransition() {
    try {
      window.sessionStorage?.removeItem(STORAGE_KEY);
    } catch {
      // The server lease still expires if browser storage is unavailable.
    }
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  function getTransitionEndpoint(transition, action) {
    return `/api/${transition.apiRoute}/auth-transition/${action}`;
  }

  async function postTransition(transition, action) {
    const response = await fetch(getTransitionEndpoint(transition, action), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyId: transition.partyId,
        computerId: transition.computerId,
        transitionId: transition.transitionId,
        token: transition.token
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      const error = new Error(
        payload?.error?.message || 'The party sign-in transition failed.'
      );
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function canPreserveCurrentParty() {
    if (
      typeof partyCode === 'undefined' ||
      typeof deviceId === 'undefined' ||
      typeof sessionPartyType === 'undefined' ||
      !partyCode ||
      !deviceId ||
      !PARTY_API_ROUTE_PATTERN.test(sessionPartyType)
    ) {
      return false;
    }
    const party =
      typeof currentPartyData !== 'undefined' ? currentPartyData : null;
    const state = party?.state ?? party ?? {};
    const isLobby = state?.isPlaying === false && state?.phase === 'lobby';
    const isGameSession =
      state?.isPlaying === true || state?.phase === 'game-over';
    if (!isLobby && !isGameSession) return false;

    const isHost =
      typeof isCurrentPartyHost === 'function'
        ? isCurrentPartyHost()
        : String(state?.hostComputerId || '') === String(deviceId);
    return !isLobby || !isHost;
  }

  async function beginOnlinePartyAuthNavigation(
    destination,
    { navigate = null } = {}
  ) {
    const performNavigation = () => {
      if (typeof navigate === 'function') {
        navigate(destination);
      } else {
        window.location.href = destination;
      }
    };

    if (!canPreserveCurrentParty()) {
      performNavigation();
      return false;
    }
    if (beginInFlight) return beginInFlight;

    beginInFlight = (async () => {
      let preserved = false;
      try {
        const response = await fetch(
          `/api/${sessionPartyType}/auth-transition/begin`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partyId: partyCode,
              computerId: deviceId,
              socketId:
                typeof socket !== 'undefined' && typeof socket?.id === 'string'
                  ? socket.id
                  : null
            })
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) {
          throw new Error(
            payload?.error?.message ||
              'Could not preserve the party while signing in.'
          );
        }

        preserved = storeTransition({
          apiRoute: sessionPartyType,
          partyId: String(partyCode).toUpperCase(),
          computerId: String(deviceId),
          transitionId: payload.transitionId,
          token: payload.token,
          expiresAt: payload.expiresAt,
          hardExpiresAt: payload.hardExpiresAt
        });
        window.onlinePartyAuthTransitionInProgress = preserved;
      } catch (error) {
        console.warn('Party sign-in preservation was unavailable:', error);
      }

      performNavigation();
      return preserved;
    })().finally(() => {
      beginInFlight = null;
    });
    return beginInFlight;
  }

  async function heartbeatStoredTransition() {
    const transition = getStoredTransition();
    if (!transition) return false;
    try {
      const payload = await postTransition(transition, 'heartbeat');
      storeTransition({
        ...transition,
        expiresAt: payload.expiresAt || transition.expiresAt,
        hardExpiresAt: payload.hardExpiresAt || transition.hardExpiresAt
      });
      return true;
    } catch (error) {
      if (error.status === 404 || error.status === 410) {
        clearStoredTransition();
      }
      return false;
    }
  }

  async function completeCurrentPartyAuthTransition() {
    const transition = getStoredTransition();
    if (!transition) return false;
    if (
      typeof partyCode === 'undefined' ||
      typeof deviceId === 'undefined' ||
      String(transition.partyId).toUpperCase() !==
        String(partyCode || '').toUpperCase() ||
      String(transition.computerId) !== String(deviceId || '')
    ) {
      return false;
    }

    try {
      const payload = await postTransition(transition, 'complete');
      if (
        payload?.updated &&
        typeof currentPartyData !== 'undefined'
      ) {
        currentPartyData = payload.updated;
      }
      clearStoredTransition();
      return true;
    } catch (error) {
      if (error.status === 404 || error.status === 410) {
        clearStoredTransition();
      }
      return false;
    }
  }

  function startAuthPageHeartbeat() {
    if (window.location.pathname !== '/sign-in' || !getStoredTransition()) {
      return;
    }
    void heartbeatStoredTransition();
    heartbeatTimer = setInterval(
      heartbeatStoredTransition,
      HEARTBEAT_INTERVAL_MS
    );
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void heartbeatStoredTransition();
      }
    });
  }

  window.PartyAuthTransition = {
    beginOnlinePartyAuthNavigation,
    completeCurrentPartyAuthTransition,
    heartbeatStoredTransition
  };
  window.beginOnlinePartyAuthNavigation = beginOnlinePartyAuthNavigation;

  startAuthPageHeartbeat();
})();

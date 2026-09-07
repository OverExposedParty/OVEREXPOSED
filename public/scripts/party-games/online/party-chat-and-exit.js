// party-chat-and-exit.js

// --- Exit / unload handlers ---

let lobbyExitCleanupQueued = false;
let lobbyVisibilityUnreadyQueued = false;
let exitDisconnectQueued = false;
let onlinePartyExitHandlersBound = false;

if (!Object.prototype.hasOwnProperty.call(window, 'currentPartyData')) {
  window.currentPartyData = null;
}

function getCurrentPartyDataSnapshot() {
  return window.currentPartyData ?? null;
}

function getCurrentPartyActorId() {
  return (
    window.resolveOnlinePartyActorId?.(
      getCurrentPartyDataSnapshot(),
      typeof deviceId === 'undefined' ? null : deviceId
    ) ?? (typeof deviceId === 'undefined' ? null : deviceId)
  );
}

function getCurrentPartyStateSnapshot() {
  const partyData = getCurrentPartyDataSnapshot();
  return partyData?.state ?? partyData ?? {};
}

function isCurrentPartyLobby() {
  if (!partyCode || loadingPage || window.onlinePartyReturningToLobby === true) return false;

  const state = getCurrentPartyStateSnapshot();
  return state?.isPlaying === false && state?.phase === 'lobby';
}

function isOnlineGamemodeSettingsPage() {
  return /\/settings\/?$/i.test(window.location.pathname);
}

function getCurrentPartyPlayer() {
  const partyData = getCurrentPartyDataSnapshot();
  const actorId = getCurrentPartyActorId();
  const players = Array.isArray(partyData?.players)
    ? partyData.players
    : [];

  return players.find(
    (player) =>
      String(player?.identity?.computerId || player?.computerId || '') ===
      String(actorId || '')
  );
}

function isCurrentPartyPlayerReady() {
  const player = getCurrentPartyPlayer();
  return player?.state?.isReady === true || player?.isReady === true;
}

function isCurrentPartyHost() {
  return isAuthoritativePartyHost();
}

function setLocalReadyButtonState(isReady) {
  document
    .querySelectorAll('.start-game-button.ready-up, #waiting-room')
    .forEach((button) => {
      button.classList.toggle('active', Boolean(isReady));
    });
}

function sendLobbyRemoveBeacon() {
  if (!partyCode || !sessionPartyType || !navigator.sendBeacon) return false;
  const actorComputerId = getCurrentPartyActorId();
  if (!actorComputerId) return false;

  const payload = {
    partyId: partyCode,
    computerIdToRemove: actorComputerId,
    actorComputerId,
    actorSocketId: typeof socket?.id === 'string' ? socket.id : null
  };
  const blob = new Blob([JSON.stringify(payload)], {
    type: 'application/json'
  });
  const success = navigator.sendBeacon(
    `/api/${sessionPartyType}/remove-user`,
    blob
  );
  debugLog('🚀 Lobby remove beacon queued:', success, payload);
  return success;
}

function removeLobbyUserOnExit() {
  if (lobbyExitCleanupQueued || !isCurrentPartyLobby()) return false;

  lobbyExitCleanupQueued = true;
  return sendLobbyRemoveBeacon();
}

function disconnectUserOnExit() {
  if (!partyCode || loadingPage || window.onlinePartyReturningToLobby === true) return;
  if (isCurrentPartyLobby()) return;
  if (exitDisconnectQueued) return;
  exitDisconnectQueued = true;
  const actorComputerId = getCurrentPartyActorId();
  if (!actorComputerId) return;

  const sessionPayload = {
    partyId: partyCode,
    computerId: actorComputerId,
    socketId: typeof socket?.id === 'string' ? socket.id : null
  };

  const blobSession = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
  const successSession = navigator.sendBeacon(`/api/${sessionPartyType}/disconnect-user`, blobSession);
  debugLog("🚀 Beacon to session queued:", successSession, sessionPayload);
}

async function unreadyLobbyUserOnHidden() {
  if (
    lobbyVisibilityUnreadyQueued ||
    document.visibilityState !== 'hidden' ||
    !isCurrentPartyLobby() ||
    isCurrentPartyHost() ||
    !isCurrentPartyPlayerReady()
  ) {
    return;
  }

  lobbyVisibilityUnreadyQueued = true;
  setLocalReadyButtonState(false);

  try {
    await UpdateUserPartyData({
      partyId: partyCode,
      computerId: getCurrentPartyActorId(),
      newUserReady: false,
      newUserConfirmation: false
    });

    if (getCurrentPartyDataSnapshot()) {
      const player = getCurrentPartyPlayer();
      if (player) {
        player.state ||= {};
        player.state.isReady = false;
        player.isReady = false;
      }
    }

    if (typeof GetAllUsersReady === 'function') {
      allUsersReady = await GetAllUsersReady();
    }
    if (typeof updateStartGameButton === 'function') {
      updateStartGameButton(allUsersReady);
    }
  } catch (error) {
    console.error('Failed to unready lobby user after tab hidden:', error);
  } finally {
    lobbyVisibilityUnreadyQueued = false;
  }
}

function handleOnlinePartyPageHide() {
  if (isOnlineGamemodeSettingsPage()) return;
  if (window.onlinePartyAuthTransitionInProgress === true) return;
  if (removeLobbyUserOnExit()) return;
  disconnectUserOnExit();
}

function bindOnlinePartyExitHandlers() {
  if (onlinePartyExitHandlersBound) return;
  onlinePartyExitHandlersBound = true;

  // Use pagehide and beforeunload for the best browser coverage.
  document.addEventListener('visibilitychange', unreadyLobbyUserOnHidden);
  window.addEventListener('pagehide', handleOnlinePartyPageHide);
  window.addEventListener('beforeunload', handleOnlinePartyPageHide);
}

if (window.Ready?.when) {
  window.Ready.when('online-core', { timeout: 10000 })
    .catch(() => null)
    .then(bindOnlinePartyExitHandlers);
} else {
  bindOnlinePartyExitHandlers();
}

function RemoveUserFromParty(computerIdToRemove, { exitIntent = null } = {}) {
  let payload = {};
  if (partyCode && computerIdToRemove && loadingPage == false) {
    const actorComputerId = getCurrentPartyActorId();
    if (!actorComputerId) return;
    if (String(computerIdToRemove) !== String(actorComputerId) && typeof canCurrentUserKickPlayers === 'function' && !canCurrentUserKickPlayers()) {
      console.warn("Only the host can remove players from the party.");
      return;
    }

    payload = {
      partyId: partyCode,
      computerIdToRemove,
      actorComputerId,
      actorSocketId: typeof socket?.id === 'string' ? socket.id : null,
      ...(exitIntent && { exitIntent })
    };

    debugLog("🚀 Sending beacon on unload:", payload);

    const data = JSON.stringify(payload);
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blob);
  }
}

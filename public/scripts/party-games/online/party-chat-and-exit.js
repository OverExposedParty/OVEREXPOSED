// party-chat-and-exit.js

// --- Exit / unload handlers ---

let lobbyExitCleanupQueued = false;
let lobbyVisibilityUnreadyQueued = false;
let exitDisconnectQueued = false;

function getCurrentPartyStateSnapshot() {
  return currentPartyData?.state ?? currentPartyData ?? {};
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
  const players = Array.isArray(currentPartyData?.players)
    ? currentPartyData.players
    : [];

  return players.find(
    (player) => String(player?.identity?.computerId) === String(deviceId)
  );
}

function isCurrentPartyPlayerReady() {
  const player = getCurrentPartyPlayer();
  return player?.state?.isReady === true || player?.isReady === true;
}

function isCurrentPartyHost() {
  const hostComputerId =
    currentPartyData?.state?.hostComputerId || hostDeviceId || null;

  return Boolean(hostComputerId && String(hostComputerId) === String(deviceId));
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

  const payload = {
    partyId: partyCode,
    computerIdToRemove: deviceId,
    actorComputerId: deviceId,
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

  const sessionPayload = {
    partyId: partyCode,
    computerId: deviceId,
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
      computerId: deviceId,
      newUserReady: false,
      newUserConfirmation: false
    });

    if (currentPartyData) {
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
  if (removeLobbyUserOnExit()) return;
  disconnectUserOnExit();
}

// Use pagehide and beforeunload for the best browser coverage.
document.addEventListener('visibilitychange', unreadyLobbyUserOnHidden);
window.addEventListener('pagehide', handleOnlinePartyPageHide);
window.addEventListener('beforeunload', handleOnlinePartyPageHide);

function RemoveUserFromParty(computerIdToRemove, { exitIntent = null } = {}) {
  let payload = {};
  if (partyCode && computerIdToRemove && loadingPage == false) {
    if (computerIdToRemove !== deviceId && typeof canCurrentUserKickPlayers === 'function' && !canCurrentUserKickPlayers()) {
      console.warn("Only the host can remove players from the party.");
      return;
    }

    payload = {
      partyId: partyCode,
      computerIdToRemove,
      actorComputerId: deviceId,
      actorSocketId: typeof socket?.id === 'string' ? socket.id : null,
      ...(exitIntent && { exitIntent })
    };

    debugLog("🚀 Sending beacon on unload:", payload);

    const data = JSON.stringify(payload);
    const blob = new Blob([data], { type: "application/json" });
    navigator.sendBeacon(`/api/${sessionPartyType}/remove-user`, blob);
  }
}

// party-socket.js

// Join / leave / kick via socket
async function joinParty(code) {
  debugLog(`Joining party: ${code}`);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off('joined-party', handleJoinedParty);
      reject(new Error(`Timed out joining party: ${code}`));
    }, 5000);

    function handleJoinedParty(data) {
      clearTimeout(timeoutId);
      socket.off('joined-party', handleJoinedParty);
      resolve(data);
    }

    socket.on('joined-party', handleJoinedParty);
    socket.emit('join-party', code);
  });
}

async function leaveParty(code) {
  await UpdateUserPartyData({
    partyId: code,
    computerId: deviceId,
    newUserSocketId: null
  });

  debugLog(`Leaving party: ${code}`);
  socket.emit('leave-party', code);
}

async function kickUser(code) {
  await UpdateUserPartyData({
    partyId: code,
    computerId: deviceId,
    newUserSocketId: null
  });

  debugLog(`Kicking self from party: ${code}`);
  socket.emit('kick-user', code);
}

// --- Socket events ---

const pendingLivePartyNotifications = [];
let livePartyNotificationFlushTimer = null;
const pendingLiveAccountNotifications = [];
let liveAccountNotificationFlushTimer = null;

function isCurrentPartyDevice({ computerId, socketId } = {}) {
  if (computerId && typeof deviceId !== 'undefined') {
    return String(computerId) === String(deviceId);
  }

  return Boolean(
    socketId && socket?.id && String(socketId) === String(socket.id)
  );
}

function flushLivePartyNotifications() {
  if (typeof window.showPartyNotificationPopup !== 'function') {
    return false;
  }

  while (pendingLivePartyNotifications.length) {
    window.showPartyNotificationPopup({
      ...pendingLivePartyNotifications.shift(),
      suppressIfRecent: true
    });
  }

  if (livePartyNotificationFlushTimer) {
    window.clearInterval(livePartyNotificationFlushTimer);
    livePartyNotificationFlushTimer = null;
  }

  return true;
}

function queueLivePartyNotification(notification) {
  if (!notification) return;

  pendingLivePartyNotifications.push(notification);
  if (flushLivePartyNotifications()) return;

  if (!livePartyNotificationFlushTimer) {
    livePartyNotificationFlushTimer = window.setInterval(
      flushLivePartyNotifications,
      100
    );
    window.setTimeout(() => {
      if (!livePartyNotificationFlushTimer) return;
      window.clearInterval(livePartyNotificationFlushTimer);
      livePartyNotificationFlushTimer = null;
    }, 6000);
  }
}

function flushLiveAccountNotifications() {
  if (typeof window.handleLiveAccountNotifications !== 'function') {
    return false;
  }

  const notifications = pendingLiveAccountNotifications.splice(0);
  if (notifications.length) {
    Promise.resolve(window.handleLiveAccountNotifications(notifications)).catch(
      (error) => console.warn(error)
    );
  }

  if (liveAccountNotificationFlushTimer) {
    window.clearInterval(liveAccountNotificationFlushTimer);
    liveAccountNotificationFlushTimer = null;
  }
  return true;
}

function queueLiveAccountNotifications(notifications) {
  if (!Array.isArray(notifications) || !notifications.length) return;
  pendingLiveAccountNotifications.push(...notifications);
  if (flushLiveAccountNotifications()) return;

  if (!liveAccountNotificationFlushTimer) {
    liveAccountNotificationFlushTimer = window.setInterval(
      flushLiveAccountNotifications,
      100
    );
    window.setTimeout(() => {
      if (!liveAccountNotificationFlushTimer) return;
      window.clearInterval(liveAccountNotificationFlushTimer);
      liveAccountNotificationFlushTimer = null;
    }, 6000);
  }
}

window.addEventListener('oe-popup-feed-ready', () => {
  flushLivePartyNotifications();
  flushLiveAccountNotifications();
});

socket.on('account-progression-notifications', ({ notifications } = {}) => {
  queueLiveAccountNotifications(notifications);
});

socket.on('joined-party', (data) => {
  debugLog(data.message);
});

socket.on('left-party', (code) => {
  debugLog(`✅ You left party: ${code}`);
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }
  if (window.onlinePartySuppressNextLeftPartyDisbanded === true) {
    window.onlinePartySuppressNextLeftPartyDisbanded = false;
    return;
  }
  if (window.onlinePartyReturningToLobby === true || loadingPage) return;
  PartyDisbanded();
});

function showKickedFromPartyState() {
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }

  if (window.OESessionStatusPrompts?.showKicked) {
    window.OESessionStatusPrompts.showKicked({
      useActiveContainers: typeof setActiveContainers === 'function'
    });
    return;
  }

  if (typeof KickUser === 'function') {
    KickUser();
    return;
  }

  const kickedContainer = document.getElementById('user-kicked');
  if (kickedContainer && typeof setActiveContainers === 'function') {
    setActiveContainers(kickedContainer);
  }
}

function isPartySessionInactive(party) {
  const state = party?.state || {};
  return (
    party?.active === false ||
    party?.isActive === false ||
    state.active === false ||
    state.isActive === false ||
    String(party?.status || state.status || '').toLowerCase() === 'inactive'
  );
}

socket.on('kicked-from-party', (payload) => {
  const code =
    payload && typeof payload === 'object' ? payload.partyCode : payload;
  debugLog(`🥾 You were kicked from party: ${code}`);
  queueLivePartyNotification(
    payload && typeof payload === 'object' ? payload.notification : null
  );
  window.checkPartyNotifications?.();
  showKickedFromPartyState();
});

socket.on('user-joined', ({ socketId }) => {
  debugLog(`👋 User joined: ${socketId}`);
  window.setTimeout(() => window.checkPartyNotifications?.(), 250);
});

socket.on('user-left', ({ socketId, computerId, notification }) => {
  debugLog(`👋 User left: ${socketId}`);
  if (!isCurrentPartyDevice({ computerId, socketId })) {
    window.playGamemodeSettingsPlayerLeftSound?.();
    queueLivePartyNotification(notification);
  }
});

socket.on(
  'user-kicked',
  ({ socketId, computerId, notification } = {}) => {
    debugLog(`🥾 User kicked: ${socketId}`);
    if (!isCurrentPartyDevice({ computerId, socketId })) {
      queueLivePartyNotification(notification);
    }
    window.setTimeout(() => window.checkPartyNotifications?.(), 250);
  }
);

socket.on('user-disconnected', ({ socketId, computerId, notification }) => {
  debugLog(`❌ User disconnected: ${socketId}`);
  if (!isCurrentPartyDevice({ computerId, socketId })) {
    queueLivePartyNotification(notification);
  }
  window.setTimeout(() => window.checkPartyNotifications?.(), 250);
});

socket.on('user-reconnected', ({ socketId, computerId, notification }) => {
  debugLog(`🔁 User reconnected: ${socketId}`);
  if (!isCurrentPartyDevice({ computerId, socketId })) {
    queueLivePartyNotification(notification);
  }
  window.setTimeout(() => window.checkPartyNotifications?.(), 250);
});

socket.on('host-changed', ({ hostComputerId, notification }) => {
  debugLog(`👑 Host changed: ${hostComputerId}`);
  queueLivePartyNotification(notification);
});

socket.on('party-deleted', async ({ partyCode: deletedCode, notification }) => {
  debugLog(`🛑 Party ${deletedCode} has been disbanded.`);
  if (
    window.onlinePartyReturningToLobby === true ||
    window.onlinePartyTeardownInProgress === true ||
    loadingPage
  ) {
    return;
  }

  const deletedCodeMatchesCurrentParty =
    deletedCode &&
    partyCode &&
    String(deletedCode).toUpperCase() === String(partyCode).toUpperCase();
  if (deletedCodeMatchesCurrentParty) {
    window.onlinePartyTeardownInProgress = true;
    hostedParty = false;
    waitingForHost = false;
    currentPartyData = null;
    partyCode = null;
    window.PartyChat?.clearMessages?.();
    window.dispatchEvent(
      new CustomEvent('oe-active-party-lobby-disbanded', {
        detail: { partyCode: deletedCode }
      })
    );
  }
  queueLivePartyNotification(notification);
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }
  PartyDisbanded();
});

// Party data updates
socket.on(
  'party-updated',
  async ({ type, source, emittedPartyCode, documentKey }) => {
    try {
      if (isPlaying && source === 'waiting-room') {
        return;
      }

      const codeToUse = partyCode || emittedPartyCode?.partyId;
      let party = null;
      const emittedPartyMatchesCurrentCode =
        emittedPartyCode?.partyId &&
        codeToUse &&
        emittedPartyCode.partyId === codeToUse;

      if (emittedPartyMatchesCurrentCode) {
        party = emittedPartyCode;
      } else {
        const res = await fetch(
          `/api/${sessionPartyType}?partyCode=${codeToUse}`
        );
        const data = await res.json();

        if (!data || data.length === 0) {
          if (window.onlinePartyReturningToLobby === true || loadingPage) {
            return;
          }
          PartyDisbanded();
          return;
        }

        party = data[0];
      }

      // ✅ New layout only
      const config = party.config;
      const state = party.state;
      const players = party.players || [];

      if (isPartySessionInactive(party)) {
        if (window.onlinePartyReturningToLobby === true || loadingPage) {
          return;
        }
        PartyDisbanded();
        return;
      }

      if (state?.hostComputerId) {
        hostDeviceId = state.hostComputerId;
      }

      if (
        state?.isPlaying === false &&
        state?.phase === 'lobby' &&
        !loadingPage &&
        typeof isCurrentOnlineGamemodePartyRoute === 'function' &&
        isCurrentOnlineGamemodePartyRoute(party)
      ) {
        currentPartyData = party;
        redirectOnlinePartyToLobby(party, {
          forceWaitingRoom:
            String(state.hostComputerId || '') !== String(deviceId)
        });
        return;
      }

      if (typeof updatePartyGameStatisticsEndGameButtonState === 'function') {
        updatePartyGameStatisticsEndGameButtonState(party);
      }

      if (!isPlaying) {
        partyUserCount = players.length;
        if (typeof updatePartyQrPlayerCount === 'function') {
          updatePartyQrPlayerCount(partyUserCount);
        }
        if (typeof UpdateUserIcons === 'function') {
          await UpdateUserIcons(party);
        }

        const playerIndex = players.findIndex(
          (p) => p.identity?.computerId === deviceId
        );
        if (playerIndex === -1) {
          showKickedFromPartyState();
          socket.emit('kick-user', codeToUse);
          return;
        }

        partyRulesSettings = config.gameRules;
        if (typeof gamemodeSettings !== 'undefined') {
          gamemodeSettings = config.gameRules || {};
        }
        if (typeof gamemodeSelectedPacks !== 'undefined') {
          gamemodeSelectedPacks = Array.isArray(config.selectedPacks)
            ? [...config.selectedPacks]
            : [];
        }
        if (typeof gamemodeRoleCounts !== 'undefined') {
          gamemodeRoleCounts =
            config.roleCounts && typeof config.roleCounts === 'object'
              ? { ...config.roleCounts }
              : {};
        }

        // ✅ Pass the real document (new layout) into helpers
        if (typeof checkForGameSettingsUpdates === 'function') {
          await checkForGameSettingsUpdates(party);
        }

        if (waitingForHost || hostedParty) {
          UpdateGamemodeContainer();
        }
      }

      const latestPing = state.lastPinged;
      const incomingSignature =
        typeof getOnlineInstructionSnapshotSignature === 'function'
          ? getOnlineInstructionSnapshotSignature(party)
          : '';
      const pingChanged =
        new Date(latestPing).getTime() !== new Date(lastKnownPing).getTime();
      const snapshotChanged =
        incomingSignature &&
        incomingSignature !== window.lastOnlineInstructionSnapshotSignature;

      if (pingChanged || snapshotChanged) {
        const latestInstructions =
          config?.userInstructions ?? state?.userInstructions ?? '';

        debugLog('[OE_DEBUG][party-updated] received fresh party update', {
          source,
          codeToUse,
          isPlaying,
          waitingForHost,
          onlineGameUiReady: window.onlineGameUiReady,
          latestPing,
          pingChanged,
          snapshotChanged,
          phase: state?.phase ?? null,
          playerTurn: state?.playerTurn ?? null,
          instructions: latestInstructions
        });
        debugLog('🟢 Party data changed!');
        if (
          !state.isPlaying &&
          isPlaying &&
          String(latestInstructions).includes('GAME_OVER')
        ) {
          currentPartyData = party;

          if (!window.onlineGameUiReady) {
            window.pendingOnlineInstructionSync = true;
            lastKnownPing = latestPing;
            return;
          }

          if (typeof runOnlineFetchInstructions === 'function') {
            await runOnlineFetchInstructions({ force: true, reason: 'socket' });
          } else {
            await FetchInstructions();
          }

          lastKnownPing = latestPing;
          return;
        }

        if (state.isPlaying) {
          if (waitingForHost) {
            loadingPage = true;
            debugLog('start');
            const baseUrl = window.location.origin;
            const gm = config.gamemode;
            transitionSplashScreen(
              `${baseUrl}/${formatPackName(gm)}/${codeToUse}`,
              `/images/splash-screens/${formatPackName(gm)}.png`
            );
            return;
          }
          if (isPlaying) {
            currentPartyData = party;

            if (typeof SyncWaitingForPlayersIcons === 'function') {
              await SyncWaitingForPlayersIcons(party);
            }

            if (!window.onlineGameUiReady) {
              debugLog(
                '[OE_DEBUG][party-updated] UI not ready, deferring FetchInstructions',
                {
                  phase: state?.phase ?? null,
                  playerTurn: state?.playerTurn ?? null,
                  instructions:
                    config?.userInstructions ?? state?.userInstructions ?? ''
                }
              );
              window.pendingOnlineInstructionSync = true;
              return;
            }

            debugLog('[OE_DEBUG][party-updated] calling FetchInstructions', {
              phase: state?.phase ?? null,
              playerTurn: state?.playerTurn ?? null,
              instructions:
                config?.userInstructions ?? state?.userInstructions ?? ''
            });
            if (typeof runOnlineFetchInstructions === 'function') {
              await runOnlineFetchInstructions({
                force: true,
                reason: 'socket'
              });
            } else {
              await FetchInstructions();
            }
          }
        }
        lastKnownPing = latestPing;
      }
    } catch (err) {
      console.error('❌ Error in party-updated handler:', err);
    }
  }
);

// Chat updates
socket.on('chat-updated', async ({ type, chatLog, documentKey }) => {
  debugLog('💬 Chat updated:', type, chatLog);

  if (type === 'delete') {
    return;
  }
  const partyChat = await window.PartyChatReady;
  partyChat?.displayLogs();
});

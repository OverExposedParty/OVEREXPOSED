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

socket.on('joined-party', (data) => {
  debugLog(data.message);
});

socket.on('left-party', (code) => {
  debugLog(`✅ You left party: ${code}`);
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }
  PartyDisbanded();
});

function showKickedFromPartyState() {
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
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

socket.on('kicked-from-party', (code) => {
  debugLog(`🥾 You were kicked from party: ${code}`);
  showKickedFromPartyState();
});

socket.on('user-joined', ({ socketId }) => {
  debugLog(`👋 User joined: ${socketId}`);
});

socket.on('user-left', ({ socketId }) => {
  debugLog(`👋 User left: ${socketId}`);
});

socket.on('user-kicked', ({ socketId }) => {
  debugLog(`🥾 User kicked: ${socketId}`);
});

socket.on('user-disconnected', ({ socketId }) => {
  debugLog(`❌ User disconnected: ${socketId}`);
});

socket.on('party-deleted', ({ partyCode: deletedCode }) => {
  debugLog(`🛑 Party ${deletedCode} has been disbanded.`);
  if (typeof togglePartyQrCode === 'function') {
    togglePartyQrCode(false);
  }
  PartyDisbanded();
});

// Party data updates
socket.on("party-updated", async ({ type, source, emittedPartyCode, documentKey }) => {
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
      const res = await fetch(`/api/${sessionPartyType}?partyCode=${codeToUse}`);
      const data = await res.json();

      if (!data || data.length === 0) {
        PartyDisbanded();
        return;
      }

      party = data[0];
    }

    // ✅ New layout only
    const config = party.config;
    const state = party.state;
    const players = party.players || [];

    if (state?.hostComputerId) {
      hostDeviceId = state.hostComputerId;
    }

    if (typeof updatePartyGameStatisticsEndGameButtonState === 'function') {
      updatePartyGameStatisticsEndGameButtonState(party);
    }

    if (!isPlaying) {
      partyUserCount = players.length;
      if (typeof updatePartyQrPlayerCount === 'function') {
        updatePartyQrPlayerCount(partyUserCount);
      }

      const playerIndex = players.findIndex(
        p => p.identity?.computerId === deviceId
      );
      if (playerIndex === -1) {
        showKickedFromPartyState();
        socket.emit('kick-user', codeToUse);
        return;
      }

      partyRulesSettings = config.gameRules;

      // ✅ Pass the real document (new layout) into helpers
      await checkForGameSettingsUpdates(party);

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
      const latestInstructions = config?.userInstructions ?? state?.userInstructions ?? '';

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
      if (!state.isPlaying && isPlaying && String(latestInstructions).includes('GAME_OVER')) {
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
          debugLog("start");
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

          if (!window.onlineGameUiReady) {
            debugLog('[OE_DEBUG][party-updated] UI not ready, deferring FetchInstructions', {
              phase: state?.phase ?? null,
              playerTurn: state?.playerTurn ?? null,
              instructions: config?.userInstructions ?? state?.userInstructions ?? ''
            });
            window.pendingOnlineInstructionSync = true;
            return;
          }

          debugLog('[OE_DEBUG][party-updated] calling FetchInstructions', {
            phase: state?.phase ?? null,
            playerTurn: state?.playerTurn ?? null,
            instructions: config?.userInstructions ?? state?.userInstructions ?? ''
          });
          if (typeof runOnlineFetchInstructions === 'function') {
            await runOnlineFetchInstructions({ force: true, reason: 'socket' });
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
});

// Chat updates
socket.on("chat-updated", ({ type, chatLog, documentKey }) => {
  debugLog("💬 Chat updated:", type, chatLog);

  if (type === "delete") {
    // CreateChatMessage("[CONSOLE]", "Party disbanded.", "error", Date.now());
    return;
  }
  DisplayChatLogs();
});

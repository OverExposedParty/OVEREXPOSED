// party-socket.js

// Join / leave / kick via socket
async function joinParty(code) {
  console.log(`Joining party: ${code}`);
  socket.emit('join-party', code);
}

async function leaveParty(code) {
  const currentPartyData = await GetCurrentPartyData();

  const players = currentPartyData.players || [];

  const index = players.findIndex(
    player => player.identity?.computerId === deviceId
  );

  if (index !== -1) {
    players[index].connection = players[index].connection || {};
    players[index].connection.socketId = null;
  }

  // ✅ New layout only: config/state must exist
  const currentConfig = currentPartyData.config;
  const currentState = currentPartyData.state;

  const updatedState = {
    ...currentState,
    lastPinged: Date.now()
  };

  await updateOnlineParty({
    partyId: code,
    config: currentConfig,
    state: updatedState,
    players
  });

  console.log(`Leaving party: ${code}`);
  socket.emit('leave-party', code);
}

async function kickUser(code) {
  const currentPartyData = await GetCurrentPartyData();

  const players = currentPartyData.players || [];

  const index = players.findIndex(
    player => player.identity?.computerId === deviceId
  );

  if (index !== -1) {
    players[index].connection = players[index].connection || {};
    players[index].connection.socketId = null;
  }

  // ✅ New layout only: config/state must exist
  const currentConfig = currentPartyData.config;
  const currentState = currentPartyData.state;

  const updatedState = {
    ...currentState,
    lastPinged: Date.now()
  };

  await updateOnlineParty({
    partyId: code,
    config: currentConfig,
    state: updatedState,
    players
  });

  console.log(`Kicking self from party: ${code}`);
  socket.emit('kick-user', code);
}

// --- Socket events ---

socket.on('joined-party', (data) => {
  console.log(data.message);
});

socket.on('left-party', (code) => {
  console.log(`✅ You left party: ${code}`);
  PartyDisbanded();
});

socket.on('kicked-from-party', (code) => {
  console.log(`🥾 You were kicked from party: ${code}`);
});

socket.on('user-joined', ({ socketId }) => {
  console.log(`👋 User joined: ${socketId}`);
});

socket.on('user-left', ({ socketId }) => {
  console.log(`👋 User left: ${socketId}`);
});

socket.on('user-kicked', ({ socketId }) => {
  console.log(`🥾 User kicked: ${socketId}`);
});

socket.on('user-disconnected', ({ socketId }) => {
  console.log(`❌ User disconnected: ${socketId}`);
});

socket.on('party-deleted', ({ partyCode: deletedCode }) => {
  console.log(`🛑 Party ${deletedCode} has been disbanded.`);
  PartyDisbanded();
});

// Party data updates
socket.on("party-updated", async ({ type, emittedPartyCode, documentKey }) => {
  try {
    const codeToUse = partyCode || emittedPartyCode.partyId;
    const res = await fetch(`/api/${sessionPartyType}?partyCode=${codeToUse}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      PartyDisbanded();
      return;
    }

    const party = data[0];

    // ✅ New layout only
    const config = party.config;
    const state = party.state;
    const players = party.players || [];

    if (!isPlaying) {
      partyUserCount = players.length;

      const playerIndex = players.findIndex(
        p => p.identity?.computerId === deviceId
      );
      if (playerIndex === -1) {
        await KickUser();
      }

      partyRulesSettings = config.gameRules;

      // ✅ Pass the real document (new layout) into helpers
      await checkForGameSettingsUpdates(party);

      if (waitingForHost || hostedParty) {
        UpdateGamemodeContainer();
      }
    }

    const latestPing = state.lastPinged;
    if (new Date(latestPing).getTime() !== new Date(lastKnownPing).getTime()) {
      console.log('🟢 Party data changed!');
      if (state.isPlaying) {
        if (waitingForHost) {
          loadingPage = true;
          console.log("start");
          const baseUrl = window.location.origin;
          const gm = config.gamemode;
          transitionSplashScreen(
            `${baseUrl}/${formatPackName(gm)}/${codeToUse}`,
            `/images/splash-screens/${formatPackName(gm)}.png`
          );
          return;
        }
        if (isPlaying) {
          FetchInstructions();
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
  console.log("💬 Chat updated:", type, chatLog);

  if (type === "delete") {
    // CreateChatMessage("[CONSOLE]", "Party disbanded.", "error", Date.now());
    return;
  }
  DisplayChatLogs();
});

function postToBothEndpoints(payload, endpoint1, endpoint2) {
  const postEndpoint = async (endpoint, requestPayload) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const serverError =
        data.error && typeof data.error === 'object' ? data.error : {};
      const message =
        (typeof data.error === 'string' && data.error) ||
        serverError.message ||
        data.message ||
        `Request failed for ${endpoint} with status ${res.status}`;
      const error = new Error(message);
      if (typeof serverError.code === 'string') {
        error.code = serverError.code;
      }
      if (serverError.details !== undefined) {
        error.details = serverError.details;
      }
      error.status = res.status;
      error.requestId = data.requestId || null;
      throw error;
    }
    return data;
  };

  return postEndpoint(endpoint1, payload)
    .then(async (primary) => {
      const authoritativeSession = primary?.updated?.session;
      const secondaryPayload = authoritativeSession
        ? { ...payload, session: authoritativeSession }
        : payload;
      return {
        primary,
        secondary: await postEndpoint(endpoint2, secondaryPayload)
      };
    })
    .catch((err) => {
      console.error('❌ One or both POSTs failed:', err);
      throw err;
    });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOnlinePartySnapshot({
  partyType = sessionPartyType,
  requirePlayer = false,
  requirePlaying = false,
  requireSelectedPacks = false,
  retries = 20,
  delayMs = 250
} = {}) {
  let latestParty = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const existingData = await getExistingPartyData(partyCode, partyType);
      latestParty = Array.isArray(existingData)
        ? (existingData[0] ?? null)
        : null;
    } catch (error) {
      console.warn('Failed to fetch party snapshot during startup:', error);
      latestParty = null;
    }

    if (latestParty) {
      const players = latestParty.players || [];
      const state = getPartyState(latestParty) || {};
      const hasPlayer = players.some(
        (player) =>
          player.identity?.computerId === deviceId ||
          player.computerId === deviceId
      );
      const playingReady = requirePlaying
        ? state.isPlaying === true || state.phase === 'game-over'
        : true;
      const playerReady = requirePlayer ? hasPlayer : true;
      const selectedPacksReady = requireSelectedPacks
        ? Array.isArray(latestParty.config?.selectedPacks) &&
          latestParty.config.selectedPacks.length > 0
        : true;

      if (playerReady && playingReady && selectedPacksReady) {
        return latestParty;
      }
    }

    if (attempt < retries) {
      await delay(delayMs);
    }
  }

  return latestParty;
}

async function waitForPartyInstruction({
  partyType = sessionPartyType,
  retries = 20,
  delayMs = 250
} = {}) {
  let latestParty = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const existingData = await getExistingPartyData(partyCode, partyType);
      latestParty = Array.isArray(existingData)
        ? (existingData[0] ?? null)
        : null;
    } catch (error) {
      console.warn('Failed to fetch party instructions during startup:', error);
      latestParty = null;
    }

    const userInstructions = latestParty
      ? getUserInstructions(latestParty)
      : '';
    if (
      typeof userInstructions === 'string' &&
      userInstructions.trim() !== ''
    ) {
      return latestParty;
    }

    if (attempt < retries) {
      await delay(delayMs);
    }
  }

  return latestParty;
}

async function flushPendingOnlineInstructionSync() {
  if (!window.pendingOnlineInstructionSync) {
    return;
  }

  window.pendingOnlineInstructionSync = false;

  await runOnlineFetchInstructions({ reason: 'pending' });
}

function getOnlineInstructionSnapshotSignature(party) {
  const partyData =
    party ||
    (typeof currentPartyData !== 'undefined' ? currentPartyData : null);

  if (!partyData || typeof partyData !== 'object') {
    return '';
  }

  const config = partyData.config || {};
  const state = partyData.state || {};
  const instruction =
    config.userInstructions ??
    state.userInstructions ??
    partyData.userInstructions ??
    '';
  const players = Array.isArray(partyData.players) ? partyData.players : [];
  const playerSignature = players
    .map((player) => {
      const identity = player.identity || {};
      const playerState = player.state || {};
      const connection = player.connection || {};

      return [
        identity.computerId ?? player.computerId ?? '',
        playerState.isReady ?? player.isReady ?? '',
        playerState.hasConfirmed ?? player.hasConfirmed ?? '',
        playerState.vote ?? player.vote ?? '',
        playerState.score ?? player.score ?? '',
        connection.socketId ?? player.socketId ?? ''
      ].join(':');
    })
    .join('|');

  return [
    partyData.partyId ?? partyCode ?? '',
    config.gamemode ?? partyData.gamemode ?? '',
    state.lastPinged ?? partyData.lastPinged ?? '',
    state.phase ?? partyData.phase ?? '',
    state.playerTurn ?? partyData.playerTurn ?? '',
    state.speakingRound ??
      state.round ??
      partyData.speakingRound ??
      partyData.round ??
      '',
    state.speakingPlayerTurn ??
      state.roundPlayerTurn ??
      partyData.speakingPlayerTurn ??
      partyData.roundPlayerTurn ??
      '',
    state.completedRounds ?? partyData.completedRounds ?? '',
    state.timer ?? partyData.timer ?? '',
    instruction,
    playerSignature
  ].join('||');
}

async function runOnlineFetchInstructions({ force = false, reason = '' } = {}) {
  if (typeof FetchInstructions !== 'function') {
    return false;
  }

  const signatureBeforeRender = getOnlineInstructionSnapshotSignature();

  if (
    !force &&
    signatureBeforeRender &&
    signatureBeforeRender === window.lastOnlineInstructionSnapshotSignature
  ) {
    return false;
  }

  if (window.onlineInstructionSyncInFlight) {
    window.pendingOnlineInstructionSync = true;
    return false;
  }

  window.onlineInstructionSyncInFlight = true;

  try {
    await FetchInstructions();
    window.lastOnlineInstructionSnapshotSignature =
      getOnlineInstructionSnapshotSignature();
    return true;
  } finally {
    window.onlineInstructionSyncInFlight = false;

    if (
      window.pendingOnlineInstructionSync &&
      window.onlineGameUiReady &&
      isPlaying
    ) {
      window.pendingOnlineInstructionSync = false;
      await runOnlineFetchInstructions({ reason: reason || 'queued' });
    }
  }
}

async function syncStartupPartyState({
  partyType = sessionPartyType,
  requirePlaying = true
} = {}) {
  const latestParty = await waitForOnlinePartySnapshot({
    partyType,
    requirePlayer: true,
    requirePlaying,
    retries: 8,
    delayMs: 200
  });

  if (!latestParty) {
    return null;
  }

  const config =
    typeof normalizeConfig === 'function'
      ? normalizeConfig(latestParty)
      : { ...(latestParty.config ?? latestParty) };
  const state =
    typeof normalizeState === 'function'
      ? normalizeState(latestParty)
      : { ...(latestParty.state ?? latestParty) };
  const deck =
    typeof normalizeDeck === 'function'
      ? normalizeDeck(latestParty)
      : { ...(latestParty.deck ?? latestParty) };
  const players = Array.isArray(latestParty.players)
    ? latestParty.players.map((player) => ({ ...player }))
    : [];

  const playerIndex = players.findIndex(
    (player) =>
      player.identity?.computerId === deviceId || player.computerId === deviceId
  );

  if (playerIndex !== -1) {
    const player = players[playerIndex];
    player.connection = player.connection || {};
    player.connection.socketId = socket.id;
    player.connection.lastPing = new Date();
    player.socketId = socket.id;
  }

  return {
    party: latestParty,
    config,
    state,
    deck,
    players
  };
}

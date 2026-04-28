// party-api.js

async function getExistingPartyData(partyId, partyType = sessionPartyType) {
  try {
    const res = await fetch(`/api/${partyType}?partyCode=${partyId}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

async function GetCurrentPartyData({
  requireInstructions = false,
  retries = 0,
  delayMs = 150
} = {}) {
  const fallbackParty =
    currentPartyData && (currentPartyData.partyId === partyCode || !currentPartyData.partyId)
      ? currentPartyData
      : null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const existingData = await getExistingPartyData(partyCode);
    const latestParty = existingData?.[0];
    const latestInstructions = typeof getUserInstructions === 'function'
      ? getUserInstructions(latestParty)
      : latestParty?.config?.userInstructions ?? latestParty?.state?.userInstructions ?? latestParty?.userInstructions ?? '';

    if (!latestParty) {
      debugLog('[OE_DEBUG][GetCurrentPartyData] no latest party', {
        partyCode,
        requireInstructions,
        attempt,
        retries,
        hasFallbackParty: Boolean(fallbackParty)
      });
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }

      if (fallbackParty) {
        return fallbackParty;
      }

      console.warn('No party data found.');
      return;
    }

    if (!requireInstructions) {
      debugLog('[OE_DEBUG][GetCurrentPartyData] returning latest party (no instruction requirement)', {
        partyCode,
        attempt,
        hasInstructions: typeof latestInstructions === 'string' && latestInstructions.trim() !== '',
        phase: latestParty?.state?.phase ?? latestParty?.phase ?? null,
        playerTurn: latestParty?.state?.playerTurn ?? latestParty?.playerTurn ?? null
      });
      return latestParty;
    }

    if (typeof latestInstructions === 'string' && latestInstructions.trim() !== '') {
      debugLog('[OE_DEBUG][GetCurrentPartyData] returning latest party with instructions', {
        partyCode,
        attempt,
        instructions: latestInstructions,
        phase: latestParty?.state?.phase ?? latestParty?.phase ?? null,
        playerTurn: latestParty?.state?.playerTurn ?? latestParty?.playerTurn ?? null
      });
      return latestParty;
    }

    if (attempt < retries) {
      debugLog('[OE_DEBUG][GetCurrentPartyData] latest party missing instructions, retrying', {
        partyCode,
        attempt,
        retries,
        phase: latestParty?.state?.phase ?? latestParty?.phase ?? null,
        playerTurn: latestParty?.state?.playerTurn ?? latestParty?.playerTurn ?? null
      });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } else {
      debugLog('[OE_DEBUG][GetCurrentPartyData] returning latest party without instructions after retries', {
        partyCode,
        attempt,
        phase: latestParty?.state?.phase ?? latestParty?.phase ?? null,
        playerTurn: latestParty?.state?.playerTurn ?? latestParty?.playerTurn ?? null
      });
      return latestParty;
    }
  }
}

async function reserveUniquePartyCode() {
  const res = await fetch('/api/party-code/reserve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to reserve unique party code');
  }

  const data = await res.json();
  return data.partyCode;
}

function normaliseOnlinePartyActionPayload(payload = {}) {
  const nextPayload = { ...payload };
  const partyData = nextPayload.partyData;

  if (partyData && typeof partyData === 'object') {
    if (partyData.config && nextPayload.configPatch === undefined) {
      nextPayload.configPatch = partyData.config;
    }

    if (partyData.state && nextPayload.statePatch === undefined) {
      nextPayload.statePatch = partyData.state;
    }

    if (partyData.deck && nextPayload.deckPatch === undefined) {
      nextPayload.deckPatch = partyData.deck;
    }

    if (Array.isArray(partyData.players) && nextPayload.playerUpdates === undefined) {
      nextPayload.playerUpdates = partyData.players.map((player) => ({
        computerId: player?.identity?.computerId ?? player?.computerId ?? null,
        identity: player?.identity,
        connection: player?.connection,
        state: player?.state,
        isReady: player?.isReady,
        hasConfirmed: player?.hasConfirmed,
        vote: player?.vote,
        score: player?.score,
        socketId: player?.socketId,
        lastPing: player?.lastPing
      }));
    }

    delete nextPayload.partyData;
  }

  return nextPayload;
}

async function syncOnlinePartyInstructionsAfterAction() {
  if (typeof FetchInstructions !== 'function') {
    return;
  }

  if (!isPlaying) {
    return;
  }

  if (!window.onlineGameUiReady) {
    window.pendingOnlineInstructionSync = true;
    return;
  }

  if (typeof runOnlineFetchInstructions === 'function') {
    await runOnlineFetchInstructions({ reason: 'action' });
  } else {
    await FetchInstructions();
  }
}

async function performOnlinePartyAction({
  partyType = sessionPartyType,
  partyId = partyCode,
  action,
  actorId = typeof deviceId === 'string' ? deviceId : null,
  payload = {},
  syncInstructions = true
} = {}) {
  if (!partyId) {
    throw new Error('partyId is required for party actions');
  }

  if (!action) {
    throw new Error('action is required for party actions');
  }

  const res = await fetch(`/api/${partyType}/action?partyCode=${partyId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      partyId,
      action,
      actorId,
      payload: normaliseOnlinePartyActionPayload({
        ...payload,
        socketId: typeof socket?.id === 'string' ? socket.id : payload.socketId
      })
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage =
      typeof data.error === 'string'
        ? data.error
        : data.error?.message ||
          data.message ||
          `Failed to perform party action: ${action}`;
    throw new Error(errorMessage);
  }

  if (data.updated) {
    currentPartyData = data.updated;

    if (syncInstructions) {
      await syncOnlinePartyInstructionsAfterAction();
    }
  }

  return data.updated ?? null;
}

async function EndOnlineGame({
  partyType = sessionPartyType,
  partyId = partyCode
} = {}) {
  const updatedParty = await performOnlinePartyAction({
    partyType,
    partyId,
    action: 'end-game',
    syncInstructions: false
  });

  if (updatedParty) {
    currentPartyData = updatedParty;
  }

  if (typeof runOnlineFetchInstructions === 'function') {
    await runOnlineFetchInstructions({ force: true, reason: 'end-game' });
  } else if (typeof FetchInstructions === 'function') {
    await FetchInstructions();
  }

  return updatedParty;
}

async function getPartyChatLog() {
  try {
    const res = await fetch(`/api/chat/${partyCode}`);
    const existingData = await res.json();
    return existingData;
  } catch (err) {
    console.error('❌ Failed to fetch existing party data:', err);
    throw err;
  }
}

function updateOnlineParty({
  partyType = sessionPartyType,
  partyId,
  config,
  state,
  deck,
  players,
  bypassPlayerRestrictions = false
}) {
  const isDeckGame = !partyType?.startsWith('party-game-mafia');
      debugLog("config:", config);
  const payload = {
    partyId,
    ...(isDeckGame && deck !== undefined && { deck }),
    ...(config !== undefined && { config }),
    ...(state !== undefined && { state }),
    ...(players !== undefined && { players }),
    ...(bypassPlayerRestrictions && { bypassPlayerRestrictions: true })
  };
    debugLog("players", players);
  return postToBothEndpoints(
    payload,
    `/api/${partyType}?partyCode=${partyId}`,
    `/api/waiting-room?partyCode=${partyId}`
  );
}

async function addUserToParty({
  partyType = sessionPartyType,
  partyId,
  newComputerId,
  newUsername,
  newUserIcon,
  newScore,
  newUserReady = false,
  newUserConfirmation = false,
  newUserSocketId = null
}) {
  try {
    const res = await fetch(`/api/${partyType}/join-user?partyCode=${partyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partyId,
        newComputerId,
        newUsername,
        newUserIcon,
        newScore,
        newUserReady,
        newUserConfirmation,
        newUserSocketId
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Failed to join party');
    }

    return data;
  } catch (err) {
    console.error('❌ Append failed:', err);
    throw err;
  }
}

async function UpdateUserReady({ partyId, computerId, newReady, newConfirmation }) {
  try {
    await UpdateUserPartyData({
      partyId,
      computerId,
      newUserReady: newReady,
      newUserConfirmation: newConfirmation
    });
  } catch (err) {
    console.error('❌ Failed to update user ready status:', err);
  }
}

async function UpdateUserPartyData({
  partyId,
  computerId,
  newUsername,
  newUserIcon,
  newUserReady,
  newUserConfirmation,
  newScore,
  newUserSocketId,
  playerPatch,
  partyType = sessionPartyType
}) {
  try {
    const res = await fetch(`/api/${partyType}/patch-player?partyCode=${partyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partyId,
        computerId,
        newUsername,
        newUserIcon,
        newUserReady,
        newUserConfirmation,
        newScore,
        newUserSocketId,
        playerPatch
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Failed to patch player "${computerId}"`);
    }

    if (data.updated) {
      currentPartyData = data.updated;
    }

    return data;
  } catch (err) {
    console.error('❌ Update by computerId failed:', err);
    throw err;
  }
}

async function removeUserFromParty(partyId, computerIdToRemove, partyType = sessionPartyType) {
  const url = `/api/${partyType}/remove-user`;
  const payload = {
    partyId,
    computerIdToRemove,
    actorComputerId: typeof deviceId === 'string' ? deviceId : null,
    actorSocketId: typeof socket?.id === 'string' ? socket.id : null
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Failed to remove user:', error);
    return;
  }

  const partyRes = await fetch(`/api/${partyType}?partyCode=${partyId}`);
  const data = await partyRes.json();
  const party = data[0];

  allUsersReady = party.players.every(
    player => player.state?.isReady === true
  );

  if (party.players.length === 0) {
    DeleteParty();
  } else {
    updateStartGameButton(allUsersReady);
  }
}

async function checkAndDeleteEmptyParty(partyId) {
  try {
    const existingData = await getExistingPartyData(partyId);
    if (!existingData || existingData.length === 0) {
      console.warn('No party data found.');
      return;
    }

    const currentPartyData = existingData[0];
    const players = currentPartyData.players || [];

    const isEmpty = players.length === 0;

    if (isEmpty) {
      await DeleteParty(partyId);
    } else {
      debugLog(`Party "${partyId}" still has users. No action taken.`);
    }
  } catch (err) {
    console.error('❌ Error checking or deleting empty party:', err);
  }
}

function DeleteParty() {
  if (!partyCode) return;
  hostedParty = false;
  const payload = JSON.stringify({ partyCode });
  const blob = new Blob([payload], { type: 'application/json' });

  socket.emit('delete-party', partyCode);
  partyCode = null;
  debugLog('🚀 Party deleted');
  navigator.sendBeacon(`/api/${sessionPartyType}/delete`, blob);
}

async function startOnlinePartyGame(partyId, { bypassPlayerRestrictions = false } = {}) {
  try {
    await performOnlinePartyAction({
      partyId,
      action: 'start-game',
      payload: {
        bypassPlayerRestrictions
      },
      syncInstructions: false
    });

    debugLog(`✅ Online game started for party ${partyId}`);
  } catch (error) {
    console.error('❌ Failed to start online game:', error);
    throw error;
  }
}

async function userPingToParty(deviceId, partyId) {
  try {
    const res = await fetch(`/api/${sessionPartyType}/patch-player?partyCode=${partyId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        partyId,
        computerId: deviceId
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || `Failed to ping device "${deviceId}"`);
    }

    if (data.updated) {
      currentPartyData = data.updated;
    }

    return data;
  } catch (err) {
    console.error('❌ Failed to ping user in party:', err);
    throw err;
  }
}

async function GetAllUsersReady() {
  const partyRes = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await partyRes.json();
  const party = data[0];
  if (!party) return true;

  if (party.players.length === 1) return false;

  return party.players
    .slice(1)
    .every(player => player.state?.isReady === true);
}

function getAllDeviceIDs(currentPartyData) {
  return currentPartyData.players.map(player => player.identity.computerId);
}

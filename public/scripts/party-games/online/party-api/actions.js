(() => {
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
    if (typeof FetchInstructions !== 'function' || !isPlaying) return;

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
    const normalisedPartyId = window.PartyApiPartyData.requireOnlinePartyId(partyId);
    if (!action) throw new Error('action is required for party actions');

    const res = await fetch(
      `/api/${partyType}/action?partyCode=${encodeURIComponent(normalisedPartyId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: normalisedPartyId,
          action,
          actorId,
          payload: normaliseOnlinePartyActionPayload({
            ...payload,
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
            socketId: typeof socket?.id === 'string' ? socket.id : payload.socketId
          })
        })
      }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || `Failed to perform party action: ${action}`;
      throw new Error(errorMessage);
    }

    if (data.updated) {
      currentPartyData = data.updated;
      if (syncInstructions) await syncOnlinePartyInstructionsAfterAction();
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
    if (updatedParty) currentPartyData = updatedParty;

    if (typeof runOnlineFetchInstructions === 'function') {
      await runOnlineFetchInstructions({ force: true, reason: 'end-game' });
    } else if (typeof FetchInstructions === 'function') {
      await FetchInstructions();
    }

    return updatedParty;
  }

  async function ReturnOnlinePartyToLobby({
    partyType = sessionPartyType,
    partyId = partyCode
  } = {}) {
    const updatedParty = await performOnlinePartyAction({
      partyType,
      partyId,
      action: 'return-to-lobby',
      syncInstructions: false
    });
    if (updatedParty) currentPartyData = updatedParty;
    return updatedParty;
  }

  async function ReplayOnlinePartyGame({
    partyType = sessionPartyType,
    partyId = partyCode,
    expectedGameId = currentPartyData?.session?.gameId
  } = {}) {
    const updatedParty = await performOnlinePartyAction({
      partyType,
      partyId,
      action: 'replay-game',
      payload: { expectedGameId },
      syncInstructions: false
    });
    if (updatedParty) currentPartyData = updatedParty;
    return updatedParty;
  }

  window.PartyApiActions = {
    EndOnlineGame,
    ReplayOnlinePartyGame,
    ReturnOnlinePartyToLobby,
    normaliseOnlinePartyActionPayload,
    performOnlinePartyAction,
    syncOnlinePartyInstructionsAfterAction
  };
})();

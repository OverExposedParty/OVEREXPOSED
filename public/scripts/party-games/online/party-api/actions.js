(() => {
  const HOST_ONLY_PARTY_ACTIONS = new Set([
    'start-game',
    'end-game',
    'return-to-lobby',
    'replay-game'
  ]);

  function getOnlinePartyActionActorId(party, requestedActorId) {
    return (
      window.resolveOnlinePartyActorId?.(party, requestedActorId) ??
      requestedActorId ??
      (typeof deviceId === 'string' ? deviceId : null)
    );
  }

  function assertOnlinePartyActionAllowed(action, party, actorId) {
    if (!HOST_ONLY_PARTY_ACTIONS.has(action) || !party?.state?.hostComputerId) {
      return;
    }

    if (typeof window.requireCurrentOnlinePartyHost === 'function') {
      window.requireCurrentOnlinePartyHost(party, action.replaceAll('-', ' '));
      return;
    }

    if (String(party.state.hostComputerId) !== String(actorId || '')) {
      const error = new Error('Only the host can perform this action.');
      error.status = 403;
      error.code = 'party_host_required';
      throw error;
    }
  }

  async function refreshPartyAfterAccessDenied(partyId, partyType, error) {
    try {
      const existing = await window.PartyApiPartyData.getExistingPartyData(
        partyId,
        partyType
      );
      const latestParty = Array.isArray(existing) ? existing[0] : null;
      if (latestParty) {
        currentPartyData = latestParty;
        window.syncOnlinePartyIdentity?.(latestParty);
      }
    } catch (refreshError) {
      console.warn(
        'Failed to refresh party identity after access denial:',
        refreshError
      );
    }

    if (typeof window.CustomEvent === 'function') {
      window.dispatchEvent?.(
        new CustomEvent('oe-party-access-denied', {
          detail: {
            partyId,
            action: error?.action || null,
            code: error?.code || 'party_access_denied'
          }
        })
      );
    }
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
      if (
        Array.isArray(partyData.players) &&
        nextPayload.playerUpdates === undefined
      ) {
        nextPayload.playerUpdates = partyData.players.map((player) => ({
          computerId:
            player?.identity?.computerId ?? player?.computerId ?? null,
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
    actorId = null,
    payload = {},
    syncInstructions = true
  } = {}) {
    const normalisedPartyId =
      window.PartyApiPartyData.requireOnlinePartyId(partyId);
    if (!action) throw new Error('action is required for party actions');
    const party =
      typeof currentPartyData === 'undefined' ? null : currentPartyData;
    const resolvedActorId = getOnlinePartyActionActorId(party, actorId);
    assertOnlinePartyActionAllowed(action, party, resolvedActorId);

    const requestUrl = `/api/${partyType}/action?partyCode=${encodeURIComponent(normalisedPartyId)}`;
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyId: normalisedPartyId,
        action,
        actorId: resolvedActorId,
        payload: normaliseOnlinePartyActionPayload({
          ...payload,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          socketId:
            typeof socket?.id === 'string' ? socket.id : payload.socketId
        })
      })
    };
    let data;

    try {
      if (window.PartyApiRequest?.requestPartyJson) {
        ({ data } = await window.PartyApiRequest.requestPartyJson(
          requestUrl,
          requestOptions,
          { fallbackMessage: `Failed to perform party action: ${action}` }
        ));
      } else {
        const response = await fetch(requestUrl, requestOptions);
        data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const serverError =
            data.error && typeof data.error === 'object' ? data.error : {};
          const error = new Error(
            (typeof data.error === 'string' && data.error) ||
              serverError.message ||
              data.message ||
              `Failed to perform party action: ${action}`
          );
          error.status = response.status;
          error.code = serverError.code || 'party_action_failed';
          error.details = serverError.details;
          throw error;
        }
      }
    } catch (error) {
      error.action = action;
      if (error.status === 403) {
        await refreshPartyAfterAccessDenied(
          normalisedPartyId,
          partyType,
          error
        );
      }
      throw error;
    }

    if (data.updated) {
      currentPartyData = data.updated;
      window.syncOnlinePartyIdentity?.(data.updated);
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

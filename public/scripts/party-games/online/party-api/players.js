(() => {
  const { getExistingPartyData, requireOnlinePartyId } =
    window.PartyApiPartyData;
  const { performOnlinePartyAction } = window.PartyApiActions;

  function updateOnlineParty({
    partyType = sessionPartyType,
    partyId,
    session,
    config,
    state,
    deck,
    players,
    bypassPlayerRestrictions = false
  }) {
    const normalisedPartyId = requireOnlinePartyId(partyId);
    const isDeckGame = !partyType?.startsWith('party-game-mafia');
    const payload = {
      partyId: normalisedPartyId,
      ...(session !== undefined && { session }),
      ...(isDeckGame && deck !== undefined && { deck }),
      ...(config !== undefined && { config }),
      ...(state !== undefined && { state }),
      ...(players !== undefined && { players }),
      ...(bypassPlayerRestrictions && { bypassPlayerRestrictions: true })
    };
    debugLog('config:', config);
    debugLog('players', players);
    return postToBothEndpoints(
      payload,
      `/api/${partyType}?partyCode=${encodeURIComponent(normalisedPartyId)}`,
      `/api/waiting-room?partyCode=${encodeURIComponent(normalisedPartyId)}`
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
      const normalisedPartyId = requireOnlinePartyId(partyId);
      const res = await fetch(
        `/api/${partyType}/join-user?partyCode=${encodeURIComponent(normalisedPartyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partyId: normalisedPartyId,
            newComputerId,
            newUsername,
            newUserIcon,
            newScore,
            newUserReady,
            newUserConfirmation,
            newUserSocketId
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to join party');
      await window.PartyAuthTransition?.completeCurrentPartyAuthTransition?.();
      return data;
    } catch (err) {
      console.error('Append failed:', err);
      throw err;
    }
  }

  async function UpdateUserReady({
    partyId,
    computerId,
    newReady,
    newConfirmation
  }) {
    try {
      await UpdateUserPartyData({
        partyId,
        computerId,
        newUserReady: newReady,
        newUserConfirmation: newConfirmation
      });
      return true;
    } catch (err) {
      console.error('Failed to update user ready status:', err);
      return false;
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
      const normalisedPartyId = requireOnlinePartyId(partyId);
      const res = await fetch(
        `/api/${partyType}/patch-player?partyCode=${encodeURIComponent(normalisedPartyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partyId: normalisedPartyId,
            computerId,
            newUsername,
            newUserIcon,
            newUserReady,
            newUserConfirmation,
            newScore,
            newUserSocketId,
            playerPatch
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const serverError = data?.error;
        const error = new Error(
          serverError?.message ||
            data?.message ||
            `Failed to patch player "${computerId}"`
        );
        error.code = serverError?.code || 'party_patch_player_failed';
        error.status = res.status;
        error.details = serverError?.details;
        throw error;
      }
      if (data.updated) currentPartyData = data.updated;
      if (newUserSocketId) {
        await window.PartyAuthTransition?.completeCurrentPartyAuthTransition?.();
      }
      return data;
    } catch (err) {
      console.error('Update by computerId failed:', err);
      throw err;
    }
  }

  async function removeUserFromParty(
    partyId,
    computerIdToRemove,
    partyType = sessionPartyType
  ) {
    const normalisedPartyId = requireOnlinePartyId(partyId);
    const res = await fetch(`/api/${partyType}/remove-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyId: normalisedPartyId,
        computerIdToRemove,
        actorComputerId: typeof deviceId === 'string' ? deviceId : null,
        actorSocketId: typeof socket?.id === 'string' ? socket.id : null
      })
    });

    if (!res.ok) {
      console.error('Failed to remove user:', await res.json());
      return;
    }

    const partyRes = await fetch(
      `/api/${partyType}?partyCode=${encodeURIComponent(normalisedPartyId)}`
    );
    const data = await partyRes.json();
    const party = data[0];
    allUsersReady = party.players.every(
      (player) => player.state?.isReady === true
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

      const party = existingData[0];
      if ((party.players || []).length === 0) {
        await DeleteParty(partyId);
      } else {
        debugLog(`Party "${partyId}" still has users. No action taken.`);
      }
    } catch (err) {
      console.error('Error checking or deleting empty party:', err);
    }
  }

  async function DeleteParty(partyIdToDelete = partyCode) {
    const normalisedPartyId = requireOnlinePartyId(partyIdToDelete);
    const previousTeardownState = window.onlinePartyTeardownInProgress === true;
    window.onlinePartyTeardownInProgress = true;

    try {
      const response = await fetch(`/api/${sessionPartyType}/delete`, {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partyCode: normalisedPartyId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(
          payload?.error?.message ||
            payload?.message ||
            'Failed to disband the party'
        );
      }

      hostedParty = false;
      waitingForHost = false;
      currentPartyData = null;
      if (
        String(partyCode || '').toUpperCase() ===
        String(normalisedPartyId).toUpperCase()
      ) {
        partyCode = null;
      }
      window.removeOnlineSettingsPartyCodeFromUrl?.();
      window.PartyChat?.clearMessages?.();
      window.dispatchEvent(
        new CustomEvent('oe-active-party-lobby-disbanded', {
          detail: { partyCode: normalisedPartyId }
        })
      );
      debugLog(`Party ${normalisedPartyId} disbanded`);
      return payload?.data || payload;
    } catch (error) {
      window.onlinePartyTeardownInProgress = previousTeardownState;
      throw error;
    }
  }

  async function startOnlinePartyGame(
    partyId,
    { bypassPlayerRestrictions = false } = {}
  ) {
    try {
      const normalisedPartyId = requireOnlinePartyId(partyId);
      await performOnlinePartyAction({
        partyId: normalisedPartyId,
        actorId:
          hostedParty && hostDeviceId
            ? hostDeviceId
            : typeof deviceId === 'string'
              ? deviceId
              : null,
        action: 'start-game',
        payload: { bypassPlayerRestrictions },
        syncInstructions: false
      });
      debugLog(`Online game started for party ${normalisedPartyId}`);
    } catch (error) {
      console.error('Failed to start online game:', error);
      throw error;
    }
  }

  async function userPingToParty(currentDeviceId, partyId) {
    try {
      const normalisedPartyId = requireOnlinePartyId(partyId);
      const res = await fetch(
        `/api/${sessionPartyType}/patch-player?partyCode=${encodeURIComponent(normalisedPartyId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partyId: normalisedPartyId,
            computerId: currentDeviceId
          })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to ping device "${currentDeviceId}"`
        );
      }
      if (data.updated) currentPartyData = data.updated;
      return data;
    } catch (err) {
      console.error('Failed to ping user in party:', err);
      throw err;
    }
  }

  async function GetAllUsersReady() {
    const partyRes = await fetch(
      `/api/${sessionPartyType}?partyCode=${partyCode}`
    );
    const data = await partyRes.json();
    const party = data[0];
    if (!party) return true;
    const players = Array.isArray(party.players) ? party.players : [];
    if (players.length <= 1) return false;

    const hostComputerId = party.state?.hostComputerId;
    const nonHostPlayers = hostComputerId
      ? players.filter(
          (player) =>
            String(
              player.identity?.computerId || player.computerId || ''
            ) !== String(hostComputerId)
        )
      : players.slice(1);

    return (
      nonHostPlayers.length > 0 &&
      nonHostPlayers.every((player) => player.state?.isReady === true)
    );
  }

  function getAllDeviceIDs(currentParty) {
    return currentParty.players.map((player) => player.identity.computerId);
  }

  window.PartyApiPlayers = {
    DeleteParty,
    GetAllUsersReady,
    UpdateUserPartyData,
    UpdateUserReady,
    addUserToParty,
    checkAndDeleteEmptyParty,
    getAllDeviceIDs,
    removeUserFromParty,
    startOnlinePartyGame,
    updateOnlineParty,
    userPingToParty
  };
})();

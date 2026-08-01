function createPartyHostRepairTools({
  io,
  getPartyPlayerId,
  getPartyNotificationActor,
  getPartyNotificationModeName,
  withoutGuestHashes,
  isSocketIdActive,
  getPlayerConnectionSocketId
}) {
  function getLiveHostCandidate({ session, ignoreComputerId = null }) {
    const state = session.state;
    const players = Array.isArray(session.players) ? session.players : [];
    const playerIds = players
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);
    const currentHostId = state?.hostComputerId ?? null;
    const fallbackHostList = currentHostId
      ? [
          currentHostId,
          ...playerIds.filter(
            (playerId) => String(playerId) !== String(currentHostId)
          )
        ]
      : playerIds;
    const rawHostList =
      Array.isArray(state?.hostComputerIdList) &&
      state.hostComputerIdList.length > 0
        ? state.hostComputerIdList
        : fallbackHostList;
    const hostList = rawHostList.filter((candidateComputerId) =>
      players.some(
        (player) =>
          String(getPartyPlayerId(player)) === String(candidateComputerId)
      )
    );

    for (const candidateComputerId of hostList) {
      if (
        ignoreComputerId &&
        String(candidateComputerId) === String(ignoreComputerId)
      ) {
        continue;
      }

      const candidate = players.find(
        (player) =>
          String(getPartyPlayerId(player)) === String(candidateComputerId)
      );

      if (
        candidate &&
        isSocketIdActive(getPlayerConnectionSocketId(candidate))
      ) {
        return { candidateComputerId, candidate, hostList };
      }
    }

    return { candidateComputerId: null, candidate: null, hostList };
  }

  async function syncWaitingRoomHostState({
    waitingRoomModel,
    partyId,
    state
  }) {
    if (!waitingRoomModel || !partyId || !state) return;

    await waitingRoomModel.findOneAndUpdate(
      { partyId },
      {
        $set: {
          'state.hostComputerId': state.hostComputerId ?? null,
          'state.hostComputerIdList': Array.isArray(state.hostComputerIdList)
            ? state.hostComputerIdList
            : [],
          'state.lastPinged': new Date()
        }
      }
    );
  }

  function appendHostChangedChat(
    chatLogSession,
    previousHostId,
    newHostPlayer
  ) {
    if (!chatLogSession || !newHostPlayer) return;

    const newHostId = getPartyPlayerId(newHostPlayer);
    if (String(newHostId) === String(previousHostId)) return;

    const username = newHostPlayer.identity?.username || newHostPlayer.username;
    if (!username) return;

    chatLogSession.chat.push({
      username: '[CONSOLE]',
      message: `${username} is now the host.`,
      eventType: 'connect'
    });
  }

  function createLivePartyNotification({
    type,
    partyId,
    party,
    player,
    logLabel
  }) {
    const actor = getPartyNotificationActor(player);
    return {
      id: `live:${type}:${partyId}:${getPartyPlayerId(player) || actor.username}`,
      type,
      partyId,
      modeName: getPartyNotificationModeName(party, logLabel),
      actorAccountId: actor.accountId,
      actorUsername: actor.username,
      actorOeIcon: actor.oeIcon,
      createdAt: new Date()
    };
  }

  function emitPartyHostChanged({
    partyId,
    party,
    previousHostId,
    newHostPlayer,
    logLabel
  }) {
    if (!partyId || !newHostPlayer) return;

    const newHostId = getPartyPlayerId(newHostPlayer);
    if (String(newHostId || '') === String(previousHostId || '')) return;

    io.to(partyId).emit('host-changed', {
      previousHostId,
      hostComputerId: newHostId,
      username: newHostPlayer.identity?.username || newHostPlayer.username,
      notification: createLivePartyNotification({
        type: 'party_host_changed',
        partyId,
        party,
        player: newHostPlayer,
        logLabel
      })
    });
  }

  async function repairPartyHost({
    session,
    waitingRoomModel,
    chatLogSession,
    ignoreComputerId = null
  }) {
    const state = session.state;
    if (!state) return null;

    const previousHostId = state.hostComputerId ?? null;
    const players = Array.isArray(session.players) ? session.players : [];
    const currentHost = players.find(
      (player) =>
        previousHostId &&
        String(getPartyPlayerId(player)) === String(previousHostId)
    );
    const currentHostWasRemoved =
      ignoreComputerId && String(previousHostId) === String(ignoreComputerId);

    // Joining a party or refreshing a socket must never transfer host ownership.
    // Only elect a replacement after the current host actually leaves/disconnects,
    // or when the party has no valid host yet.
    if (currentHost && !currentHostWasRemoved) {
      const playerIds = players
        .map((player) => getPartyPlayerId(player))
        .filter(Boolean);
      const existingHostOrder = Array.isArray(state.hostComputerIdList)
        ? state.hostComputerIdList
        : [];
      state.hostComputerIdList = [
        ...new Set([previousHostId, ...existingHostOrder, ...playerIds])
      ].filter((candidateComputerId) =>
        players.some(
          (player) =>
            String(getPartyPlayerId(player)) === String(candidateComputerId)
        )
      );
      state.hostComputerId = previousHostId;
      state.lastPinged = new Date();

      await syncWaitingRoomHostState({
        waitingRoomModel,
        partyId: session.partyId,
        state
      });

      return {
        previousHostId,
        hostComputerId: state.hostComputerId,
        hostChanged: false,
        newHostPlayer: currentHost
      };
    }

    const { candidateComputerId, candidate, hostList } = getLiveHostCandidate({
      session,
      ignoreComputerId
    });

    state.hostComputerIdList = hostList;
    state.hostComputerId = candidateComputerId ?? null;
    state.lastPinged = new Date();

    appendHostChangedChat(chatLogSession, previousHostId, candidate);
    await syncWaitingRoomHostState({
      waitingRoomModel,
      partyId: session.partyId,
      state
    });

    return {
      previousHostId,
      hostComputerId: state.hostComputerId,
      hostChanged:
        Boolean(candidate) &&
        String(candidateComputerId || '') !== String(previousHostId || ''),
      newHostPlayer: candidate
    };
  }

  async function repairPartyHostForParty({
    partyId,
    mainModel,
    waitingRoomModel,
    chatLogSession,
    ignoreComputerId = null
  }) {
    const session = await mainModel
      .findOne({ partyId })
      .select('+players.identity.guestIdHash');
    if (!session) return null;

    await repairPartyHost({
      session,
      waitingRoomModel,
      chatLogSession,
      ignoreComputerId
    });

    await session.save();
    return withoutGuestHashes(session);
  }

  return {
    getLiveHostCandidate,
    syncWaitingRoomHostState,
    appendHostChangedChat,
    createLivePartyNotification,
    emitPartyHostChanged,
    repairPartyHost,
    repairPartyHostForParty
  };
}

module.exports = { createPartyHostRepairTools };

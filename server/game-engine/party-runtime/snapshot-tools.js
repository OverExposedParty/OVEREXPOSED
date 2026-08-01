function createPartySnapshotTools(context) {
  const {
    cloneSerializable,
    getPartyConfigDoc,
    getPartyStateDoc,
    getPartyDeckDoc,
    getPartyPlayersDoc,
    getPartyPlayerId
  } = context;

  function mergePlayerState(basePlayer = {}, incomingPlayer = {}) {
    const baseIdentity = cloneSerializable(basePlayer.identity) || {};
    const mergedPlayer = {
      ...cloneSerializable(basePlayer),
      ...cloneSerializable(incomingPlayer)
    };

    mergedPlayer.identity = {
      ...baseIdentity,
      ...(cloneSerializable(incomingPlayer.identity) || {})
    };
    [
      'computerId',
      'accountId',
      'guestIdHash',
      'partyOwnerIdHash',
      'accountLinkedAt',
      'accountLinkSource'
    ].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(baseIdentity, key)) {
        mergedPlayer.identity[key] = baseIdentity[key];
      } else {
        delete mergedPlayer.identity[key];
      }
    });
    mergedPlayer.connection = {
      ...(cloneSerializable(basePlayer.connection) || {}),
      ...(cloneSerializable(incomingPlayer.connection) || {})
    };
    mergedPlayer.state = {
      ...(cloneSerializable(basePlayer.state) || {}),
      ...(cloneSerializable(incomingPlayer.state) || {})
    };
    if (
      Object.prototype.hasOwnProperty.call(basePlayer.state || {}, 'roleKey')
    ) {
      mergedPlayer.state.roleKey = basePlayer.state.roleKey;
    } else {
      delete mergedPlayer.state.roleKey;
    }
    delete mergedPlayer.state.role;

    return mergedPlayer;
  }

  function applyPartyPatchesToSnapshot(
    workingParty,
    payload = {},
    { hasDeck = true } = {}
  ) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck });
    const players = getPartyPlayersDoc(workingParty);

    if (payload.configPatch && typeof payload.configPatch === 'object') {
      Object.assign(config, cloneSerializable(payload.configPatch));
    }

    if (payload.statePatch && typeof payload.statePatch === 'object') {
      Object.assign(state, cloneSerializable(payload.statePatch));
    }

    if (deck && payload.deckPatch && typeof payload.deckPatch === 'object') {
      Object.assign(deck, cloneSerializable(payload.deckPatch));
    }

    if (Array.isArray(payload.playerUpdates)) {
      const playersById = new Map();
      players.forEach((player, index) => {
        const id = getPartyPlayerId(player);
        if (id) {
          playersById.set(id, index);
        }
      });

      payload.playerUpdates.forEach((update) => {
        const updateId =
          update?.computerId ?? update?.identity?.computerId ?? null;
        if (!updateId) return;

        const updatePayload = cloneSerializable(update);
        delete updatePayload.computerId;

        const existingIndex = playersById.get(updateId);
        if (existingIndex === undefined) {
          const nextPlayer = mergePlayerState(
            { identity: { computerId: updateId } },
            updatePayload
          );
          players.push(nextPlayer);
          playersById.set(updateId, players.length - 1);
          return;
        }

        players[existingIndex] = mergePlayerState(
          players[existingIndex],
          updatePayload
        );
      });
    }

    return workingParty;
  }

  function assertActorCanControlParty(party, actorId, allowBypass = false) {
    if (allowBypass) return;

    const state = getPartyStateDoc(party);
    const hostId = state.hostComputerId ?? null;

    if (!hostId || !actorId || String(hostId) !== String(actorId)) {
      const error = new Error('Only the host can perform this action.');
      error.status = 403;
      throw error;
    }
  }

  return {
    mergePlayerState,
    applyPartyPatchesToSnapshot,
    assertActorCanControlParty
  };
}

function createTimelineAppender({
  gamemode,
  config,
  workingParty,
  state,
  getPartyPlayerId,
  getTimelinePlayerName,
  getTimelinePlayerIcon,
  comparePreviousEvent
}) {
  return function appendTimelineEvent({
    type,
    player = null,
    playerId = null,
    questionType = null,
    targetIds = null,
    punishmentType = null
  } = {}) {
    if ((config.gamemode || workingParty.gamemode) !== gamemode) return;
    if (!Array.isArray(state.roundTimeline)) state.roundTimeline = [];

    const resolvedPlayerId =
      playerId ?? (player ? getPartyPlayerId(player) : null);
    const event = { type, at: Date.now() };

    if (resolvedPlayerId) event.playerId = resolvedPlayerId;
    if (player) {
      event.playerName = getTimelinePlayerName(player);
      event.playerIcon = getTimelinePlayerIcon(player);
    }
    if (questionType) event.questionType = questionType;
    if (Array.isArray(targetIds)) event.targetIds = targetIds.filter(Boolean);
    if (punishmentType) event.punishmentType = punishmentType;

    const previousEvent = state.roundTimeline[state.roundTimeline.length - 1];
    if (comparePreviousEvent(previousEvent, event)) {
      state.roundTimeline.push(event);
    }
  };
}

function createPartyActionSnapshotTools({
  config,
  state,
  workingParty,
  players,
  getPartyPlayerId,
  getPartyPlayerState
}) {
  const ensureAchievementData = () => {
    if (!state.achievementData || typeof state.achievementData !== 'object') {
      state.achievementData = {};
    }
    return state.achievementData;
  };
  const markSkippedAchievement = () => {
    ensureAchievementData().skipOccurred = true;
  };
  const getScore = (player) =>
    Number(getPartyPlayerState(player).score ?? player.score) || 0;
  const getStandingPlayerIds = (selectScore) => {
    const scoredPlayers = players
      .map((player) => ({
        playerId: getPartyPlayerId(player),
        score: getScore(player)
      }))
      .filter(({ playerId }) => playerId);
    if (scoredPlayers.length === 0) return [];

    const standingScore = selectScore(scoredPlayers.map(({ score }) => score));
    return scoredPlayers
      .filter(({ score }) => score === standingScore)
      .map(({ playerId }) => String(playerId));
  };
  const createGameOverPlayerSnapshot = () =>
    players
      .map((player) => {
        const playerId = getPartyPlayerId(player);
        if (!playerId) return null;
        const username =
          player?.identity?.username ||
          player?.username ||
          player?.profile?.username ||
          player?.name ||
          'Player';
        const userIcon =
          player?.identity?.userIcon ||
          player?.userIcon ||
          player?.profile?.oeIcon ||
          null;
        const score = getScore(player);

        return {
          identity: {
            computerId: playerId,
            username,
            userIcon
          },
          username,
          userIcon,
          state: { score },
          score
        };
      })
      .filter(Boolean);
  const getTimelinePlayerName = (player) =>
    player?.username ||
    player?.identity?.username ||
    player?.profile?.username ||
    player?.name ||
    'Player';
  const getTimelinePlayerIcon = (player) =>
    player?.identity?.userIcon ||
    player?.userIcon ||
    player?.profile?.oeIcon ||
    null;
  const createQuestionTimelineAppender = (gamemode) =>
    createTimelineAppender({
      gamemode,
      config,
      workingParty,
      state,
      getPartyPlayerId,
      getTimelinePlayerName,
      getTimelinePlayerIcon,
      comparePreviousEvent: (previousEvent, event) =>
        previousEvent?.type !== event.type
    });

  const appendTruthOrDareTimelineEvent = createTimelineAppender({
    gamemode: 'truth-or-dare',
    config,
    workingParty,
    state,
    getPartyPlayerId,
    getTimelinePlayerName,
    getTimelinePlayerIcon,
    comparePreviousEvent: (previousEvent, event) => {
      const previousSignature = previousEvent
        ? [
            previousEvent.type,
            previousEvent.playerId,
            previousEvent.questionType,
            previousEvent.punishmentType
          ].join(':')
        : null;
      const eventSignature = [
        event.type,
        event.playerId,
        event.questionType,
        event.punishmentType
      ].join(':');
      return previousSignature !== eventSignature;
    }
  });
  const appendNeverHaveIEverTimelineEvent =
    createQuestionTimelineAppender('never-have-i-ever');
  const appendWouldYouRatherTimelineEvent =
    createQuestionTimelineAppender('would-you-rather');
  const appendMostLikelyToTimelineEvent =
    createQuestionTimelineAppender('most-likely-to');
  const appendParanoiaTimelineEvent =
    createQuestionTimelineAppender('paranoia');

  const getCurrentRoundPlayers = () => {
    const roundParticipantIds = new Set(
      (state.roundParticipantIds || []).map(String)
    );
    return players.filter((player) => {
      const playerState = getPartyPlayerState(player);
      const playerId = getPartyPlayerId(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      return (
        socketId !== 'DISCONNECTED' &&
        playerState.participationStatus !== 'pending_next_round' &&
        (roundParticipantIds.size === 0 ||
          roundParticipantIds.has(String(playerId)))
      );
    });
  };

  return {
    ensureAchievementData,
    markSkippedAchievement,
    getStandingPlayerIds,
    createGameOverPlayerSnapshot,
    getTimelinePlayerName,
    getTimelinePlayerIcon,
    appendTruthOrDareTimelineEvent,
    appendNeverHaveIEverTimelineEvent,
    appendWouldYouRatherTimelineEvent,
    appendMostLikelyToTimelineEvent,
    appendParanoiaTimelineEvent,
    getCurrentRoundPlayers
  };
}

module.exports = {
  createPartySnapshotTools,
  createPartyActionSnapshotTools
};

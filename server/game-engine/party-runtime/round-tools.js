function createPartyRoundTools(context) {
  const {
    getPartyConfigDoc,
    getPartyStateDoc,
    completeRoundProgress,
    getPartyPlayerState,
    getPartyPlayerId,
    getPartyDeckDoc,
    getPartyPlayersDoc,
    getTurnPlayer,
    getTurnPlayerIndex,
    getPlayerTurnOrder,
    advancePlayerTurn
  } = context;

  function getPartyInstruction(party) {
    const config = getPartyConfigDoc(party);
    const state = getPartyStateDoc(party);
    return (
      config.userInstructions ??
      state.userInstructions ??
      party.userInstructions ??
      ''
    );
  }

  function getPartyRuleValue(config, key, fallback = null) {
    const rules = config?.gameRules;
    if (!rules) return fallback;
    if (typeof rules.get === 'function') {
      const value = rules.get(key);
      return value ?? fallback;
    }
    if (Object.prototype.hasOwnProperty.call(rules, key)) {
      return rules[key];
    }
    return fallback;
  }

  function completeConfiguredRound(workingParty, shouldCount = true) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    return completeRoundProgress({
      gamemode: config.gamemode || workingParty.gamemode,
      config,
      state,
      shouldCount
    });
  }

  function getVoteCountForTarget(players, targetId) {
    return players.filter((player) => {
      const playerState = getPartyPlayerState(player);
      return playerState.vote === targetId || player.vote === targetId;
    }).length;
  }

  function getMostLikelyToHighestVoteValue(players) {
    const voteCounts = players.map((player) => {
      const playerId = getPartyPlayerId(player);
      return getVoteCountForTarget(players, playerId);
    });

    if (voteCounts.length === 0) return 0;

    const maxVote = Math.max(...voteCounts);
    const occurrences = voteCounts.filter((value) => value === maxVote).length;
    return occurrences > 1 ? -maxVote : maxVote;
  }

  function getMostLikelyToHighestVotedIds(players) {
    const highestVoteValue = Math.abs(getMostLikelyToHighestVoteValue(players));

    return players
      .filter((player) => {
        const playerId = getPartyPlayerId(player);
        return getVoteCountForTarget(players, playerId) === highestVoteValue;
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);
  }

  function getMostLikelyToEnabledPunishments(config) {
    const rules = config?.gameRules;
    const entries =
      rules instanceof Map
        ? Array.from(rules.entries())
        : Object.entries(rules || {});

    return entries
      .filter(([, value]) => value === true || value === 'true')
      .map(([key]) => key)
      .filter((key) => !/\d/.test(key));
  }

  function applyMostLikelyToRoundReset({
    workingParty,
    incrementScore = 0,
    playerIndex = null,
    nextPlayer = true,
    timer = null
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

    const playerTurn = state.playerTurn ?? 0;
    let resolvedPlayerIndex = playerIndex;

    if (resolvedPlayerIndex == null) {
      resolvedPlayerIndex = playerTurn;
    }

    if (resolvedPlayerIndex >= 0 && resolvedPlayerIndex < players.length) {
      const target = players[resolvedPlayerIndex];
      const targetState = getPartyPlayerState(target);
      targetState.score =
        (targetState.score ?? target.score ?? 0) + incrementScore;
      target.score = targetState.score;
    }

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

    if (nextPlayer && players.length > 0) {
      state.playerTurn = (playerTurn + 1) % players.length;
    }

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      if (
        playerState.participationStatus === 'pending_next_round' &&
        (player.connection?.socketId ?? player.socketId) !== 'DISCONNECTED'
      ) {
        playerState.participationStatus = 'active';
      }
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    state.roundParticipantIds = players
      .filter((player) => {
        const status = getPartyPlayerState(player).participationStatus;
        const socketId = player.connection?.socketId ?? player.socketId;
        return (
          status !== 'disconnected' &&
          status !== 'reconnecting' &&
          status !== 'pending_next_round' &&
          socketId !== 'DISCONNECTED'
        );
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);
    state.roundTimeline = [
      { type: 'question-shown', at: Date.now() },
      { type: 'players-voting', at: Date.now() + 1 }
    ];

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.lastPinged = new Date();
    completeConfiguredRound(workingParty);
  }

  function applyParanoiaRoundReset({
    workingParty,
    incrementScore = 0,
    currentPlayerIndex = null,
    nextPlayer = true,
    timer = null
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

    if (players.length === 0) return;

    const playerTurn = state.playerTurn ?? 0;
    let resolvedPlayerIndex = currentPlayerIndex;

    if (resolvedPlayerIndex == null) {
      const turnPlayer = getTurnPlayer(players, state, playerTurn);
      const votedId =
        getPartyPlayerState(turnPlayer).vote ?? turnPlayer?.vote ?? null;
      if (votedId == null) {
        resolvedPlayerIndex = getTurnPlayerIndex(players, state, playerTurn);
      } else {
        const votedIndex = players.findIndex(
          (player) => getPartyPlayerId(player) === votedId
        );
        resolvedPlayerIndex =
          votedIndex === -1
            ? getTurnPlayerIndex(players, state, playerTurn)
            : votedIndex;
      }
    }

    if (resolvedPlayerIndex >= 0 && resolvedPlayerIndex < players.length) {
      const target = players[resolvedPlayerIndex];
      const targetState = getPartyPlayerState(target);
      targetState.score =
        (targetState.score ?? target.score ?? 0) + incrementScore;
      target.score = targetState.score;
    }

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

    let completedTurnCycle = false;
    if (nextPlayer && players.length > 0) {
      const turnOrder = getPlayerTurnOrder(state, players);
      const normalizedTurn =
        turnOrder.length > 0
          ? ((playerTurn % turnOrder.length) + turnOrder.length) %
            turnOrder.length
          : 0;
      completedTurnCycle =
        turnOrder.length > 0 && normalizedTurn === turnOrder.length - 1;
      advancePlayerTurn(state, players);
    }

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      if (
        playerState.participationStatus === 'pending_next_round' &&
        (player.connection?.socketId ?? player.socketId) !== 'DISCONNECTED'
      ) {
        playerState.participationStatus = 'active';
      }
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    state.roundParticipantIds = players
      .filter((player) => {
        const status = getPartyPlayerState(player).participationStatus;
        const socketId = player.connection?.socketId ?? player.socketId;
        return (
          status !== 'disconnected' &&
          status !== 'reconnecting' &&
          status !== 'pending_next_round' &&
          socketId !== 'DISCONNECTED'
        );
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);
    getPlayerTurnOrder(state, players);
    const nextSelector = getTurnPlayer(players, state, state.playerTurn ?? 0);
    const nextSelectorId = nextSelector ? getPartyPlayerId(nextSelector) : null;
    state.roundTimeline = [
      {
        type: 'question-shown',
        at: Date.now(),
        ...(nextSelectorId ? { playerId: nextSelectorId } : {})
      },
      {
        type: 'target-selection',
        at: Date.now() + 1,
        ...(nextSelectorId ? { playerId: nextSelectorId } : {})
      }
    ];

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
    state.lastPinged = new Date();
    completeConfiguredRound(workingParty, completedTurnCycle);
  }

  return {
    getPartyInstruction,
    getPartyRuleValue,
    completeConfiguredRound,
    getVoteCountForTarget,
    getMostLikelyToHighestVoteValue,
    getMostLikelyToHighestVotedIds,
    getMostLikelyToEnabledPunishments,
    applyMostLikelyToRoundReset,
    applyParanoiaRoundReset
  };
}

module.exports = { createPartyRoundTools };

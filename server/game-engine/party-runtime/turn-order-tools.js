function createPartyTurnOrderTools(context) {
  const {
    getPartyConfigDoc,
    PLAYER_TURN_ORDER_GAMEMODES,
    getPartyPlayerState,
    getPartyPlayerId,
    ONLINE_GAMEMODE_MIN_PLAYERS,
    ONLINE_GAMEMODE_MAX_PLAYERS,
    formatGamemodeName
  } = context;

  function shuffleValues(values = []) {
    const shuffled = [...values];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [
        shuffled[randomIndex],
        shuffled[index]
      ];
    }

    return shuffled;
  }

  function shuffleTurnOrderValues(values = []) {
    const shuffled = shuffleValues(values);
    const matchesOriginalOrder =
      values.length > 1 &&
      shuffled.every((value, index) => value === values[index]);

    if (matchesOriginalOrder) {
      const [firstValue] = shuffled.splice(0, 1);
      shuffled.push(firstValue);
    }

    return shuffled;
  }

  function shouldUsePlayerTurnOrder(party) {
    const config = getPartyConfigDoc(party);
    return PLAYER_TURN_ORDER_GAMEMODES.has(config.gamemode || party.gamemode);
  }

  function getPlayerTurnOrder(state, players) {
    const hasParticipantSnapshot =
      Array.isArray(state.roundParticipantIds) &&
      (state.roundParticipantIds.length > 0 ||
        players.some((player) => {
          const status = getPartyPlayerState(player).participationStatus;
          return status && status !== 'active';
        }));
    const participantIds = hasParticipantSnapshot
      ? new Set(state.roundParticipantIds.map(String))
      : null;
    const playerIds = players
      .filter((player) => {
        const playerId = getPartyPlayerId(player);
        return !participantIds || participantIds.has(String(playerId));
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);

    const existingOrder = Array.isArray(state.playerTurnOrder)
      ? state.playerTurnOrder.filter(Boolean)
      : [];

    const keptIds = existingOrder.filter((id) => playerIds.includes(id));
    const newIds = playerIds.filter((id) => !keptIds.includes(id));

    state.playerTurnOrder = [...keptIds, ...shuffleValues(newIds)];
    return state.playerTurnOrder;
  }

  function initializePlayerTurnOrder(state, players) {
    state.playerTurnOrder = shuffleTurnOrderValues(
      players.map((player) => getPartyPlayerId(player)).filter(Boolean)
    );
    state.playerTurn = 0;
  }

  function getTurnPlayer(players, state, turnIndex = state.playerTurn ?? 0) {
    const order = getPlayerTurnOrder(state, players);
    if (order.length === 0) return null;

    const safeTurnIndex =
      ((turnIndex % order.length) + order.length) % order.length;
    const playerId = order[safeTurnIndex];
    return (
      players.find((player) => getPartyPlayerId(player) === playerId) ?? null
    );
  }

  function getTurnPlayerIndex(
    players,
    state,
    turnIndex = state.playerTurn ?? 0
  ) {
    const turnPlayer = getTurnPlayer(players, state, turnIndex);
    if (!turnPlayer) return -1;

    const turnPlayerId = getPartyPlayerId(turnPlayer);
    return players.findIndex(
      (player) => getPartyPlayerId(player) === turnPlayerId
    );
  }

  function advancePlayerTurn(state, players) {
    const order = getPlayerTurnOrder(state, players);

    if (order.length === 0) {
      state.playerTurn = 0;
      return;
    }

    state.playerTurn = ((state.playerTurn ?? 0) + 1) % order.length;
  }

  function assertOnlinePlayerRestrictions({ gamemode, players = [] }) {
    const playerCount = Array.isArray(players) ? players.length : 0;
    const minPlayers = ONLINE_GAMEMODE_MIN_PLAYERS[gamemode] ?? null;
    const maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode] ?? null;

    if (minPlayers != null && playerCount < minPlayers) {
      const error = new Error(
        `${formatGamemodeName(gamemode)} needs at least ${minPlayers} players to start.`
      );
      error.status = 400;
      throw error;
    }

    if (maxPlayers != null && playerCount > maxPlayers) {
      const error = new Error(
        `${formatGamemodeName(gamemode)} allows up to ${maxPlayers} players.`
      );
      error.status = 400;
      throw error;
    }
  }

  return {
    shuffleValues,
    shuffleTurnOrderValues,
    shouldUsePlayerTurnOrder,
    getPlayerTurnOrder,
    initializePlayerTurnOrder,
    getTurnPlayer,
    getTurnPlayerIndex,
    advancePlayerTurn,
    assertOnlinePlayerRestrictions
  };
}

module.exports = { createPartyTurnOrderTools };

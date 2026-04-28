const {
  ONLINE_GAMEMODE_MIN_PLAYERS,
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PLAYER_TURN_ORDER_GAMEMODES,
  formatGamemodeName
} = require('../constants');
const {
  assertDisconnectPlayerBody,
  assertJoinPlayerBody,
  assertPartyActionBody,
  assertPartyId,
  assertPartyUpdateBody,
  assertPatchPlayerBody,
  assertRemovePlayerBody,
  parseBeaconBody
} = require('../validation/party-requests');

function createPartyRuntime({ app, io, models, logger }) {
  const { waitingRoomSchema, partyGameChatLogSchema } = models;
  const { debugLog, debugWarn } = logger;
  const socketPartyMemberships = new Map();

  function createDeleteHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const partyCode = req.body?.partyCode ?? req.body?.partyId;
        assertPartyId(partyCode, req.body?.partyCode ? 'partyCode' : 'partyId');

        const deletedMain = await mainModel.findOneAndDelete({
          partyId: partyCode
        });
        await waitingRoomModel.findOneAndDelete({
          partyId: partyCode
        });

        if (!deletedMain) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        debugLog(`✅ ${logLabel} ${partyCode} deleted via beacon`);
        res.apiSuccess({
          message: `${logLabel} deleted successfully`,
          deleted: deletedMain
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error deleting ${logLabel.toLowerCase()} on unload:`,
          err
        );
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_delete_on_unload_failed',
          message: err.message || `Failed to delete ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  function createDeleteQueryHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.delete(route, async (req, res) => {
      try {
        const { partyCode } = req.query;
        assertPartyId(partyCode, 'partyCode');

        const deletedMain = await mainModel.findOneAndDelete({
          partyId: partyCode
        });
        await waitingRoomModel.findOneAndDelete({
          partyId: partyCode
        });

        if (!deletedMain) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        debugLog(`✅ ${logLabel} ${partyCode} deleted`);
        res.apiSuccess({
          message: `${logLabel} deleted successfully`,
          deleted: deletedMain
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error deleting ${logLabel.toLowerCase()}:`,
          err
        );
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_delete_failed',
          message: err.message || `Failed to delete ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  function cloneSerializable(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function getPartyConfigDoc(party) {
    if (!party.config || typeof party.config !== 'object') {
      party.config = {};
    }
    return party.config;
  }

  function getPartyStateDoc(party) {
    if (!party.state || typeof party.state !== 'object') {
      party.state = {};
    }
    return party.state;
  }

  function getPartyDeckDoc(party, { hasDeck = true } = {}) {
    if (!hasDeck) return null;
    if (!party.deck || typeof party.deck !== 'object') {
      party.deck = {};
    }
    return party.deck;
  }

  function getPartyPlayersDoc(party) {
    if (!Array.isArray(party.players)) {
      party.players = [];
    }
    return party.players;
  }

  function getPartyPlayerId(player) {
    return player?.identity?.computerId ?? player?.computerId ?? null;
  }

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
    const playerIds = players
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

  function getPartyPlayerState(player) {
    if (!player.state || typeof player.state !== 'object') {
      player.state = {};
    }
    return player.state;
  }

  function ensurePartyPlayerConnection(player) {
    if (!player.connection || typeof player.connection !== 'object') {
      player.connection = {
        socketId: player?.socketId ?? null,
        lastPing: new Date()
      };
    }
    return player.connection;
  }

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
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.lastPinged = new Date();
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

    if (nextPlayer && players.length > 0) {
      advancePlayerTurn(state, players);
    }

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD:READING_CARD';
    state.lastPinged = new Date();
  }

  function applyWouldYouRatherRoundReset({
    workingParty,
    winningVote = null,
    timer = null
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const socketId = player.connection?.socketId ?? player.socketId;
      const vote = playerState.vote ?? player.vote ?? null;

      if (winningVote && vote === winningVote && socketId !== 'DISCONNECTED') {
        const nextScore = (playerState.score ?? player.score ?? 0) + 1;
        playerState.score = nextScore;
        player.score = nextScore;
      }

      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;
    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.lastPinged = new Date();
  }

  function applyNeverHaveIEverRoundReset({
    workingParty,
    timer = null,
    nextPlayer = true
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

    if (nextPlayer && players.length > 0) {
      const playerTurn = state.playerTurn ?? 0;
      state.playerTurn = (playerTurn + 1) % players.length;
    }

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.lastPinged = new Date();
  }

  function getTruthOrDareEnabledPunishments(config = {}) {
    const rules =
      config.gameRules instanceof Map
        ? Object.fromEntries(config.gameRules)
        : config.gameRules || {};

    return Object.entries(rules)
      .filter(([ruleKey, value]) => {
        const isEnabled = value === true || value === 'true';
        if (!isEnabled) return false;
        if (/\d/.test(ruleKey)) return false;
        if (ruleKey === 'truth-or-dare-text-box') return false;
        return true;
      })
      .map(([ruleKey]) => ruleKey);
  }

  function applyTruthOrDareRoundReset({
    workingParty,
    incrementScore = 0,
    nextPlayer = true,
    timer = null
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const players = getPartyPlayersDoc(workingParty);

    const playerTurn = state.playerTurn ?? 0;
    const currentPlayer = getTurnPlayer(players, state, playerTurn);
    if (currentPlayer) {
      const currentPlayerState = getPartyPlayerState(currentPlayer);
      currentPlayerState.score =
        (currentPlayerState.score ?? currentPlayer.score ?? 0) + incrementScore;
      currentPlayer.score = currentPlayerState.score;
    }

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      player.isReady = false;
      player.hasConfirmed = false;
    });

    if (nextPlayer && players.length > 0) {
      advancePlayerTurn(state, players);
    }

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
    state.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
    state.lastPinged = new Date();
  }

  function applyImposterRoundReset({
    workingParty,
    nextPlayer = true,
    timer = null,
    resetInstruction = 'DISPLAY_START_TIMER',
    alternativeQuestionIndex = null
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;

    if (
      alternativeQuestionIndex !== null &&
      alternativeQuestionIndex !== undefined
    ) {
      deck.alternativeQuestionIndex = alternativeQuestionIndex;
    }

    if (nextPlayer && players.length > 0) {
      state.playerTurn = Math.floor(Math.random() * players.length);
    }

    state.round = 0;
    state.roundPlayerTurn = 0;

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      playerState.isReady = false;
      playerState.hasConfirmed = false;
      playerState.vote = null;
      player.isReady = false;
      player.hasConfirmed = false;
      player.vote = null;
    });

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = resetInstruction;
    state.userInstructions = resetInstruction;
    state.lastPinged = new Date();
  }

  function getMostFrequentNonTiedVote(votes = []) {
    const counts = new Map();
    votes.filter(Boolean).forEach((vote) => {
      counts.set(vote, (counts.get(vote) ?? 0) + 1);
    });

    let maxCount = 0;
    let maxVote = '';
    let isTie = false;

    counts.forEach((count, vote) => {
      if (count > maxCount) {
        maxCount = count;
        maxVote = vote;
        isTie = false;
      } else if (count === maxCount) {
        isTie = true;
      }
    });

    return isTie ? '' : maxVote;
  }

  function getMafiaNightVote(players = []) {
    const mafiosoRoles = new Set(['mafioso', 'godfather']);
    const votes = players
      .filter((player) => mafiosoRoles.has(getPartyPlayerState(player).role))
      .map((player) => getPartyPlayerState(player).vote ?? player.vote)
      .filter(Boolean);

    return getMostFrequentNonTiedVote(votes);
  }

  function getMafiaTownVote(players = []) {
    const votes = players
      .filter(
        (player) =>
          (getPartyPlayerState(player).status ?? player.status) === 'alive'
      )
      .map((player) => getPartyPlayerState(player).vote ?? player.vote)
      .filter(Boolean);

    return getMostFrequentNonTiedVote(votes);
  }

  function evaluateMafiaGameOver(players = []) {
    const civilianRoles = new Set(['civilian', 'mayor']);
    const mafiosoRoles = new Set(['mafioso', 'godfather']);
    const neutralRoles = new Set(['lawyer', 'serial killer']);

    const alive = players.filter(
      (player) =>
        (getPartyPlayerState(player).status ?? player.status) === 'alive'
    );
    const civilians = alive.filter((player) =>
      civilianRoles.has(getPartyPlayerState(player).role)
    );
    const mafia = alive.filter((player) =>
      mafiosoRoles.has(getPartyPlayerState(player).role)
    );
    const neutrals = alive.filter((player) =>
      neutralRoles.has(getPartyPlayerState(player).role)
    );
    const serialKillers = alive.filter(
      (player) => getPartyPlayerState(player).role === 'serial killer'
    );

    if (
      mafia.length > 0 &&
      mafia.length >= civilians.length + neutrals.length
    ) {
      return 'DISPLAY_GAMEOVER:MAFIOSO';
    }

    if (mafia.length === 0 && civilians.length > 0) {
      return 'DISPLAY_GAMEOVER:CIVILIAN';
    }

    if (serialKillers.length === 1 && alive.length === 1) {
      return 'DISPLAY_GAMEOVER:SERIAL_KILLER';
    }

    if (alive.length === 0) {
      return 'DISPLAY_GAMEOVER:DRAW';
    }

    return null;
  }

  function resetMafiaVotes(players = []) {
    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      const status = playerState.status ?? player.status;
      if (status === 'alive') {
        playerState.vote = null;
        player.vote = null;
      }
      playerState.hasConfirmed = false;
      playerState.isReady = false;
      player.hasConfirmed = false;
      player.isReady = false;
    });
  }

  function mergePlayerState(basePlayer = {}, incomingPlayer = {}) {
    const mergedPlayer = {
      ...cloneSerializable(basePlayer),
      ...cloneSerializable(incomingPlayer)
    };

    mergedPlayer.identity = {
      ...(cloneSerializable(basePlayer.identity) || {}),
      ...(cloneSerializable(incomingPlayer.identity) || {})
    };
    mergedPlayer.connection = {
      ...(cloneSerializable(basePlayer.connection) || {}),
      ...(cloneSerializable(incomingPlayer.connection) || {})
    };
    mergedPlayer.state = {
      ...(cloneSerializable(basePlayer.state) || {}),
      ...(cloneSerializable(incomingPlayer.state) || {})
    };

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

  function applyPartyActionToSnapshot({
    party,
    action,
    actorId,
    payload = {},
    hasDeck = true
  }) {
    const workingParty = cloneSerializable(party);
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck });
    const players = getPartyPlayersDoc(workingParty);
    const allowBypass = payload.byPassHost === true;
    const actorIndex = players.findIndex(
      (player) => getPartyPlayerId(player) === actorId
    );
    const actorPlayer = actorIndex !== -1 ? players[actorIndex] : null;

    if (actorPlayer) {
      const connection = ensurePartyPlayerConnection(actorPlayer);
      connection.lastPing = new Date();
      if (payload.socketId) {
        connection.socketId = payload.socketId;
        actorPlayer.socketId = payload.socketId;
      }
    }

    switch (action) {
      case 'start-game': {
        assertActorCanControlParty(workingParty, actorId, false);

        const gamemode = config.gamemode || workingParty.gamemode;

        if (payload.bypassPlayerRestrictions !== true) {
          assertOnlinePlayerRestrictions({ gamemode, players });
        }

        state.isPlaying = true;
        state.lastPinged = new Date();
        state.hostComputerId = state.hostComputerId ?? actorId;
        state.hostComputerIdList = players
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);

        if (shouldUsePlayerTurnOrder(workingParty)) {
          initializePlayerTurnOrder(state, players);
        }
        break;
      }

      case 'send-instruction': {
        assertActorCanControlParty(workingParty, actorId, allowBypass);
        applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

        if (
          payload.updateUsersReady !== null &&
          payload.updateUsersReady !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.isReady = payload.updateUsersReady;
            player.isReady = payload.updateUsersReady;
          });
        }

        if (
          payload.updateUsersConfirmation !== null &&
          payload.updateUsersConfirmation !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.hasConfirmed = payload.updateUsersConfirmation;
            player.hasConfirmed = payload.updateUsersConfirmation;
          });
        }

        if (
          payload.updateUsersVote !== null &&
          payload.updateUsersVote !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.vote = payload.updateUsersVote;
            player.vote = payload.updateUsersVote;
          });
        }

        if (payload.timer !== null && payload.timer !== undefined) {
          state.timer = payload.timer;
        }

        const nextInstruction =
          payload.instruction == null
            ? getPartyInstruction(workingParty)
            : payload.instruction;

        if (nextInstruction != null) {
          config.userInstructions = nextInstruction;
          state.userInstructions = nextInstruction;
        }

        state.isPlaying = payload.isPlaying ?? true;
        state.lastPinged = new Date();
        break;
      }

      case 'end-game': {
        assertActorCanControlParty(workingParty, actorId, false);

        config.userInstructions = 'GAME_OVER';
        state.userInstructions = 'GAME_OVER';
        state.isPlaying = false;
        state.phase = 'game-over';
        state.lastPinged = new Date();
        break;
      }

      case 'set-user-confirmation': {
        const targetIndex = players.findIndex(
          (player) => getPartyPlayerId(player) === payload.selectedDeviceId
        );

        if (targetIndex === -1) {
          const error = new Error('Player not found for confirmation update.');
          error.status = 404;
          throw error;
        }

        const targetPlayer = players[targetIndex];
        const targetState = getPartyPlayerState(targetPlayer);
        const targetConnection = ensurePartyPlayerConnection(targetPlayer);

        targetState.isReady = true;
        targetState.hasConfirmed = payload.option;
        targetPlayer.isReady = true;
        targetPlayer.hasConfirmed = payload.option;
        targetConnection.lastPing = new Date();
        targetPlayer.lastPing = targetConnection.lastPing;

        if (payload.userInstruction != null) {
          const nextInstruction = `${payload.userInstruction}:${payload.reason}`;
          config.userInstructions = nextInstruction;
          state.userInstructions = nextInstruction;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'set-user-bool': {
        const targetPlayer = players.find(
          (player) => getPartyPlayerId(player) === payload.selectedDeviceId
        );

        if (!targetPlayer) {
          const error = new Error('Player not found for state update.');
          error.status = 404;
          throw error;
        }

        const targetState = getPartyPlayerState(targetPlayer);

        if (
          payload.userConfirmation !== null &&
          payload.userConfirmation !== undefined
        ) {
          targetState.hasConfirmed = payload.userConfirmation;
          targetPlayer.hasConfirmed = payload.userConfirmation;
        }

        if (payload.userReady !== null && payload.userReady !== undefined) {
          targetState.isReady = payload.userReady;
          targetPlayer.isReady = payload.userReady;
        }

        const currentInstruction = getPartyInstruction(workingParty);
        if (
          payload.setInstruction == null ||
          currentInstruction.includes(payload.setInstruction)
        ) {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'set-vote': {
        if (!actorPlayer) {
          const error = new Error('Voting player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorPlayer);
        actorState.vote = payload.option;
        actorState.isReady = true;
        actorPlayer.vote = payload.option;
        actorPlayer.isReady = true;

        if (payload.hover === false) {
          actorState.hasConfirmed = true;
          actorPlayer.hasConfirmed = true;
        }

        if (payload.sendInstruction != null) {
          config.userInstructions = payload.sendInstruction;
          state.userInstructions = payload.sendInstruction;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'set-bool-vote': {
        if (!actorPlayer) {
          const error = new Error('Voting player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorPlayer);
        actorState.vote = payload.bool;
        actorState.hasConfirmed = true;
        actorPlayer.vote = payload.bool;
        actorPlayer.hasConfirmed = true;

        state.lastPinged = new Date();
        break;
      }

      case 'reset-question': {
        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (deck) {
          const currentCardIndex =
            deck.currentCardIndex ?? workingParty.currentCardIndex ?? 0;
          deck.currentCardIndex = currentCardIndex + 1;
        }

        if (state.playerTurn !== undefined && state.playerTurn !== null) {
          const currentPlayer = shouldUsePlayerTurnOrder(workingParty)
            ? getTurnPlayer(players, state, state.playerTurn)
            : players[state.playerTurn];
          if (currentPlayer) {
            const currentPlayerState = getPartyPlayerState(currentPlayer);
            currentPlayerState.score =
              (currentPlayerState.score ?? currentPlayer.score ?? 0) +
              (payload.incrementScore ?? 0);
            currentPlayer.score = currentPlayerState.score;
          }
        } else if (
          payload.playerIndex !== null &&
          payload.playerIndex !== undefined
        ) {
          const selectedPlayer = players[payload.playerIndex];
          if (selectedPlayer) {
            const selectedPlayerState = getPartyPlayerState(selectedPlayer);
            selectedPlayerState.score =
              (selectedPlayerState.score ?? selectedPlayer.score ?? 0) +
              (payload.incrementScore ?? 0);
            selectedPlayer.score = selectedPlayerState.score;
          }
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = false;
          playerState.hasConfirmed = false;
          playerState.vote = null;
          player.isReady = false;
          player.hasConfirmed = false;
          player.vote = null;
        });

        if (payload.timer !== null && payload.timer !== undefined) {
          state.timer = payload.timer;
        }

        if (
          payload.nextPlayer &&
          players.length > 0 &&
          state.playerTurn !== undefined &&
          state.playerTurn !== null
        ) {
          if (shouldUsePlayerTurnOrder(workingParty)) {
            advancePlayerTurn(state, players);
          } else {
            state.playerTurn = (state.playerTurn + 1) % players.length;
          }
        }

        state.phase = null;
        state.phaseData = null;

        if (payload.instruction != null) {
          const resetInstruction =
            (config.gamemode || workingParty.gamemode) === 'paranoia' &&
            payload.nextPlayer === true &&
            String(payload.instruction).includes('DISPLAY_PRIVATE_CARD')
              ? 'DISPLAY_PRIVATE_CARD:READING_CARD'
              : payload.instruction;

          config.userInstructions = resetInstruction;
          state.userInstructions = resetInstruction;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'party-restart': {
        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const gamemode = config.gamemode || workingParty.gamemode;
        let restartInstruction = 'DISPLAY_PRIVATE_CARD';

        if (gamemode === 'truth-or-dare') {
          restartInstruction = 'DISPLAY_SELECT_QUESTION_TYPE';
        } else if (gamemode === 'paranoia') {
          restartInstruction = 'DISPLAY_PRIVATE_CARD:READING_CARD';
        } else if (gamemode === 'imposter') {
          restartInstruction =
            typeof payload.resetGamemodeInstruction === 'string' &&
            payload.resetGamemodeInstruction
              ? payload.resetGamemodeInstruction
              : 'DISPLAY_PRIVATE_CARD';
        }

        if (deck) {
          deck.currentCardIndex = 0;
          deck.currentCardSecondIndex = 0;
          deck.alternativeQuestionIndex = 0;
          if (deck.questionType !== undefined) {
            deck.questionType = 'truth';
          }
        }

        state.isPlaying = true;
        state.playerTurn = 0;
        if (shouldUsePlayerTurnOrder(workingParty)) {
          initializePlayerTurnOrder(state, players);
        }
        state.round = 0;
        state.roundPlayerTurn = 0;
        state.vote = null;
        state.lastPinged = new Date();

        const gameTimeLimit =
          Number(getPartyRuleValue(config, 'time-limit')) ||
          Number(getPartyRuleValue(config, 'imposter-time-limit')) ||
          120;

        state.timer = Date.now() + gameTimeLimit * 1000;
        config.userInstructions = restartInstruction;
        state.userInstructions = restartInstruction;

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = false;
          playerState.hasConfirmed = false;
          playerState.vote = null;
          playerState.score = 0;

          player.isReady = false;
          player.hasConfirmed = false;
          player.vote = null;
          player.score = 0;
        });

        break;
      }

      case 'sync-party-state': {
        applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

        if (payload.touchState !== false) {
          state.lastPinged = new Date();
        }

        break;
      }

      case 'most-likely-to-resolve-vote-results': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const highestValue = getMostLikelyToHighestVoteValue(players);
        const highestVotedIds = new Set(
          getMostLikelyToHighestVotedIds(players)
        );

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isHighestVoted = highestVotedIds.has(playerId);
          const desiredReady = !isHighestVoted;
          const desiredConfirmed = !isHighestVoted;

          playerState.isReady = desiredReady;
          playerState.hasConfirmed = desiredConfirmed;
          player.isReady = desiredReady;
          player.hasConfirmed = desiredConfirmed;

          if (isHighestVoted && highestValue > 0) {
            const nextScore = (playerState.score ?? player.score ?? 0) + 1;
            playerState.score = nextScore;
            player.score = nextScore;
          }
        });

        state.phase = null;
        state.phaseData = null;
        state.lastPinged = new Date();
        break;
      }

      case 'most-likely-to-resolve-tiebreaker': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (state.phase !== 'most-likely-to-tiebreaker') {
          state.lastPinged = new Date();
          break;
        }

        const tiedIds = Array.isArray(payload.tiedIds)
          ? payload.tiedIds.filter(Boolean)
          : [];

        if (tiedIds.length === 0) {
          const error = new Error(
            'tiedIds is required to resolve a tie-breaker.'
          );
          error.status = 400;
          throw error;
        }

        const chosenIndex = Math.floor(Math.random() * tiedIds.length);
        const chosenId = tiedIds[chosenIndex];
        state.phase = 'most-likely-to-choose-punishment';
        state.phaseData = {
          targetId: chosenId
        };
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'never-have-i-ever-resolve-vote-results': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const socketId = player.connection?.socketId ?? player.socketId;
          const vote = playerState.vote ?? player.vote;

          if (vote === true && socketId !== 'DISCONNECTED') {
            const nextScore = (playerState.score ?? player.score ?? 0) + 1;
            playerState.score = nextScore;
            player.score = nextScore;
          }
        });

        const haveVoteCount = players.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === true
        ).length;
        const haveNotVoteCount = players.filter(
          (player) =>
            (getPartyPlayerState(player).vote ?? player.vote) === false
        ).length;

        const oddManOutEnabled =
          getPartyRuleValue(config, 'odd-man-out') === true ||
          getPartyRuleValue(config, 'odd-man-out') === 'true';
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';
        const hasOddManOut =
          (haveVoteCount === 1 && haveNotVoteCount > 1) ||
          (haveNotVoteCount === 1 && haveVoteCount > 1);

        if (!(drinkPunishmentEnabled || oddManOutEnabled)) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        if (oddManOutEnabled && hasOddManOut) {
          const oddVote = haveVoteCount === 1 ? true : false;
          const oddPlayer =
            players.find(
              (player) =>
                (getPartyPlayerState(player).vote ?? player.vote) === oddVote
            ) ?? null;
          const targetId = getPartyPlayerId(oddPlayer);

          if (!targetId) {
            applyNeverHaveIEverRoundReset({
              workingParty,
              timer: payload.roundTimer ?? null,
              nextPlayer: payload.nextPlayer ?? true
            });
            break;
          }

          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            const playerId = getPartyPlayerId(player);
            const isTarget = String(playerId) === String(targetId);
            playerState.isReady = !isTarget;
            playerState.hasConfirmed = !isTarget;
            player.isReady = !isTarget;
            player.hasConfirmed = !isTarget;
          });

          state.phase = 'never-have-i-ever-spin-odd-man-out';
          state.phaseData = {
            targetIds: [targetId],
            punishmentType: 'DRINK_WHEEL'
          };
          state.timer =
            payload.phaseTimer ??
            Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
          state.lastPinged = new Date();
          break;
        }

        if (haveVoteCount === 0) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        const punishedIds = players
          .filter(
            (player) =>
              (getPartyPlayerState(player).vote ?? player.vote) === true
          )
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);

        if (punishedIds.length === 0) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isTarget = punishedIds.includes(playerId);
          playerState.isReady = !isTarget;
          playerState.hasConfirmed = !isTarget;
          player.isReady = !isTarget;
          player.hasConfirmed = !isTarget;
        });

        state.phase = 'never-have-i-ever-show-punishment';
        state.phaseData = {
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP'
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'never-have-i-ever-resolve-drink-wheel': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only the odd-man-out player can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'never-have-i-ever-show-punishment';
        state.phaseData = {
          ...(state.phaseData || {}),
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'never-have-i-ever-complete-punishment': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only punished players can complete this punishment.'
          );
          error.status = 403;
          throw error;
        }

        const actorTarget = players.find(
          (player) => getPartyPlayerId(player) === actorId
        );
        if (!actorTarget) {
          const error = new Error('Punished player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorTarget);
        actorState.isReady = true;
        actorState.hasConfirmed = true;
        actorTarget.isReady = true;
        actorTarget.hasConfirmed = true;

        const allReady = players.every(
          (player) => getPartyPlayerState(player).isReady === true
        );
        if (allReady) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'truth-or-dare-select-question-type': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can choose truth or dare.'
          );
          error.status = 403;
          throw error;
        }

        const questionType = String(payload.questionType || '')
          .trim()
          .toLowerCase();
        if (questionType !== 'truth' && questionType !== 'dare') {
          const error = new Error('questionType must be truth or dare.');
          error.status = 400;
          throw error;
        }

        if (questionType === 'truth') {
          deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;
        } else {
          deck.currentCardSecondIndex = (deck.currentCardSecondIndex ?? 0) + 1;
        }

        deck.questionType = questionType;
        state.phase = null;
        state.phaseData = null;
        state.timer = payload.timer ?? state.timer ?? null;
        config.userInstructions = 'DISPLAY_PUBLIC_CARD';
        state.userInstructions = 'DISPLAY_PUBLIC_CARD';
        state.lastPinged = new Date();
        break;
      }

      case 'truth-or-dare-pass-question': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can pass this question.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentRules = getTruthOrDareEnabledPunishments(config);
        if (punishmentRules.length === 0) {
          applyTruthOrDareRoundReset({
            workingParty,
            incrementScore: 0,
            nextPlayer: true,
            timer: payload.roundTimer ?? null
          });
        } else {
          state.phase = 'truth-or-dare-choose-punishment';
          state.phaseData = {};
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
        }
        break;
      }

      case 'truth-or-dare-select-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can choose the punishment.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'truth-or-dare-show-punishment';
        state.phaseData = { punishmentType };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'truth-or-dare-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'truth-or-dare-show-punishment';
        state.phaseData = { punishmentType };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'truth-or-dare-complete-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can complete the punishment.'
          );
          error.status = 403;
          throw error;
        }

        applyTruthOrDareRoundReset({
          workingParty,
          incrementScore: 0,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      case 'truth-or-dare-handle-card-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const punishmentRules = getTruthOrDareEnabledPunishments(config);
        if (punishmentRules.length === 0) {
          applyTruthOrDareRoundReset({
            workingParty,
            incrementScore: 0,
            nextPlayer: true,
            timer: payload.roundTimer ?? null
          });
        } else {
          state.phase = 'truth-or-dare-choose-punishment';
          state.phaseData = { timedOut: true };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
        }
        break;
      }

      case 'truth-or-dare-handle-punishment-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        applyTruthOrDareRoundReset({
          workingParty,
          incrementScore: 0,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      case 'truth-or-dare-reset-round': {
        if ((config.gamemode || workingParty.gamemode) !== 'truth-or-dare') {
          const error = new Error(
            'This action is only valid for Truth or Dare.'
          );
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);
        const hostId = state.hostComputerId ?? null;
        const force = payload.force === true;

        if (force) {
          if (
            (!turnPlayerId || String(turnPlayerId) !== String(actorId)) &&
            (!hostId || String(hostId) !== String(actorId))
          ) {
            const error = new Error(
              'Only the current player or host can force-reset this round.'
            );
            error.status = 403;
            throw error;
          }

          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.isReady = true;
            playerState.hasConfirmed = true;
            player.isReady = true;
            player.hasConfirmed = true;
          });
        } else {
          const actorPlayer = players.find(
            (player) => getPartyPlayerId(player) === actorId
          );
          if (!actorPlayer) {
            const error = new Error(
              'Player not found for round reset confirmation.'
            );
            error.status = 404;
            throw error;
          }
          const actorState = getPartyPlayerState(actorPlayer);
          actorState.hasConfirmed = true;
          actorPlayer.hasConfirmed = true;
        }

        const allConfirmed = players.every(
          (player) => getPartyPlayerState(player).hasConfirmed === true
        );
        if (allConfirmed) {
          applyTruthOrDareRoundReset({
            workingParty,
            incrementScore: Number(payload.incrementScore ?? 0),
            nextPlayer: payload.nextPlayer !== false,
            timer: payload.timer ?? null
          });
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'imposter-advance-answer-turn': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const currentRoundTurn = state.roundPlayerTurn ?? 0;
        const currentSpeaker = players[currentRoundTurn];
        const currentSpeakerId = getPartyPlayerId(currentSpeaker);
        const hostId = state.hostComputerId ?? null;
        const actorIsCurrentSpeaker =
          currentSpeakerId && String(currentSpeakerId) === String(actorId);
        const actorIsHost = hostId && String(hostId) === String(actorId);

        if (!actorIsCurrentSpeaker && !actorIsHost) {
          const error = new Error(
            'Only the current speaking player or host can advance the turn.'
          );
          error.status = 403;
          throw error;
        }

        const playerCount = players.length;
        if (playerCount === 0) {
          const error = new Error(
            'No players available for Imposter round advancement.'
          );
          error.status = 400;
          throw error;
        }

        const roundsLimit = Number(payload.roundsLimit ?? 5);
        if (
          payload.expectedRound !== undefined &&
          Number(payload.expectedRound) !== Number(state.round ?? 0)
        ) {
          state.lastPinged = new Date();
          break;
        }
        if (
          payload.expectedRoundPlayerTurn !== undefined &&
          Number(payload.expectedRoundPlayerTurn) !== Number(currentRoundTurn)
        ) {
          state.lastPinged = new Date();
          break;
        }

        const nextRoundPlayerTurn = (currentRoundTurn + 1) % playerCount;
        const wrapped = nextRoundPlayerTurn <= currentRoundTurn;
        const nextRound = (state.round ?? 0) + (wrapped ? 1 : 0);

        if (nextRound >= roundsLimit) {
          state.round = 0;
          state.roundPlayerTurn = 0;
          state.phase = null;
          state.phaseData = null;
          state.timer = payload.timer ?? state.timer ?? null;
          config.userInstructions = 'DISPLAY_PRIVATE_CARD';
          state.userInstructions = 'DISPLAY_PRIVATE_CARD';

          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.isReady = true;
            playerState.hasConfirmed = false;
            player.isReady = true;
            player.hasConfirmed = false;
          });
        } else {
          state.round = nextRound;
          state.roundPlayerTurn = nextRoundPlayerTurn;
          state.timer = payload.timer ?? state.timer ?? null;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'imposter-resolve-vote-outcome': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const imposterIndex = state.playerTurn ?? 0;
        const imposter = players[imposterIndex];
        const imposterId = getPartyPlayerId(imposter);

        if (!imposterId) {
          const error = new Error('Imposter player not found.');
          error.status = 404;
          throw error;
        }

        const voteCounts = new Map();
        players.forEach((player) => {
          const targetId =
            getPartyPlayerState(player).vote ?? player.vote ?? null;
          if (!targetId) return;
          voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
        });

        const maxVotes = Math.max(0, ...voteCounts.values());
        const highestVotedIds = [...voteCounts.entries()]
          .filter(([, count]) => count === maxVotes)
          .map(([targetId]) => targetId);
        const imposterCaught =
          maxVotes > 0 &&
          highestVotedIds.includes(imposterId) &&
          highestVotedIds.length === 1;
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';

        if (imposterCaught && drinkPunishmentEnabled) {
          state.phase = 'imposter-choose-punishment';
          state.phaseData = {
            targetId: imposterId
          };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
        } else {
          applyImposterRoundReset({
            workingParty,
            nextPlayer: true,
            timer: payload.roundTimer ?? null,
            resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
            alternativeQuestionIndex: payload.alternativeQuestionIndex
          });
        }
        break;
      }

      case 'imposter-select-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the punished imposter can choose the punishment.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'imposter-show-punishment';
        state.phaseData = {
          targetId,
          punishmentType
        };
        state.lastPinged = new Date();
        break;
      }

      case 'imposter-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the punished imposter can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'imposter-show-punishment';
        state.phaseData = {
          targetId,
          punishmentType
        };
        state.lastPinged = new Date();
        break;
      }

      case 'imposter-complete-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the punished imposter can complete the punishment.'
          );
          error.status = 403;
          throw error;
        }

        applyImposterRoundReset({
          workingParty,
          nextPlayer: true,
          timer: payload.roundTimer ?? null,
          resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
          alternativeQuestionIndex: payload.alternativeQuestionIndex
        });
        break;
      }

      case 'imposter-reset-round': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const hostId = state.hostComputerId ?? null;
        if (!hostId || String(hostId) !== String(actorId)) {
          const error = new Error(
            'Only the host can reset the Imposter round.'
          );
          error.status = 403;
          throw error;
        }

        applyImposterRoundReset({
          workingParty,
          nextPlayer: payload.nextPlayer !== false,
          timer: payload.timer ?? null,
          resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
          alternativeQuestionIndex: payload.alternativeQuestionIndex
        });
        break;
      }

      case 'mafia-start-game': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const shuffledRoles = Array.isArray(payload.shuffledRoles)
          ? payload.shuffledRoles
          : [];
        if (
          shuffledRoles.length === 0 ||
          shuffledRoles.length < players.length
        ) {
          const error = new Error('shuffledRoles is required to start Mafia.');
          error.status = 400;
          throw error;
        }

        players.forEach((player, index) => {
          const playerState = getPartyPlayerState(player);
          playerState.role = shuffledRoles[index] || 'civilian';
          playerState.status = 'alive';
          playerState.vote = null;
          playerState.isReady = false;
          playerState.hasConfirmed = false;
          player.vote = null;
          player.isReady = false;
          player.hasConfirmed = false;
        });

        state.phase = 'night';
        state.timer = payload.timer ?? state.timer ?? null;
        config.userInstructions = 'DISPLAY_ROLE';
        state.userInstructions = 'DISPLAY_ROLE';
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-resolve-night': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        state.phase = 'day';
        resetMafiaVotes(players);

        const mafiaVote = getMafiaNightVote(players);
        config.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
        state.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-finish-player-killed': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const killedId = String(payload.killedId || '').trim();
        if (killedId) {
          const killedPlayer = players.find(
            (player) => getPartyPlayerId(player) === killedId
          );
          if (killedPlayer) {
            const killedState = getPartyPlayerState(killedPlayer);
            killedState.status = 'dead';
            killedPlayer.status = 'dead';
          }
        }

        resetMafiaVotes(players);

        const gameOverInstruction = evaluateMafiaGameOver(players);
        if (gameOverInstruction) {
          config.userInstructions = gameOverInstruction;
          state.userInstructions = gameOverInstruction;
        } else {
          config.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
          state.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
          state.timer = payload.timer ?? state.timer ?? null;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'mafia-resolve-day-vote': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const townVote = getMafiaTownVote(players);
        resetMafiaVotes(players);

        config.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
        state.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-finish-town-vote': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const votedOutId = String(payload.votedOutId || '').trim();
        if (votedOutId) {
          const votedPlayer = players.find(
            (player) => getPartyPlayerId(player) === votedOutId
          );
          if (votedPlayer) {
            const votedState = getPartyPlayerState(votedPlayer);
            votedState.status = 'dead';
            votedPlayer.status = 'dead';
          }
        }

        const gameOverInstruction = evaluateMafiaGameOver(players);
        if (gameOverInstruction) {
          config.userInstructions = gameOverInstruction;
          state.userInstructions = gameOverInstruction;
        } else {
          state.phase = 'night';
          config.userInstructions = 'DISPLAY_NIGHT_PHASE';
          state.userInstructions = 'DISPLAY_NIGHT_PHASE';
          state.timer = payload.timer ?? state.timer ?? null;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'would-you-rather-resolve-vote-results': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const aVoteCount = players.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === 'A'
        ).length;
        const bVoteCount = players.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === 'B'
        ).length;
        const nullVoteCount = players.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) == null
        ).length;
        const winningVote =
          aVoteCount === bVoteCount
            ? null
            : aVoteCount > bVoteCount
              ? 'A'
              : 'B';

        const oddManOutEnabled =
          getPartyRuleValue(config, 'odd-man-out') === true ||
          getPartyRuleValue(config, 'odd-man-out') === 'true';
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';

        if (!drinkPunishmentEnabled) {
          applyWouldYouRatherRoundReset({
            workingParty,
            winningVote,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        if (
          oddManOutEnabled &&
          ((aVoteCount === 1 && bVoteCount > 1) ||
            (bVoteCount === 1 && aVoteCount > 1))
        ) {
          const oddVote = aVoteCount === 1 ? 'A' : 'B';
          const oddPlayer =
            players.find(
              (player) =>
                (getPartyPlayerState(player).vote ?? player.vote) === oddVote
            ) ?? null;
          const targetId = getPartyPlayerId(oddPlayer);

          if (!targetId) {
            applyWouldYouRatherRoundReset({
              workingParty,
              winningVote,
              timer: payload.roundTimer ?? null
            });
            break;
          }

          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            const playerId = getPartyPlayerId(player);
            const isTarget = String(playerId) === String(targetId);
            playerState.isReady = !isTarget;
            playerState.hasConfirmed = !isTarget;
            player.isReady = !isTarget;
            player.hasConfirmed = !isTarget;
          });

          state.phase = 'would-you-rather-spin-odd-man-out';
          state.phaseData = {
            targetIds: [targetId],
            punishmentType: 'DRINK_WHEEL',
            winningVote
          };
          state.timer =
            payload.phaseTimer ??
            Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
          state.lastPinged = new Date();
          break;
        }

        const punishedIds = players
          .filter((player) => {
            const vote =
              getPartyPlayerState(player).vote ?? player.vote ?? null;
            return winningVote == null ? vote == null : vote !== winningVote;
          })
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);

        if (punishedIds.length === 0) {
          applyWouldYouRatherRoundReset({
            workingParty,
            winningVote,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isTarget = punishedIds.includes(playerId);
          playerState.isReady = !isTarget;
          playerState.hasConfirmed = !isTarget;
          player.isReady = !isTarget;
          player.hasConfirmed = !isTarget;
        });

        state.phase = 'would-you-rather-show-punishment';
        state.phaseData = {
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP',
          winningVote
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'would-you-rather-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only the odd-man-out player can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'would-you-rather-show-punishment';
        state.phaseData = {
          ...(state.phaseData || {}),
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'would-you-rather-complete-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];
        const winningVote = state.phaseData?.winningVote ?? null;

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only punished players can complete this punishment.'
          );
          error.status = 403;
          throw error;
        }

        const actorTarget = players.find(
          (player) => getPartyPlayerId(player) === actorId
        );
        if (!actorTarget) {
          const error = new Error('Punished player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorTarget);
        actorState.isReady = true;
        actorState.hasConfirmed = true;
        actorTarget.isReady = true;
        actorTarget.hasConfirmed = true;

        const allReady = players.every(
          (player) => getPartyPlayerState(player).isReady === true
        );
        if (allReady) {
          const nextRoundTimer =
            payload.roundTimer ??
            (payload.nextRoundTimerDurationMs != null
              ? Date.now() + Number(payload.nextRoundTimerDurationMs)
              : null);

          applyWouldYouRatherRoundReset({
            workingParty,
            winningVote,
            timer: nextRoundTimer
          });
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'would-you-rather-handle-phase-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (state.phase === 'would-you-rather-show-punishment') {
          const nextRoundTimer =
            payload.roundTimer ??
            (payload.nextRoundTimerDurationMs != null
              ? Date.now() + Number(payload.nextRoundTimerDurationMs)
              : null);

          applyWouldYouRatherRoundReset({
            workingParty,
            winningVote: state.phaseData?.winningVote ?? null,
            timer: nextRoundTimer
          });
          break;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-select-target': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
          const error = new Error(
            'Only the current player can select a target.'
          );
          error.status = 403;
          throw error;
        }

        const targetId = String(payload.targetId || '').trim();
        if (!targetId) {
          const error = new Error('targetId is required.');
          error.status = 400;
          throw error;
        }

        const actorState = getPartyPlayerState(turnPlayer);
        actorState.vote = targetId;
        actorState.isReady = true;
        actorState.hasConfirmed = true;
        turnPlayer.vote = targetId;
        turnPlayer.isReady = true;
        turnPlayer.hasConfirmed = true;

        state.phase = 'paranoia-choose-punishment';
        state.phaseData = { targetId };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-handle-card-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);

        if (!turnPlayer || !turnPlayerId) {
          const error = new Error(
            'Current player not found for Paranoia timeout.'
          );
          error.status = 404;
          throw error;
        }

        const turnPlayerState = getPartyPlayerState(turnPlayer);
        turnPlayerState.vote = turnPlayerId;
        turnPlayerState.isReady = true;
        turnPlayerState.hasConfirmed = true;
        turnPlayer.vote = turnPlayerId;
        turnPlayer.isReady = true;
        turnPlayer.hasConfirmed = true;

        state.phase = 'paranoia-choose-punishment';
        state.phaseData = {
          targetId: turnPlayerId
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-select-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the selected player can choose the punishment.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'paranoia-show-punishment';
        state.phaseData = {
          targetId,
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the selected player can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'paranoia-show-punishment';
        state.phaseData = {
          targetId,
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-resolve-coin-flip': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the selected player can resolve the coin flip.'
          );
          error.status = 403;
          throw error;
        }

        if (payload.matchedFace === true) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.isReady = false;
            playerState.hasConfirmed = false;
            player.isReady = false;
            player.hasConfirmed = false;
          });

          state.phase = null;
          state.phaseData = {
            targetId,
            revealTargetId: targetId,
            punishmentType: 'lucky-coin-flip'
          };
          state.timer =
            payload.phaseTimer ??
            Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
          config.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
          state.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
        } else {
          state.phase = null;
          state.phaseData = {
            targetId,
            punishmentType: 'lucky-coin-flip',
            completionReason: 'USER_CALLED_WRONG_FACE'
          };
          config.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
          state.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
        }

        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-handle-reveal-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const instruction =
          state.userInstructions ?? config.userInstructions ?? '';
        if (!String(instruction).includes('DISPLAY_DUAL_STACK_CARD')) {
          state.lastPinged = new Date();
          break;
        }

        applyParanoiaRoundReset({
          workingParty,
          incrementScore: 1,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      case 'paranoia-begin-punishment-confirmation': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        const punishmentType = state.phaseData?.punishmentType ?? null;

        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the selected player can start punishment confirmation.'
          );
          error.status = 403;
          throw error;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          playerState.isReady = false;
          playerState.hasConfirmed = false;
          player.isReady = false;
          player.hasConfirmed = false;
        });

        const targetPlayer = players.find(
          (player) => getPartyPlayerId(player) === targetId
        );
        if (targetPlayer) {
          const targetState = getPartyPlayerState(targetPlayer);
          targetState.isReady = true;
          targetState.hasConfirmed = true;
          targetPlayer.isReady = true;
          targetPlayer.hasConfirmed = true;
        }

        state.phase = 'paranoia-confirm-punishment';
        state.phaseData = {
          targetId,
          punishmentType,
          completionReason: payload.completionReason ?? punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'paranoia-submit-punishment-vote': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        if (state.phase !== 'paranoia-confirm-punishment') {
          const error = new Error(
            'Paranoia is not currently confirming a punishment.'
          );
          error.status = 409;
          throw error;
        }

        const targetId = state.phaseData?.targetId ?? null;
        const completionReason = state.phaseData?.completionReason ?? null;
        const actorPlayer = players.find(
          (player) => getPartyPlayerId(player) === actorId
        );

        if (!actorPlayer) {
          const error = new Error('Voting player not found.');
          error.status = 404;
          throw error;
        }

        if (String(actorId) === String(targetId)) {
          const error = new Error(
            'Selected player cannot submit confirmation votes here.'
          );
          error.status = 403;
          throw error;
        }

        const actorState = getPartyPlayerState(actorPlayer);
        actorState.isReady = true;
        actorState.hasConfirmed = Boolean(payload.option);
        actorPlayer.isReady = true;
        actorPlayer.hasConfirmed = Boolean(payload.option);

        const totalUsersReady = players.filter(
          (player) => getPartyPlayerState(player).isReady === true
        ).length;

        if (totalUsersReady === players.length) {
          const yesVoteCount = players.filter(
            (player) => getPartyPlayerState(player).hasConfirmed === true
          ).length;
          const noVoteCount = players.filter(
            (player) => getPartyPlayerState(player).hasConfirmed === false
          ).length;

          if (noVoteCount < yesVoteCount) {
            if (completionReason === 'QUESTION') {
              applyParanoiaRoundReset({
                workingParty,
                incrementScore: 1,
                nextPlayer: true,
                timer: payload.roundTimer ?? null
              });
            } else {
              players.forEach((player) => {
                const playerState = getPartyPlayerState(player);
                playerState.isReady = false;
                playerState.hasConfirmed = false;
                player.isReady = false;
                player.hasConfirmed = false;
              });

              state.phase = null;
              state.phaseData = null;
              state.timer =
                payload.phaseTimer ??
                payload.roundTimer ??
                Date.now() +
                  Number(config.gameRules?.['time-limit'] || 120) * 1000;
              config.userInstructions = 'NEXT_QUESTION';
              state.userInstructions = 'NEXT_QUESTION';
              state.lastPinged = new Date();
            }
          } else {
            state.phase = null;
            state.phaseData = null;
            config.userInstructions =
              'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
            state.userInstructions = 'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
            state.lastPinged = new Date();
          }
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'paranoia-pass-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        const playerTurn = state.playerTurn ?? 0;
        const turnPlayer = getTurnPlayer(players, state, playerTurn);
        const turnPlayerId = getPartyPlayerId(turnPlayer);
        const targetId = state.phaseData?.targetId ?? turnPlayerId ?? null;

        if (!targetId || String(targetId) !== String(actorId)) {
          const error = new Error(
            'Only the selected player can pass the punishment.'
          );
          error.status = 403;
          throw error;
        }

        if (turnPlayerId && String(turnPlayerId) === String(actorId)) {
          const turnPlayerIndex = players.findIndex(
            (player) => getPartyPlayerId(player) === turnPlayerId
          );
          applyParanoiaRoundReset({
            workingParty,
            currentPlayerIndex: turnPlayerIndex === -1 ? null : turnPlayerIndex,
            incrementScore: -2,
            nextPlayer: true,
            timer: payload.roundTimer ?? null
          });
        } else {
          state.phase = null;
          state.phaseData = null;
          config.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
          state.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
          state.lastPinged = new Date();
        }
        break;
      }

      case 'paranoia-handle-phase-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
          const error = new Error('This action is only valid for Paranoia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (state.phase === 'paranoia-choose-punishment') {
          const targetId = state.phaseData?.targetId ?? null;
          const targetIndex = players.findIndex(
            (player) => getPartyPlayerId(player) === targetId
          );

          applyParanoiaRoundReset({
            workingParty,
            currentPlayerIndex: targetIndex === -1 ? null : targetIndex,
            incrementScore: 0,
            nextPlayer: true,
            timer: payload.roundTimer ?? null
          });
        } else if (state.phase === 'paranoia-show-punishment') {
          const playerTurn = state.playerTurn ?? 0;
          const turnPlayer = getTurnPlayer(players, state, playerTurn);
          const turnPlayerId = getPartyPlayerId(turnPlayer);
          const targetId = state.phaseData?.targetId ?? turnPlayerId ?? null;

          if (
            turnPlayerId &&
            targetId &&
            String(turnPlayerId) === String(targetId)
          ) {
            const turnPlayerIndex = players.findIndex(
              (player) => getPartyPlayerId(player) === turnPlayerId
            );
            applyParanoiaRoundReset({
              workingParty,
              currentPlayerIndex:
                turnPlayerIndex === -1 ? null : turnPlayerIndex,
              incrementScore: 0,
              nextPlayer: true,
              timer: payload.roundTimer ?? null
            });
          } else {
            state.phase = null;
            state.phaseData = null;
            config.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
            state.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
            state.lastPinged = new Date();
          }
        } else if (state.phase === 'paranoia-confirm-punishment') {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            if (playerState.isReady !== true) {
              playerState.isReady = true;
              playerState.hasConfirmed = false;
              player.isReady = true;
              player.hasConfirmed = false;
            }
          });

          state.phase = null;
          state.phaseData = null;
          config.userInstructions = 'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
          state.userInstructions = 'USER_HAS_PASSED:USER_DIDNT_DO_PUNISHMENT';
          state.lastPinged = new Date();
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'most-likely-to-advance-from-results': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const highestValue = getMostLikelyToHighestVoteValue(players);
        const highestVotedIds = getMostLikelyToHighestVotedIds(players);
        const enabledPunishments = getMostLikelyToEnabledPunishments(config);

        if (enabledPunishments.length === 0 || highestValue === 0) {
          applyMostLikelyToRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        if (highestValue < 0) {
          players.forEach((player) => {
            const playerId = getPartyPlayerId(player);
            const playerState = getPartyPlayerState(player);
            const isTiedPlayer = highestVotedIds.includes(playerId);

            playerState.vote = null;
            player.vote = null;
            playerState.isReady = false;
            player.isReady = false;
            playerState.hasConfirmed = !isTiedPlayer;
            player.hasConfirmed = !isTiedPlayer;
          });

          state.phase = 'most-likely-to-tiebreaker';
          state.phaseData = {
            tiedIds: highestVotedIds
          };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
          break;
        }

        state.phase = 'most-likely-to-choose-punishment';
        state.phaseData = {
          targetId: highestVotedIds[0] ?? null
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'most-likely-to-select-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        const phase = state.phase;
        const phaseData = state.phaseData || {};
        const targetId = phaseData.targetId ?? null;

        if (phase !== 'most-likely-to-choose-punishment' || !targetId) {
          const error = new Error(
            'Most Likely To is not currently choosing a punishment.'
          );
          error.status = 409;
          throw error;
        }

        if (!actorId || String(actorId) !== String(targetId)) {
          const error = new Error(
            'Only the selected player can choose the punishment.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phase = 'most-likely-to-show-punishment';
        state.phaseData = {
          targetId,
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'most-likely-to-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        const phase = state.phase;
        const phaseData = state.phaseData || {};
        const targetId = phaseData.targetId ?? null;

        if (phase !== 'most-likely-to-show-punishment' || !targetId) {
          const error = new Error(
            'Most Likely To is not currently resolving a punishment.'
          );
          error.status = 409;
          throw error;
        }

        if (!actorId || String(actorId) !== String(targetId)) {
          const error = new Error(
            'Only the selected player can resolve the drink wheel.'
          );
          error.status = 403;
          throw error;
        }

        const punishmentType = String(payload.punishmentType || '').trim();
        if (!punishmentType) {
          const error = new Error('punishmentType is required.');
          error.status = 400;
          throw error;
        }

        state.phaseData = {
          ...phaseData,
          targetId,
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        break;
      }

      case 'most-likely-to-complete-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        const phase = state.phase;
        const phaseData = state.phaseData || {};
        const targetId = phaseData.targetId ?? null;

        if (phase !== 'most-likely-to-show-punishment' || !targetId) {
          const error = new Error(
            'Most Likely To is not currently resolving a punishment.'
          );
          error.status = 409;
          throw error;
        }

        if (!actorId || String(actorId) !== String(targetId)) {
          const error = new Error(
            'Only the selected player can complete the punishment.'
          );
          error.status = 403;
          throw error;
        }

        applyMostLikelyToRoundReset({
          workingParty,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      case 'most-likely-to-handle-phase-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'most-likely-to') {
          const error = new Error(
            'This action is only valid for Most Likely To.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (state.phase === 'most-likely-to-tiebreaker') {
          const tiedIds = Array.isArray(state.phaseData?.tiedIds)
            ? state.phaseData.tiedIds.filter(Boolean)
            : [];

          if (tiedIds.length === 0) {
            applyMostLikelyToRoundReset({
              workingParty,
              timer: payload.roundTimer ?? null
            });
            break;
          }

          state.phase = 'most-likely-to-choose-punishment';
          state.phaseData = {
            targetId: tiedIds[0]
          };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
          break;
        }

        if (state.phase === 'most-likely-to-choose-punishment') {
          const targetId = state.phaseData?.targetId ?? null;
          const targetIndex = players.findIndex(
            (player) => getPartyPlayerId(player) === targetId
          );

          applyMostLikelyToRoundReset({
            workingParty,
            playerIndex: targetIndex === -1 ? null : targetIndex,
            incrementScore: 0,
            nextPlayer: false,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        state.lastPinged = new Date();
        break;
      }

      default: {
        const error = new Error(`Unknown party action: ${action}`);
        error.status = 400;
        throw error;
      }
    }

    return workingParty;
  }

  function createPartyActionHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel,
    hasDeck
  }) {
    app.post(`${route}/action`, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPartyActionBody(body);
        const { partyId, action, actorId, payload = {} } = body;

        const existingParty = await mainModel.findOne({ partyId }).lean();
        if (!existingParty) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        const updatedPartySnapshot = applyPartyActionToSnapshot({
          party: existingParty,
          action,
          actorId,
          payload,
          hasDeck
        });

        const updateData = {
          config: updatedPartySnapshot.config,
          state: updatedPartySnapshot.state,
          players: updatedPartySnapshot.players
        };

        if (hasDeck) {
          updateData.deck = updatedPartySnapshot.deck;
        }

        const [updatedParty] = await Promise.all([
          mainModel.findOneAndUpdate({ partyId }, updateData, { new: true }),
          waitingRoomModel.findOneAndUpdate(
            { partyId },
            {
              config: updatedPartySnapshot.config,
              state: updatedPartySnapshot.state,
              players: updatedPartySnapshot.players
            },
            {
              new: true,
              upsert: true
            }
          )
        ]);

        res.apiSuccess({
          message: `${logLabel} action applied successfully`,
          updated: updatedParty
        });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error applying ${logLabel.toLowerCase()} action:`,
          err
        );
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_action_apply_failed',
          message:
            err.message || `Failed to apply ${logLabel.toLowerCase()} action`
        });
      }
    });
  }

  function createUpsertPartyHandler({ route, model, logLabel, fields }) {
    app.post(route, async (req, res) => {
      try {
        assertPartyUpdateBody(req.body, fields);
        const { partyId } = req.body;

        // Build the update object dynamically from allowed fields
        const updateData = {};
        for (const field of fields) {
          if (req.body.hasOwnProperty(field)) {
            updateData[field] = req.body[field];
          }
        }

        const shouldCheckExistingParty =
          updateData.state?.isPlaying === true ||
          updateData.state?.hostComputerId !== undefined ||
          updateData.state?.hostComputerIdList !== undefined;
        const existingParty = shouldCheckExistingParty
          ? await model.findOne({ partyId }).lean()
          : null;

        if (
          existingParty &&
          updateData.state &&
          typeof updateData.state === 'object'
        ) {
          updateData.state = {
            ...updateData.state,
            hostComputerId: existingParty.state?.hostComputerId ?? null,
            hostComputerIdList: Array.isArray(
              existingParty.state?.hostComputerIdList
            )
              ? existingParty.state.hostComputerIdList
              : [],
            playerTurnOrder: Array.isArray(updateData.state.playerTurnOrder)
              ? updateData.state.playerTurnOrder
              : Array.isArray(existingParty.state?.playerTurnOrder)
                ? existingParty.state.playerTurnOrder
                : []
          };
        }

        if (updateData.state?.isPlaying === true) {
          const gamemode =
            updateData.config?.gamemode ??
            existingParty?.config?.gamemode ??
            existingParty?.gamemode;
          const players = Array.isArray(updateData.players)
            ? updateData.players
            : Array.isArray(existingParty?.players)
              ? existingParty.players
              : [];

          if (
            PLAYER_TURN_ORDER_GAMEMODES.has(gamemode) &&
            (!Array.isArray(updateData.state.playerTurnOrder) ||
              updateData.state.playerTurnOrder.length === 0)
          ) {
            initializePlayerTurnOrder(updateData.state, players);
          }
        }

        if (
          updateData.state?.isPlaying === true &&
          req.body.bypassPlayerRestrictions !== true
        ) {
          const gamemode =
            updateData.config?.gamemode ??
            existingParty?.config?.gamemode ??
            existingParty?.gamemode;
          const players = Array.isArray(updateData.players)
            ? updateData.players
            : existingParty?.players;

          assertOnlinePlayerRestrictions({ gamemode, players });
        }

        const updated = await model.findOneAndUpdate({ partyId }, updateData, {
          new: true,
          upsert: true
        });

        res.apiSuccess({
          message: `${logLabel} updated or created successfully`,
          updated
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error saving/updating ${logLabel.toLowerCase()}:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_upsert_failed',
          message:
            err.message || `Failed to save/update ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  const partyJoinLocks = new Map();

  async function withPartyJoinLock(partyId, task) {
    const previous = partyJoinLocks.get(partyId) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    const stored = current.catch(() => {});

    partyJoinLocks.set(partyId, stored);

    try {
      return await current;
    } finally {
      if (partyJoinLocks.get(partyId) === stored) {
        partyJoinLocks.delete(partyId);
      }
    }
  }

  function getSocketPartyMembershipKey(partyId, computerId) {
    return `${partyId}:${computerId}`;
  }

  function rememberSocketPartyMembership({
    socketId,
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    if (
      !socketId ||
      socketId === 'DISCONNECTED' ||
      !partyId ||
      !computerId ||
      !mainModel
    ) {
      return;
    }

    const memberships = socketPartyMemberships.get(socketId) || new Map();
    memberships.set(getSocketPartyMembershipKey(partyId, computerId), {
      partyId,
      computerId,
      mainModel,
      waitingRoomModel,
      logLabel
    });
    socketPartyMemberships.set(socketId, memberships);
  }

  function forgetSocketPartyMembership(socketId, partyId, computerId) {
    if (!socketId) return;

    const memberships = socketPartyMemberships.get(socketId);
    if (!memberships) return;

    memberships.delete(getSocketPartyMembershipKey(partyId, computerId));

    if (memberships.size === 0) {
      socketPartyMemberships.delete(socketId);
    }
  }

  function isSocketIdActive(socketId) {
    return Boolean(
      socketId &&
      socketId !== 'DISCONNECTED' &&
      io.sockets.sockets.get(socketId)
    );
  }

  function getPlayerConnectionSocketId(player) {
    return player?.connection?.socketId ?? player?.socketId ?? null;
  }

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

  async function repairPartyHost({
    session,
    waitingRoomModel,
    chatLogSession,
    ignoreComputerId = null
  }) {
    const state = session.state;
    if (!state) return null;

    const previousHostId = state.hostComputerId ?? null;
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

    return state.hostComputerId;
  }

  async function repairPartyHostForParty({
    partyId,
    mainModel,
    waitingRoomModel,
    chatLogSession,
    ignoreComputerId = null
  }) {
    const session = await mainModel.findOne({ partyId });
    if (!session) return null;

    await repairPartyHost({
      session,
      waitingRoomModel,
      chatLogSession,
      ignoreComputerId
    });

    await session.save();
    return session.toObject ? session.toObject() : session;
  }

  async function disconnectPartyPlayer({
    partyId,
    computerId,
    mainModel,
    waitingRoomModel,
    logLabel,
    socketId = null,
    writeChat = true
  }) {
    return withPartyJoinLock(partyId, async () => {
      const session = await mainModel.findOne({ partyId });
      if (!session) {
        debugWarn(
          `Unable to disconnect ${computerId}; ${logLabel} ${partyId} was not found.`
        );
        return null;
      }

      const player = session.players.find(
        (partyPlayer) =>
          String(getPartyPlayerId(partyPlayer)) === String(computerId)
      );

      if (!player) {
        debugWarn(
          `Unable to disconnect ${computerId}; player was not found in ${logLabel} ${partyId}.`
        );
        return null;
      }

      const currentSocketId = getPlayerConnectionSocketId(player);
      if (currentSocketId === 'DISCONNECTED') {
        forgetSocketPartyMembership(socketId, partyId, computerId);
        return session.toObject ? session.toObject() : session;
      }

      if (
        socketId &&
        currentSocketId &&
        currentSocketId !== 'DISCONNECTED' &&
        String(currentSocketId) !== String(socketId)
      ) {
        forgetSocketPartyMembership(socketId, partyId, computerId);
        return session.toObject ? session.toObject() : session;
      }

      if (!player.connection) {
        player.connection = {};
      }
      player.connection.socketId = 'DISCONNECTED';
      player.connection.lastPing = new Date();
      player.socketId = 'DISCONNECTED';

      if (session.state) {
        session.state.lastPinged = new Date();
      } else {
        session.lastPinged = new Date();
      }

      const waitingRoomSession = waitingRoomModel
        ? await waitingRoomModel.findOne({ partyId })
        : null;
      if (waitingRoomSession) {
        const waitingPlayer = waitingRoomSession.players.find(
          (partyPlayer) =>
            String(getPartyPlayerId(partyPlayer)) === String(computerId)
        );
        if (waitingPlayer) {
          if (!waitingPlayer.connection) {
            waitingPlayer.connection = {};
          }
          waitingPlayer.connection.socketId = 'DISCONNECTED';
          waitingPlayer.connection.lastPing = new Date();
          waitingPlayer.socketId = 'DISCONNECTED';
          waitingRoomSession.state = waitingRoomSession.state || {
            isPlaying: Boolean(session.state?.isPlaying)
          };
          waitingRoomSession.state.lastPinged = new Date();
          await waitingRoomSession.save();
        }
      }

      const chatLogSession = writeChat
        ? await partyGameChatLogSchema.findOne({ partyId })
        : null;

      if (chatLogSession) {
        chatLogSession.chat.push({
          username: '[CONSOLE]',
          message: `${player.identity?.username || player.username || 'A player'} has been disconnected.`,
          eventType: 'disconnect'
        });
      }

      await repairPartyHost({
        session,
        waitingRoomModel,
        chatLogSession,
        ignoreComputerId: computerId
      });

      await session.save();
      if (chatLogSession) {
        await chatLogSession.save();
      }

      forgetSocketPartyMembership(currentSocketId, partyId, computerId);
      if (socketId && socketId !== currentSocketId) {
        forgetSocketPartyMembership(socketId, partyId, computerId);
      }

      return session.toObject ? session.toObject() : session;
    });
  }

  async function disconnectSocketPartyMemberships(socketId) {
    const memberships = socketPartyMemberships.get(socketId);
    if (!memberships) return;

    socketPartyMemberships.delete(socketId);

    await Promise.all(
      Array.from(memberships.values()).map((membership) =>
        disconnectPartyPlayer({
          ...membership,
          socketId,
          writeChat: true
        }).catch((error) => {
          console.error(
            `❌ Failed to disconnect socket ${socketId} from ${membership.partyId}:`,
            error
          );
        })
      )
    );
  }

  function mergePartyPlayer(existing = {}, incoming = {}) {
    return {
      ...existing,
      ...incoming,
      identity: {
        ...(existing.identity || {}),
        ...(incoming.identity || {})
      },
      connection: {
        ...(existing.connection || {}),
        ...(incoming.connection || {})
      },
      state: {
        ...(existing.state || {}),
        ...(incoming.state || {})
      }
    };
  }

  function upsertPartyPlayer(players, incomingPlayer) {
    const incomingPlayerId = getPartyPlayerId(incomingPlayer);
    const nextPlayers = [];
    let mergedPlayer = null;
    let mergedPlayerIndex = -1;

    for (const player of players || []) {
      if (getPartyPlayerId(player) !== incomingPlayerId) {
        nextPlayers.push(player);
        continue;
      }

      mergedPlayer = mergePartyPlayer(mergedPlayer || player, player);

      if (mergedPlayerIndex === -1) {
        mergedPlayerIndex = nextPlayers.length;
        nextPlayers.push(null);
      }
    }

    if (mergedPlayerIndex === -1) {
      nextPlayers.push(incomingPlayer);
    } else {
      nextPlayers[mergedPlayerIndex] = mergePartyPlayer(
        mergedPlayer,
        incomingPlayer
      );
    }

    return nextPlayers;
  }

  function buildJoinPlayerFromBody(body = {}) {
    const identity = body.identity || {};
    const connection = body.connection || {};
    const state = body.state || {};
    const computerId =
      body.computerId ?? body.newComputerId ?? identity.computerId;
    const username = body.username ?? body.newUsername ?? identity.username;
    const userIcon = body.userIcon ?? body.newUserIcon ?? identity.userIcon;
    const socketId =
      body.socketId ?? body.newUserSocketId ?? connection.socketId;
    const isReady = body.isReady ?? body.newUserReady ?? state.isReady;
    const hasConfirmed =
      body.hasConfirmed ?? body.newUserConfirmation ?? state.hasConfirmed;
    const score = body.score ?? body.newScore ?? state.score;
    const nextState = {
      ...state
    };

    if (isReady !== undefined) {
      nextState.isReady = isReady;
    }

    if (hasConfirmed !== undefined) {
      nextState.hasConfirmed = hasConfirmed;
    }

    if (score !== undefined) {
      nextState.score = score;
    }

    return {
      identity: {
        computerId,
        ...(username !== undefined ? { username } : {}),
        ...(userIcon !== undefined ? { userIcon } : {})
      },
      connection: {
        ...(socketId !== undefined ? { socketId } : {}),
        lastPing: new Date()
      },
      state: nextState
    };
  }

  function isPlainPatchObject(value) {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  function addNestedPlayerPatch(set, path, value) {
    if (value === undefined) {
      return;
    }

    if (isPlainPatchObject(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        addNestedPlayerPatch(set, `${path}.${key}`, nestedValue);
      });
      return;
    }

    set[`players.$.${path}`] = value;
  }

  function buildPlayerPatchFromBody(body = {}) {
    const identityPatch = body.identityPatch || body.identity || {};
    const connectionPatch = body.connectionPatch || body.connection || {};
    const statePatch = body.statePatch || body.state || {};
    const fullPlayerPatch = body.playerPatch || body.player || {};
    const set = {};

    if (isPlainPatchObject(fullPlayerPatch.identity)) {
      Object.entries(fullPlayerPatch.identity).forEach(([key, value]) => {
        if (key === 'computerId') return;
        addNestedPlayerPatch(set, `identity.${key}`, value);
      });
    }

    if (isPlainPatchObject(fullPlayerPatch.connection)) {
      Object.entries(fullPlayerPatch.connection).forEach(([key, value]) => {
        addNestedPlayerPatch(set, `connection.${key}`, value);
      });
    }

    if (isPlainPatchObject(fullPlayerPatch.state)) {
      Object.entries(fullPlayerPatch.state).forEach(([key, value]) => {
        addNestedPlayerPatch(set, `state.${key}`, value);
      });
    }

    const username =
      body.username ?? body.newUsername ?? identityPatch.username;
    const userIcon =
      body.userIcon ?? body.newUserIcon ?? identityPatch.userIcon;
    const socketId =
      body.socketId ?? body.newUserSocketId ?? connectionPatch.socketId;
    const isReady = body.isReady ?? body.newUserReady ?? statePatch.isReady;
    const hasConfirmed =
      body.hasConfirmed ?? body.newUserConfirmation ?? statePatch.hasConfirmed;
    const score = body.score ?? body.newScore ?? statePatch.score;
    const vote = body.vote ?? body.newVote ?? statePatch.vote;
    const status = body.status ?? body.newStatus ?? statePatch.status;
    const role = body.role ?? body.newRole ?? statePatch.role;

    if (username !== undefined) {
      set['players.$.identity.username'] = username;
    }

    if (userIcon !== undefined) {
      set['players.$.identity.userIcon'] = userIcon;
    }

    if (socketId !== undefined) {
      set['players.$.connection.socketId'] = socketId;
    }

    if (isReady !== undefined) {
      set['players.$.state.isReady'] = isReady;
    }

    if (hasConfirmed !== undefined) {
      set['players.$.state.hasConfirmed'] = hasConfirmed;
    }

    if (score !== undefined) {
      set['players.$.state.score'] = score;
    }

    if (vote !== undefined) {
      set['players.$.state.vote'] = vote;
    }

    if (status !== undefined) {
      set['players.$.state.status'] = status;
    }

    if (role !== undefined) {
      set['players.$.state.role'] = role;
    }

    if (body.touchLastPing !== false) {
      set['players.$.connection.lastPing'] = new Date();
    }

    set['state.lastPinged'] = new Date();

    return set;
  }

  async function upsertPlayerInPartyDocument(model, partyId, incomingPlayer) {
    const session = await model.findOne({ partyId });

    if (!session) {
      return null;
    }

    const currentPlayers = Array.isArray(session.players)
      ? session.players.map((player) =>
          player.toObject ? player.toObject() : cloneSerializable(player)
        )
      : [];

    session.players = upsertPartyPlayer(currentPlayers, incomingPlayer);

    if (session.state && typeof session.state === 'object') {
      session.state.lastPinged = new Date();
    }

    await session.save();
    return session.toObject ? session.toObject() : session;
  }

  function createJoinUserHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertJoinPlayerBody(body);
        const partyId = body.partyId;
        const incomingPlayer = buildJoinPlayerFromBody(body);
        const incomingPlayerId = getPartyPlayerId(incomingPlayer);

        const result = await withPartyJoinLock(partyId, async () => {
          const updatedMain = await upsertPlayerInPartyDocument(
            mainModel,
            partyId,
            incomingPlayer
          );

          if (!updatedMain) {
            return null;
          }

          const updatedWaitingRoom = await upsertPlayerInPartyDocument(
            waitingRoomModel,
            partyId,
            incomingPlayer
          );
          const socketId = getPlayerConnectionSocketId(incomingPlayer);

          rememberSocketPartyMembership({
            socketId,
            partyId,
            computerId: incomingPlayerId,
            mainModel,
            waitingRoomModel,
            logLabel
          });

          const repairedMain = await repairPartyHostForParty({
            partyId,
            mainModel,
            waitingRoomModel
          });

          return {
            updatedMain: repairedMain ?? updatedMain,
            updatedWaitingRoom
          };
        });

        if (!result) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: 'Party not found'
          });
        }

        res.apiSuccess({
          message: `${logLabel} player joined or updated successfully`,
          updated: result.updatedMain,
          waitingRoom: result.updatedWaitingRoom
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error joining/updating ${logLabel.toLowerCase()} player:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        res.apiError({
          status,
          code:
            typeof err.code === 'string' ? err.code : 'party_join_user_failed',
          message:
            err.message ||
            `Failed to join/update ${logLabel.toLowerCase()} player`
        });
      }
    });
  }

  async function patchPlayerInPartyDocument(model, partyId, computerId, set) {
    if (!model) {
      return null;
    }

    return model
      .findOneAndUpdate(
        {
          partyId,
          'players.identity.computerId': computerId
        },
        { $set: set },
        { new: true }
      )
      .lean();
  }

  function createPatchPlayerHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = {
          ...req.body,
          partyId: req.body?.partyId || req.query.partyCode
        };
        assertPatchPlayerBody(body);
        const partyId = body.partyId;
        const computerId =
          body.computerId ??
          body.newComputerId ??
          body.identity?.computerId ??
          body.identityPatch?.computerId;
        const playerPatch = buildPlayerPatchFromBody(body);
        const nextSocketId = playerPatch['players.$.connection.socketId'];

        const { updatedMain, updatedWaitingRoom } = await withPartyJoinLock(
          partyId,
          async () => {
            const [patchedMain, patchedWaitingRoom] = await Promise.all([
              patchPlayerInPartyDocument(
                mainModel,
                partyId,
                computerId,
                playerPatch
              ),
              patchPlayerInPartyDocument(
                waitingRoomModel,
                partyId,
                computerId,
                playerPatch
              )
            ]);

            if (nextSocketId) {
              rememberSocketPartyMembership({
                socketId: nextSocketId,
                partyId,
                computerId,
                mainModel,
                waitingRoomModel,
                logLabel
              });
            }

            const repairedMain = await repairPartyHostForParty({
              partyId,
              mainModel,
              waitingRoomModel
            });

            return {
              updatedMain: repairedMain ?? patchedMain,
              updatedWaitingRoom: patchedWaitingRoom
            };
          }
        );

        if (!updatedMain) {
          return res.apiError({
            status: 404,
            code: 'party_player_not_found',
            message: `${logLabel} player not found`
          });
        }

        res.apiSuccess({
          message: `${logLabel} player patched successfully`,
          updated: updatedMain,
          waitingRoom: updatedWaitingRoom
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error patching ${logLabel.toLowerCase()} player:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_patch_player_failed',
          message:
            err.message || `Failed to patch ${logLabel.toLowerCase()} player`
        });
      }
    });
  }

  function createRemoveUserHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = parseBeaconBody(req.body);
        assertRemovePlayerBody(body);
        const { partyId, computerIdToRemove } = body;
        const actorComputerId = body.actorComputerId ?? body.actorId ?? null;
        const actorSocketId = body.actorSocketId ?? body.socketId ?? null;

        const result = await withPartyJoinLock(partyId, async () => {
          // --- Remove from session ---
          const session = await mainModel.findOne({ partyId: partyId });
          if (!session) {
            return { status: 404, error: `${logLabel} not found` };
          }

          const isSelfRemoval =
            String(actorComputerId) === String(computerIdToRemove);

          if (!isSelfRemoval) {
            const hostComputerId = session.state?.hostComputerId ?? null;
            const actorPlayer = session.players.find(
              (player) =>
                String(getPartyPlayerId(player)) === String(actorComputerId)
            );
            const actorCurrentSocketId =
              actorPlayer?.connection?.socketId ?? null;
            const actorSocketMatches =
              !actorSocketId ||
              !actorCurrentSocketId ||
              String(actorCurrentSocketId) === String(actorSocketId);

            if (
              !hostComputerId ||
              String(actorComputerId) !== String(hostComputerId) ||
              !actorSocketMatches
            ) {
              return {
                status: 403,
                error: 'Only the host can remove another player from the party'
              };
            }
          }

          const removedPlayer = session.players.find(
            (player) =>
              String(getPartyPlayerId(player)) === String(computerIdToRemove)
          );
          const removedSocketId = getPlayerConnectionSocketId(removedPlayer);
          const originalCount = session.players.length;
          session.players = session.players.filter(
            (player) =>
              String(getPartyPlayerId(player)) !== String(computerIdToRemove)
          );

          if (session.players.length === originalCount) {
            return { status: 400, error: 'Computer ID not found in session' };
          }

          const chatLogSession = await partyGameChatLogSchema.findOne({
            partyId
          });
          await repairPartyHost({
            session,
            waitingRoomModel,
            chatLogSession,
            ignoreComputerId: computerIdToRemove
          });

          await session.save();
          if (chatLogSession) {
            await chatLogSession.save();
          }

          // --- Remove from waiting room (if exists) ---
          const waitingRoom = await waitingRoomModel.findOne({
            partyId: partyId
          });
          if (waitingRoom) {
            const originalWaitingCount = waitingRoom.players.length;
            waitingRoom.players = waitingRoom.players.filter(
              (player) =>
                String(getPartyPlayerId(player)) !== String(computerIdToRemove)
            );

            if (waitingRoom.players.length !== originalWaitingCount) {
              if (waitingRoom.state) {
                waitingRoom.state.hostComputerId =
                  session.state?.hostComputerId ?? null;
                waitingRoom.state.hostComputerIdList =
                  session.state?.hostComputerIdList ?? [];
                waitingRoom.state.lastPinged = new Date();
              }
              await waitingRoom.save();
            }
          }

          forgetSocketPartyMembership(
            removedSocketId,
            partyId,
            computerIdToRemove
          );
          return { removedSocketId };
        });

        if (result?.error) {
          return res.apiError({
            status: result.status,
            code: 'party_remove_user_failed',
            message: result.error
          });
        }

        const removedSocketId = result?.removedSocketId;

        if (removedSocketId && removedSocketId !== 'DISCONNECTED') {
          const removedSocket = io.sockets.sockets.get(removedSocketId);

          if (removedSocket) {
            removedSocket.emit('kicked-from-party', partyId);
            removedSocket.leave(partyId);
          }

          io.to(partyId).emit('user-kicked', {
            socketId: removedSocketId,
            computerId: computerIdToRemove
          });
        }

        res.apiSuccess({
          message:
            'User removed successfully from session and waiting room (if present)'
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error removing user from ${logLabel.toLowerCase()}:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_remove_user_internal_error',
          message: err.message || 'Internal server error'
        });
      }
    });
  }

  function createDisconnectUserHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const body = parseBeaconBody(req.body);
        assertDisconnectPlayerBody(body);
        const { partyId, computerId, partyCode } = body;
        const actualPartyId = partyId || partyCode;

        const updated = await disconnectPartyPlayer({
          partyId: actualPartyId,
          computerId,
          mainModel,
          waitingRoomModel,
          logLabel,
          socketId: body.socketId ?? body.actorSocketId ?? null,
          writeChat: true
        });

        if (!updated) {
          return res.apiError({
            status: 404,
            code: 'party_or_player_not_found',
            message: `${logLabel} or player not found`
          });
        }

        res.apiSuccess({
          message:
            'Socket ID reset successfully in session and waiting room (if present)',
          updated
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Error resetting socket ID for ${logLabel.toLowerCase()}:`,
          err
        );
        const status = Number.isInteger(err.status) ? err.status : 500;
        res.apiError({
          status,
          code:
            typeof err.code === 'string'
              ? err.code
              : 'party_disconnect_user_internal_error',
          message: err.message || 'Internal server error'
        });
      }
    });
  }

  function createPartyGetHandler({ route, model, logLabel }) {
    app.get(route, async (req, res) => {
      try {
        const { partyCode } = req.query;
        assertPartyId(partyCode, 'partyCode');
        const existingData = await model.find({ partyId: partyCode });
        res.json(existingData);
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error fetching ${logLabel.toLowerCase()}:`,
          err
        );
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_fetch_failed',
          message: err.message || `Failed to fetch ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  return {
    createDeleteHandler,
    createDeleteQueryHandler,
    createUpsertPartyHandler,
    createPartyActionHandler,
    createRemoveUserHandler,
    createJoinUserHandler,
    createPatchPlayerHandler,
    createDisconnectUserHandler,
    createPartyGetHandler,
    disconnectSocketPartyMemberships
  };
}

module.exports = {
  createPartyRuntime
};

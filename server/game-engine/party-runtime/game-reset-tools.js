const { createMafiaResetTools } = require('./mafia-reset-tools');

function createPartyGameResetTools(context) {
  const {
    getPartyConfigDoc,
    getPartyStateDoc,
    getPartyDeckDoc,
    getPartyPlayersDoc,
    getPartyPlayerState,
    getPartyPlayerId,
    completeConfiguredRound,
    getPartyRuleValue,
    SCORE_RULES,
    getTurnPlayer,
    getPlayerTurnOrder,
    advancePlayerTurn
  } = context;
  const mafiaResetTools = createMafiaResetTools({ getPartyPlayerState });

  function applyWouldYouRatherRoundReset({ workingParty, timer = null }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const players = getPartyPlayersDoc(workingParty);

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
      { type: 'players-choosing', at: Date.now() + 1 }
    ];

    deck.currentCardIndex = (deck.currentCardIndex ?? 0) + 1;
    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.userInstructions = 'DISPLAY_PRIVATE_CARD';
    state.lastPinged = new Date();
    completeConfiguredRound(workingParty);
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
      { type: 'players-answering', at: Date.now() + 1 }
    ];

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
    completeConfiguredRound(workingParty);
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
        // Historical party snapshots can still contain this retired rule.
        if (ruleKey === 'truth-or-dare-text-box') return false;
        if (ruleKey === 'truth-or-dare-prompt-heist') return false;
        if (ruleKey === 'prompt-heist') return false;
        return true;
      })
      .map(([ruleKey]) => ruleKey);
  }

  function isTruthOrDarePromptHeistEnabled(config = {}) {
    return (
      getPartyRuleValue(config, 'truth-or-dare-prompt-heist', false) === true ||
      getPartyRuleValue(config, 'truth-or-dare-prompt-heist', false) ===
        'true' ||
      getPartyRuleValue(config, 'prompt-heist', false) === true ||
      getPartyRuleValue(config, 'prompt-heist', false) === 'true'
    );
  }

  function getTruthOrDarePromptHeistTimeLimit(config = {}) {
    const configuredSeconds =
      Number(
        getPartyRuleValue(
          config,
          'truth-or-dare-prompt-heist-game-rule-time-limit'
        )
      ) ||
      Number(getPartyRuleValue(config, 'prompt-heist-game-rule-time-limit'));

    return Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds
      : 10;
  }

  function applyTruthOrDarePassConsequence({
    workingParty,
    phaseTimer = null,
    roundTimer = null,
    timedOut = false
  }) {
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const punishmentRules = getTruthOrDareEnabledPunishments(config);
    const wasStolenPrompt = state.phaseData?.promptHeist === true;
    const passScore = wasStolenPrompt
      ? SCORE_RULES['truth-or-dare'].passStolenPrompt
      : SCORE_RULES['truth-or-dare'].passUnresolved;

    if (punishmentRules.length === 0) {
      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore: passScore,
        nextPlayer: true,
        timer: roundTimer
      });
      return;
    }

    state.phase = 'truth-or-dare-choose-punishment';
    state.phaseData = {
      ...(state.phaseData || {}),
      ...(timedOut ? { timedOut: true } : {}),
      passScoreApplied: false
    };
    state.timer = phaseTimer ?? state.timer ?? null;
    state.lastPinged = new Date();
  }

  function addScoreToTruthOrDareCurrentPlayer(workingParty, score) {
    const state = getPartyStateDoc(workingParty);
    const players = getPartyPlayersDoc(workingParty);
    const currentPlayer = getTurnPlayer(players, state, state.playerTurn ?? 0);
    if (!currentPlayer || !Number.isFinite(score) || score === 0) return;

    const currentPlayerState = getPartyPlayerState(currentPlayer);
    currentPlayerState.score =
      (currentPlayerState.score ?? currentPlayer.score ?? 0) + score;
    currentPlayer.score = currentPlayerState.score;
  }

  function getTruthOrDareCompletionScore(workingParty) {
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck: true });
    const questionType = deck.questionType;
    const wasStolenPrompt = state.phaseData?.promptHeist === true;
    const rules = SCORE_RULES['truth-or-dare'];

    if (questionType === 'truth') {
      return wasStolenPrompt ? rules.completeStolenTruth : rules.completeTruth;
    }

    if (questionType === 'dare') {
      return wasStolenPrompt ? rules.completeStolenDare : rules.completeDare;
    }

    return 0;
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
    const originalPromptHeistTurn = Number.isInteger(
      state.phaseData?.originalPlayerTurn
    )
      ? state.phaseData.originalPlayerTurn
      : null;
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

    if (originalPromptHeistTurn !== null) {
      const order = getPlayerTurnOrder(state, players);
      state.playerTurn =
        order.length > 0
          ? ((originalPromptHeistTurn % order.length) + order.length) %
            order.length
          : 0;
    }

    let completedTurnCycle = false;
    if (nextPlayer && players.length > 0) {
      const turnOrder = getPlayerTurnOrder(state, players);
      const normalizedTurn =
        turnOrder.length > 0
          ? (((state.playerTurn ?? 0) % turnOrder.length) + turnOrder.length) %
            turnOrder.length
          : 0;
      completedTurnCycle =
        turnOrder.length > 0 && normalizedTurn === turnOrder.length - 1;
      advancePlayerTurn(state, players);
    }

    players.forEach((player) => {
      const playerState = getPartyPlayerState(player);
      if (playerState.participationStatus === 'pending_next_round') {
        playerState.participationStatus = 'active';
      }
      if (playerState.participationStatus !== 'reconnecting') {
        playerState.reconnectDeadline = null;
      }
    });
    state.roundParticipantIds = players
      .filter((player) => {
        const status = getPartyPlayerState(player).participationStatus;
        return status !== 'disconnected' && status !== 'pending_next_round';
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);
    getPlayerTurnOrder(state, players);

    const nextTurnPlayer = getTurnPlayer(players, state, state.playerTurn ?? 0);
    state.roundTimeline = [
      {
        type: 'choosing-question-type',
        at: Date.now(),
        ...(nextTurnPlayer
          ? {
              playerId: getPartyPlayerId(nextTurnPlayer),
              playerName:
                nextTurnPlayer.username ||
                nextTurnPlayer.identity?.username ||
                nextTurnPlayer.profile?.username ||
                nextTurnPlayer.name ||
                'Player'
            }
          : {})
      }
    ];

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
    state.userInstructions = 'DISPLAY_SELECT_QUESTION_TYPE';
    state.lastPinged = new Date();
    completeConfiguredRound(workingParty, completedTurnCycle);
  }

  function applyImposterRoundReset({
    workingParty,
    nextPlayer = true,
    completeGameLoop = true,
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
        const playerState = getPartyPlayerState(player);
        const socketId = player.connection?.socketId ?? player.socketId;
        return (
          playerState.participationStatus === 'active' &&
          socketId !== 'DISCONNECTED'
        );
      })
      .map((player) => getPartyPlayerId(player))
      .filter(Boolean);

    const participantIdSet = new Set(state.roundParticipantIds.map(String));
    const participantIndexes = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) =>
        participantIdSet.has(String(getPartyPlayerId(player)))
      )
      .map(({ index }) => index);

    if (nextPlayer && participantIndexes.length > 0) {
      state.playerTurn =
        participantIndexes[
          Math.floor(Math.random() * participantIndexes.length)
        ];
    }

    state.speakingRound = 0;
    state.speakingPlayerTurn = participantIndexes[0] ?? 0;
    state.roundTimeline = [
      { type: 'roles-assigned', at: Date.now() },
      { type: 'viewing-prompts', at: Date.now() + 1 }
    ];

    state.phase = null;
    state.phaseData = null;
    state.timer = timer;
    config.userInstructions = resetInstruction;
    state.userInstructions = resetInstruction;
    state.lastPinged = new Date();
    completeConfiguredRound(workingParty, completeGameLoop);
  }

  return {
    applyWouldYouRatherRoundReset,
    applyNeverHaveIEverRoundReset,
    getTruthOrDareEnabledPunishments,
    isTruthOrDarePromptHeistEnabled,
    getTruthOrDarePromptHeistTimeLimit,
    applyTruthOrDarePassConsequence,
    addScoreToTruthOrDareCurrentPlayer,
    getTruthOrDareCompletionScore,
    applyTruthOrDareRoundReset,
    applyImposterRoundReset,
    getMostFrequentNonTiedVote: mafiaResetTools.getMostFrequentNonTiedVote,
    getMafiaNightVote: mafiaResetTools.getMafiaNightVote,
    getMafiaTownVote: mafiaResetTools.getMafiaTownVote,
    evaluateMafiaGameOver: mafiaResetTools.evaluateMafiaGameOver,
    resetMafiaVotes: mafiaResetTools.resetMafiaVotes
  };
}

module.exports = { createPartyGameResetTools };

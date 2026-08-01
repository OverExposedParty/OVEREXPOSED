function handleCoreRoundAction(action, context) {
  const {
    SCORE_RULES,
    getPartyPlayerId,
    shouldUsePlayerTurnOrder,
    getPlayerTurnOrder,
    initializePlayerTurnOrder,
    getTurnPlayer,
    advancePlayerTurn,
    getPartyPlayerState,
    getPartyRuleValue,
    addScoreToPartyPlayer,
    assertActorCanControlParty,
    actorId,
    payload,
    workingParty,
    config,
    state,
    deck,
    players,
    allowBypass,
    getTimelinePlayerName,
    getTimelinePlayerIcon,
    appendNeverHaveIEverTimelineEvent,
    appendWouldYouRatherTimelineEvent,
    appendMostLikelyToTimelineEvent,
    appendParanoiaTimelineEvent
  } = context;

  switch (action) {
      case 'reset-question': {
        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (deck) {
          const currentCardIndex =
            deck.currentCardIndex ?? workingParty.currentCardIndex ?? 0;
          deck.currentCardIndex = currentCardIndex + 1;
        }

        const rawIncrementScore = Number(payload.incrementScore ?? 0);
        const isParanoiaReset =
          (config.gamemode || workingParty.gamemode) === 'paranoia';
        let incrementScore = Number.isFinite(rawIncrementScore)
          ? rawIncrementScore
          : 0;
        let paranoiaSelector = null;
        let paranoiaTarget = null;

        if (isParanoiaReset) {
          paranoiaSelector = getTurnPlayer(
            players,
            state,
            state.playerTurn ?? 0
          );
          paranoiaTarget =
            payload.playerIndex !== null && payload.playerIndex !== undefined
              ? players[payload.playerIndex]
              : paranoiaSelector;

          if (incrementScore > 0) {
            incrementScore = SCORE_RULES.paranoia.revealQuestionTargetBonus;
            addScoreToPartyPlayer(
              paranoiaSelector,
              SCORE_RULES.paranoia.revealQuestionSelectorPenalty
            );
          } else if (incrementScore < 0) {
            incrementScore = SCORE_RULES.paranoia.revealMissPenalty;

            if (
              paranoiaSelector &&
              paranoiaTarget &&
              String(getPartyPlayerId(paranoiaSelector)) !==
                String(getPartyPlayerId(paranoiaTarget))
            ) {
              addScoreToPartyPlayer(
                paranoiaSelector,
                SCORE_RULES.paranoia.keepQuestionSecretBonus
              );
            }
          }
        }

        if (
          isParanoiaReset &&
          payload.playerIndex !== null &&
          payload.playerIndex !== undefined
        ) {
          addScoreToPartyPlayer(paranoiaTarget, incrementScore);
        } else if (
          state.playerTurn !== undefined &&
          state.playerTurn !== null
        ) {
          const currentPlayer = shouldUsePlayerTurnOrder(workingParty)
            ? getTurnPlayer(players, state, state.playerTurn)
            : players[state.playerTurn];
          addScoreToPartyPlayer(currentPlayer, incrementScore);
        } else if (
          payload.playerIndex !== null &&
          payload.playerIndex !== undefined
        ) {
          const selectedPlayer = players[payload.playerIndex];
          addScoreToPartyPlayer(selectedPlayer, incrementScore);
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          if (
            [
              'never-have-i-ever',
              'would-you-rather',
              'most-likely-to',
              'paranoia'
            ].includes(config.gamemode || workingParty.gamemode) &&
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

        if (
          (config.gamemode || workingParty.gamemode) === 'never-have-i-ever'
        ) {
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
          state.roundTimeline = [];
          appendNeverHaveIEverTimelineEvent({ type: 'question-shown' });
          appendNeverHaveIEverTimelineEvent({ type: 'players-answering' });
        }

        if ((config.gamemode || workingParty.gamemode) === 'would-you-rather') {
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
          state.roundTimeline = [];
          appendWouldYouRatherTimelineEvent({ type: 'question-shown' });
          appendWouldYouRatherTimelineEvent({ type: 'players-choosing' });
        }

        if ((config.gamemode || workingParty.gamemode) === 'most-likely-to') {
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
          state.roundTimeline = [];
          appendMostLikelyToTimelineEvent({ type: 'question-shown' });
          appendMostLikelyToTimelineEvent({ type: 'players-voting' });
        }

        if ((config.gamemode || workingParty.gamemode) === 'paranoia') {
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
          state.roundTimeline = [];
          appendParanoiaTimelineEvent({
            type: 'question-shown',
            player: getTurnPlayer(players, state, state.playerTurn ?? 0)
          });
          appendParanoiaTimelineEvent({
            type: 'target-selection',
            player: getTurnPlayer(players, state, state.playerTurn ?? 0)
          });
        }

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

        if ((config.gamemode || workingParty.gamemode) === 'paranoia') {
          const currentSelector = getTurnPlayer(
            players,
            state,
            state.playerTurn ?? 0
          );
          const selectorEvents = Array.isArray(state.roundTimeline)
            ? state.roundTimeline.filter((event) =>
                ['question-shown', 'target-selection'].includes(event?.type)
              )
            : [];
          if (currentSelector) {
            selectorEvents.forEach((event) => {
              event.playerId = getPartyPlayerId(currentSelector);
              event.playerName = getTimelinePlayerName(currentSelector);
              event.playerIcon = getTimelinePlayerIcon(currentSelector);
            });
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
        state.completedRounds = 0;
        state.speakingRound = 0;
        state.speakingPlayerTurn = 0;
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

    default:
      return false;
  }

  return true;
}

module.exports = {
  handleCoreRoundAction
};

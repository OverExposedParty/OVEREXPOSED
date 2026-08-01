function handleCoreLifecycleAction(action, context) {
  const {
    getPartyPlayerId,
    appendPartyAccountStatEvent,
    createAccountStatEvent,
    shouldUsePlayerTurnOrder,
    initializePlayerTurnOrder,
    getTurnPlayer,
    assertOnlinePlayerRestrictions,
    getPartyPlayerState,
    assertActorCanControlParty,
    actorId,
    payload,
    workingParty,
    config,
    state,
    deck,
    players,
    ensureAchievementData,
    appendTruthOrDareTimelineEvent,
    appendNeverHaveIEverTimelineEvent,
    appendWouldYouRatherTimelineEvent,
    appendMostLikelyToTimelineEvent,
    appendParanoiaTimelineEvent
  } = context;

  switch (action) {
      case 'start-game': {
        assertActorCanControlParty(workingParty, actorId, false);

        const gamemode = config.gamemode || workingParty.gamemode;

        if (payload.bypassPlayerRestrictions !== true) {
          assertOnlinePlayerRestrictions({ gamemode, players });
        }

        state.isPlaying = true;
        state.completedRounds = 0;
        state.lastPinged = new Date();
        state.hostComputerId = state.hostComputerId ?? actorId;
        state.hostComputerIdList = players
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);
        state.achievementData = {
          ...ensureAchievementData(),
          skipOccurred: false,
          comebackHalfwayLowestPlayerIds: null
        };

        if (
          [
            'truth-or-dare',
            'never-have-i-ever',
            'would-you-rather',
            'most-likely-to',
            'paranoia',
            'imposter'
          ].includes(gamemode)
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.participationStatus = 'active';
            playerState.reconnectDeadline = null;
          });
          state.roundParticipantIds = players
            .map((player) => getPartyPlayerId(player))
            .filter(Boolean);
          state.roundTimeline = [];
        }

        if (gamemode === 'never-have-i-ever') {
          appendNeverHaveIEverTimelineEvent({ type: 'question-shown' });
          appendNeverHaveIEverTimelineEvent({ type: 'players-answering' });
        }

        if (gamemode === 'would-you-rather') {
          appendWouldYouRatherTimelineEvent({ type: 'question-shown' });
          appendWouldYouRatherTimelineEvent({ type: 'players-choosing' });
        }

        if (gamemode === 'most-likely-to') {
          appendMostLikelyToTimelineEvent({ type: 'question-shown' });
          appendMostLikelyToTimelineEvent({ type: 'players-voting' });
        }

        if (gamemode === 'imposter') {
          state.roundTimeline = [
            { type: 'roles-assigned', at: Date.now() },
            { type: 'viewing-prompts', at: Date.now() + 1 }
          ];
        }

        if (shouldUsePlayerTurnOrder(workingParty)) {
          initializePlayerTurnOrder(state, players);
        }

        if (gamemode === 'paranoia') {
          appendParanoiaTimelineEvent({
            type: 'question-shown',
            player: getTurnPlayer(players, state, state.playerTurn ?? 0)
          });
          appendParanoiaTimelineEvent({
            type: 'target-selection',
            player: getTurnPlayer(players, state, state.playerTurn ?? 0)
          });
        }

        if (gamemode === 'truth-or-dare') {
          appendTruthOrDareTimelineEvent({
            type: 'choosing-question-type',
            player: getTurnPlayer(players, state, state.playerTurn ?? 0)
          });
        }

        const lobbyCreatedAt = new Date(
          workingParty.session?.createdAt ||
            workingParty.session?.access?.createdAt ||
            0
        );
        const startDelayMs = Date.now() - lobbyCreatedAt.getTime();
        if (
          Number.isFinite(startDelayMs) &&
          startDelayMs >= 0 &&
          startDelayMs <= 60 * 1000
        ) {
          const hostPlayer = players.find(
            (player) => String(getPartyPlayerId(player)) === String(actorId)
          );
          appendPartyAccountStatEvent(
            workingParty,
            createAccountStatEvent(gamemode, [
              {
                player: hostPlayer,
                paths: { 'achievement.theOrganiser': 1 }
              }
            ])
          );
        }
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

      case 'return-to-lobby': {
        assertActorCanControlParty(workingParty, actorId, false);

        const gamemode = config.gamemode || workingParty.gamemode;
        config.userInstructions = '';
        state.userInstructions = '';
        state.isPlaying = false;
        state.phase = 'lobby';
        state.phaseData = null;
        state.timer = null;
        state.completedRounds = 0;
        state.playerTurn = 0;
        state.playerTurnOrder = [];
        state.roundParticipantIds = [];
        state.speakingRound = 0;
        state.speakingPlayerTurn = 0;
        state.round = 0;
        state.roundPlayerTurn = 0;
        state.vote = null;
        state.lastPinged = new Date();

        if (deck) {
          deck.currentCardIndex = 0;
          deck.currentCardSecondIndex = 0;
          deck.alternativeQuestionIndex = 0;
          if (deck.questionType !== undefined) {
            deck.questionType = 'truth';
          }
        }

        players.forEach((player) => {
          const playerId = getPartyPlayerId(player);
          const playerState = getPartyPlayerState(player);
          const isHost =
            state.hostComputerId &&
            String(playerId) === String(state.hostComputerId);

          playerState.isReady = Boolean(isHost);
          playerState.hasConfirmed = false;
          playerState.vote = gamemode === 'mafia' ? 'N/A' : null;
          playerState.score = 0;
          playerState.participationStatus = 'active';
          playerState.reconnectDeadline = null;
          player.isReady = playerState.isReady;
          player.hasConfirmed = false;
          player.vote = playerState.vote;
          player.score = 0;

          if (gamemode === 'mafia') {
            playerState.roleKey = null;
            playerState.status = 'alive';
          }
        });
        break;
      }

    default:
      return false;
  }

  return true;
}

module.exports = {
  handleCoreLifecycleAction
};

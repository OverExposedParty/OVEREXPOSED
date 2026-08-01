function createImposterActionHandler() {
  return function handleImposterAction(action, context) {
    const {
      getPartyPlayerId,
      appendPartyAccountStatEvent,
      createImposterVoteOutcomeStatEvent,
      getPartyPlayerState,
      getPartyRuleValue,
      addImposterVoteOutcomeScores,
      applyImposterRoundReset,
      assertActorCanControlParty,
      actorId,
      payload,
      workingParty,
      config,
      state,
      players,
      allowBypass
    } = context;

    switch (action) {
      case 'imposter-advance-answer-turn': {
        if ((config.gamemode || workingParty.gamemode) !== 'imposter') {
          const error = new Error('This action is only valid for Imposter.');
          error.status = 400;
          throw error;
        }

        const participantIds = new Set(
          (state.roundParticipantIds || []).map(String)
        );
        const eligibleSpeakerIndexes = players
          .map((player, index) => ({ player, index }))
          .filter(({ player }) => {
            const playerState = getPartyPlayerState(player);
            const socketId = player.connection?.socketId ?? player.socketId;
            return (
              playerState.participationStatus !== 'pending_next_round' &&
              socketId !== 'DISCONNECTED' &&
              (participantIds.size === 0 ||
                participantIds.has(String(getPartyPlayerId(player))))
            );
          })
          .map(({ index }) => index);
        const currentSpeakingTurn =
          state.speakingPlayerTurn ?? state.roundPlayerTurn ?? 0;
        const currentSpeaker = players[currentSpeakingTurn];
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

        const playerCount = eligibleSpeakerIndexes.length;
        if (playerCount === 0) {
          const error = new Error(
            'No players available for Imposter round advancement.'
          );
          error.status = 400;
          throw error;
        }

        const speakingRoundsLimit = Number(payload.speakingRoundsLimit ?? 5);
        if (
          payload.expectedSpeakingRound !== undefined &&
          Number(payload.expectedSpeakingRound) !==
            Number(state.speakingRound ?? state.round ?? 0)
        ) {
          state.lastPinged = new Date();
          break;
        }
        if (
          payload.expectedSpeakingPlayerTurn !== undefined &&
          Number(payload.expectedSpeakingPlayerTurn) !==
            Number(currentSpeakingTurn)
        ) {
          state.lastPinged = new Date();
          break;
        }

        const currentEligiblePosition = Math.max(
          0,
          eligibleSpeakerIndexes.indexOf(currentSpeakingTurn)
        );
        const nextEligiblePosition =
          (currentEligiblePosition + 1) % playerCount;
        const nextSpeakingPlayerTurn =
          eligibleSpeakerIndexes[nextEligiblePosition];
        const wrapped = nextEligiblePosition === 0;
        const nextSpeakingRound =
          (state.speakingRound ?? state.round ?? 0) + (wrapped ? 1 : 0);

        if (nextSpeakingRound >= speakingRoundsLimit) {
          state.speakingRound = 0;
          state.speakingPlayerTurn = 0;
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
          state.speakingRound = nextSpeakingRound;
          state.speakingPlayerTurn = nextSpeakingPlayerTurn;
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

        const roundParticipantIds = new Set(
          (state.roundParticipantIds || []).map(String)
        );
        const roundPlayers = players.filter((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          return (
            playerState.participationStatus !== 'pending_next_round' &&
            (roundParticipantIds.size === 0 ||
              roundParticipantIds.has(String(playerId)))
          );
        });
        const voteCounts = new Map();
        roundPlayers.forEach((player) => {
          const targetId =
            getPartyPlayerState(player).vote ?? player.vote ?? null;
          if (!targetId) return;
          voteCounts.set(targetId, (voteCounts.get(targetId) ?? 0) + 1);
        });

        const maxVotes = Math.max(0, ...voteCounts.values());
        const highestVotedIds = [...voteCounts.entries()]
          .filter(([, count]) => count === maxVotes)
          .map(([targetId]) => targetId);
        const imposterVoteCount = voteCounts.get(imposterId) ?? 0;
        const imposterCaught =
          maxVotes > 0 &&
          highestVotedIds.includes(imposterId) &&
          highestVotedIds.length === 1;
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';
        const outcomeScoresAlreadyApplied =
          state.phaseData?.imposterVoteOutcomeScoresApplied === true;

        if (!outcomeScoresAlreadyApplied) {
          addImposterVoteOutcomeScores({
            players: roundPlayers,
            imposterId,
            imposterCaught,
            imposterVoteCount
          });
          appendPartyAccountStatEvent(
            workingParty,
            createImposterVoteOutcomeStatEvent({
              players: roundPlayers,
              imposterId,
              imposterCaught
            })
          );
        }

        if (imposterCaught && drinkPunishmentEnabled) {
          state.phase = 'imposter-choose-punishment';
          state.phaseData = {
            targetId: imposterId,
            imposterVoteOutcomeScoresApplied: true
          };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.roundTimeline ||= [];
          state.roundTimeline.push({
            type: 'choosing-punishment',
            at: Date.now(),
            playerId: imposterId
          });
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
          ...(state.phaseData || {}),
          targetId,
          punishmentType
        };
        state.roundTimeline ||= [];
        state.roundTimeline.push({
          type: 'punishment-in-progress',
          at: Date.now(),
          playerId: targetId,
          punishmentType
        });
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
          ...(state.phaseData || {}),
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
          completeGameLoop: false,
          timer: payload.timer ?? null,
          resetInstruction: payload.resetInstruction ?? 'DISPLAY_START_TIMER',
          alternativeQuestionIndex: payload.alternativeQuestionIndex
        });
        break;
      }
      default:
        return false;
    }

    return true;
  };
}

module.exports = {
  createImposterActionHandler
};

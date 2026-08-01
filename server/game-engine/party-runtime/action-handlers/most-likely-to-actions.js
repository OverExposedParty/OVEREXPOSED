const {
  assertMostLikelyToGamemode,
  assertMostLikelyToTargetActor,
  getMostLikelyToPlayerIndexById,
  requireMostLikelyToPunishmentPhase,
  requireMostLikelyToPunishmentType
} = require('./most-likely-to-tools');

function createMostLikelyToActionHandler() {
  return function handleMostLikelyToAction(action, context) {
    const {
      SCORE_RULES,
      getPartyPlayerId,
      appendPartyAccountStatEvent,
      createMostLikelyToRoundStatEvent,
      createMostLikelyToOutcomeStatEvent,
      getPartyPlayerState,
      getMostLikelyToHighestVoteValue,
      getMostLikelyToHighestVotedIds,
      getMostLikelyToEnabledPunishments,
      applyMostLikelyToRoundReset,
      getMostLikelyToVoteSnapshot,
      addMostLikelyToPickedScores,
      addMostLikelyToCorrectVoteScores,
      assertActorCanControlParty,
      actorId,
      payload,
      workingParty,
      config,
      state,
      players,
      allowBypass,
      appendMostLikelyToTimelineEvent,
      getCurrentRoundPlayers
    } = context;

    switch (action) {
      case 'most-likely-to-resolve-vote-results': {
        assertMostLikelyToGamemode({ config, workingParty });

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const currentRoundPlayers = getCurrentRoundPlayers();
        appendMostLikelyToTimelineEvent({ type: 'votes-revealed' });

        const highestValue =
          getMostLikelyToHighestVoteValue(currentRoundPlayers);
        const highestVotedIds = new Set(
          getMostLikelyToHighestVotedIds(currentRoundPlayers)
        );
        const voteSnapshot = getMostLikelyToVoteSnapshot(currentRoundPlayers);
        const resultScoresAlreadyApplied =
          state.phaseData?.mostLikelyToResultScoresApplied === true;

        const hasSingleHighestVote =
          highestValue > 0 && highestVotedIds.size === 1;

        if (!resultScoresAlreadyApplied) {
          addMostLikelyToPickedScores(currentRoundPlayers, voteSnapshot);
          appendPartyAccountStatEvent(
            workingParty,
            createMostLikelyToRoundStatEvent(
              currentRoundPlayers,
              voteSnapshot,
              hasSingleHighestVote ? [...highestVotedIds][0] : null
            )
          );

          if (hasSingleHighestVote) {
            addMostLikelyToCorrectVoteScores(
              currentRoundPlayers,
              [...highestVotedIds][0],
              voteSnapshot
            );
          }
        }

        currentRoundPlayers.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isHighestVoted = highestVotedIds.has(playerId);
          const desiredReady = !isHighestVoted;
          const desiredConfirmed = !isHighestVoted;

          playerState.isReady = desiredReady;
          playerState.hasConfirmed = desiredConfirmed;
          player.isReady = desiredReady;
          player.hasConfirmed = desiredConfirmed;
        });

        state.phase = null;
        state.phaseData = {
          ...(state.phaseData || {}),
          mostLikelyToVoteSnapshot: voteSnapshot,
          mostLikelyToResultScoresApplied: true,
          mostLikelyToCorrectVoteScoreApplied: hasSingleHighestVote
        };
        state.lastPinged = new Date();
        break;
      }

      case 'most-likely-to-resolve-tiebreaker': {
        assertMostLikelyToGamemode({ config, workingParty });

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
        const voteSnapshot = Array.isArray(
          state.phaseData?.mostLikelyToVoteSnapshot
        )
          ? state.phaseData.mostLikelyToVoteSnapshot
          : getMostLikelyToVoteSnapshot(getCurrentRoundPlayers());

        if (state.phaseData?.mostLikelyToCorrectVoteScoreApplied !== true) {
          addMostLikelyToCorrectVoteScores(
            getCurrentRoundPlayers(),
            chosenId,
            voteSnapshot
          );
        }
        appendPartyAccountStatEvent(
          workingParty,
          createMostLikelyToOutcomeStatEvent(
            getCurrentRoundPlayers(),
            voteSnapshot,
            chosenId
          )
        );

        state.phase = 'most-likely-to-choose-punishment';
        state.phaseData = {
          targetId: chosenId,
          mostLikelyToVoteSnapshot: voteSnapshot,
          mostLikelyToResultScoresApplied: true,
          mostLikelyToCorrectVoteScoreApplied: true
        };
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        appendMostLikelyToTimelineEvent({
          type: 'choosing-punishment',
          playerId: chosenId
        });
        break;
      }

      case 'most-likely-to-advance-from-results': {
        assertMostLikelyToGamemode({ config, workingParty });

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const currentRoundPlayers = getCurrentRoundPlayers();
        const highestValue =
          getMostLikelyToHighestVoteValue(currentRoundPlayers);
        const highestVotedIds =
          getMostLikelyToHighestVotedIds(currentRoundPlayers);
        const enabledPunishments = getMostLikelyToEnabledPunishments(config);
        const voteSnapshot = Array.isArray(
          state.phaseData?.mostLikelyToVoteSnapshot
        )
          ? state.phaseData.mostLikelyToVoteSnapshot
          : getMostLikelyToVoteSnapshot(currentRoundPlayers);
        const resultScoresApplied =
          state.phaseData?.mostLikelyToResultScoresApplied === true;
        let correctVoteScoreApplied =
          state.phaseData?.mostLikelyToCorrectVoteScoreApplied === true;

        if (!resultScoresApplied) {
          addMostLikelyToPickedScores(currentRoundPlayers, voteSnapshot);
          appendPartyAccountStatEvent(
            workingParty,
            createMostLikelyToRoundStatEvent(
              currentRoundPlayers,
              voteSnapshot,
              highestValue > 0 && highestVotedIds.length === 1
                ? highestVotedIds[0]
                : null
            )
          );
        }

        const hasSingleHighestVote =
          highestValue > 0 && highestVotedIds.length === 1;

        if (hasSingleHighestVote && !correctVoteScoreApplied) {
          addMostLikelyToCorrectVoteScores(
            currentRoundPlayers,
            highestVotedIds[0] ?? null,
            voteSnapshot
          );
          correctVoteScoreApplied = true;
        }

        if (enabledPunishments.length === 0 || highestValue === 0) {
          applyMostLikelyToRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        if (highestValue < 0) {
          currentRoundPlayers.forEach((player) => {
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
            tiedIds: highestVotedIds,
            mostLikelyToVoteSnapshot: voteSnapshot,
            mostLikelyToResultScoresApplied: true,
            mostLikelyToCorrectVoteScoreApplied: correctVoteScoreApplied
          };
          state.timer = payload.phaseTimer ?? state.timer ?? null;
          state.lastPinged = new Date();
          appendMostLikelyToTimelineEvent({
            type: 'tiebreaker-voting',
            targetIds: highestVotedIds
          });
          break;
        }

        if (!correctVoteScoreApplied) {
          addMostLikelyToCorrectVoteScores(
            currentRoundPlayers,
            highestVotedIds[0] ?? null,
            voteSnapshot
          );
        }

        state.phase = 'most-likely-to-choose-punishment';
        state.phaseData = {
          targetId: highestVotedIds[0] ?? null,
          mostLikelyToVoteSnapshot: voteSnapshot,
          mostLikelyToResultScoresApplied: true,
          mostLikelyToCorrectVoteScoreApplied: true
        };
        state.timer = payload.phaseTimer ?? state.timer ?? null;
        state.lastPinged = new Date();
        appendMostLikelyToTimelineEvent({
          type: 'choosing-punishment',
          playerId: highestVotedIds[0] ?? null
        });
        break;
      }

      case 'most-likely-to-select-punishment': {
        assertMostLikelyToGamemode({ config, workingParty });

        const { targetId } = requireMostLikelyToPunishmentPhase({
          state,
          expectedPhase: 'most-likely-to-choose-punishment',
          message: 'Most Likely To is not currently choosing a punishment.'
        });
        assertMostLikelyToTargetActor({
          actorId,
          targetId,
          message: 'Only the selected player can choose the punishment.'
        });
        const punishmentType = requireMostLikelyToPunishmentType(payload);

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

      case 'most-likely-to-pass-punishment': {
        assertMostLikelyToGamemode({ config, workingParty });

        const { targetId } = requireMostLikelyToPunishmentPhase({
          state,
          expectedPhase: 'most-likely-to-choose-punishment',
          message: 'Most Likely To is not currently choosing a punishment.'
        });
        assertMostLikelyToTargetActor({
          actorId,
          targetId,
          message: 'Only the selected player can pass the punishment.'
        });
        const targetIndex = getMostLikelyToPlayerIndexById(
          players,
          getPartyPlayerId,
          targetId
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

      case 'most-likely-to-resolve-drink-wheel': {
        assertMostLikelyToGamemode({ config, workingParty });

        const { phaseData, targetId } = requireMostLikelyToPunishmentPhase({
          state,
          expectedPhase: 'most-likely-to-show-punishment',
          message: 'Most Likely To is not currently resolving a punishment.'
        });
        assertMostLikelyToTargetActor({
          actorId,
          targetId,
          message: 'Only the selected player can resolve the drink wheel.'
        });
        const punishmentType = requireMostLikelyToPunishmentType(payload);

        state.phaseData = {
          ...phaseData,
          targetId,
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        appendMostLikelyToTimelineEvent({
          type: 'punishment-in-progress',
          playerId: targetId,
          targetIds: [targetId],
          punishmentType
        });
        break;
      }

      case 'most-likely-to-complete-punishment': {
        assertMostLikelyToGamemode({ config, workingParty });

        const { targetId } = requireMostLikelyToPunishmentPhase({
          state,
          expectedPhase: 'most-likely-to-show-punishment',
          message: 'Most Likely To is not currently resolving a punishment.'
        });
        assertMostLikelyToTargetActor({
          actorId,
          targetId,
          message: 'Only the selected player can complete the punishment.'
        });
        const targetIndex = getMostLikelyToPlayerIndexById(
          players,
          getPartyPlayerId,
          targetId
        );

        applyMostLikelyToRoundReset({
          workingParty,
          playerIndex: targetIndex === -1 ? null : targetIndex,
          incrementScore: SCORE_RULES['most-likely-to'].completePunishment,
          timer: payload.roundTimer ?? null
        });
        break;
      }

      case 'most-likely-to-handle-phase-timeout': {
        assertMostLikelyToGamemode({ config, workingParty });

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
          appendMostLikelyToTimelineEvent({
            type: 'choosing-punishment',
            playerId: tiedIds[0]
          });
          break;
        }

        if (state.phase === 'most-likely-to-choose-punishment') {
          const targetId = state.phaseData?.targetId ?? null;
          const targetIndex = getMostLikelyToPlayerIndexById(
            players,
            getPartyPlayerId,
            targetId
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
      default:
        return false;
    }

    return true;
  };
}

module.exports = {
  createMostLikelyToActionHandler
};

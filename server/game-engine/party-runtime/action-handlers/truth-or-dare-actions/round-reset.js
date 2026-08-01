const {
  assertTruthOrDareAction,
  getCurrentTurnPlayer
} = require('./shared');

function getRoundPlayers(context) {
  const { getPartyPlayerId, getPartyPlayerState, players, state } = context;
  const hasParticipantSnapshot =
    Array.isArray(state.roundParticipantIds) &&
    (state.roundParticipantIds.length > 0 ||
      players.some((player) => {
        const status = getPartyPlayerState(player).participationStatus;
        return status && status !== 'active';
      }));
  const participantIds = new Set((state.roundParticipantIds || []).map(String));

  return {
    hasParticipantSnapshot,
    roundPlayers: hasParticipantSnapshot
      ? players.filter((player) =>
          participantIds.has(String(getPartyPlayerId(player)))
        )
      : players
  };
}

function createTruthOrDareRoundResetHandlers() {
  return {
    'truth-or-dare-reset-round'(context) {
      const {
        getPartyPlayerId,
        getPartyPlayerState,
        getTruthOrDareCompletionScore,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        applyTruthOrDareRoundReset,
        actorId,
        payload,
        workingParty,
        state,
        deck,
        players,
        markSkippedAchievement,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer, playerId: turnPlayerId } =
        getCurrentTurnPlayer(context);
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

        const { roundPlayers } = getRoundPlayers(context);
        roundPlayers.forEach((player) => {
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
          const error = new Error('Player not found for round reset confirmation.');
          error.status = 404;
          throw error;
        }
        const actorState = getPartyPlayerState(actorPlayer);
        actorState.hasConfirmed = true;
        actorPlayer.hasConfirmed = true;
      }

      const { roundPlayers } = getRoundPlayers(context);
      const allConfirmed = roundPlayers.every((player) => {
        const playerState = getPartyPlayerState(player);
        return (
          playerState.participationStatus === 'disconnected' ||
          playerState.hasConfirmed === true
        );
      });
      if (!allConfirmed) {
        state.lastPinged = new Date();
        return;
      }

      const completionSignal = Number(payload.incrementScore ?? 0) > 0;
      const incrementScore = completionSignal
        ? getTruthOrDareCompletionScore(workingParty)
        : Number(payload.incrementScore ?? 0);
      if (force && !completionSignal && incrementScore === 0) {
        markSkippedAchievement();
      }

      if (completionSignal) {
        appendTruthOrDareTimelineEvent({
          type: 'prompt-completed',
          player: turnPlayer,
          questionType: deck.questionType ?? null
        });
        appendPartyAccountStatEvent(
          workingParty,
          createAccountStatEvent('truth-or-dare', [
            {
              player: turnPlayer,
              paths:
                deck.questionType === 'dare'
                  ? {
                      'stats.daresCompleted': 1,
                      'achievement.truthOrDareDareCompleted': 1,
                      ...(payload.isNsfwDare === true
                        ? { 'achievement.nsfwDareCompleted': 1 }
                        : {})
                    }
                  : {
                      'stats.truthsCompleted': 1,
                      'achievement.truthOrDareTruthCompleted': 1
                    }
            }
          ])
        );
      }

      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore,
        nextPlayer: payload.nextPlayer !== false,
        timer: payload.timer ?? null
      });
    }
  };
}

module.exports = { createTruthOrDareRoundResetHandlers };

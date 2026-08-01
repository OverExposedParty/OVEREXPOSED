const { assertTruthOrDareAction, getCurrentTurnPlayer } = require('./shared');

function createTruthOrDareTimeoutHandlers() {
  return {
    'truth-or-dare-handle-card-timeout'(context) {
      const {
        attachRewardProgress,
        assertActorCanControlParty,
        appendPartyAccountStatEvent,
        applyTruthOrDarePassConsequence,
        actorId,
        allowBypass,
        markSkippedAchievement,
        payload,
        workingParty,
        state,
        deck,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);
      assertActorCanControlParty(workingParty, actorId, allowBypass);

      markSkippedAchievement();
      const timeoutPlayer = getCurrentTurnPlayer(context).player;
      appendTruthOrDareTimelineEvent({
        type: 'prompt-timed-out',
        player: timeoutPlayer,
        questionType: deck.questionType ?? null
      });
      appendPartyAccountStatEvent(
        workingParty,
        attachRewardProgress(
          { gameMode: 'truth-or-dare', increments: [] },
          [timeoutPlayer]
        )
      );
      applyTruthOrDarePassConsequence({
        workingParty,
        phaseTimer: payload.phaseTimer ?? state.timer ?? null,
        roundTimer: payload.roundTimer ?? null,
        timedOut: true
      });
      if (state.phase === 'truth-or-dare-choose-punishment') {
        appendTruthOrDareTimelineEvent({
          type: 'choosing-punishment',
          player: timeoutPlayer
        });
      }
    },

    'truth-or-dare-handle-punishment-timeout'(context) {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        applyTruthOrDareRoundReset,
        actorId,
        allowBypass,
        payload,
        workingParty,
        state,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const timeoutPlayer = getCurrentTurnPlayer(context).player;
      if (!allowBypass) {
        const hostId = state.hostComputerId ?? null;
        const turnPlayerId = getPartyPlayerId(timeoutPlayer);
        const isHostActor = hostId && actorId && String(hostId) === String(actorId);
        const isCurrentPlayerActor =
          turnPlayerId && actorId && String(turnPlayerId) === String(actorId);

        if (!isHostActor && !isCurrentPlayerActor) {
          const error = new Error(
            'Only the host or current player can resolve the punishment.'
          );
          error.status = 403;
          throw error;
        }
      }

      const punishmentTimeoutScore = state.phaseData?.passScoreApplied
        ? 0
        : SCORE_RULES['truth-or-dare'].passUnresolved;
      appendTruthOrDareTimelineEvent({
        type: 'punishment-timed-out',
        player: timeoutPlayer
      });
      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore: punishmentTimeoutScore,
        nextPlayer: true,
        timer: payload.roundTimer ?? null
      });
    }
  };
}

module.exports = { createTruthOrDareTimeoutHandlers };

const {
  assertTruthOrDareAction,
  getCurrentTurnPlayer,
  assertCurrentTurnPlayer
} = require('./shared');

function createTruthOrDarePromptFlowHandlers() {
  return {
    'truth-or-dare-select-question-type'(context) {
      const {
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        attachRewardProgress,
        payload,
        workingParty,
        config,
        state,
        deck,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer } = assertCurrentTurnPlayer(
        context,
        'Only the current player can choose truth or dare.'
      );
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
      appendTruthOrDareTimelineEvent({
        type: 'question-type-selected',
        player: turnPlayer,
        questionType
      });
      appendTruthOrDareTimelineEvent({
        type: 'deciding-answer-or-pass',
        player: turnPlayer,
        questionType
      });
      appendPartyAccountStatEvent(
        workingParty,
        attachRewardProgress(
          createAccountStatEvent('truth-or-dare', [
            { player: turnPlayer, paths: { roundsPlayed: 1 } }
          ]),
          [turnPlayer],
          { takenPredicate: () => true }
        )
      );
      state.phase = null;
      state.phaseData = null;
      state.timer = payload.timer ?? state.timer ?? null;
      config.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.lastPinged = new Date();
    },

    'truth-or-dare-pass-question'(context) {
      const {
        getTruthOrDarePromptHeistTimeLimit,
        isTruthOrDarePromptHeistEnabled,
        applyTruthOrDarePassConsequence,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        markSkippedAchievement,
        payload,
        workingParty,
        config,
        state,
        deck,
        players,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const {
        playerTurn,
        player: turnPlayer,
        playerId: turnPlayerId
      } = assertCurrentTurnPlayer(
        context,
        'Only the current player can pass this question.'
      );
      const promptWasAlreadyStolen = state.phaseData?.promptHeist === true;
      markSkippedAchievement();
      appendTruthOrDareTimelineEvent({
        type: 'prompt-passed',
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
                    'stats.daresSkipped': 1,
                    'stats.promptsSkipped': 1,
                    'achievement.truthOrDarePromptSkipped': 1
                  }
                : {
                    'stats.truthsSkipped': 1,
                    'stats.promptsSkipped': 1,
                    'achievement.truthOrDarePromptSkipped': 1
                  }
          }
        ])
      );

      if (
        isTruthOrDarePromptHeistEnabled(config) &&
        !promptWasAlreadyStolen &&
        players.length > 1
      ) {
        state.phase = 'truth-or-dare-prompt-heist';
        state.phaseData = {
          passedPlayerId: turnPlayerId,
          originalPlayerTurn: playerTurn
        };
        state.timer =
          payload.heistTimer ??
          Date.now() + getTruthOrDarePromptHeistTimeLimit(config) * 1000;
        appendTruthOrDareTimelineEvent({
          type: 'prompt-heist-opened',
          player: turnPlayer
        });
        state.lastPinged = new Date();
        return;
      }

      applyTruthOrDarePassConsequence({
        workingParty,
        phaseTimer: payload.phaseTimer ?? state.timer ?? null,
        roundTimer: payload.roundTimer ?? null
      });
      if (state.phase === 'truth-or-dare-choose-punishment') {
        appendTruthOrDareTimelineEvent({
          type: 'choosing-punishment',
          player: turnPlayer
        });
      }
    },

    'truth-or-dare-start-prompt'(context) {
      const { config, state, deck, appendTruthOrDareTimelineEvent } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer } = assertCurrentTurnPlayer(
        context,
        'Only the current player can start this prompt.'
      );
      appendTruthOrDareTimelineEvent({
        type: 'doing-prompt',
        player: turnPlayer,
        questionType: deck.questionType ?? null
      });
      config.userInstructions = 'DISPLAY_COMPLETE_QUESTION';
      state.userInstructions = 'DISPLAY_COMPLETE_QUESTION';
      state.lastPinged = new Date();
    },

    'truth-or-dare-claim-prompt-heist'(context) {
      const {
        getPlayerTurnOrder,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      if (state.phase !== 'truth-or-dare-prompt-heist') {
        const error = new Error('Prompt Heist is not active.');
        error.status = 400;
        throw error;
      }

      const passedPlayerId = state.phaseData?.passedPlayerId ?? null;
      if (!actorId || String(actorId) === String(passedPlayerId)) {
        const error = new Error('The passing player cannot claim the prompt.');
        error.status = 403;
        throw error;
      }

      const order = getPlayerTurnOrder(state, players);
      const claimingTurnIndex = order.findIndex(
        (playerId) => String(playerId) === String(actorId)
      );
      if (claimingTurnIndex === -1) {
        const error = new Error('Claiming player not found.');
        error.status = 404;
        throw error;
      }

      const claimingPlayer = players.find(
        (player) => String(getPartyPlayerId(player)) === String(actorId)
      );
      state.playerTurn = claimingTurnIndex;
      appendTruthOrDareTimelineEvent({
        type: 'prompt-heist-claimed',
        player: claimingPlayer
      });
      state.phase = null;
      state.phaseData = {
        promptHeist: true,
        passedPlayerId,
        claimedByPlayerId: actorId,
        originalPlayerTurn: state.phaseData?.originalPlayerTurn ?? null
      };
      appendPartyAccountStatEvent(
        workingParty,
        createAccountStatEvent(
          'truth-or-dare',
          [{ player: claimingPlayer, paths: { 'stats.promptHeists': 1 } }],
          { feature: 'party-games.prompt-heist' }
        )
      );
      state.timer = payload.timer ?? state.timer ?? null;
      config.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.userInstructions = 'DISPLAY_PUBLIC_CARD';
      state.lastPinged = new Date();
    },

    'truth-or-dare-resolve-prompt-heist'(context) {
      const {
        assertActorCanControlParty,
        applyTruthOrDarePassConsequence,
        actorId,
        allowBypass,
        payload,
        workingParty,
        state,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);
      assertActorCanControlParty(workingParty, actorId, allowBypass);

      if (state.phase !== 'truth-or-dare-prompt-heist') return;

      appendTruthOrDareTimelineEvent({ type: 'prompt-heist-expired' });
      applyTruthOrDarePassConsequence({
        workingParty,
        phaseTimer: payload.phaseTimer ?? state.timer ?? null,
        roundTimer: payload.roundTimer ?? null
      });
      if (state.phase === 'truth-or-dare-choose-punishment') {
        appendTruthOrDareTimelineEvent({
          type: 'choosing-punishment',
          player: getCurrentTurnPlayer(context).player
        });
      }
    }
  };
}

module.exports = { createTruthOrDarePromptFlowHandlers };

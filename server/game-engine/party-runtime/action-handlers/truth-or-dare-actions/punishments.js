const {
  appendPunishmentChoiceTimelineEvent,
  assertCurrentTurnPlayer,
  assertTruthOrDareAction
} = require('./shared');

function getPunishmentType(payload) {
  const punishmentType = String(payload.punishmentType || '').trim();
  if (punishmentType) return punishmentType;

  const error = new Error('punishmentType is required.');
  error.status = 400;
  throw error;
}

function applySelectedPunishment(context, punishmentType) {
  const { payload, config, state } = context;
  state.phase = 'truth-or-dare-show-punishment';
  state.phaseData = { ...(state.phaseData || {}), punishmentType };
  state.timer =
    payload.phaseTimer ??
    Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
  state.lastPinged = new Date();
}

function createTruthOrDarePunishmentHandlers() {
  return {
    'truth-or-dare-select-punishment'(context) {
      const {
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        workingParty,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer } = assertCurrentTurnPlayer(
        context,
        'Only the current player can choose the punishment.'
      );
      const punishmentType = getPunishmentType(context.payload);

      appendTruthOrDareTimelineEvent({
        type: 'punishment-selected',
        player: turnPlayer,
        punishmentType
      });
      appendPartyAccountStatEvent(
        workingParty,
        createAccountStatEvent('truth-or-dare', [
          { player: turnPlayer, paths: { 'stats.drinkWheelSpins': 1 } }
        ])
      );
      applySelectedPunishment(context, punishmentType);
      appendPunishmentChoiceTimelineEvent(context, turnPlayer, punishmentType);
    },

    'truth-or-dare-resolve-drink-wheel'(context) {
      const { appendTruthOrDareTimelineEvent } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer } = assertCurrentTurnPlayer(
        context,
        'Only the current player can resolve the drink wheel.'
      );
      const punishmentType = getPunishmentType(context.payload);

      appendTruthOrDareTimelineEvent({
        type: 'punishment-selected',
        player: turnPlayer,
        punishmentType
      });
      applySelectedPunishment(context, punishmentType);
    },

    'truth-or-dare-complete-punishment'(context) {
      const {
        SCORE_RULES,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        applyTruthOrDareRoundReset,
        payload,
        workingParty,
        state,
        appendTruthOrDareTimelineEvent
      } = context;
      assertTruthOrDareAction(context);

      const { player: turnPlayer } = assertCurrentTurnPlayer(
        context,
        'Only the current player can complete the punishment.'
      );
      const punishmentCompletionScore =
        state.phaseData?.promptHeist === true
          ? SCORE_RULES['truth-or-dare'].passStolenPromptWithPunishment
          : SCORE_RULES['truth-or-dare'].passWithPunishment;
      appendPartyAccountStatEvent(
        workingParty,
        createAccountStatEvent('truth-or-dare', [
          { player: turnPlayer, paths: { 'stats.punishmentsCompleted': 1 } }
        ])
      );
      appendTruthOrDareTimelineEvent({
        type: 'punishment-completed',
        player: turnPlayer
      });
      applyTruthOrDareRoundReset({
        workingParty,
        incrementScore: punishmentCompletionScore,
        nextPlayer: true,
        timer: payload.roundTimer ?? null
      });
    }
  };
}

module.exports = { createTruthOrDarePunishmentHandlers };

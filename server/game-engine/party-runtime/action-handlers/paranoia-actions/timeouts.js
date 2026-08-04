function createParanoiaTimeoutHandlers() {
  return {
    'paranoia-handle-reveal-timeout': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        getTurnPlayer,
        applyParanoiaRoundReset,
        addScoreToPartyPlayerById,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass
      } = context;
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
        return;
      }
      const turnPlayer = getTurnPlayer(players, state, state.playerTurn ?? 0);
      const turnPlayerId = getPartyPlayerId(turnPlayer);
      addScoreToPartyPlayerById(
        players,
        turnPlayerId,
        SCORE_RULES.paranoia.revealQuestionSelectorPenalty
      );
      appendPartyAccountStatEvent(
        workingParty,
        createAccountStatEvent('paranoia', [
          {
            player: players.find(
              (player) =>
                String(getPartyPlayerId(player)) ===
                String(state.phaseData?.targetId)
            ),
            paths: { 'stats.revealsSurvived': 1 }
          }
        ])
      );
      applyParanoiaRoundReset({
        workingParty,
        incrementScore: SCORE_RULES.paranoia.revealQuestionTargetBonus,
        nextPlayer: true,
        timer: payload.roundTimer ?? null
      });
    },
    'paranoia-handle-phase-timeout': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass
      } = context;
      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }
      assertActorCanControlParty(workingParty, actorId, allowBypass);
      if (state.phase === 'paranoia-choose-punishment') {
        const targetId = state.phaseData?.targetId ?? null;
        const selector = getTurnPlayer(players, state, state.playerTurn ?? 0);
        const targetIndex = players.findIndex(
          (player) => getPartyPlayerId(player) === targetId
        );
        if (
          targetId &&
          String(getPartyPlayerId(selector)) !== String(targetId)
        ) {
          addScoreToPartyPlayer(
            selector,
            SCORE_RULES.paranoia.keepQuestionSecretBonus
          );
        }
        applyParanoiaRoundReset({
          workingParty,
          currentPlayerIndex: targetIndex === -1 ? null : targetIndex,
          incrementScore: SCORE_RULES.paranoia.revealMissPenalty,
          nextPlayer: true,
          timer: payload.roundTimer ?? null
        });
        return;
      }
      if (state.phase === 'paranoia-show-punishment') {
        const turnPlayer = getTurnPlayer(players, state, state.playerTurn ?? 0);
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
            currentPlayerIndex: turnPlayerIndex === -1 ? null : turnPlayerIndex,
            incrementScore: SCORE_RULES.paranoia.revealMissPenalty,
            nextPlayer: true,
            timer: payload.roundTimer ?? null
          });
        } else {
          addParanoiaRevealMissScores(players, turnPlayerId, targetId);
          state.phase = null;
          state.phaseData = null;
          config.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
          state.userInstructions = 'USER_HAS_PASSED:USER_PASSED_PUNISHMENT';
          state.lastPinged = new Date();
        }
        return;
      }
      if (state.phase === 'paranoia-confirm-punishment') {
        const turnPlayer = getTurnPlayer(players, state, state.playerTurn ?? 0);
        const targetId = state.phaseData?.targetId ?? null;
        addParanoiaRevealMissScores(
          players,
          getPartyPlayerId(turnPlayer),
          targetId
        );
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
        return;
      }
      state.lastPinged = new Date();
    }
  };
}
module.exports = { createParanoiaTimeoutHandlers };

const {
  appendParanoiaAccountStat,
  assertParanoiaGamemode,
  findPlayerByPartyId,
  requirePunishmentType,
  requireTargetActor,
  resetPunishmentConfirmations,
  setParanoiaPunishmentInProgress,
  setParanoiaUserPassed
} = require('./punishment-flow-tools');

function createParanoiaPunishmentFlowHandlers() {
  return {
    'paranoia-select-punishment': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });
      const targetId = requireTargetActor({
        state,
        actorId,
        message: 'Only the selected player can choose the punishment.'
      });
      const punishmentType = requirePunishmentType(payload);
      setParanoiaPunishmentInProgress({
        state,
        config,
        payload,
        targetId,
        punishmentType,
        appendParanoiaTimelineEvent
      });
    },
    'paranoia-resolve-drink-wheel': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });
      const targetId = requireTargetActor({
        state,
        actorId,
        message: 'Only the selected player can resolve the drink wheel.'
      });
      const punishmentType = requirePunishmentType(payload);
      setParanoiaPunishmentInProgress({
        state,
        config,
        payload,
        targetId,
        punishmentType,
        appendParanoiaTimelineEvent
      });
    },
    'paranoia-resolve-coin-flip': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });
      const targetId = state.phaseData?.targetId ?? null;
      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = getTurnPlayer(players, state, playerTurn);
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      requireTargetActor({
        state,
        actorId,
        message: 'Only the selected player can resolve the coin flip.'
      });

      if (payload.matchedFace === true) {
        appendParanoiaAccountStat({
          workingParty,
          players,
          getPartyPlayerId,
          appendPartyAccountStatEvent,
          createAccountStatEvent,
          playerId: targetId,
          paths: { 'stats.revealsTriggered': 1 }
        });
        resetPunishmentConfirmations(players, getPartyPlayerState);

        state.phase = null;
        state.phaseData = {
          targetId,
          revealTargetId: targetId,
          punishmentType: 'lucky-coin-flip'
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        config.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
        state.userInstructions = 'DISPLAY_DUAL_STACK_CARD';
      } else {
        addParanoiaRevealMissScores(players, turnPlayerId, targetId);
        appendParanoiaAccountStat({
          workingParty,
          players,
          getPartyPlayerId,
          appendPartyAccountStatEvent,
          createAccountStatEvent,
          playerId: targetId,
          paths: { 'stats.revealsFailed': 1 }
        });

        state.phase = null;
        state.phaseData = {
          targetId,
          punishmentType: 'lucky-coin-flip',
          completionReason: 'USER_CALLED_WRONG_FACE'
        };
        config.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
        state.userInstructions = 'USER_HAS_PASSED:USER_CALLED_WRONG_FACE';
      }

      state.lastPinged = new Date();
    },
    'paranoia-begin-punishment-confirmation': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });
      const targetId = requireTargetActor({
        state,
        actorId,
        message: 'Only the selected player can start punishment confirmation.'
      });
      const punishmentType = state.phaseData?.punishmentType ?? null;

      resetPunishmentConfirmations(players, getPartyPlayerState);

      const targetPlayer = findPlayerByPartyId(
        players,
        getPartyPlayerId,
        targetId
      );
      if (targetPlayer) {
        const targetState = getPartyPlayerState(targetPlayer);
        targetState.isReady = true;
        targetState.hasConfirmed = true;
        targetPlayer.isReady = true;
        targetPlayer.hasConfirmed = true;
      }

      state.phase = 'paranoia-confirm-punishment';
      state.phaseData = {
        targetId,
        punishmentType,
        completionReason: payload.completionReason ?? punishmentType
      };
      state.timer =
        payload.phaseTimer ??
        Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
      state.lastPinged = new Date();
    },
    'paranoia-submit-punishment-vote': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });

      if (state.phase !== 'paranoia-confirm-punishment') {
        const error = new Error(
          'Paranoia is not currently confirming a punishment.'
        );
        error.status = 409;
        throw error;
      }

      const targetId = state.phaseData?.targetId ?? null;
      const completionReason = state.phaseData?.completionReason ?? null;
      const actorPlayer = players.find(
        (player) => getPartyPlayerId(player) === actorId
      );

      if (!actorPlayer) {
        const error = new Error('Voting player not found.');
        error.status = 404;
        throw error;
      }

      if (String(actorId) === String(targetId)) {
        const error = new Error(
          'Selected player cannot submit confirmation votes here.'
        );
        error.status = 403;
        throw error;
      }

      const actorState = getPartyPlayerState(actorPlayer);
      actorState.isReady = true;
      actorState.hasConfirmed = Boolean(payload.option);
      actorPlayer.isReady = true;
      actorPlayer.hasConfirmed = Boolean(payload.option);

      const totalUsersReady = players.filter(
        (player) => getPartyPlayerState(player).isReady === true
      ).length;

      if (totalUsersReady === players.length) {
        const yesVoteCount = players.filter(
          (player) => getPartyPlayerState(player).hasConfirmed === true
        ).length;
        const noVoteCount = players.filter(
          (player) => getPartyPlayerState(player).hasConfirmed === false
        ).length;

        if (noVoteCount < yesVoteCount) {
          if (completionReason === 'QUESTION') {
            const selector = getTurnPlayer(
              players,
              state,
              state.playerTurn ?? 0
            );
            addScoreToPartyPlayerById(
              players,
              getPartyPlayerId(selector),
              SCORE_RULES.paranoia.revealQuestionSelectorPenalty
            );
            applyParanoiaRoundReset({
              workingParty,
              incrementScore: SCORE_RULES.paranoia.revealQuestionTargetBonus,
              nextPlayer: true,
              timer: payload.roundTimer ?? null
            });
          } else {
            resetPunishmentConfirmations(players, getPartyPlayerState);

            state.phase = null;
            state.phaseData = null;
            state.timer =
              payload.phaseTimer ??
              payload.roundTimer ??
              Date.now() +
                Number(config.gameRules?.['time-limit'] || 120) * 1000;
            config.userInstructions = 'NEXT_QUESTION';
            state.userInstructions = 'NEXT_QUESTION';
            state.lastPinged = new Date();
          }
        } else {
          const selector = getTurnPlayer(players, state, state.playerTurn ?? 0);
          addParanoiaRevealMissScores(
            players,
            getPartyPlayerId(selector),
            targetId
          );
          appendPartyAccountStatEvent(
            workingParty,
            createParanoiaAchievementEvent(players, {
              type: 'paranoia-punishment-denied',
              targetPlayerId: String(targetId)
            })
          );

          setParanoiaUserPassed({
            state,
            config,
            reason: 'USER_DIDNT_DO_PUNISHMENT'
          });
        }
      } else {
        state.lastPinged = new Date();
      }
    },
    'paranoia-pass-punishment': (context) => {
      const {
        SCORE_RULES,
        getPartyPlayerId,
        appendPartyAccountStatEvent,
        createAccountStatEvent,
        createParanoiaAchievementEvent,
        attachRewardProgress,
        getTurnPlayer,
        getPartyPlayerState,
        applyParanoiaRoundReset,
        addScoreToPartyPlayer,
        addScoreToPartyPlayerById,
        addParanoiaRevealMissScores,
        assertActorCanControlParty,
        actorId,
        payload,
        workingParty,
        config,
        state,
        players,
        allowBypass,
        appendParanoiaTimelineEvent,
        getCurrentRoundPlayers
      } = context;

      assertParanoiaGamemode({ config, workingParty });

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = getTurnPlayer(players, state, playerTurn);
      const turnPlayerId = getPartyPlayerId(turnPlayer);
      const targetId = state.phaseData?.targetId ?? turnPlayerId ?? null;

      if (!targetId || String(targetId) !== String(actorId)) {
        const error = new Error(
          'Only the selected player can pass the punishment.'
        );
        error.status = 403;
        throw error;
      }

      if (turnPlayerId && String(turnPlayerId) === String(actorId)) {
        appendParanoiaAccountStat({
          workingParty,
          players,
          getPartyPlayerId,
          appendPartyAccountStatEvent,
          createAccountStatEvent,
          player: turnPlayer,
          playerId: turnPlayerId,
          paths: { 'stats.revealsFailed': 1 }
        });
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
        appendParanoiaAccountStat({
          workingParty,
          players,
          getPartyPlayerId,
          appendPartyAccountStatEvent,
          createAccountStatEvent,
          playerId: targetId,
          paths: { 'stats.revealsFailed': 1 }
        });

        setParanoiaUserPassed({
          state,
          config,
          reason: 'USER_PASSED_PUNISHMENT'
        });
      }
    }
  };
}

module.exports = {
  createParanoiaPunishmentFlowHandlers
};

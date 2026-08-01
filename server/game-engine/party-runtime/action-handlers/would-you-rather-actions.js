function createWouldYouRatherActionHandler() {
  return function handleWouldYouRatherAction(action, context) {
    const {
      getPartyPlayerId,
      appendPartyAccountStatEvent,
      createAccountStatEvent,
      createWouldYouRatherRoundStatEvent,
      getPartyPlayerState,
      getPartyRuleValue,
      addWouldYouRatherVoteResultScores,
      applyWouldYouRatherRoundReset,
      assertActorCanControlParty,
      actorId,
      payload,
      workingParty,
      config,
      state,
      players,
      allowBypass,
      appendWouldYouRatherTimelineEvent
    } = context;

    switch (action) {
      case 'would-you-rather-resolve-vote-results': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const roundParticipantIds = new Set(
          (state.roundParticipantIds || []).map(String)
        );
        const eligibleVoters = players.filter((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const socketId = player.connection?.socketId ?? player.socketId;
          return (
            socketId !== 'DISCONNECTED' &&
            playerState.participationStatus !== 'pending_next_round' &&
            (roundParticipantIds.size === 0 ||
              roundParticipantIds.has(String(playerId)))
          );
        });

        const aVoteCount = eligibleVoters.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === 'A'
        ).length;
        const bVoteCount = eligibleVoters.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === 'B'
        ).length;
        const nullVoteCount = eligibleVoters.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) == null
        ).length;
        const winningVote =
          aVoteCount === bVoteCount
            ? null
            : aVoteCount > bVoteCount
              ? 'A'
              : 'B';

        const oddManOutEnabled =
          getPartyRuleValue(config, 'odd-man-out') === true ||
          getPartyRuleValue(config, 'odd-man-out') === 'true';
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';
        const resultScoresAlreadyApplied =
          state.phaseData?.wouldYouRatherResultScoresApplied === true;

        appendWouldYouRatherTimelineEvent({ type: 'votes-revealed' });

        if (!resultScoresAlreadyApplied) {
          addWouldYouRatherVoteResultScores(eligibleVoters);
          appendPartyAccountStatEvent(
            workingParty,
            createWouldYouRatherRoundStatEvent(eligibleVoters)
          );
        }

        if (!drinkPunishmentEnabled) {
          applyWouldYouRatherRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        if (
          oddManOutEnabled &&
          ((aVoteCount === 1 && bVoteCount > 1) ||
            (bVoteCount === 1 && aVoteCount > 1))
        ) {
          const oddVote = aVoteCount === 1 ? 'A' : 'B';
          const oddPlayer =
            eligibleVoters.find(
              (player) =>
                (getPartyPlayerState(player).vote ?? player.vote) === oddVote
            ) ?? null;
          const targetId = getPartyPlayerId(oddPlayer);

          if (!targetId) {
            applyWouldYouRatherRoundReset({
              workingParty,
              timer: payload.roundTimer ?? null
            });
            break;
          }

          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            const playerId = getPartyPlayerId(player);
            const isTarget = String(playerId) === String(targetId);
            playerState.isReady = !isTarget;
            playerState.hasConfirmed = !isTarget;
            player.isReady = !isTarget;
            player.hasConfirmed = !isTarget;
          });

          state.phase = 'would-you-rather-spin-odd-man-out';
          state.phaseData = {
            targetIds: [targetId],
            punishmentType: 'DRINK_WHEEL',
            winningVote,
            wouldYouRatherResultScoresApplied: true
          };
          state.timer =
            payload.phaseTimer ??
            Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
          state.lastPinged = new Date();
          appendWouldYouRatherTimelineEvent({
            type: 'odd-man-out-spinning',
            player: oddPlayer,
            playerId: targetId
          });
          break;
        }

        const punishedIds = eligibleVoters
          .filter((player) => {
            const vote =
              getPartyPlayerState(player).vote ?? player.vote ?? null;
            return winningVote == null ? vote == null : vote !== winningVote;
          })
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);

        if (punishedIds.length === 0) {
          applyWouldYouRatherRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null
          });
          break;
        }

        players.forEach((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          const isTarget = punishedIds.includes(playerId);
          playerState.isReady = !isTarget;
          playerState.hasConfirmed = !isTarget;
          player.isReady = !isTarget;
          player.hasConfirmed = !isTarget;
        });

        state.phase = 'would-you-rather-show-punishment';
        state.phaseData = {
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP',
          winningVote,
          wouldYouRatherResultScoresApplied: true
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        appendWouldYouRatherTimelineEvent({
          type: 'punishment-in-progress',
          playerId: punishedIds[0] || null,
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP'
        });
        break;
      }

      case 'would-you-rather-resolve-drink-wheel': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only the odd-man-out player can resolve the drink wheel.'
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

        state.phase = 'would-you-rather-show-punishment';
        state.phaseData = {
          ...(state.phaseData || {}),
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        appendWouldYouRatherTimelineEvent({
          type: 'punishment-in-progress',
          playerId: targetIds[0] || null,
          targetIds,
          punishmentType
        });
        break;
      }

      case 'would-you-rather-complete-punishment': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        const targetIds = Array.isArray(state.phaseData?.targetIds)
          ? state.phaseData.targetIds.filter(Boolean)
          : [];

        if (!targetIds.includes(actorId)) {
          const error = new Error(
            'Only punished players can complete this punishment.'
          );
          error.status = 403;
          throw error;
        }

        const actorTarget = players.find(
          (player) => getPartyPlayerId(player) === actorId
        );
        if (!actorTarget) {
          const error = new Error('Punished player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorTarget);
        actorState.isReady = true;
        actorState.hasConfirmed = true;
        actorTarget.isReady = true;
        actorTarget.hasConfirmed = true;
        appendPartyAccountStatEvent(
          workingParty,
          createAccountStatEvent('would-you-rather', [
            {
              player: actorTarget,
              paths: { 'stats.drinkPunishmentsCompleted': 1 }
            }
          ])
        );

        const roundParticipantIds = new Set(
          (state.roundParticipantIds || []).map(String)
        );
        const allReady = players.every((player) => {
          const playerState = getPartyPlayerState(player);
          const playerId = getPartyPlayerId(player);
          return (
            playerState.participationStatus === 'pending_next_round' ||
            (roundParticipantIds.size > 0 &&
              !roundParticipantIds.has(String(playerId))) ||
            playerState.isReady === true
          );
        });
        if (allReady) {
          const nextRoundTimer =
            payload.roundTimer ??
            (payload.nextRoundTimerDurationMs != null
              ? Date.now() + Number(payload.nextRoundTimerDurationMs)
              : null);

          applyWouldYouRatherRoundReset({
            workingParty,
            timer: nextRoundTimer
          });
        } else {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'would-you-rather-handle-phase-timeout': {
        if ((config.gamemode || workingParty.gamemode) !== 'would-you-rather') {
          const error = new Error(
            'This action is only valid for Would You Rather.'
          );
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        if (state.phase === 'would-you-rather-show-punishment') {
          const nextRoundTimer =
            payload.roundTimer ??
            (payload.nextRoundTimerDurationMs != null
              ? Date.now() + Number(payload.nextRoundTimerDurationMs)
              : null);

          applyWouldYouRatherRoundReset({
            workingParty,
            timer: nextRoundTimer
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
  createWouldYouRatherActionHandler
};

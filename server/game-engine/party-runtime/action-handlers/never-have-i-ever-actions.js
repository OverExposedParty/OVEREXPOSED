function createNeverHaveIEverActionHandler() {
  return function handleNeverHaveIEverAction(action, context) {
    const {
      getPartyPlayerId,
      appendPartyAccountStatEvent,
      createAccountStatEvent,
      createNeverHaveIEverRoundStatEvent,
      getPartyPlayerState,
      getPartyRuleValue,
      addNeverHaveIEverVoteResultScores,
      applyNeverHaveIEverRoundReset,
      assertActorCanControlParty,
      actorId,
      payload,
      workingParty,
      config,
      state,
      players,
      allowBypass,
      appendNeverHaveIEverTimelineEvent
    } = context;

    switch (action) {
      case 'never-have-i-ever-resolve-vote-results': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
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
          const vote = playerState.vote ?? player.vote;
          return (
            socketId !== 'DISCONNECTED' &&
            playerState.participationStatus !== 'pending_next_round' &&
            (roundParticipantIds.size === 0 ||
              roundParticipantIds.has(String(playerId))) &&
            typeof vote === 'boolean'
          );
        });

        const haveVoteCount = eligibleVoters.filter(
          (player) => (getPartyPlayerState(player).vote ?? player.vote) === true
        ).length;
        const haveNotVoteCount = eligibleVoters.filter(
          (player) =>
            (getPartyPlayerState(player).vote ?? player.vote) === false
        ).length;

        const oddManOutEnabled =
          getPartyRuleValue(config, 'odd-man-out') === true ||
          getPartyRuleValue(config, 'odd-man-out') === 'true';
        const drinkPunishmentEnabled =
          getPartyRuleValue(config, 'drink-punishment') === true ||
          getPartyRuleValue(config, 'drink-punishment') === 'true';
        const hasOddManOut =
          (haveVoteCount === 1 && haveNotVoteCount > 1) ||
          (haveNotVoteCount === 1 && haveVoteCount > 1);

        addNeverHaveIEverVoteResultScores({
          players,
          haveVoteCount,
          haveNotVoteCount,
          oddManOutEnabled
        });

        if (state.phaseData?.neverHaveIEverStatsApplied !== true) {
          appendPartyAccountStatEvent(
            workingParty,
            createNeverHaveIEverRoundStatEvent({
              players,
              rewardEligiblePlayers: players.filter((player) => {
                const playerState = getPartyPlayerState(player);
                const playerId = getPartyPlayerId(player);
                const socketId = player.connection?.socketId ?? player.socketId;
                return (
                  socketId !== 'DISCONNECTED' &&
                  playerState.participationStatus !== 'pending_next_round' &&
                  (roundParticipantIds.size === 0 ||
                    roundParticipantIds.has(String(playerId)))
                );
              }),
              oddManOutEnabled,
              drinkPunishmentEnabled
            })
          );
          state.phaseData = {
            ...(state.phaseData || {}),
            neverHaveIEverStatsApplied: true
          };
        }

        if (!(drinkPunishmentEnabled || oddManOutEnabled)) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        if (oddManOutEnabled && hasOddManOut) {
          const oddVote = haveVoteCount === 1 ? true : false;
          const oddPlayer =
            players.find(
              (player) =>
                (getPartyPlayerState(player).vote ?? player.vote) === oddVote
            ) ?? null;
          const targetId = getPartyPlayerId(oddPlayer);

          if (!targetId) {
            applyNeverHaveIEverRoundReset({
              workingParty,
              timer: payload.roundTimer ?? null,
              nextPlayer: payload.nextPlayer ?? true
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

          state.phase = 'never-have-i-ever-spin-odd-man-out';
          state.phaseData = {
            targetIds: [targetId],
            punishmentType: 'DRINK_WHEEL'
          };
          state.timer =
            payload.phaseTimer ??
            Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
          state.lastPinged = new Date();
          appendNeverHaveIEverTimelineEvent({
            type: 'odd-man-out-spinning',
            player: oddPlayer
          });
          break;
        }

        if (haveVoteCount === 0) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
          break;
        }

        const punishedIds = players
          .filter(
            (player) =>
              (getPartyPlayerState(player).vote ?? player.vote) === true
          )
          .map((player) => getPartyPlayerId(player))
          .filter(Boolean);

        if (punishedIds.length === 0) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
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

        state.phase = 'never-have-i-ever-show-punishment';
        state.phaseData = {
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP'
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        appendNeverHaveIEverTimelineEvent({
          type: 'punishment-in-progress',
          playerId: punishedIds[0],
          targetIds: punishedIds,
          punishmentType: 'TAKE_A_SIP'
        });
        break;
      }

      case 'never-have-i-ever-resolve-drink-wheel': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
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

        state.phase = 'never-have-i-ever-show-punishment';
        state.phaseData = {
          ...(state.phaseData || {}),
          punishmentType
        };
        state.timer =
          payload.phaseTimer ??
          Date.now() + Number(config.gameRules?.['time-limit'] || 120) * 1000;
        state.lastPinged = new Date();
        appendNeverHaveIEverTimelineEvent({
          type: 'punishment-in-progress',
          playerId: targetIds[0],
          targetIds,
          punishmentType
        });
        break;
      }

      case 'never-have-i-ever-complete-punishment': {
        if (
          (config.gamemode || workingParty.gamemode) !== 'never-have-i-ever'
        ) {
          const error = new Error(
            'This action is only valid for Never Have I Ever.'
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
          createAccountStatEvent('never-have-i-ever', [
            {
              player: actorTarget,
              paths: { 'stats.drinkPunishmentsCompleted': 1 }
            }
          ])
        );

        const participantIds = new Set(
          (state.roundParticipantIds || []).map(String)
        );
        const allReady = players
          .filter((player) => {
            const playerState = getPartyPlayerState(player);
            return (
              playerState.participationStatus !== 'pending_next_round' &&
              (participantIds.size === 0 ||
                participantIds.has(String(getPartyPlayerId(player))))
            );
          })
          .every((player) => getPartyPlayerState(player).isReady === true);
        if (allReady) {
          applyNeverHaveIEverRoundReset({
            workingParty,
            timer: payload.roundTimer ?? null,
            nextPlayer: payload.nextPlayer ?? true
          });
        } else {
          state.lastPinged = new Date();
        }
        break;
      }
      default:
        return false;
    }

    return true;
  };
}

module.exports = {
  createNeverHaveIEverActionHandler
};

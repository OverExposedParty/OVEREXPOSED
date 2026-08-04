function createParanoiaTargetSelectionHandlers() {
  return {
    'paranoia-select-target': (context) => {
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

      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = getTurnPlayer(players, state, playerTurn);
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayerId || String(turnPlayerId) !== String(actorId)) {
        const error = new Error('Only the current player can select a target.');
        error.status = 403;
        throw error;
      }

      const targetId = String(payload.targetId || '').trim();
      if (!targetId) {
        const error = new Error('targetId is required.');
        error.status = 400;
        throw error;
      }

      if (
        !getCurrentRoundPlayers().some(
          (player) => String(getPartyPlayerId(player)) === String(targetId)
        )
      ) {
        const error = new Error(
          'That player will join at the next round and cannot be selected yet.'
        );
        error.status = 409;
        error.code = 'party_target_pending_next_round';
        throw error;
      }

      const actorState = getPartyPlayerState(turnPlayer);
      actorState.vote = targetId;
      actorState.isReady = true;
      actorState.hasConfirmed = true;
      turnPlayer.vote = targetId;
      turnPlayer.isReady = true;
      turnPlayer.hasConfirmed = true;
      addScoreToPartyPlayer(turnPlayer, SCORE_RULES.paranoia.selectTarget);
      appendPartyAccountStatEvent(
        workingParty,
        attachRewardProgress(
          createAccountStatEvent('paranoia', [
            {
              player: turnPlayer,
              paths: {
                roundsPlayed: 1,
                'stats.questionsAsked': 1,
                'stats.playersSelected': 1
              }
            },
            {
              player: players.find(
                (player) =>
                  String(getPartyPlayerId(player)) === String(targetId)
              ),
              paths: { 'stats.timesSelectedByOthers': 1 }
            }
          ]),
          [turnPlayer],
          {
            takenPredicate: () => true
          }
        )
      );
      state.achievementData =
        state.achievementData && typeof state.achievementData === 'object'
          ? state.achievementData
          : {};
      state.achievementData.paranoiaPickedCounts =
        state.achievementData.paranoiaPickedCounts &&
        typeof state.achievementData.paranoiaPickedCounts === 'object'
          ? state.achievementData.paranoiaPickedCounts
          : {};
      state.achievementData.paranoiaPickedCounts[targetId] =
        (Number(state.achievementData.paranoiaPickedCounts[targetId]) || 0) + 1;
      appendPartyAccountStatEvent(
        workingParty,
        createParanoiaAchievementEvent(players, {
          type: 'paranoia-target-selected',
          selectorPlayerId: String(turnPlayerId),
          targetPlayerId: targetId,
          pickedCountsByPlayerId: state.achievementData.paranoiaPickedCounts
        })
      );

      state.phase = 'paranoia-choose-punishment';
      state.phaseData = { targetId };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      appendParanoiaTimelineEvent({
        type: 'target-selected',
        playerId: targetId
      });
      appendParanoiaTimelineEvent({
        type: 'choosing-punishment',
        playerId: targetId
      });
    },
    'paranoia-handle-card-timeout': (context) => {
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

      if ((config.gamemode || workingParty.gamemode) !== 'paranoia') {
        const error = new Error('This action is only valid for Paranoia.');
        error.status = 400;
        throw error;
      }

      assertActorCanControlParty(workingParty, actorId, allowBypass);

      const playerTurn = state.playerTurn ?? 0;
      const turnPlayer = getTurnPlayer(players, state, playerTurn);
      const turnPlayerId = getPartyPlayerId(turnPlayer);

      if (!turnPlayer || !turnPlayerId) {
        const error = new Error(
          'Current player not found for Paranoia timeout.'
        );
        error.status = 404;
        throw error;
      }

      const turnPlayerState = getPartyPlayerState(turnPlayer);
      turnPlayerState.vote = turnPlayerId;
      turnPlayerState.isReady = true;
      turnPlayerState.hasConfirmed = true;
      turnPlayer.vote = turnPlayerId;
      turnPlayer.isReady = true;
      turnPlayer.hasConfirmed = true;
      appendPartyAccountStatEvent(
        workingParty,
        attachRewardProgress(
          createAccountStatEvent('paranoia', [
            {
              player: turnPlayer,
              paths: {
                roundsPlayed: 1,
                'stats.questionsAsked': 1,
                'stats.playersSelected': 1
              }
            }
          ]),
          [turnPlayer],
          {
            takenPredicate: () => false
          }
        )
      );

      state.phase = 'paranoia-choose-punishment';
      state.phaseData = {
        targetId: turnPlayerId
      };
      state.timer = payload.phaseTimer ?? state.timer ?? null;
      state.lastPinged = new Date();
      appendParanoiaTimelineEvent({
        type: 'target-selected',
        playerId: turnPlayerId
      });
      appendParanoiaTimelineEvent({
        type: 'choosing-punishment',
        playerId: turnPlayerId
      });
    }
  };
}

module.exports = {
  createParanoiaTargetSelectionHandlers
};

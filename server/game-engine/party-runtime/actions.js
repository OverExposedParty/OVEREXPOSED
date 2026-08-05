const {
  createPartyActionDispatcher
} = require('./action-handlers/action-dispatcher');
const { createPartyActionSnapshotTools } = require('./snapshot-tools');

function createPartyActionApplier(deps) {
  const {
    ONLINE_GAMEMODE_MIN_PLAYERS,
    ONLINE_GAMEMODE_MAX_PLAYERS,
    PLAYER_TURN_ORDER_GAMEMODES,
    formatGamemodeName,
    getServerRegion,
    SCORE_RULES,
    Account,
    debugLog,
    cloneSerializable,
    getPartyConfigDoc,
    getPartyStateDoc,
    getPartyDeckDoc,
    getPartyPlayersDoc,
    getPartyPlayerId,
    getPartyPlayerAccountId,
    appendPartyAccountStatEvent,
    createAccountStatEvent,
    createMostLikelyToRoundStatEvent,
    createMostLikelyToOutcomeStatEvent,
    createParanoiaAchievementEvent,
    createNeverHaveIEverRoundStatEvent,
    createWouldYouRatherRoundStatEvent,
    createImposterVoteOutcomeStatEvent,
    attachRewardProgress,
    createMafiaStartStatEvent,
    createMafiaGameOverStatEvent,
    getMafiaTeamForRole,
    shuffleValues,
    shuffleTurnOrderValues,
    shouldUsePlayerTurnOrder,
    getPlayerTurnOrder,
    initializePlayerTurnOrder,
    getTurnPlayer,
    getTurnPlayerIndex,
    advancePlayerTurn,
    assertOnlinePlayerRestrictions,
    getPartyPlayerState,
    ensurePartyPlayerConnection,
    getPartyInstruction,
    getPartyRuleValue,
    getVoteCountForTarget,
    getMostLikelyToHighestVoteValue,
    getMostLikelyToHighestVotedIds,
    getMostLikelyToEnabledPunishments,
    applyMostLikelyToRoundReset,
    applyParanoiaRoundReset,
    addScoreToPartyPlayer,
    addScoreToPartyPlayerById,
    addParanoiaRevealMissScores,
    addNeverHaveIEverVoteResultScores,
    addImposterVoteOutcomeScores,
    addWouldYouRatherVoteResultScores,
    getMostLikelyToVoteSnapshot,
    addMostLikelyToPickedScores,
    addMostLikelyToCorrectVoteScores,
    applyWouldYouRatherRoundReset,
    applyNeverHaveIEverRoundReset,
    getTruthOrDareEnabledPunishments,
    isTruthOrDarePromptHeistEnabled,
    getTruthOrDarePromptHeistTimeLimit,
    applyTruthOrDarePassConsequence,
    addScoreToTruthOrDareCurrentPlayer,
    getTruthOrDareCompletionScore,
    applyTruthOrDareRoundReset,
    applyImposterRoundReset,
    getMostFrequentNonTiedVote,
    getMafiaNightVote,
    getMafiaTownVote,
    evaluateMafiaGameOver,
    resetMafiaVotes,
    mergePlayerState,
    applyPartyPatchesToSnapshot,
    assertActorCanControlParty
  } = deps;
  const dispatchPartyAction = createPartyActionDispatcher(deps);

  function applyPartyActionToSnapshot({
    party,
    action,
    actorId,
    payload = {},
    hasDeck = true
  }) {
    const previousState = getPartyStateDoc(party);
    const workingParty = cloneSerializable(party);
    const config = getPartyConfigDoc(workingParty);
    const state = getPartyStateDoc(workingParty);
    const deck = getPartyDeckDoc(workingParty, { hasDeck });
    const players = getPartyPlayersDoc(workingParty);
    const allowBypass = payload.byPassHost === true;
    const actorIndex = players.findIndex(
      (player) => getPartyPlayerId(player) === actorId
    );
    const actorPlayer = actorIndex !== -1 ? players[actorIndex] : null;
    const {
      ensureAchievementData,
      markSkippedAchievement,
      getStandingPlayerIds,
      createGameOverPlayerSnapshot,
      getTimelinePlayerName,
      getTimelinePlayerIcon,
      appendTruthOrDareTimelineEvent,
      appendNeverHaveIEverTimelineEvent,
      appendWouldYouRatherTimelineEvent,
      appendMostLikelyToTimelineEvent,
      appendParanoiaTimelineEvent,
      getCurrentRoundPlayers
    } = createPartyActionSnapshotTools({
      config,
      state,
      workingParty,
      players,
      getPartyPlayerId,
      getPartyPlayerState
    });

    if (actorPlayer) {
      const connection = ensurePartyPlayerConnection(actorPlayer);
      connection.lastPing = new Date();
      if (payload.socketId) {
        connection.socketId = payload.socketId;
        actorPlayer.socketId = payload.socketId;
      }
    }

    // Game-over is terminal until the host explicitly returns the party to the
    // lobby. Delayed timers and in-flight client actions must not restart the
    // gameplay cycle after an end-game action has landed.
    if (
      state.phase === 'game-over' &&
      action !== 'end-game' &&
      action !== 'return-to-lobby'
    ) {
      return workingParty;
    }

    const actionGamemode = config.gamemode || workingParty.gamemode;
    if (
      [
        'truth-or-dare',
        'never-have-i-ever',
        'would-you-rather',
        'most-likely-to',
        'paranoia',
        'imposter'
      ].includes(actionGamemode) &&
      state.isPlaying === true &&
      actorPlayer &&
      !['start-game', 'return-to-lobby', 'end-game'].includes(action)
    ) {
      const participantIds = new Set(
        (state.roundParticipantIds || []).map(String)
      );
      const actorStatus = getPartyPlayerState(actorPlayer).participationStatus;
      if (
        actorStatus === 'pending_next_round' ||
        actorStatus === 'disconnected'
      ) {
        const error = new Error('This player will join at the next round.');
        error.status = 409;
        error.code = 'party_player_pending_next_round';
        throw error;
      }
      if (participantIds.size > 0 && !participantIds.has(String(actorId))) {
        if (
          actionGamemode !== 'never-have-i-ever' &&
          actionGamemode !== 'would-you-rather' &&
          actionGamemode !== 'most-likely-to' &&
          actionGamemode !== 'paranoia'
        ) {
          const error = new Error('This player will join at the next round.');
          error.status = 409;
          error.code = 'party_player_pending_next_round';
          throw error;
        }

        // Question-based games can recover from stale participant snapshots.
        // Pending late-joiners are blocked above, so reaching this point means
        // the actor is an active/legacy player whose device was accidentally
        // omitted from the current question participant list. Add them back so
        // their answer is accepted and counted when results are resolved.
        const resolvedActorId = getPartyPlayerId(actorPlayer) || actorId;
        if (resolvedActorId) {
          if (!Array.isArray(state.roundParticipantIds)) {
            state.roundParticipantIds = [];
          }
          state.roundParticipantIds.push(resolvedActorId);
        }
      }
    }

    dispatchPartyAction(action, {
      actorId,
      payload,
      hasDeck,
      workingParty,
      config,
      state,
      deck,
      players,
      allowBypass,
      actorPlayer,
      ensureAchievementData,
      markSkippedAchievement,
      getTimelinePlayerName,
      getTimelinePlayerIcon,
      appendTruthOrDareTimelineEvent,
      appendNeverHaveIEverTimelineEvent,
      appendWouldYouRatherTimelineEvent,
      appendMostLikelyToTimelineEvent,
      appendParanoiaTimelineEvent,
      getCurrentRoundPlayers,
      actionGamemode
    });

    const playtimeNow = new Date();
    if (!workingParty.session || typeof workingParty.session !== 'object') {
      workingParty.session = {};
    }
    const partySession = workingParty.session;
    const wasPlaying = previousState?.isPlaying === true;
    const isPlaying = state.isPlaying === true;

    if (action === 'start-game' && isPlaying) {
      partySession.playSequence =
        Math.max(0, Number(partySession.playSequence) || 0) + 1;
      partySession.playtimeStartedAt = playtimeNow;
      partySession.playtimeAccumulatedMilliseconds = 0;
      partySession.startedAt = playtimeNow;
      partySession.endedAt = null;
    } else {
      if (wasPlaying && !partySession.playtimeStartedAt) {
        // Active parties created before playtime tracking was deployed begin
        // accruing from their next server-authoritative action.
        partySession.playtimeStartedAt = playtimeNow;
      }

      if (wasPlaying && !isPlaying) {
        const playtimeStartedAt = new Date(
          partySession.playtimeStartedAt || 0
        ).getTime();
        const elapsedMilliseconds =
          Number.isFinite(playtimeStartedAt) &&
          playtimeStartedAt > 0 &&
          playtimeStartedAt <= playtimeNow.getTime()
            ? playtimeNow.getTime() - playtimeStartedAt
            : 0;
        partySession.playtimeAccumulatedMilliseconds =
          Math.max(
            0,
            Number(partySession.playtimeAccumulatedMilliseconds) || 0
          ) + elapsedMilliseconds;
        partySession.playtimeStartedAt = null;
      } else if (!wasPlaying && isPlaying) {
        partySession.playtimeStartedAt = playtimeNow;
      }
    }

    const gamemode = config.gamemode || workingParty.gamemode;
    const configuredRounds = Math.max(0, Number(config.gameRules?.rounds) || 0);
    const completedRounds = Math.max(0, Number(state.completedRounds) || 0);
    if (
      configuredRounds > 0 &&
      completedRounds >= Math.ceil(configuredRounds / 2) &&
      !Array.isArray(state.achievementData?.comebackHalfwayLowestPlayerIds)
    ) {
      ensureAchievementData().comebackHalfwayLowestPlayerIds =
        getStandingPlayerIds((scores) => Math.min(...scores));
    }

    const gameJustEnded =
      previousState.phase !== 'game-over' && state.phase === 'game-over';

    if (gameJustEnded) {
      partySession.endedAt = playtimeNow;
      const phaseData =
        state.phaseData && typeof state.phaseData === 'object'
          ? state.phaseData
          : {};
      state.phaseData = {
        ...phaseData,
        gameOverPlayers: createGameOverPlayerSnapshot()
      };

      const hostComputerId = state.hostComputerId;
      const winnerPlayerIds = new Set(
        getStandingPlayerIds((scores) => Math.max(...scores))
      );
      const comebackEligiblePlayerIds = new Set(
        Array.isArray(state.achievementData?.comebackHalfwayLowestPlayerIds)
          ? state.achievementData.comebackHalfwayLowestPlayerIds.map(String)
          : []
      );
      const sessionStartedAtValue =
        workingParty.session?.startedAt ||
        workingParty.session?.createdAt ||
        workingParty.session?.access?.createdAt ||
        null;
      const sessionStartedAt = new Date(sessionStartedAtValue || 0);
      const sessionHours =
        sessionStartedAtValue && Number.isFinite(sessionStartedAt.getTime())
          ? Math.floor((Date.now() - sessionStartedAt.getTime()) / 3600000)
          : 0;
      const noSkipCompleted =
        gamemode !== 'mafia' && state.achievementData?.skipOccurred !== true;
      const playtimeSeconds = Math.max(
        0,
        Math.floor(
          Number(partySession.playtimeAccumulatedMilliseconds) / 1000 || 0
        )
      );
      const completionEvent = createAccountStatEvent(
        gamemode,
        players.map((player) => {
          const isHost =
            String(getPartyPlayerId(player)) === String(hostComputerId);
          const playerId = String(getPartyPlayerId(player) || '');
          return {
            player,
            paths: {
              ...(gamemode === 'mafia' ? {} : { gamesPlayed: 1 }),
              ...(playtimeSeconds > 0
                ? { totalPlaytimeSeconds: playtimeSeconds }
                : {}),
              'achievement.completedParty': 1,
              ...(isHost ? { 'achievement.hostedParties': 1 } : {}),
              ...(sessionHours >= 3
                ? { 'achievement.marathonSession': sessionHours }
                : {}),
              ...(noSkipCompleted ? { 'achievement.noSkipsGiven': 1 } : {}),
              ...(winnerPlayerIds.has(playerId) &&
              comebackEligiblePlayerIds.has(playerId)
                ? { 'achievement.theComeback': 1 }
                : {})
            }
          };
        })
      );
      if (completionEvent) {
        completionEvent.selectedPacks = Array.isArray(config.selectedPacks)
          ? config.selectedPacks
          : [];
        completionEvent.participantAccountIds = players
          .map((player) => getPartyPlayerAccountId(player))
          .filter(Boolean);
        completionEvent.playerCount = players.length;
        completionEvent.maxPlayers = ONLINE_GAMEMODE_MAX_PLAYERS[gamemode];
        const timezoneOffsetMinutes = Number(payload.timezoneOffsetMinutes);
        if (
          Number.isFinite(timezoneOffsetMinutes) &&
          timezoneOffsetMinutes >= -14 * 60 &&
          timezoneOffsetMinutes <= 14 * 60
        ) {
          completionEvent.localHour = new Date(
            Date.now() - timezoneOffsetMinutes * 60 * 1000
          ).getUTCHours();
        }
        if (gamemode === 'paranoia') {
          completionEvent.achievementData = {
            type: 'paranoia-game-complete',
            pickedCountsByPlayerId:
              state.achievementData?.paranoiaPickedCounts || {},
            playerAccounts: players
              .map((player) => ({
                playerId: getPartyPlayerId(player),
                accountId: getPartyPlayerAccountId(player),
                score:
                  Number(getPartyPlayerState(player).score ?? player.score) || 0
              }))
              .filter(({ playerId, accountId }) => playerId && accountId)
          };
        } else if (gamemode === 'never-have-i-ever') {
          completionEvent.achievementData = {
            type: 'never-have-i-ever-game-complete',
            playerCount: players.length,
            playerAccounts: players
              .map((player) => ({
                playerId: getPartyPlayerId(player),
                accountId: getPartyPlayerAccountId(player)
              }))
              .filter(({ playerId, accountId }) => playerId && accountId)
          };
        }
        appendPartyAccountStatEvent(workingParty, completionEvent);
      }
    }

    return workingParty;
  }

  return {
    applyPartyActionToSnapshot
  };
}

module.exports = {
  createPartyActionApplier
};

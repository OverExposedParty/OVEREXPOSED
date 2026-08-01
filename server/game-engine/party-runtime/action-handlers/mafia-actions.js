const {
  getMafiaRoleBehaviour,
  mafiaRoleHasAction,
  MAFIA_ACTION_KEYS
} = require('../mafia-role-behaviours');

function createMafiaActionHandler() {
  return function handleMafiaAction(action, context) {
    const {
      getPartyPlayerId,
      appendPartyAccountStatEvent,
      createAccountStatEvent,
      attachRewardProgress,
      createMafiaStartStatEvent,
      createMafiaGameOverStatEvent,
      getMafiaTeamForRole,
      getPartyPlayerState,
      getMafiaNightVote,
      getMafiaTownVote,
      evaluateMafiaGameOver,
      resetMafiaVotes,
      assertActorCanControlParty,
      actorId,
      payload,
      workingParty,
      config,
      state,
      players,
      allowBypass
    } = context;

    switch (action) {
      case 'mafia-start-game': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const assignedRoleKeys = Array.isArray(payload.assignedRoleKeys)
          ? payload.assignedRoleKeys
          : [];
        if (
          assignedRoleKeys.length !== players.length ||
          assignedRoleKeys.some((roleKey) => !getMafiaRoleBehaviour(roleKey))
        ) {
          const error = new Error(
            'A complete server-generated role assignment is required to start Mafia.'
          );
          error.status = 400;
          error.code = 'invalid_mafia_role_assignment';
          throw error;
        }

        players.forEach((player, index) => {
          const playerState = getPartyPlayerState(player);
          playerState.roleKey = assignedRoleKeys[index];
          playerState.status = 'alive';
          playerState.vote = null;
          playerState.isReady = false;
          playerState.hasConfirmed = false;
          player.vote = null;
          player.isReady = false;
          player.hasConfirmed = false;
        });
        appendPartyAccountStatEvent(
          workingParty,
          createMafiaStartStatEvent(players)
        );

        state.completedRounds = 0;
        state.phase = 'night';
        state.timer = payload.timer ?? state.timer ?? null;
        config.userInstructions = 'DISPLAY_ROLE';
        state.userInstructions = 'DISPLAY_ROLE';
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-resolve-night': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const mafiaVote = getMafiaNightVote(players);
        appendPartyAccountStatEvent(
          workingParty,
          attachRewardProgress(
            createAccountStatEvent(
              'mafia',
              players
                .filter((player) => {
                  const roleKey = getPartyPlayerState(player).roleKey;
                  const vote = getPartyPlayerState(player).vote ?? player.vote;
                  return (
                    mafiaRoleHasAction(
                      roleKey,
                      'night',
                      MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
                    ) &&
                    mafiaVote &&
                    String(vote) === String(mafiaVote)
                  );
                })
                .map((player) => ({
                  player,
                  paths: { 'stats.nightKillsParticipatedIn': 1 }
                }))
            ) || {
              gameMode: 'mafia',
              increments: []
            },
            players,
            {
              availablePredicate: (player) => {
                const playerState = getPartyPlayerState(player);
                const roleKey = playerState.roleKey;
                const status = playerState.status ?? player.status;
                return (
                  status === 'alive' &&
                  mafiaRoleHasAction(
                    roleKey,
                    'night',
                    MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE
                  )
                );
              },
              takenPredicate: (player) => {
                const vote = getPartyPlayerState(player).vote ?? player.vote;
                return Boolean(mafiaVote && String(vote) === String(mafiaVote));
              }
            }
          )
        );
        state.phase = 'day';
        resetMafiaVotes(players);

        config.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
        state.userInstructions = `DISPLAY_PLAYER_KILLED:${mafiaVote}`;
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-finish-player-killed': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const killedId = String(payload.killedId || '').trim();
        if (killedId) {
          const killedPlayer = players.find(
            (player) => getPartyPlayerId(player) === killedId
          );
          if (killedPlayer) {
            const killedState = getPartyPlayerState(killedPlayer);
            killedState.status = 'dead';
            killedPlayer.status = 'dead';
            appendPartyAccountStatEvent(
              workingParty,
              createAccountStatEvent('mafia', [
                {
                  player: killedPlayer,
                  paths: { 'stats.timesKilledAtNight': 1 }
                }
              ])
            );
          }
        }

        resetMafiaVotes(players);

        const gameOverInstruction = evaluateMafiaGameOver(players);
        if (gameOverInstruction) {
          state.completedRounds =
            Math.max(0, Number(state.completedRounds) || 0) + 1;
          appendPartyAccountStatEvent(
            workingParty,
            createMafiaGameOverStatEvent(
              players,
              gameOverInstruction,
              state.completedRounds
            )
          );
          config.userInstructions = gameOverInstruction;
          state.userInstructions = gameOverInstruction;
        } else {
          config.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
          state.userInstructions = 'DISPLAY_DAY_PHASE_DISCUSSION';
          state.timer = payload.timer ?? state.timer ?? null;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'mafia-resolve-day-vote': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const townVote = getMafiaTownVote(players);
        const votedPlayer = players.find(
          (player) => String(getPartyPlayerId(player)) === String(townVote)
        );
        const votedTeam = votedPlayer
          ? getMafiaTeamForRole(getPartyPlayerState(votedPlayer).roleKey)
          : null;
        appendPartyAccountStatEvent(
          workingParty,
          attachRewardProgress(
            createAccountStatEvent(
              'mafia',
              players
                .filter(
                  (player) =>
                    (getPartyPlayerState(player).status ?? player.status) ===
                    'alive'
                )
                .map((player) => {
                  const vote = getPartyPlayerState(player).vote ?? player.vote;
                  const paths = vote ? { 'stats.dayVotesCast': 1 } : {};
                  if (
                    vote &&
                    townVote &&
                    votedTeam &&
                    String(vote) === String(townVote)
                  ) {
                    paths[
                      votedTeam === 'mafia'
                        ? 'stats.correctEliminations'
                        : 'stats.wrongEliminations'
                    ] = 1;
                  }
                  return { player, paths };
                })
            ) || {
              gameMode: 'mafia',
              increments: []
            },
            players,
            {
              availablePredicate: (player) =>
                (getPartyPlayerState(player).status ?? player.status) ===
                'alive',
              takenPredicate: (player) =>
                Boolean(getPartyPlayerState(player).vote ?? player.vote)
            }
          )
        );
        resetMafiaVotes(players);

        config.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
        state.userInstructions = `DISPLAY_TOWN_VOTE:${townVote}`;
        state.timer = payload.timer ?? state.timer ?? null;
        state.lastPinged = new Date();
        break;
      }

      case 'mafia-finish-town-vote': {
        if ((config.gamemode || workingParty.gamemode) !== 'mafia') {
          const error = new Error('This action is only valid for Mafia.');
          error.status = 400;
          throw error;
        }

        assertActorCanControlParty(workingParty, actorId, allowBypass);

        const votedOutId = String(payload.votedOutId || '').trim();
        if (votedOutId) {
          const votedPlayer = players.find(
            (player) => getPartyPlayerId(player) === votedOutId
          );
          if (votedPlayer) {
            const votedState = getPartyPlayerState(votedPlayer);
            votedState.status = 'dead';
            votedPlayer.status = 'dead';
            appendPartyAccountStatEvent(
              workingParty,
              createAccountStatEvent('mafia', [
                {
                  player: votedPlayer,
                  paths: { 'stats.timesVotedOutDuringDay': 1 }
                }
              ])
            );
          }
        }

        state.completedRounds =
          Math.max(0, Number(state.completedRounds) || 0) + 1;
        const gameOverInstruction = evaluateMafiaGameOver(players);
        if (gameOverInstruction) {
          appendPartyAccountStatEvent(
            workingParty,
            createMafiaGameOverStatEvent(
              players,
              gameOverInstruction,
              state.completedRounds
            )
          );
          config.userInstructions = gameOverInstruction;
          state.userInstructions = gameOverInstruction;
        } else {
          state.phase = 'night';
          config.userInstructions = 'DISPLAY_NIGHT_PHASE';
          state.userInstructions = 'DISPLAY_NIGHT_PHASE';
          state.timer = payload.timer ?? state.timer ?? null;
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
  createMafiaActionHandler
};

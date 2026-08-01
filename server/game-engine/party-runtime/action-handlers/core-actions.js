const { handleCoreLifecycleAction } = require('./core-actions/lifecycle');
const { handleCoreRoundAction } = require('./core-actions/rounds');
const {
  getMafiaRoleTeamKey,
  mafiaRoleHasAction,
  MAFIA_ACTION_KEYS
} = require('../mafia-role-behaviours');

function createCoreActionHandler() {
  return function handleCoreAction(action, context) {
    if (handleCoreLifecycleAction(action, context)) return true;
    if (handleCoreRoundAction(action, context)) return true;

    const {
      SCORE_RULES,
      getPartyPlayerId,
      getPartyPlayerState,
      ensurePartyPlayerConnection,
      getPartyInstruction,
      addScoreToPartyPlayer,
      applyPartyPatchesToSnapshot,
      assertActorCanControlParty,
      actorId,
      payload,
      hasDeck,
      workingParty,
      config,
      state,
      players,
      allowBypass,
      actorPlayer,
      appendNeverHaveIEverTimelineEvent,
      appendWouldYouRatherTimelineEvent,
      appendMostLikelyToTimelineEvent,
      getCurrentRoundPlayers,
      actionGamemode
    } = context;

    switch (action) {
      case 'send-instruction': {
        assertActorCanControlParty(workingParty, actorId, allowBypass);
        applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

        if (
          payload.updateUsersReady !== null &&
          payload.updateUsersReady !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.isReady = payload.updateUsersReady;
            player.isReady = payload.updateUsersReady;
          });
        }

        if (
          payload.updateUsersConfirmation !== null &&
          payload.updateUsersConfirmation !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.hasConfirmed = payload.updateUsersConfirmation;
            player.hasConfirmed = payload.updateUsersConfirmation;
          });
        }

        if (
          payload.updateUsersVote !== null &&
          payload.updateUsersVote !== undefined
        ) {
          players.forEach((player) => {
            const playerState = getPartyPlayerState(player);
            playerState.vote = payload.updateUsersVote;
            player.vote = payload.updateUsersVote;
          });
        }

        if (payload.timer !== null && payload.timer !== undefined) {
          state.timer = payload.timer;
        }

        const nextInstruction =
          payload.instruction == null
            ? getPartyInstruction(workingParty)
            : payload.instruction;

        if (nextInstruction != null) {
          config.userInstructions = nextInstruction;
          state.userInstructions = nextInstruction;
          if (
            actionGamemode === 'never-have-i-ever' &&
            String(nextInstruction).includes('DISPLAY_VOTE_RESULTS')
          ) {
            appendNeverHaveIEverTimelineEvent({ type: 'answers-revealed' });
          }
          if (
            actionGamemode === 'would-you-rather' &&
            String(nextInstruction).includes('DISPLAY_VOTE_RESULTS')
          ) {
            appendWouldYouRatherTimelineEvent({ type: 'votes-revealed' });
          }
          if (
            actionGamemode === 'most-likely-to' &&
            String(nextInstruction).includes('DISPLAY_VOTE_RESULTS')
          ) {
            appendMostLikelyToTimelineEvent({ type: 'votes-revealed' });
          }
          if (actionGamemode === 'imposter') {
            if (!Array.isArray(state.roundTimeline)) state.roundTimeline = [];
            const appendImposterEvent = (type) => {
              if (state.roundTimeline.at(-1)?.type !== type) {
                state.roundTimeline.push({ type, at: Date.now() });
              }
            };
            const instruction = String(nextInstruction);
            if (instruction.includes('DISPLAY_START_TIMER')) {
              appendImposterEvent('viewing-prompts');
            }
            if (instruction.includes('DISPLAY_ANSWER_CONTAINER')) {
              appendImposterEvent('clues-in-progress');
            }
            if (instruction.includes('DISPLAY_PRIVATE_CARD')) {
              appendImposterEvent('selecting-imposter');
            }
            if (
              instruction.includes('DISPLAY_VOTE_RESULTS') &&
              !instruction.includes('DISPLAY_VOTE_RESULTS_PART_TWO')
            ) {
              appendImposterEvent('votes-revealed');
            }
            if (instruction.includes('DISPLAY_VOTE_RESULTS_PART_TWO')) {
              appendImposterEvent('imposter-revealed');
            }
          }
        }

        state.isPlaying = payload.isPlaying ?? true;
        state.lastPinged = new Date();
        break;
      }

      case 'set-user-confirmation': {
        const targetIndex = players.findIndex(
          (player) => getPartyPlayerId(player) === payload.selectedDeviceId
        );

        if (targetIndex === -1) {
          const error = new Error('Player not found for confirmation update.');
          error.status = 404;
          throw error;
        }

        const targetPlayer = players[targetIndex];
        const targetState = getPartyPlayerState(targetPlayer);
        const targetConnection = ensurePartyPlayerConnection(targetPlayer);

        targetState.isReady = true;
        targetState.hasConfirmed = payload.option;
        targetPlayer.isReady = true;
        targetPlayer.hasConfirmed = payload.option;
        targetConnection.lastPing = new Date();
        targetPlayer.lastPing = targetConnection.lastPing;

        if (payload.userInstruction != null) {
          const nextInstruction = `${payload.userInstruction}:${payload.reason}`;
          config.userInstructions = nextInstruction;
          state.userInstructions = nextInstruction;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'set-user-bool': {
        const targetPlayer = players.find(
          (player) => getPartyPlayerId(player) === payload.selectedDeviceId
        );

        if (!targetPlayer) {
          const error = new Error('Player not found for state update.');
          error.status = 404;
          throw error;
        }

        const targetState = getPartyPlayerState(targetPlayer);

        if (
          payload.userConfirmation !== null &&
          payload.userConfirmation !== undefined
        ) {
          targetState.hasConfirmed = payload.userConfirmation;
          targetPlayer.hasConfirmed = payload.userConfirmation;
        }

        if (payload.userReady !== null && payload.userReady !== undefined) {
          targetState.isReady = payload.userReady;
          targetPlayer.isReady = payload.userReady;
        }

        const currentInstruction = getPartyInstruction(workingParty);
        if (
          payload.setInstruction == null ||
          currentInstruction.includes(payload.setInstruction)
        ) {
          state.lastPinged = new Date();
        }
        break;
      }

      case 'set-vote': {
        if (!actorPlayer) {
          const error = new Error('Voting player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorPlayer);
        const gamemode = config.gamemode || workingParty.gamemode;
        if (gamemode === 'mafia') {
          const phase = state.phase === 'day' ? 'day' : 'night';
          const requiredAction =
            phase === 'day'
              ? MAFIA_ACTION_KEYS.TOWN_VOTE
              : MAFIA_ACTION_KEYS.MAFIA_KILL_VOTE;
          const actorIsAlive =
            (actorState.status ?? actorPlayer.status) === 'alive';

          if (
            !actorIsAlive ||
            !mafiaRoleHasAction(actorState.roleKey, phase, requiredAction)
          ) {
            const error = new Error(
              `Role "${actorState.roleKey}" cannot vote during the Mafia ${phase} phase.`
            );
            error.status = 403;
            error.code = 'mafia_role_action_not_allowed';
            throw error;
          }

          const targetPlayer = players.find(
            (player) =>
              String(getPartyPlayerId(player)) === String(payload.option)
          );
          const targetState = targetPlayer
            ? getPartyPlayerState(targetPlayer)
            : null;
          const validTarget =
            targetPlayer &&
            (targetState.status ?? targetPlayer.status) === 'alive' &&
            (phase === 'day' ||
              (String(getPartyPlayerId(targetPlayer)) !== String(actorId) &&
                getMafiaRoleTeamKey(targetState.roleKey) === 'town'));

          if (!validTarget) {
            const error = new Error(
              'That player is not a valid target for this Mafia vote.'
            );
            error.status = 400;
            error.code = 'invalid_mafia_vote_target';
            throw error;
          }
        }

        const shouldAwardNeverHaveIEverSidePick =
          gamemode === 'never-have-i-ever' &&
          payload.hover !== true &&
          actorState.hasConfirmed !== true;
        const shouldAwardWouldYouRatherSidePick =
          gamemode === 'would-you-rather' &&
          payload.hover !== true &&
          actorState.hasConfirmed !== true &&
          (payload.option === 'A' || payload.option === 'B');
        const shouldAwardMostLikelyToPlayerPick =
          gamemode === 'most-likely-to' &&
          state.phase !== 'most-likely-to-tiebreaker' &&
          payload.hover !== true &&
          actorState.hasConfirmed !== true &&
          getCurrentRoundPlayers().some(
            (player) =>
              String(getPartyPlayerId(player)) === String(payload.option)
          );

        if (
          ['most-likely-to', 'imposter'].includes(gamemode) &&
          state.phase !== 'most-likely-to-tiebreaker' &&
          payload.option != null &&
          !getCurrentRoundPlayers().some(
            (player) =>
              String(getPartyPlayerId(player)) === String(payload.option)
          )
        ) {
          const error = new Error(
            'That player will join at the next round and cannot be voted for yet.'
          );
          error.status = 409;
          error.code = 'party_vote_target_pending_next_round';
          throw error;
        }

        actorState.vote = payload.option;
        actorState.isReady = true;
        actorPlayer.vote = payload.option;
        actorPlayer.isReady = true;

        if (payload.hover === false) {
          actorState.hasConfirmed = true;
          actorPlayer.hasConfirmed = true;
        }

        if (shouldAwardNeverHaveIEverSidePick) {
          addScoreToPartyPlayer(
            actorPlayer,
            SCORE_RULES['never-have-i-ever'].selectSide
          );
        }

        if (shouldAwardWouldYouRatherSidePick) {
          addScoreToPartyPlayer(
            actorPlayer,
            SCORE_RULES['would-you-rather'].selectSide
          );
        }

        if (shouldAwardMostLikelyToPlayerPick) {
          addScoreToPartyPlayer(
            actorPlayer,
            SCORE_RULES['most-likely-to'].selectPlayer
          );
        }

        if (payload.sendInstruction != null) {
          config.userInstructions = payload.sendInstruction;
          state.userInstructions = payload.sendInstruction;
        }

        state.lastPinged = new Date();
        break;
      }

      case 'set-bool-vote': {
        if (!actorPlayer) {
          const error = new Error('Voting player not found.');
          error.status = 404;
          throw error;
        }

        const actorState = getPartyPlayerState(actorPlayer);
        actorState.vote = payload.bool;
        actorState.hasConfirmed = true;
        actorPlayer.vote = payload.bool;
        actorPlayer.hasConfirmed = true;

        state.lastPinged = new Date();
        break;
      }

      case 'sync-party-state': {
        applyPartyPatchesToSnapshot(workingParty, payload, { hasDeck });

        if (payload.touchState !== false) {
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
  createCoreActionHandler
};

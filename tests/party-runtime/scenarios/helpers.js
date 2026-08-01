const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyActionApplier
} = require('../../../server/game-engine/party-runtime/actions');
const {
  isReservedPartyShell
} = require('../../../server/game-engine/party-runtime/routes');

function createApplier(overrides = {}) {
  return createPartyActionApplier({
    ONLINE_GAMEMODE_MAX_PLAYERS: {
      'most-likely-to': 2,
      mafia: 20
    },
    cloneSerializable: (value) => structuredClone(value),
    getPartyConfigDoc: (party) => party.config,
    getPartyStateDoc: (party) => party.state,
    getPartyDeckDoc: (party) => party.deck,
    getPartyPlayersDoc: (party) => party.players,
    getPartyPlayerId: (player) => player.identity.computerId,
    getPartyPlayerAccountId: (player) => player.identity.accountId || null,
    getPartyPlayerState: (player) => player.state,
    getTruthOrDareCompletionScore: () => 1,
    applyTruthOrDareRoundReset: () => {},
    applyPartyPatchesToSnapshot: () => {},
    shouldUsePlayerTurnOrder: () => false,
    initializePlayerTurnOrder: () => {},
    getTurnPlayer: (players, state) => players[state.playerTurn ?? 0],
    appendPartyAccountStatEvent: (party, event) => {
      if (!event) return;
      party.__accountStatEvents ||= [];
      party.__accountStatEvents.push(event);
    },
    createAccountStatEvent: (gameMode, entries) => {
      const increments = entries
        .filter(
          ({ player, paths }) =>
            player.identity.accountId && Object.values(paths).some(Boolean)
        )
        .map(({ player, paths }) => ({
          accountId: player.identity.accountId,
          paths
        }));
      return increments.length ? { gameMode, increments } : null;
    },
    attachRewardProgress: (event, players = [], options = {}) => {
      if (!event) return event;
      const rewardProgress = players
        .filter((player) => player?.identity?.accountId)
        .filter((player) =>
          typeof options.availablePredicate === 'function'
            ? options.availablePredicate(player)
            : true
        )
        .map((player) => ({
          accountId: player.identity.accountId,
          actionsAvailable: 1,
          actionsTaken:
            typeof options.takenPredicate === 'function' &&
            options.takenPredicate(player)
              ? 1
              : 0
        }));
      if (rewardProgress.length) event.rewardProgress = rewardProgress;
      return event;
    },
    ensurePartyPlayerConnection: (player) => {
      player.connection ||= {};
      return player.connection;
    },
    assertActorCanControlParty: (party, actorId) => {
      if (String(party.state.hostComputerId) !== String(actorId)) {
        const error = new Error('Only the host can perform this action.');
        error.status = 403;
        throw error;
      }
    },
    ...overrides
  });
}

function createGameOverParty() {
  return {
    partyId: 'ABC-123',
    config: {
      gamemode: 'most-likely-to',
      gameRules: { rounds: 20 },
      selectedPacks: ['pack-one'],
      userInstructions: 'GAME_OVER'
    },
    state: {
      isPlaying: false,
      phase: 'game-over',
      phaseData: { result: true },
      completedRounds: 20,
      playerTurn: 2,
      hostComputerId: 'host-device',
      hostComputerIdList: ['host-device', 'guest-device'],
      timer: new Date()
    },
    deck: {
      currentCardIndex: 20,
      alternativeQuestionIndex: 4
    },
    players: [
      {
        identity: { computerId: 'host-device' },
        state: {
          isReady: false,
          hasConfirmed: true,
          vote: 'guest-device',
          score: 9
        }
      },
      {
        identity: { computerId: 'guest-device' },
        state: {
          isReady: true,
          hasConfirmed: true,
          vote: 'host-device',
          score: 7
        }
      }
    ]
  };
}

module.exports = {
  test,
  assert,
  createApplier,
  createGameOverParty,
  isReservedPartyShell
};

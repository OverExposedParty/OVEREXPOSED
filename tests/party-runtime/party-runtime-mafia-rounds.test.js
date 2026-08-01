const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMafiaActionHandler
} = require('../../server/game-engine/party-runtime/action-handlers/mafia-actions');
const {
  createMafiaStatEventTools
} = require('../../server/game-engine/party-runtime/mafia-stat-events');

function createPlayers() {
  return [
    {
      identity: { computerId: 'host-device', accountId: 'account-one' },
      state: { roleKey: 'civilian', status: 'alive', vote: null }
    },
    {
      identity: { computerId: 'guest-device', accountId: 'account-two' },
      state: { roleKey: 'mafioso', status: 'alive', vote: null }
    }
  ];
}

function createMafiaContext({
  completedRounds = 0,
  gameOverInstruction = null
} = {}) {
  const players = createPlayers();
  const accountEvents = [];
  const gameOverCalls = [];
  const state = {
    isPlaying: true,
    completedRounds,
    phase: 'day',
    hostComputerId: 'host-device'
  };

  return {
    players,
    state,
    accountEvents,
    gameOverCalls,
    context: {
      getPartyPlayerId: (player) => player.identity.computerId,
      appendPartyAccountStatEvent: (_party, event) => {
        if (event) accountEvents.push(event);
      },
      createAccountStatEvent: () => null,
      attachRewardProgress: (event) => event,
      createMafiaStartStatEvent: () => ({ type: 'mafia-start' }),
      createMafiaGameOverStatEvent: (gamePlayers, instruction, roundCount) => {
        gameOverCalls.push({ gamePlayers, instruction, roundCount });
        return { type: 'mafia-game-over', roundCount };
      },
      getMafiaTeamForRole: () => 'town',
      getPartyPlayerState: (player) => player.state,
      getMafiaNightVote: () => null,
      getMafiaTownVote: () => null,
      evaluateMafiaGameOver: () => gameOverInstruction,
      resetMafiaVotes: () => {},
      assertActorCanControlParty: () => {},
      actorId: 'host-device',
      payload: {},
      workingParty: { gamemode: 'mafia' },
      config: { gamemode: 'mafia', userInstructions: '' },
      state,
      players,
      allowBypass: false
    }
  };
}

test('Mafia resets its completed round count when a game starts', () => {
  const handleMafiaAction = createMafiaActionHandler();
  const setup = createMafiaContext({ completedRounds: 7 });
  setup.context.payload = {
    assignedRoleKeys: ['civilian', 'mafioso']
  };

  handleMafiaAction('mafia-start-game', setup.context);

  assert.equal(setup.state.completedRounds, 0);
  assert.equal(setup.state.phase, 'night');
  assert.deepEqual(
    setup.players.map((player) => player.state.roleKey),
    ['civilian', 'mafioso']
  );
});

test('finishing a Mafia day counts one completed night and day cycle', () => {
  const handleMafiaAction = createMafiaActionHandler();
  const setup = createMafiaContext({ completedRounds: 2 });

  handleMafiaAction('mafia-finish-town-vote', setup.context);

  assert.equal(setup.state.completedRounds, 3);
  assert.equal(setup.state.phase, 'night');
  assert.equal(setup.gameOverCalls.length, 0);
});

test('a Mafia game ending after night counts its terminal cycle', () => {
  const handleMafiaAction = createMafiaActionHandler();
  const setup = createMafiaContext({
    completedRounds: 2,
    gameOverInstruction: 'GAME_OVER:CIVILIAN'
  });

  handleMafiaAction('mafia-finish-player-killed', setup.context);

  assert.equal(setup.state.completedRounds, 3);
  assert.equal(setup.gameOverCalls.length, 1);
  assert.equal(setup.gameOverCalls[0].roundCount, 3);
});

test('a Mafia game ending after a day vote sends the completed cycle total', () => {
  const handleMafiaAction = createMafiaActionHandler();
  const setup = createMafiaContext({
    completedRounds: 2,
    gameOverInstruction: 'GAME_OVER:CIVILIAN'
  });

  handleMafiaAction('mafia-finish-town-vote', setup.context);

  assert.equal(setup.state.completedRounds, 3);
  assert.equal(setup.gameOverCalls.length, 1);
  assert.equal(setup.gameOverCalls[0].roundCount, 3);
});

test('Mafia game-over stats apply the final round total to every account', () => {
  const players = createPlayers();
  const { createMafiaGameOverStatEvent } = createMafiaStatEventTools({
    getPartyPlayerState: (player) => player.state,
    createAccountStatEvent: (gameMode, entries) => ({ gameMode, entries })
  });

  const event = createMafiaGameOverStatEvent(players, 'GAME_OVER:CIVILIAN', 4);

  assert.equal(event.eventKey, 'mafia-game-over');
  assert.equal(event.gameMode, 'mafia');
  assert.deepEqual(
    event.entries.map(({ paths }) => paths.roundsPlayed),
    [4, 4]
  );
});

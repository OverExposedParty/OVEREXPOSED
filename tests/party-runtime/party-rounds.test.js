const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_ROUND_LIMITS,
  completeConfiguredRound,
  getConfiguredRoundLimit
} = require('../../server/game-engine/party-runtime/rounds');

test('online round defaults match each gamemode cadence', () => {
  assert.equal(DEFAULT_ROUND_LIMITS['most-likely-to'], 20);
  assert.equal(DEFAULT_ROUND_LIMITS['never-have-i-ever'], 20);
  assert.equal(DEFAULT_ROUND_LIMITS['would-you-rather'], 20);
  assert.equal(DEFAULT_ROUND_LIMITS['truth-or-dare'], 5);
  assert.equal(DEFAULT_ROUND_LIMITS.paranoia, 5);
  assert.equal(DEFAULT_ROUND_LIMITS.imposter, 5);
  assert.equal(DEFAULT_ROUND_LIMITS.mafia, undefined);
});

test('configured rounds override defaults and remain within the UI range', () => {
  assert.equal(
    getConfiguredRoundLimit({
      gamemode: 'most-likely-to',
      gameRules: new Map([['rounds', 7]])
    }),
    7
  );
  assert.equal(
    getConfiguredRoundLimit({
      gamemode: 'imposter',
      gameRules: { rounds: 999 }
    }),
    50
  );
});

test('the final completed round switches the party to the existing game-over state', () => {
  const config = { gameRules: { rounds: 2 }, userInstructions: '' };
  const state = {
    completedRounds: 1,
    isPlaying: true,
    phase: null,
    timer: new Date()
  };

  const ended = completeConfiguredRound({
    gamemode: 'would-you-rather',
    config,
    state
  });

  assert.equal(ended, true);
  assert.equal(state.completedRounds, 2);
  assert.equal(state.isPlaying, false);
  assert.equal(state.phase, 'game-over');
  assert.equal(state.timer, null);
  assert.equal(config.userInstructions, 'GAME_OVER');
  assert.equal(state.userInstructions, 'GAME_OVER');
});

test('mafia does not participate in configured round completion', () => {
  const config = { gameRules: { rounds: 1 }, userInstructions: '' };
  const state = { completedRounds: 0, isPlaying: true };

  assert.equal(
    completeConfiguredRound({ gamemode: 'mafia', config, state }),
    false
  );
  assert.equal(state.completedRounds, 0);
  assert.equal(state.isPlaying, true);
});

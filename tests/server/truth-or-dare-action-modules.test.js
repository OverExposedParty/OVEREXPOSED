const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createTruthOrDareActionHandler
} = require('../../server/game-engine/party-runtime/action-handlers/truth-or-dare-actions');
const {
  createTruthOrDarePromptFlowHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/truth-or-dare-actions/prompt-flow');
const {
  createTruthOrDarePunishmentHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/truth-or-dare-actions/punishments');
const {
  createTruthOrDareTimeoutHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/truth-or-dare-actions/timeouts');
const {
  createTruthOrDareRoundResetHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/truth-or-dare-actions/round-reset');

test('Truth or Dare action modules expose the full dispatcher action contract', () => {
  const actionNames = Object.keys({
    ...createTruthOrDarePromptFlowHandlers(),
    ...createTruthOrDarePunishmentHandlers(),
    ...createTruthOrDareTimeoutHandlers(),
    ...createTruthOrDareRoundResetHandlers()
  }).sort();

  assert.deepEqual(actionNames, [
    'truth-or-dare-claim-prompt-heist',
    'truth-or-dare-complete-punishment',
    'truth-or-dare-handle-card-timeout',
    'truth-or-dare-handle-punishment-timeout',
    'truth-or-dare-pass-question',
    'truth-or-dare-reset-round',
    'truth-or-dare-resolve-drink-wheel',
    'truth-or-dare-resolve-prompt-heist',
    'truth-or-dare-select-punishment',
    'truth-or-dare-select-question-type',
    'truth-or-dare-start-prompt'
  ]);
});

test('Truth or Dare punishment selection records a timeline event for the active player', () => {
  const events = [];
  const handler = createTruthOrDareActionHandler();
  const player = { identity: { computerId: 'player-1' }, state: {} };
  const state = { playerTurn: 0, phaseData: null };

  assert.equal(
    handler('truth-or-dare-select-punishment', {
      getPartyPlayerId: (candidate) => candidate.identity.computerId,
      getTurnPlayer: () => player,
      appendPartyAccountStatEvent: () => {},
      createAccountStatEvent: () => ({}),
      appendTruthOrDareTimelineEvent: (event) => events.push(event),
      actorId: 'player-1',
      payload: { punishmentType: 'DRINK_WHEEL' },
      workingParty: { gamemode: 'truth-or-dare' },
      config: { gamemode: 'truth-or-dare', gameRules: {} },
      state,
      players: [player]
    }),
    true
  );

  assert.equal(state.phase, 'truth-or-dare-show-punishment');
  assert.deepEqual(events.map((event) => event.type), [
    'punishment-selected',
    'punishment-in-progress'
  ]);
  assert.equal(events[1].player, player);
});

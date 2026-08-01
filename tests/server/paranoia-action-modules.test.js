const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createParanoiaActionHandler
} = require('../../server/game-engine/party-runtime/action-handlers/paranoia-actions');
const {
  createParanoiaTargetSelectionHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/paranoia-actions/target-selection');
const {
  createParanoiaPunishmentFlowHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/paranoia-actions/punishment-flow');
const {
  createParanoiaTimeoutHandlers
} = require('../../server/game-engine/party-runtime/action-handlers/paranoia-actions/timeouts');

test('Paranoia action modules expose every action through the facade', () => {
  const actionNames = [
    ...Object.keys(createParanoiaTargetSelectionHandlers()),
    ...Object.keys(createParanoiaPunishmentFlowHandlers()),
    ...Object.keys(createParanoiaTimeoutHandlers())
  ];
  const handler = createParanoiaActionHandler();

  assert.deepEqual(actionNames.sort(), [
    'paranoia-begin-punishment-confirmation',
    'paranoia-handle-card-timeout',
    'paranoia-handle-phase-timeout',
    'paranoia-handle-reveal-timeout',
    'paranoia-pass-punishment',
    'paranoia-resolve-coin-flip',
    'paranoia-resolve-drink-wheel',
    'paranoia-select-punishment',
    'paranoia-select-target',
    'paranoia-submit-punishment-vote'
  ]);
  assert.equal(handler('unrelated-action', {}), false);
});

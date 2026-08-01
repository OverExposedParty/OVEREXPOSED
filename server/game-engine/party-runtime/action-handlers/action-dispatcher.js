const { createCoreActionHandler } = require('./core-actions');
const { createMostLikelyToActionHandler } = require('./most-likely-to-actions');
const {
  createNeverHaveIEverActionHandler
} = require('./never-have-i-ever-actions');
const { createTruthOrDareActionHandler } = require('./truth-or-dare-actions');
const { createImposterActionHandler } = require('./imposter-actions');
const { createMafiaActionHandler } = require('./mafia-actions');
const {
  createWouldYouRatherActionHandler
} = require('./would-you-rather-actions');
const { createParanoiaActionHandler } = require('./paranoia-actions');

function createPartyActionDispatcher(dependencies) {
  const handlers = [
    createCoreActionHandler(),
    createMostLikelyToActionHandler(),
    createNeverHaveIEverActionHandler(),
    createTruthOrDareActionHandler(),
    createImposterActionHandler(),
    createMafiaActionHandler(),
    createWouldYouRatherActionHandler(),
    createParanoiaActionHandler()
  ];

  return function dispatchPartyAction(action, runtimeContext) {
    const context = { ...dependencies, ...runtimeContext };
    if (handlers.some((handler) => handler(action, context))) return;

    const error = new Error(`Unknown party action: ${action}`);
    error.status = 400;
    throw error;
  };
}

module.exports = {
  createPartyActionDispatcher
};

const {
  createTruthOrDarePromptFlowHandlers
} = require('./truth-or-dare-actions/prompt-flow');
const {
  createTruthOrDarePunishmentHandlers
} = require('./truth-or-dare-actions/punishments');
const {
  createTruthOrDareTimeoutHandlers
} = require('./truth-or-dare-actions/timeouts');
const {
  createTruthOrDareRoundResetHandlers
} = require('./truth-or-dare-actions/round-reset');

function createTruthOrDareActionHandler() {
  const actionHandlers = {
    ...createTruthOrDarePromptFlowHandlers(),
    ...createTruthOrDarePunishmentHandlers(),
    ...createTruthOrDareTimeoutHandlers(),
    ...createTruthOrDareRoundResetHandlers()
  };

  return function handleTruthOrDareAction(action, context) {
    const handler = actionHandlers[action];
    if (!handler) return false;
    handler(context);
    return true;
  };
}

module.exports = { createTruthOrDareActionHandler };

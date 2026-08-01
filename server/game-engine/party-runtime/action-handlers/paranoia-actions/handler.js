const {
  createParanoiaTargetSelectionHandlers
} = require('./target-selection');
const {
  createParanoiaPunishmentFlowHandlers
} = require('./punishment-flow');
const { createParanoiaTimeoutHandlers } = require('./timeouts');

function createParanoiaActionHandler() {
  const actionHandlers = {
    ...createParanoiaTargetSelectionHandlers(),
    ...createParanoiaPunishmentFlowHandlers(),
    ...createParanoiaTimeoutHandlers()
  };

  return function handleParanoiaAction(action, context) {
    const handler = actionHandlers[action];
    if (!handler) return false;
    handler(context);
    return true;
  };
}

module.exports = {
  createParanoiaActionHandler
};

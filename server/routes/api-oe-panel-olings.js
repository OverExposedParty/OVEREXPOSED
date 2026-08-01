const {
  createOePanelOlingPayloadHelpers
} = require('./api-oe-panel-olings/payload-helpers');
const {
  createOePanelOlingDashboardHelpers
} = require('./api-oe-panel-olings/dashboard-helpers');
const {
  createOePanelOlingSimulationHelpers
} = require('./api-oe-panel-olings/simulation-helpers');
const {
  registerOePanelOlingDashboardRoutes
} = require('./api-oe-panel-olings/dashboard-routes');
const {
  registerOePanelOlingSyncRoutes
} = require('./api-oe-panel-olings/sync-routes');
const {
  registerOePanelOlingEggRoutes
} = require('./api-oe-panel-olings/egg-routes');
const {
  registerOePanelOlingTraitRoutes
} = require('./api-oe-panel-olings/trait-routes');
const {
  registerOePanelOlingSimulationRoutes
} = require('./api-oe-panel-olings/simulation-routes');

function registerOePanelOlingRoutes(context) {
  const payloadHelpers = createOePanelOlingPayloadHelpers(context);
  const dashboardHelpers = createOePanelOlingDashboardHelpers(
    context,
    payloadHelpers
  );
  const helpers = {
    ...payloadHelpers,
    ...dashboardHelpers,
    ...createOePanelOlingSimulationHelpers()
  };

  registerOePanelOlingDashboardRoutes(context, helpers);
  registerOePanelOlingSyncRoutes(context, helpers);
  registerOePanelOlingEggRoutes(context, helpers);
  registerOePanelOlingTraitRoutes(context, helpers);
  registerOePanelOlingSimulationRoutes(context, helpers);
}

module.exports = {
  registerOePanelOlingRoutes
};

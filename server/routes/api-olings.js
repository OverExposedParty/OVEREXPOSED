const olingServices = require('../services/olings');
const labCatalog = require('./api-olings/lab-catalog');
const labIncubation = require('./api-olings/lab-incubation');
const labState = require('./api-olings/lab-state');
const olingProfile = require('./api-olings/oling-profile');
const { createOlingRouteSupport } = require('./api-olings/route-support');
const { registerOlingStorageRoutes } = require('./api-olings/storage-routes');
const { registerOlingLabRoutes } = require('./api-olings/lab-routes');
const {
  registerOlingAdventuresRoutes
} = require('./api-olings/adventures-routes');
const { registerOlingCareRoutes } = require('./api-olings/care-routes');
const { registerOlingAdminRoutes } = require('./api-olings/admin-routes');
const { registerOlingProfileRoutes } = require('./api-olings/profile-routes');

const OLING_ACTIVITY_ENERGY_COSTS = Object.freeze({
  adventure: 15,
  battle: 20,
  play: 5,
  train: 10,
  roam: 5
});

const OLING_ADVENTURES = Object.freeze([
  {
    key: 'backyard-path',
    name: 'Backyard Path',
    durationMs: 300000,
    energyCost: 10,
    recommendedLevel: 1,
    xp: 20,
    rewards: ['Oling XP', 'Oling Cookie']
  },
  {
    key: 'supply-run',
    name: 'Supply Run',
    durationMs: 900000,
    energyCost: 15,
    recommendedLevel: 2,
    xp: 45,
    rewards: ['Oling XP', 'Oling Cookie']
  },
  {
    key: 'cloud-trail',
    name: 'Cloud Trail',
    durationMs: 1800000,
    energyCost: 20,
    recommendedLevel: 4,
    xp: 80,
    rewards: ['Oling XP', 'Rare supplies']
  },
  {
    key: 'ancient-ruins',
    name: 'Ancient Ruins',
    durationMs: 3600000,
    energyCost: 30,
    recommendedLevel: 7,
    xp: 140,
    rewards: ['Oling XP', 'Rare egg supplies']
  }
]);

const QUICK_SELL_RATE = 0.35;

function registerOlingRoutes(context) {
  const { app, models } = context;
  const routeContext = {
    ...context,
    ...models,
    ...olingServices,
    ...labCatalog,
    ...labIncubation,
    ...labState,
    ...olingProfile,
    OLING_ACTIVITY_ENERGY_COSTS,
    OLING_ADVENTURES,
    QUICK_SELL_RATE
  };
  Object.assign(routeContext, createOlingRouteSupport(routeContext));
  const { requireOlingLabAccess } = routeContext;

  app.use('/api/olings/storage/quick-sell', requireOlingLabAccess);
  app.use('/api/olings/lab', requireOlingLabAccess);
  app.use('/api/olings/adventures', requireOlingLabAccess);
  app.use('/api/olings/mine', requireOlingLabAccess);
  app.use('/api/olings/hatch', requireOlingLabAccess);
  app.use('/api/olings/:olingId/consume', requireOlingLabAccess);
  app.use('/api/olings/:olingId/activities', requireOlingLabAccess);
  app.use('/api/olings/:olingId/sleep', requireOlingLabAccess);
  app.patch('/api/olings/:olingId', requireOlingLabAccess);

  registerOlingStorageRoutes(routeContext);
  registerOlingLabRoutes(routeContext);
  registerOlingAdventuresRoutes(routeContext);
  registerOlingCareRoutes(routeContext);
  registerOlingAdminRoutes(routeContext);
  registerOlingProfileRoutes(routeContext);
}

module.exports = {
  registerOlingRoutes,
  __test: {
    getIncubatorReadyNotifications:
      labIncubation.getIncubatorReadyNotifications,
    getLabExpansionDetails: labState.getLabExpansionDetails,
    getUnlockedLabCellKeys: labState.getUnlockedLabCellKeys,
    serializeOlingLab: labState.serializeOlingLab
  }
};

const { createApiRouteContext } = require('./api-route-context');
const { registerPublicContentRoutes } = require('./api-public-content');
const { registerPartyChatRoutes } = require('./api-party-chat');
const { registerPartyGameRoutes } = require('./api-party-games');
const { registerPublicSurfaceRoutes } = require('./api-public-surface');
const { registerOePanelRoutes } = require('./api-oe-panel');
const { registerAccountAuthRoutes } = require('./api-account-auth');
const { registerOverexposurePostRoutes } = require('./api-overexposure-posts');
const { registerOlingRoutes } = require('./api-olings');
const { registerOlingBattleRoutes } = require('./api-oling-battles');

function registerApiRoutes({ app, models, runtime, partyOwnerLeases }) {
  const routeContext = createApiRouteContext({
    app,
    models,
    runtime,
    partyOwnerLeases
  });

  registerPublicSurfaceRoutes(routeContext);
  registerOePanelRoutes(routeContext);
  registerPublicContentRoutes({ app, models });
  registerAccountAuthRoutes(routeContext);
  registerOlingRoutes(routeContext);
  registerOlingBattleRoutes(routeContext);
  registerOverexposurePostRoutes(routeContext);
  registerPartyGameRoutes({ app, models, runtime });
  registerPartyChatRoutes({ app, models, runtime });
}

module.exports = {
  registerApiRoutes
};

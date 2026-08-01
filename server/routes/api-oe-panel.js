const {
  registerOePanelAchievementRoutes
} = require('./api-oe-panel-achievements');
const {
  registerOePanelCustomisationRoutes
} = require('./api-oe-panel-customisation');
const { registerOePanelDashboardRoutes } = require('./api-oe-panel-dashboard');
const { registerOePanelOlingRoutes } = require('./api-oe-panel-olings');
const {
  registerOePanelPartyGameRoutes
} = require('./api-oe-panel-party-games');
const { registerOePanelShopRoutes } = require('./api-oe-panel-shop');
const {
  registerOePanelSocialMediaRoutes
} = require('./api-oe-panel-social-media');
const { registerOePanelUserAdminRoutes } = require('./api-oe-panel-user-admin');
const {
  registerOePanelModerationRoutes
} = require('./api-oe-panel/moderation-routes');
const { registerOePanelSystemRoutes } = require('./api-oe-panel/system-routes');
const {
  registerOePanelOverexposureRoutes
} = require('./api-oe-panel/overexposure-routes');
const { registerOePanelEmailRoutes } = require('./api-oe-panel-emails');

function registerOePanelRoutes(context) {
  registerOePanelShopRoutes(context);
  registerOePanelPartyGameRoutes(context);
  registerOePanelAchievementRoutes(context);
  registerOePanelOlingRoutes(context);
  registerOePanelCustomisationRoutes(context);
  registerOePanelSocialMediaRoutes(context);
  registerOePanelDashboardRoutes(context);
  registerOePanelModerationRoutes(context);
  registerOePanelSystemRoutes(context);
  registerOePanelOverexposureRoutes(context);
  registerOePanelEmailRoutes(context);
  registerOePanelUserAdminRoutes(context);
}

module.exports = { registerOePanelRoutes };

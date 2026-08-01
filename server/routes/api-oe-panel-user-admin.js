const {
  registerOePanelAdminLogRoutes
} = require('./api-oe-panel-user-admin/admin-log-routes');
const {
  registerOePanelUserQueryRoutes
} = require('./api-oe-panel-user-admin/user-query-routes');
const {
  registerOePanelUserOpalRoutes
} = require('./api-oe-panel-user-admin/user-opal-routes');
const {
  registerOePanelUserDeletionRoutes
} = require('./api-oe-panel-user-admin/user-deletion-routes');

function registerOePanelUserAdminRoutes(context) {
  registerOePanelAdminLogRoutes(context);
  registerOePanelUserQueryRoutes(context);
  registerOePanelUserOpalRoutes(context);
  registerOePanelUserDeletionRoutes(context);
}

module.exports = { registerOePanelUserAdminRoutes };

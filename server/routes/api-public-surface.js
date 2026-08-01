const {
  registerPublicGeneralRoutes
} = require('./api-public-surface/general-routes');
const {
  registerPublicReportRoutes
} = require('./api-public-surface/report-routes');
const {
  registerPublicShopRoutes
} = require('./api-public-surface/shop-routes');
const {
  registerPublicShopAdminRoutes
} = require('./api-public-surface/shop-admin-routes');

function registerPublicSurfaceRoutes(context) {
  registerPublicGeneralRoutes(context);
  registerPublicReportRoutes(context);
  registerPublicShopRoutes(context);
  registerPublicShopAdminRoutes(context);
}

module.exports = {
  registerPublicSurfaceRoutes
};

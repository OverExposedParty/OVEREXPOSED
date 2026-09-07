const {
  registerOlingLabPublicCatalogRoutes
} = require('./lab-public-catalog-routes');
const { registerOlingLabReadRoutes } = require('./lab-read-routes');
const { registerOlingLabPrivacyRoutes } = require('./lab-privacy-routes');
const {
  registerOlingNotificationRoutes
} = require('./oling-notification-routes');
const { registerOlingLabSaveRoutes } = require('./lab-save-routes');
const { registerOlingLabExpansionRoutes } = require('./lab-expansion-routes');
const {
  registerOlingLabFurnitureSaleRoutes
} = require('./lab-furniture-sale-routes');

function registerOlingLabRoutes(context) {
  registerOlingLabReadRoutes(context);
  registerOlingLabPrivacyRoutes(context);
  registerOlingNotificationRoutes(context);
  registerOlingLabSaveRoutes(context);
  registerOlingLabFurnitureSaleRoutes(context);
  registerOlingLabExpansionRoutes(context);
  registerOlingLabPublicCatalogRoutes(context);
}

module.exports = { registerOlingLabRoutes };

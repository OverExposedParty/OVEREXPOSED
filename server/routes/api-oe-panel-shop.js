const {
  registerOePanelShopProductRoutes
} = require('./api-oe-panel-shop/product-routes');

function registerOePanelShopRoutes(context) {
  registerOePanelShopProductRoutes(context);
}

module.exports = { registerOePanelShopRoutes };

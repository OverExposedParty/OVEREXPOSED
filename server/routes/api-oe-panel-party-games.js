const {
  registerOePanelPartyRoomRoutes
} = require('./api-oe-panel-party-games/party-room-routes');
const {
  registerOePanelGamePackRoutes
} = require('./api-oe-panel-party-games/game-pack-routes');
const {
  registerOePanelGameModeRoutes
} = require('./api-oe-panel-party-games/game-mode-routes');
const {
  registerOePanelGameRuleRoutes
} = require('./api-oe-panel-party-games/game-rule-routes');
const {
  registerOePanelGameRoleRoutes
} = require('./api-oe-panel-party-games/game-role-routes');

function registerOePanelPartyGameRoutes(context) {
  registerOePanelPartyRoomRoutes(context);
  registerOePanelGamePackRoutes(context);
  registerOePanelGameModeRoutes(context);
  registerOePanelGameRuleRoutes(context);
  registerOePanelGameRoleRoutes(context);
}

module.exports = { registerOePanelPartyGameRoutes };

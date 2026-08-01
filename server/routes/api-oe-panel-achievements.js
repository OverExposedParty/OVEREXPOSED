const {
  registerOePanelAchievementCreateRoutes
} = require('./api-oe-panel/achievement-create-routes');
const {
  registerOePanelAchievementExportRoutes
} = require('./api-oe-panel/achievement-export-routes');
const {
  registerOePanelAchievementListRoutes
} = require('./api-oe-panel/achievement-list-routes');

function registerOePanelAchievementRoutes(context) {
  registerOePanelAchievementListRoutes(context);
  registerOePanelAchievementCreateRoutes(context);
  registerOePanelAchievementExportRoutes(context);
}

module.exports = {
  registerOePanelAchievementRoutes
};

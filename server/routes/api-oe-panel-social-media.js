const {
  registerOePanelSocialMediaListRoutes
} = require('./api-oe-panel/social-media-list-routes');
const {
  registerOePanelSocialMediaCreateRoutes
} = require('./api-oe-panel/social-media-create-routes');
const {
  registerOePanelSocialMediaUpdateRoutes
} = require('./api-oe-panel/social-media-update-routes');
const {
  registerOePanelSocialMediaDeleteRoutes
} = require('./api-oe-panel/social-media-delete-routes');
const {
  registerOePanelSocialMediaExportRoutes
} = require('./api-oe-panel/social-media-export-video-routes');

function registerOePanelSocialMediaRoutes(context) {
  registerOePanelSocialMediaListRoutes(context);
  registerOePanelSocialMediaCreateRoutes(context);
  registerOePanelSocialMediaUpdateRoutes(context);
  registerOePanelSocialMediaDeleteRoutes(context);
  registerOePanelSocialMediaExportRoutes(context);
}

module.exports = { registerOePanelSocialMediaRoutes };

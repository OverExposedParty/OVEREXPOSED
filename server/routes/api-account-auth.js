const achievementService = require('../services/achievements');
const accountNotificationService = require('../services/account-notifications');
const friendActivityNotificationService = require('../services/friend-activity-notifications');
const {
  createAccountAuthRouteSupport
} = require('./api-account-auth/route-support');
const {
  registerAccountRegistrationRoutes
} = require('./api-account-auth/registration-routes');
const {
  registerAccountSessionsRoutes
} = require('./api-account-auth/sessions-routes');
const {
  registerAccountDeviceSessionsRoutes
} = require('./api-account-auth/device-sessions-routes');
const {
  registerAccountProfileRoutes
} = require('./api-account-auth/profile-routes');
const {
  registerAccountNotificationRoutes
} = require('./api-account-auth/notification-routes');
const {
  registerAccountPartyInvitesRoutes
} = require('./api-account-auth/party-invites-routes');
const {
  registerAccountFriendsRoutes
} = require('./api-account-auth/friends-routes');
const {
  registerAccountPublicProfileRoutes
} = require('./api-account-auth/public-profile-routes');
const {
  registerAccountControlsRoutes
} = require('./api-account-auth/controls-routes');
const {
  registerAccountLibraryRoutes
} = require('./api-account-auth/library-routes');
const {
  registerAccountOauthRoutes
} = require('./api-account-auth/oauth-routes');

function registerAccountAuthRoutes(context) {
  const routeContext = {
    ...context,
    ...achievementService,
    ...accountNotificationService,
    ...friendActivityNotificationService
  };
  Object.assign(routeContext, createAccountAuthRouteSupport(routeContext));

  registerAccountRegistrationRoutes(routeContext);
  registerAccountSessionsRoutes(routeContext);
  registerAccountDeviceSessionsRoutes(routeContext);
  registerAccountProfileRoutes(routeContext);
  registerAccountNotificationRoutes(routeContext);
  registerAccountPartyInvitesRoutes(routeContext);
  registerAccountFriendsRoutes(routeContext);
  registerAccountPublicProfileRoutes(routeContext);
  registerAccountControlsRoutes(routeContext);
  registerAccountLibraryRoutes(routeContext);
  registerAccountOauthRoutes(routeContext);
}

module.exports = { registerAccountAuthRoutes };

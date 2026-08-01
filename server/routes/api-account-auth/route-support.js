const {
  createFriendRelationshipSupport
} = require('./friend-relationship-support');
const { createInviteSessionSupport } = require('./invite-session-support');
const { createOAuthCallbackSupport } = require('./oauth-callback-support');
const {
  createProfileCompletionSupport
} = require('./profile-completion-support');
const { createPublicProfileSupport } = require('./public-profile-support');

function createAccountAuthRouteSupport(context) {
  const profileCompletionSupport = createProfileCompletionSupport(context);
  const friendRelationshipSupport = createFriendRelationshipSupport(context);
  const inviteSessionSupport = createInviteSessionSupport(context);
  const publicProfileSupport = createPublicProfileSupport(
    context,
    friendRelationshipSupport
  );
  const oauthCallbackSupport = createOAuthCallbackSupport(context);

  return {
    ...profileCompletionSupport,
    ...friendRelationshipSupport,
    ...inviteSessionSupport,
    ...publicProfileSupport,
    ...oauthCallbackSupport
  };
}

module.exports = { createAccountAuthRouteSupport };

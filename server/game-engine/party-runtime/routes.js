const crypto = require('crypto');
const { getCurrentAccount } = require('../../services/page-protection');
const {
  getPublishedAchievements,
  incrementAchievementStat,
  recordAchievementCollectionItems,
  recordAchievementPlayDate,
  recordMostLikelyToResult,
  recordNeverHaveIEverResult,
  recordParanoiaResult,
  recordTruthOrDarePromptResult,
  unlockAchievementByKey
} = require('../../services/achievements');
const {
  grantPendingPartyGameReward,
  grantPartyGameRewards
} = require('../../services/party-game-rewards');

function isReservedPartyShell(party) {
  return Boolean(
    party &&
    (!Array.isArray(party.players) || party.players.length === 0) &&
    !party.state?.hostComputerId &&
    !party.config?.gamemode
  );
}

function shouldUseDisconnectGrace(party) {
  return Boolean(
    party?.state?.phase === 'game-over' ||
    (party?.state?.isPlaying === true &&
      [
        'truth-or-dare',
        'never-have-i-ever',
        'would-you-rather',
        'most-likely-to',
        'paranoia',
        'imposter'
      ].includes(party?.config?.gamemode))
  );
}

const { createPartyTimelineTools } = require('./route-handlers/timeline-tools');
const { createPartyPlayerTools } = require('./route-handlers/player-tools');
const {
  createPartyAchievementTools
} = require('./route-handlers/achievement-tools');
const {
  createPartyProgressionNotificationTools
} = require('./route-handlers/progression-notification-tools');
const { createPartyActionRoute } = require('./route-handlers/action-route');
const { createPartyUpsertRoute } = require('./route-handlers/upsert-route');
const { createPartySocketTools } = require('./route-handlers/socket-tools');
const { createPartyJoinRoute } = require('./route-handlers/join-route');
const {
  createPartyPlayerUpdateRoutes
} = require('./route-handlers/player-update-routes');
const { createPartyExitRoutes } = require('./route-handlers/exit-routes');
const {
  createPartyAuthTransitionRoutes
} = require('./route-handlers/auth-transition-routes');
const { createPartyUtilityRoutes } = require('./route-handlers/utility-routes');
const {
  createPartySwitchGameRoute
} = require('./route-handlers/switch-game-route');

function createPartyRouteHandlers(deps) {
  const context = {
    ...deps,
    crypto,
    getCurrentAccount,
    getPublishedAchievements,
    incrementAchievementStat,
    recordAchievementCollectionItems,
    recordAchievementPlayDate,
    recordMostLikelyToResult,
    recordNeverHaveIEverResult,
    recordParanoiaResult,
    recordTruthOrDarePromptResult,
    unlockAchievementByKey,
    grantPendingPartyGameReward,
    grantPartyGameRewards,
    isReservedPartyShell,
    shouldUseDisconnectGrace
  };

  Object.assign(context, createPartyTimelineTools(context));
  Object.assign(context, createPartyPlayerTools(context));
  Object.assign(context, createPartyProgressionNotificationTools(context));
  Object.assign(context, createPartyAchievementTools(context));
  Object.assign(context, createPartyActionRoute(context));
  Object.assign(context, createPartyUpsertRoute(context));
  Object.assign(context, createPartySocketTools(context));
  Object.assign(context, createPartyAuthTransitionRoutes(context));
  Object.assign(context, createPartyJoinRoute(context));
  Object.assign(context, createPartyPlayerUpdateRoutes(context));
  Object.assign(context, createPartyExitRoutes(context));
  Object.assign(context, createPartyUtilityRoutes(context));
  Object.assign(context, createPartySwitchGameRoute(context));

  return {
    createUpsertPartyHandler: context.createUpsertPartyHandler,
    createPartyActionHandler: context.createPartyActionHandler,
    createDisbandPartyHandler: context.createDisbandPartyHandler,
    createRemoveUserHandler: context.createRemoveUserHandler,
    createJoinUserHandler: context.createJoinUserHandler,
    createLinkPlayerAccountHandler: context.createLinkPlayerAccountHandler,
    createContinuePlayerAsGuestHandler:
      context.createContinuePlayerAsGuestHandler,
    createPatchPlayerHandler: context.createPatchPlayerHandler,
    createDisconnectUserHandler: context.createDisconnectUserHandler,
    createAuthTransitionHandlers: context.createAuthTransitionHandlers,
    createPartyErrorHandler: context.createPartyErrorHandler,
    createPartyGetHandler: context.createPartyGetHandler,
    createSwitchGameHandler: context.createSwitchGameHandler,
    disconnectSocketPartyMemberships: context.disconnectSocketPartyMemberships,
    DISCONNECT_GRACE_PERIOD_MS: context.DISCONNECT_GRACE_PERIOD_MS
  };
}

module.exports = {
  createPartyRouteHandlers,
  isReservedPartyShell,
  shouldUseDisconnectGrace
};

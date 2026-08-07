const {
  ONLINE_GAMEMODE_MIN_PLAYERS,
  ONLINE_GAMEMODE_MAX_PLAYERS,
  PLAYER_TURN_ORDER_GAMEMODES,
  formatGamemodeName
} = require('../constants');
const partyRequestValidation = require('../validation/party-requests');
const { getServerRegion } = require('../services/server-region');
const { createPartyActionApplier } = require('./party-runtime/actions');
const { createPartyErrorTools } = require('./party-runtime/errors');
const {
  createPartyGameResetTools
} = require('./party-runtime/game-reset-tools');
const { createPartyPlayerTools } = require('./party-runtime/player-tools');
const {
  createPartyPlayerTools: createPartyRoutePlayerTools
} = require('./party-runtime/route-handlers/player-tools');
const {
  createPartyRewardProgressTools
} = require('./party-runtime/reward-progress-tools');
const { createPartyRoundTools } = require('./party-runtime/round-tools');
const { createPartyRouteHandlers } = require('./party-runtime/routes');
const { createPartyScoringTools } = require('./party-runtime/scoring-tools');
const { createPartySnapshotTools } = require('./party-runtime/snapshot-tools');
const {
  createPartyStatEventTools
} = require('./party-runtime/stat-event-tools');
const {
  createPartyTurnOrderTools
} = require('./party-runtime/turn-order-tools');
const {
  completeConfiguredRound: completeRoundProgress
} = require('./party-runtime/rounds');
const partyDocuments = require('./party-runtime/documents');
const partyRuntimeConstants = require('./party-runtime-constants');
const {
  createPartyOwnerReservationTools
} = require('./party-runtime/party-owner-reservations');
const crypto = require('crypto');
const {
  canAccessFeature,
  canAccessOwnerPages,
  getCurrentAccount
} = require('../services/page-protection');
const {
  assertPartyConfigContentAccess
} = require('../services/party-content-access');
const {
  createPartyGameSessionService
} = require('../services/party-game-sessions');
const {
  createGameModeReleaseService
} = require('../services/game-mode-releases');

function createPartyRuntime({
  app,
  io,
  models,
  logger,
  partyOwnerLeases,
  roomArchiver
}) {
  const gameModeReleases = createGameModeReleaseService({
    GameMode: models.GameMode,
    GameRule: models.GameRule,
    GamePack: models.GamePack,
    GameRole: models.GameRole
  });
  const partyGameSessions = createPartyGameSessionService({
    PartyGameSession: models.partyGameSessionSchema,
    ...gameModeReleases
  });
  const context = {
    app,
    io,
    ...models,
    ...logger,
    ONLINE_GAMEMODE_MIN_PLAYERS,
    ONLINE_GAMEMODE_MAX_PLAYERS,
    PLAYER_TURN_ORDER_GAMEMODES,
    formatGamemodeName,
    ...partyRequestValidation,
    getServerRegion,
    completeRoundProgress,
    ...partyDocuments,
    ...partyRuntimeConstants,
    crypto,
    canAccessFeature,
    canAccessOwnerPages,
    getCurrentAccount,
    assertPartyConfigContentAccess,
    archiveRoomSnapshot: roomArchiver?.archiveRoomSnapshot,
    ...partyGameSessions,
    ...partyOwnerLeases
  };

  Object.assign(context, createPartyPlayerTools(context));
  // Reservation is composed before the route handlers, but it needs the same
  // authenticated/guest principal resolver used by those handlers.
  Object.assign(context, createPartyRoutePlayerTools(context));
  Object.assign(context, createPartyOwnerReservationTools(context));
  Object.assign(context, createPartyRewardProgressTools(context));
  Object.assign(context, createPartyStatEventTools(context));
  Object.assign(context, createPartyTurnOrderTools(context));
  Object.assign(context, createPartyRoundTools(context));
  Object.assign(context, createPartyScoringTools(context));
  Object.assign(context, createPartyGameResetTools(context));
  Object.assign(context, createPartySnapshotTools(context));
  Object.assign(context, createPartyErrorTools(context));
  Object.assign(context, createPartyActionApplier(context));

  const {
    createUpsertPartyHandler,
    createPartyActionHandler,
    createDisbandPartyHandler,
    createRemoveUserHandler,
    createJoinUserHandler,
    createLinkPlayerAccountHandler,
    createContinuePlayerAsGuestHandler,
    createPatchPlayerHandler,
    createDisconnectUserHandler,
    createAuthTransitionHandlers,
    createPartyErrorHandler,
    createPartyGetHandler,
    createSwitchGameHandler,
    disconnectSocketPartyMemberships
  } = createPartyRouteHandlers(context);

  return {
    createDeleteHandler: createDisbandPartyHandler,
    createDeleteQueryHandler: (options) =>
      createDisbandPartyHandler({ ...options, method: 'delete' }),
    createUpsertPartyHandler,
    createPartyActionHandler,
    createRemoveUserHandler,
    createJoinUserHandler,
    createLinkPlayerAccountHandler,
    createContinuePlayerAsGuestHandler,
    createPatchPlayerHandler,
    createDisconnectUserHandler,
    createAuthTransitionHandlers,
    createPartyErrorHandler,
    createPartyGetHandler,
    createSwitchGameHandler,
    disconnectSocketPartyMemberships,
    reservePartyCodeForRequest: context.reservePartyCodeForRequest,
    io
  };
}

module.exports = { createPartyRuntime };

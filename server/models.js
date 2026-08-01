const OverexposurePost = require('../models/content/overexposure-post');
const SocialContentItem = require('../models/content/social-content-item-schema');
const defaultEmailTemplateSchema = require('../models/emails/email-template-schema');
const defaultReportSchema = require('../models/moderation/report-schema');
const defaultSupportTicketSchema = require('../models/moderation/support-ticket-schema');
const defaultSystemConfigSchema = require('../models/moderation/system-config-schema');
const defaultAdminLogSchema = require('../models/moderation/admin-log-schema');
const mongoose = require('mongoose');
const Account = require('../models/accounts/account-schema');
const defaultProductSchema = require('../models/shop/product-schema');
const defaultShopConfigSchema = require('../models/shop/shop-config-schema');
const defaultPartyGameTruthOrDareSchema = require('../models/party-games/party-game-truth-or-dare-schema');
const defaultPartyGameParanoiaSchema = require('../models/party-games/party-game-paranoia-schema');
const defaultPartyGameNeverHaveIEverSchema = require('../models/party-games/party-game-never-have-i-ever-schema');
const defaultPartyGameMostLikelyToSchema = require('../models/party-games/party-game-most-likely-to-schema');
const defaultPartyGameWouldYouRatherSchema = require('../models/party-games/party-game-would-you-rather-schema');
const defaultPartyGameMafiaSchema = require('../models/party-games/party-game-mafia-schema');
const defaultPartyGameChatLogSchema = require('../models/party-games/party-game-chat-log-schema');
const defaultPartyGameEventSchema = require('../models/party-games/party-game-event-schema');
const defaultPartyGameRewardClaimSchema = require('../models/party-games/party-game-reward-claim-schema');
const defaultActivePartyOwnerLeaseSchema = require('../models/party-games/active-party-owner-lease-schema');
const defaultArchivedRoomSchema = require('../models/party-games/archived-room-schema');
const defaultWaitingRoomSchema = require('../models/party-games/waiting-room-schema');
const defaultPartyGameImposterSchema = require('../models/party-games/party-game-imposter-schema');
const defaultGamePackSchema = require('../models/game-config/game-pack-schema');
const defaultGameRuleSchema = require('../models/game-config/game-rule-schema');
const defaultGameRoleSchema = require('../models/game-config/game-role-schema');
const defaultGameModeSchema = require('../models/game-config/game-mode-schema');
const defaultAchievementSchema = require('../models/content/achievement-schema');
const defaultHomepageTileSchema = require('../models/content/homepage-tile-schema');
const defaultAccountPlayedWithSchema = require('../models/accounts/account-played-with-schema');
const defaultAchievementRewardClaimSchema = require('../models/accounts/achievement-reward-claim-schema');
const defaultGamemodeSettingsAlertSchema = require('../models/game-config/gamemode-settings-alert-schema');
const defaultOeCustomisationSchema = require('../models/customisation/oe-customisation-schema');
const defaultOlingTraitSchema = require('../models/olings/oling-trait-schema');
const defaultOlingEggSchema = require('../models/olings/oling-egg-schema');
const defaultOlingBuildSetSchema = require('../models/olings/oling-build-set-schema');
const defaultOlingPersonalitySchema = require('../models/olings/oling-personality-schema');
const defaultOlingConsumableSchema = require('../models/olings/oling-consumable-schema');
const defaultPlayerOlingSchema = require('../models/olings/player-oling-schema');
const defaultOlingHatchReceiptSchema = require('../models/olings/oling-hatch-receipt-schema');
const defaultOlingStateSchema = require('../models/olings/oling-state-schema');
const defaultOlingBattleMatchSchema = require('../models/olings/oling-battle-match-schema');
const defaultOlingBattleEventSchema = require('../models/olings/oling-battle-event-schema');

const accountsConnection = mongoose.createConnection();
const olingsConnection = mongoose.createConnection();
const partyGamesConnection = mongoose.createConnection();
const oeCustomisationConnection = mongoose.createConnection();
const shopConnection = mongoose.createConnection();
const moderationConnection = mongoose.createConnection();
const socialConnection = mongoose.createConnection();
const siteContentConnection = mongoose.createConnection();
const emailConnection = mongoose.createConnection();

function bindModelToConnection(model, connection) {
  return (
    connection.models[model.modelName] ||
    connection.model(model.modelName, model.schema, model.collection.name)
  );
}

const waitingRoomSchema = bindModelToConnection(
  defaultWaitingRoomSchema,
  partyGamesConnection
);
const partyGameTruthOrDareSchema = bindModelToConnection(
  defaultPartyGameTruthOrDareSchema,
  partyGamesConnection
);
const partyGameParanoiaSchema = bindModelToConnection(
  defaultPartyGameParanoiaSchema,
  partyGamesConnection
);
const partyGameNeverHaveIEverSchema = bindModelToConnection(
  defaultPartyGameNeverHaveIEverSchema,
  partyGamesConnection
);
const partyGameMostLikelyToSchema = bindModelToConnection(
  defaultPartyGameMostLikelyToSchema,
  partyGamesConnection
);
const partyGameWouldYouRatherSchema = bindModelToConnection(
  defaultPartyGameWouldYouRatherSchema,
  partyGamesConnection
);
const partyGameMafiaSchema = bindModelToConnection(
  defaultPartyGameMafiaSchema,
  partyGamesConnection
);
const partyGameChatLogSchema = bindModelToConnection(
  defaultPartyGameChatLogSchema,
  partyGamesConnection
);
const partyGameEventSchema = bindModelToConnection(
  defaultPartyGameEventSchema,
  partyGamesConnection
);
const partyGameRewardClaimSchema = bindModelToConnection(
  defaultPartyGameRewardClaimSchema,
  partyGamesConnection
);
const activePartyOwnerLeaseSchema = bindModelToConnection(
  defaultActivePartyOwnerLeaseSchema,
  partyGamesConnection
);
const archivedRoomSchema = bindModelToConnection(
  defaultArchivedRoomSchema,
  partyGamesConnection
);
const partyGameImposterSchema = bindModelToConnection(
  defaultPartyGameImposterSchema,
  partyGamesConnection
);
const GamePack = bindModelToConnection(
  defaultGamePackSchema,
  partyGamesConnection
);
const GameRule = bindModelToConnection(
  defaultGameRuleSchema,
  partyGamesConnection
);
const GameRole = bindModelToConnection(
  defaultGameRoleSchema,
  partyGamesConnection
);
const GameMode = bindModelToConnection(
  defaultGameModeSchema,
  partyGamesConnection
);
const Achievement = bindModelToConnection(
  defaultAchievementSchema,
  socialConnection
);
const HomepageTile = bindModelToConnection(
  defaultHomepageTileSchema,
  siteContentConnection
);
const GamemodeSettingsAlert = bindModelToConnection(
  defaultGamemodeSettingsAlertSchema,
  partyGamesConnection
);
const OeCustomisation = bindModelToConnection(
  defaultOeCustomisationSchema,
  oeCustomisationConnection
);
const AchievementRewardClaim = bindModelToConnection(
  defaultAchievementRewardClaimSchema,
  accountsConnection
);
const boundAccount = bindModelToConnection(Account, accountsConnection);
const AccountPlayedWith = bindModelToConnection(
  defaultAccountPlayedWithSchema,
  accountsConnection
);
const OlingTrait = bindModelToConnection(
  defaultOlingTraitSchema,
  olingsConnection
);
const OlingEgg = bindModelToConnection(defaultOlingEggSchema, olingsConnection);
const OlingBuildSet = bindModelToConnection(
  defaultOlingBuildSetSchema,
  olingsConnection
);
const OlingPersonality = bindModelToConnection(
  defaultOlingPersonalitySchema,
  olingsConnection
);
const OlingConsumable = bindModelToConnection(
  defaultOlingConsumableSchema,
  olingsConnection
);
const PlayerOling = bindModelToConnection(
  defaultPlayerOlingSchema,
  accountsConnection
);
const OlingHatchReceipt = bindModelToConnection(
  defaultOlingHatchReceiptSchema,
  olingsConnection
);
const OlingState = bindModelToConnection(
  defaultOlingStateSchema,
  accountsConnection
);
const OlingBattleMatch = bindModelToConnection(
  defaultOlingBattleMatchSchema,
  olingsConnection
);
const OlingBattleEvent = bindModelToConnection(
  defaultOlingBattleEventSchema,
  olingsConnection
);
const Product = bindModelToConnection(defaultProductSchema, shopConnection);
const ShopConfig = bindModelToConnection(
  defaultShopConfigSchema,
  shopConnection
);
const Report = bindModelToConnection(defaultReportSchema, moderationConnection);
const SupportTicket = bindModelToConnection(
  defaultSupportTicketSchema,
  moderationConnection
);
const SystemConfig = bindModelToConnection(
  defaultSystemConfigSchema,
  moderationConnection
);
const AdminLog = bindModelToConnection(
  defaultAdminLogSchema,
  moderationConnection
);
const boundSocialContentItem = bindModelToConnection(
  SocialContentItem,
  socialConnection
);
const EmailTemplate = bindModelToConnection(
  defaultEmailTemplateSchema,
  emailConnection
);

const PARTY_GAME_MODELS_BY_GAMEMODE = {
  'truth-or-dare': partyGameTruthOrDareSchema,
  paranoia: partyGameParanoiaSchema,
  'never-have-i-ever': partyGameNeverHaveIEverSchema,
  'most-likely-to': partyGameMostLikelyToSchema,
  imposter: partyGameImposterSchema,
  'would-you-rather': partyGameWouldYouRatherSchema,
  mafia: partyGameMafiaSchema
};

module.exports = {
  Account: boundAccount,
  OverexposurePost,
  SocialContentItem: boundSocialContentItem,
  EmailTemplate,
  Report,
  SupportTicket,
  SystemConfig,
  AdminLog,
  GamePack,
  GameRule,
  GameRole,
  GameMode,
  HomepageTile,
  Achievement,
  AchievementRewardClaim,
  AccountPlayedWith,
  OlingTrait,
  OlingEgg,
  OlingBuildSet,
  OlingPersonality,
  OlingConsumable,
  PlayerOling,
  OlingHatchReceipt,
  OlingState,
  OlingBattleMatch,
  OlingBattleEvent,
  GamemodeSettingsAlert,
  OeCustomisation,
  Product,
  ShopConfig,
  partyGameTruthOrDareSchema,
  partyGameParanoiaSchema,
  partyGameNeverHaveIEverSchema,
  partyGameMostLikelyToSchema,
  partyGameWouldYouRatherSchema,
  partyGameMafiaSchema,
  partyGameChatLogSchema,
  partyGameEventSchema,
  partyGameRewardClaimSchema,
  activePartyOwnerLeaseSchema,
  archivedRoomSchema,
  waitingRoomSchema,
  partyGameImposterSchema,
  accountsConnection,
  olingsConnection,
  partyGamesConnection,
  oeCustomisationConnection,
  shopConnection,
  moderationConnection,
  socialConnection,
  siteContentConnection,
  emailConnection,
  PARTY_GAME_MODELS_BY_GAMEMODE
};

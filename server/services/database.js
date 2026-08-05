const mongoose = require('mongoose');

const { createRoomArchiver } = require('./database/room-archiver');
const { createChangeStreamService } = require('./database/change-streams');

function createDatabaseServices({
  io,
  debugLog,
  models,
  partyOwnerLeases,
  roomArchiver
}) {
  const {
    OverexposurePost,
    SocialContentItem,
    EmailTemplate,
    EmailDelivery,
    AnalyticsEvent,
    Report,
    SupportTicket,
    SystemConfig,
    AdminLog,
    Product,
    ShopConfig,
    Account,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    partyGameChatLogSchema,
    partyGameEventSchema,
    partyGameRewardClaimSchema,
    activePartyOwnerLeaseSchema,
    archivedRoomSchema,
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
    GamemodeSettingsAlert,
    OeCustomisation,
    waitingRoomSchema,
    accountsConnection,
    olingsConnection,
    partyGamesConnection,
    oeCustomisationConnection,
    shopConnection,
    moderationConnection,
    socialConnection,
    siteContentConnection,
    emailConnection
  } = models;

  let overexposureDb = null;
  let accountsDb = null;
  let olingsDb = null;
  let partyGamesDb = null;
  let oeCustomisationDb = null;
  let shopDb = null;
  let moderationDb = null;
  let socialDb = null;
  let siteContentDb = null;
  let emailDb = null;
  let dbReconnectHooksAttached = false;
  let restartAllChangeStreams = () => {};

  function getDatabaseUri(baseUri, dbName) {
    try {
      const parsedUri = new URL(baseUri);
      parsedUri.pathname = `/${dbName}`;
      return parsedUri.toString();
    } catch (error) {
      console.warn(
        `⚠️ Could not derive "${dbName}" MongoDB URI from base URI:`,
        error.message || error
      );
      return baseUri;
    }
  }

  function attachDbReconnectHooks() {
    if (
      dbReconnectHooksAttached ||
      !overexposureDb ||
      !accountsDb ||
      !olingsDb ||
      !partyGamesDb ||
      !oeCustomisationDb ||
      !shopDb ||
      !moderationDb ||
      !socialDb ||
      !siteContentDb ||
      !emailDb
    )
      return;
    dbReconnectHooksAttached = true;

    overexposureDb.on('disconnected', () => {
      console.warn(
        '⚠️ Overexposure MongoDB disconnected; waiting to restart streams on reconnect'
      );
    });

    overexposureDb.on('reconnected', () => {
      restartAllChangeStreams('overexposure-mongo-reconnected');
    });

    overexposureDb.on('error', (err) => {
      console.error('❌ Overexposure MongoDB connection error:', err);
    });

    partyGamesDb.on('disconnected', () => {
      console.warn(
        '⚠️ Party Games MongoDB disconnected; waiting to restart streams on reconnect'
      );
    });

    partyGamesDb.on('reconnected', () => {
      restartAllChangeStreams('party-games-mongo-reconnected');
    });

    partyGamesDb.on('error', (err) => {
      console.error('❌ Party Games MongoDB connection error:', err);
    });

    oeCustomisationDb.on('disconnected', () => {
      console.warn('⚠️ OE Customisation MongoDB disconnected');
    });

    oeCustomisationDb.on('error', (err) => {
      console.error('❌ OE Customisation MongoDB connection error:', err);
    });

    accountsDb.on('disconnected', () => {
      console.warn('⚠️ Accounts MongoDB disconnected');
    });

    accountsDb.on('error', (err) => {
      console.error('❌ Accounts MongoDB connection error:', err);
    });

    olingsDb.on('disconnected', () => {
      console.warn('⚠️ Olings MongoDB disconnected');
    });

    olingsDb.on('error', (err) => {
      console.error('❌ Olings MongoDB connection error:', err);
    });

    shopDb.on('disconnected', () => {
      console.warn('⚠️ Shop MongoDB disconnected');
    });

    shopDb.on('error', (err) => {
      console.error('❌ Shop MongoDB connection error:', err);
    });

    moderationDb.on('disconnected', () => {
      console.warn('⚠️ Moderation MongoDB disconnected');
    });

    moderationDb.on('error', (err) => {
      console.error('❌ Moderation MongoDB connection error:', err);
    });

    socialDb.on('disconnected', () => {
      console.warn('⚠️ Social MongoDB disconnected');
    });

    socialDb.on('error', (err) => {
      console.error('❌ Social MongoDB connection error:', err);
    });

    siteContentDb.on('disconnected', () => {
      console.warn('⚠️ Site Content MongoDB disconnected');
    });

    siteContentDb.on('error', (err) => {
      console.error('❌ Site Content MongoDB connection error:', err);
    });

    emailDb.on('disconnected', () => {
      console.warn('⚠️ Emails MongoDB disconnected');
    });

    emailDb.on('error', (err) => {
      console.error('❌ Emails MongoDB connection error:', err);
    });
  }

  async function connectDatabases() {
    try {
      const overexposureUri = process.env.MONGO_URI_OVEREXPOSURE;
      const partyGamesUri =
        process.env.MONGO_URI_PARTY_GAMES ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_PARTY_GAMES || 'party-games'
        );
      const oeCustomisationUri =
        process.env.MONGO_URI_OE_CUSTOMISATION ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_OE_CUSTOMISATION || 'oe-customisation'
        );
      const accountsUri =
        process.env.MONGO_URI_ACCOUNTS ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_ACCOUNTS || 'accounts'
        );
      const olingsUri =
        process.env.MONGO_URI_OLINGS ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_OLINGS || 'olings'
        );
      const shopUri =
        process.env.MONGO_URI_SHOP ||
        getDatabaseUri(overexposureUri, process.env.MONGO_DB_SHOP || 'shop');
      const moderationUri =
        process.env.MONGO_URI_MODERATION ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_MODERATION || 'moderation'
        );
      const socialUri =
        process.env.MONGO_URI_SOCIAL ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_SOCIAL || 'social'
        );
      const siteContentUri =
        process.env.MONGO_URI_SITE_CONTENT ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_SITE_CONTENT || 'site-content'
        );
      const emailUri =
        process.env.MONGO_URI_EMAILS ||
        getDatabaseUri(
          overexposureUri,
          process.env.MONGO_DB_EMAILS || 'emails'
        );

      await mongoose.connect(overexposureUri);
      debugLog('✅ Connected to OVEREXPOSURE Database');

      overexposureDb = mongoose.connection;

      await partyGamesConnection.openUri(partyGamesUri);
      debugLog('✅ Connected to PARTY GAMES Database');

      partyGamesDb = partyGamesConnection;

      await oeCustomisationConnection.openUri(oeCustomisationUri);
      debugLog('✅ Connected to OE CUSTOMISATION Database');

      oeCustomisationDb = oeCustomisationConnection;

      await accountsConnection.openUri(accountsUri);
      debugLog('✅ Connected to ACCOUNTS Database');

      accountsDb = accountsConnection;

      await olingsConnection.openUri(olingsUri);
      debugLog('✅ Connected to OLINGS Database');

      olingsDb = olingsConnection;

      await shopConnection.openUri(shopUri);
      debugLog('✅ Connected to SHOP Database');

      shopDb = shopConnection;

      await moderationConnection.openUri(moderationUri);
      debugLog('✅ Connected to MODERATION Database');

      moderationDb = moderationConnection;

      await socialConnection.openUri(socialUri);
      debugLog('✅ Connected to SOCIAL Database');

      socialDb = socialConnection;

      await siteContentConnection.openUri(siteContentUri);
      debugLog('✅ Connected to SITE CONTENT Database');

      siteContentDb = siteContentConnection;

      await emailConnection.openUri(emailUri);
      debugLog('✅ Connected to EMAILS Database');

      emailDb = emailConnection;
    } catch (err) {
      console.error('❌ Database connection error:', err);
      process.exit(1);
    }
  }

  async function ensureDatabaseIndexes() {
    if (!activePartyOwnerLeaseSchema) {
      throw new Error('Active party owner lease model is unavailable.');
    }

    // Party creation relies on these unique indexes across every server
    // instance, so failing to create them must fail startup.
    await activePartyOwnerLeaseSchema.createIndexes();

    const modelsToIndex = [
      waitingRoomSchema,
      partyGameTruthOrDareSchema,
      partyGameParanoiaSchema,
      partyGameNeverHaveIEverSchema,
      partyGameMostLikelyToSchema,
      partyGameImposterSchema,
      partyGameWouldYouRatherSchema,
      partyGameMafiaSchema,
      partyGameChatLogSchema,
      partyGameEventSchema,
      partyGameRewardClaimSchema,
      archivedRoomSchema,
      GamePack,
      GameRule,
      GameRole,
      GameMode,
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
      GamemodeSettingsAlert,
      OeCustomisation,
      OverexposurePost,
      SocialContentItem,
      EmailTemplate,
      EmailDelivery,
      AnalyticsEvent,
      Report,
      SupportTicket,
      SystemConfig,
      AdminLog,
      Account,
      Product,
      ShopConfig,
      HomepageTile
    ];

    await Promise.all(
      modelsToIndex.map(async (model) => {
        try {
          await model.createIndexes();
        } catch (error) {
          console.warn(
            `⚠️ Failed to ensure indexes for ${model.modelName}:`,
            error.message || error
          );
        }
      })
    );

    await ShopConfig.updateOne(
      { key: 'account-container' },
      {
        $setOnInsert: {
          key: 'account-container',
          accountCommercePublic: false,
          'system.createdAt': new Date()
        }
      },
      { upsert: true }
    );
  }

  const activeRoomArchiver =
    roomArchiver || createRoomArchiver({ models, partyOwnerLeases });
  const changeStreams = createChangeStreamService({
    io,
    debugLog,
    models,
    getConnections: () => ({
      overexposureDb,
      accountsDb,
      olingsDb,
      partyGamesDb,
      oeCustomisationDb,
      shopDb,
      moderationDb,
      socialDb,
      siteContentDb,
      emailDb
    }),
    attachDbReconnectHooks
  });
  restartAllChangeStreams = changeStreams.restartAllChangeStreams;

  return {
    connectDatabases,
    ensureDatabaseIndexes,
    startRoomArchiver: activeRoomArchiver.startRoomArchiver,
    startChangeStreams: changeStreams.startChangeStreams
  };
}

module.exports = {
  createDatabaseServices
};

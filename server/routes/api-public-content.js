const {
  getPublishedPack,
  getPublishedPacks,
  getPackAccess,
  serializePackMetadataForApi,
  serializePackQuestionsForJson
} = require('../services/game-packs');
const {
  getPublishedRules,
  getRuleAccess,
  serializeRuleForApi
} = require('../services/game-rules');
const {
  getPublishedRoles,
  getRoleAccess,
  serializeRoleForApi
} = require('../services/game-roles');
const {
  canAccountAccessGameContent
} = require('../services/game-content-access');
const {
  getGameContentRequestContext,
  getGrandfatheredPartyContentKeys
} = require('../services/party-content-access');
const {
  getPublishedGameModes,
  serializeGameModeForApi
} = require('../services/game-modes');
const {
  getHomepageTiles,
  serializeHomepageTileForApi
} = require('../services/homepage-tiles');
const {
  getPublishedAchievements,
  serializeAchievementForJson
} = require('../services/achievements');
const {
  getAchievementRewardCatalog
} = require('../services/achievements/reward-catalog');
const {
  canAccessFeature,
  canAccessOwnerPages,
  getCurrentAccount
} = require('../services/page-protection');
const {
  getPublishedOeImagePacks,
  getPublishedOeImages,
  serializeOeImagePackForApi,
  serializeOeImagesForPackJson
} = require('../services/oe-images');

function registerPublicContentRoutes({ app, models }) {
  const {
    Account,
    Achievement,
    GameMode,
    HomepageTile,
    GamePack,
    GameRule,
    GameRole,
    waitingRoomSchema,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    OeCustomisation,
    OlingConsumable,
    OlingEgg,
    Product
  } = models;
  const partyModels = [
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema
  ].filter(Boolean);

  function canAccessHomepageTile(tile, account) {
    if (!tile.enabled) return false;

    const accessType = tile.access?.type || 'public';
    if (accessType === 'account') return Boolean(account);
    if (accessType === 'feature') {
      return canAccessFeature(account, tile.access?.feature);
    }
    if (accessType === 'owner') return canAccessOwnerPages(account);
    return true;
  }

  app.get('/api/homepage-tiles', async (req, res) => {
    try {
      const [tiles, account] = await Promise.all([
        getHomepageTiles(HomepageTile),
        getCurrentAccount(req, Account)
      ]);

      res.apiSuccess({
        data: {
          homepageTiles: tiles.map((tile) =>
            serializeHomepageTileForApi(
              tile,
              canAccessHomepageTile(tile, account)
            )
          )
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch homepage tiles:`, err);
      res.apiError({
        status: 500,
        code: 'homepage_tiles_fetch_failed',
        message: 'Failed to fetch homepage tiles'
      });
    }
  });

  app.get('/api/party-game-packs/:gamemode', async (req, res) => {
    try {
      const { gamemode } = req.params;
      const contentContext = await getGameContentRequestContext(req, {
        Account,
        WaitingRoom: waitingRoomSchema,
        PartyModels: partyModels
      });
      const grandfathered = getGrandfatheredPartyContentKeys(
        contentContext.party
      );
      const packs = await getPublishedPacks(GamePack, gamemode, {
        includeKeys: grandfathered.packKeys
      });
      const accessAccount = contentContext.account;
      const visiblePacks = packs.filter((pack) =>
        canAccountAccessGameContent(accessAccount, getPackAccess(pack))
      );

      res.apiSuccess({
        data: {
          [`${gamemode}-packs`]: visiblePacks.map(serializePackMetadataForApi)
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch game packs:`, err);
      res.apiError({
        status: 500,
        code: 'game_packs_fetch_failed',
        message: 'Failed to fetch game packs'
      });
    }
  });

  app.get('/api/party-game-gamemodes', async (req, res) => {
    try {
      const account = await getCurrentAccount(req, Account);
      let gamemodes = [];

      try {
        gamemodes = await GameMode.find({})
          .sort({ sortOrder: 1, gameType: 1 })
          .lean();
      } catch (error) {
        console.warn(
          `[REQ ${req.id}] Falling back to JSON game modes:`,
          error.message || error
        );
      }

      const sourceGamemodes = gamemodes.length
        ? gamemodes
        : await getPublishedGameModes(GameMode);
      const visibleGamemodes = sourceGamemodes
        .map((gamemode) => {
          const serialized = serializeGameModeForApi(gamemode);
          const gamemodeId = String(serialized.gamemodeID || '').toLowerCase();
          const accessVisible = [
            'imposter',
            'would-you-rather',
            'mafia'
          ].includes(gamemodeId)
            ? canAccessFeature(account, gamemodeId)
            : false;

          return {
            ...serialized,
            accessVisible
          };
        })
        .filter(
          (gamemode) =>
            gamemode['gamemode-active'] !== false || gamemode.accessVisible
        );

      res.apiSuccess({
        data: { gamemodes: visibleGamemodes }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch game modes:`, err);
      res.apiError({
        status: 500,
        code: 'game_modes_fetch_failed',
        message: 'Failed to fetch game modes'
      });
    }
  });

  app.get('/api/party-game-rules/:gamemode', async (req, res) => {
    try {
      const { gamemode } = req.params;
      const contentContext = await getGameContentRequestContext(req, {
        Account,
        WaitingRoom: waitingRoomSchema,
        PartyModels: partyModels
      });
      const grandfathered = getGrandfatheredPartyContentKeys(
        contentContext.party
      );
      const rules = await getPublishedRules(GameRule, gamemode, {
        includeKeys: grandfathered.ruleKeys
      });
      const accessAccount = contentContext.account;
      const visibleRules = rules.filter((rule) =>
        canAccountAccessGameContent(accessAccount, getRuleAccess(rule))
      );

      res.apiSuccess({
        data: {
          [`${gamemode}-settings`]: visibleRules.map(serializeRuleForApi)
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch game rules:`, err);
      res.apiError({
        status: 500,
        code: 'game_rules_fetch_failed',
        message: 'Failed to fetch game rules'
      });
    }
  });

  app.get('/api/party-game-roles/:gamemode', async (req, res) => {
    try {
      const { gamemode } = req.params;
      const contentContext = await getGameContentRequestContext(req, {
        Account,
        WaitingRoom: waitingRoomSchema,
        PartyModels: partyModels
      });
      const grandfathered = getGrandfatheredPartyContentKeys(
        contentContext.party
      );
      const roles = await getPublishedRoles(GameRole, gamemode, {
        includeKeys: grandfathered.roleKeys
      });
      const accessAccount = contentContext.account;
      const visibleRoles = roles.filter((role) =>
        canAccountAccessGameContent(accessAccount, getRoleAccess(role))
      );

      res.apiSuccess({
        data: {
          [`${gamemode}-roles`]: visibleRoles.map(serializeRoleForApi)
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch game roles:`, err);
      res.apiError({
        status: 500,
        code: 'game_roles_fetch_failed',
        message: 'Failed to fetch game roles'
      });
    }
  });

  app.get('/api/achievements', async (req, res) => {
    try {
      const [achievements, rewardCatalog] = await Promise.all([
        getPublishedAchievements(Achievement),
        getAchievementRewardCatalog({
          Product,
          OlingEgg,
          OlingConsumable,
          OeCustomisation
        })
      ]);

      res.apiSuccess({
        data: {
          achievements: achievements.map(serializeAchievementForJson),
          rewardCatalog
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch achievements:`, err);
      res.apiError({
        status: 500,
        code: 'achievements_fetch_failed',
        message: 'Failed to fetch achievements'
      });
    }
  });

  app.get('/api/oe-image-packs', async (req, res) => {
    try {
      const packs = await getPublishedOeImagePacks(OeCustomisation);

      res.apiSuccess({
        data: packs.map(serializeOeImagePackForApi)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch OE image packs:`, err);
      res.apiError({
        status: 500,
        code: 'oe_image_packs_fetch_failed',
        message: 'Failed to fetch OE image packs'
      });
    }
  });

  app.get('/api/oe-image-packs/:slug/images', async (req, res) => {
    try {
      const { slug } = req.params;
      const pack = await OeCustomisation.findOne({
        recordType: 'pack',
        slug,
        enabled: true,
        status: 'published'
      }).lean();

      if (!pack) {
        return res.apiError({
          status: 404,
          code: 'oe_image_pack_not_found',
          message: 'OE image pack not found'
        });
      }

      const images = await getPublishedOeImages(OeCustomisation, {
        packSlug: slug
      });

      res.apiSuccess({
        data: serializeOeImagesForPackJson(slug, images)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch OE images:`, err);
      res.apiError({
        status: 500,
        code: 'oe_images_fetch_failed',
        message: 'Failed to fetch OE images'
      });
    }
  });

  app.get('/api/oe-image-display-index', async (req, res) => {
    try {
      const images = await getPublishedOeImages(OeCustomisation);

      res.apiSuccess({
        data: {
          items: images.map((image) => ({
            id: image.oeId,
            name: image.name,
            slot: image.slot,
            filePath: image.filePath,
            packSlug: image.packSlug
          }))
        }
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch OE image display index:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oe_image_display_index_fetch_failed',
        message: 'Failed to fetch OE image display index'
      });
    }
  });

  app.get(
    '/api/party-game-packs/:gamemode/:slug/questions',
    async (req, res) => {
      try {
        const { gamemode, slug } = req.params;
        const contentContext = await getGameContentRequestContext(req, {
          Account,
          WaitingRoom: waitingRoomSchema,
          PartyModels: partyModels
        });
        const grandfathered = getGrandfatheredPartyContentKeys(
          contentContext.party
        );
        const pack = await getPublishedPack(GamePack, gamemode, slug, {
          includeKeys: grandfathered.packKeys
        });
        const accessAccount = contentContext.account;

        if (
          !pack ||
          !canAccountAccessGameContent(accessAccount, getPackAccess(pack))
        ) {
          return res.apiError({
            status: 404,
            code: 'game_pack_not_found',
            message: 'Game pack not found'
          });
        }

        res.apiSuccess({
          data: serializePackQuestionsForJson(pack)
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch game pack questions:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'game_pack_questions_fetch_failed',
          message: 'Failed to fetch game pack questions'
        });
      }
    }
  );
}

module.exports = {
  registerPublicContentRoutes
};

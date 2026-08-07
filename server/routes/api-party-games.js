const {
  QRCodeStyling
} = require('qr-code-styling/lib/qr-code-styling.common.js');
const nodeCanvas = require('canvas');
const { JSDOM } = require('jsdom');
const {
  canAccessFeature,
  canAccessHostedFeature,
  canAccessHostedOwnerPage,
  canAccessOwnerPages,
  getCurrentAccount
} = require('../services/page-protection');

function registerPartyGameRoutes({ app, models, runtime }) {
  const {
    Account,
    waitingRoomSchema,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema
  } = models;
  const {
    createDeleteHandler,
    createDeleteQueryHandler,
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
    createSwitchGameHandler
  } = runtime;

  const BETA_GAME_FEATURES = {
    imposter: 'imposter',
    'would-you-rather': 'would-you-rather'
  };
  const OWNER_GAME_MODES = new Set(['mafia']);

  function getRequestPartyCode(req) {
    return String(
      req?.body?.partyId ||
        req?.body?.partyCode ||
        req?.query?.partyCode ||
        req?.query?.partyId ||
        ''
    ).trim();
  }

  function getRequestGamemode(req) {
    return String(
      req?.body?.targetGamemode ||
        req?.body?.config?.gamemode ||
        req?.body?.gamemode ||
        ''
    )
      .trim()
      .toLowerCase();
  }

  async function getWaitingRoomGamemode(req) {
    const partyCode = getRequestPartyCode(req);
    if (!partyCode) return '';

    const waitingRoom = await waitingRoomSchema
      .findOne({ partyId: partyCode })
      .lean();
    return String(waitingRoom?.config?.gamemode || '')
      .trim()
      .toLowerCase();
  }

  async function requireFeatureOrHostedParty(req, res, feature, PartyModels) {
    const account = await getCurrentAccount(req, Account);
    if (canAccessFeature(account, feature)) return true;

    const hosted = await canAccessHostedFeature(req, feature, {
      Account,
      PartyModels
    });
    if (hosted) return true;

    res.apiError({
      status: account ? 403 : 401,
      code: account ? 'feature_access_required' : 'account_required',
      message: 'This game is currently available to beta testers.'
    });
    return false;
  }

  async function requireOwnerOrHostedParty(req, res, PartyModels) {
    const account = await getCurrentAccount(req, Account);
    if (canAccessOwnerPages(account)) return true;

    const hosted = await canAccessHostedOwnerPage(req, {
      Account,
      PartyModels
    });
    if (hosted) return true;

    res.apiError({
      status: account ? 403 : 401,
      code: account ? 'owner_access_required' : 'account_required',
      message: 'This game is currently available to the owner only.'
    });
    return false;
  }

  function requirePartyFeature(feature, PartyModels) {
    return async (req, res, next) => {
      try {
        if (
          !(await requireFeatureOrHostedParty(req, res, feature, PartyModels))
        )
          return;
        return next();
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to verify party feature access:`,
          err
        );
        return res.apiError({
          status: 500,
          code: 'party_feature_access_check_failed',
          message: 'Failed to check game access.'
        });
      }
    };
  }

  function requirePartyOwner(PartyModels) {
    return async (req, res, next) => {
      try {
        if (!(await requireOwnerOrHostedParty(req, res, PartyModels))) return;
        return next();
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to verify party owner access:`,
          err
        );
        return res.apiError({
          status: 500,
          code: 'party_owner_access_check_failed',
          message: 'Failed to check game access.'
        });
      }
    };
  }

  async function requireBetaWaitingRoomFeature(req, res, next) {
    try {
      const requestedGamemode = getRequestGamemode(req);
      const existingGamemode = requestedGamemode
        ? ''
        : await getWaitingRoomGamemode(req);

      if (
        OWNER_GAME_MODES.has(requestedGamemode) ||
        OWNER_GAME_MODES.has(existingGamemode)
      ) {
        if (!(await requireOwnerOrHostedParty(req, res, [waitingRoomSchema]))) {
          return;
        }

        return next();
      }

      const feature =
        BETA_GAME_FEATURES[requestedGamemode] ||
        BETA_GAME_FEATURES[existingGamemode];

      if (!feature) {
        return next();
      }

      if (
        !(await requireFeatureOrHostedParty(req, res, feature, [
          waitingRoomSchema
        ]))
      ) {
        return;
      }

      return next();
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to verify waiting room feature access:`,
        err
      );
      return res.apiError({
        status: 500,
        code: 'waiting_room_feature_access_check_failed',
        message: 'Failed to check waiting room access.'
      });
    }
  }

  app.use('/api/waiting-room', requireBetaWaitingRoomFeature);
  app.use('/api/party-lobbies', requireBetaWaitingRoomFeature);
  app.use(
    '/api/party-game-imposter',
    requirePartyFeature('imposter', [
      partyGameImposterSchema,
      waitingRoomSchema
    ])
  );
  app.use(
    '/api/party-game-would-you-rather',
    requirePartyFeature('would-you-rather', [
      partyGameWouldYouRatherSchema,
      waitingRoomSchema
    ])
  );
  app.use(
    '/api/party-game-mafia',
    requirePartyOwner([partyGameMafiaSchema, waitingRoomSchema])
  );
  app.use(
    '/api/party-mafia',
    requirePartyOwner([partyGameMafiaSchema, waitingRoomSchema])
  );

  createUpsertPartyHandler({
    route: '/api/waiting-room',
    model: waitingRoomSchema,
    logLabel: 'Waiting room',
    fields: ['session', 'config', 'state', 'players']
  });
  createPartyGetHandler({
    route: '/api/waiting-room',
    model: waitingRoomSchema,
    logLabel: 'Waiting room'
  });
  createPatchPlayerHandler({
    route: '/api/waiting-room/patch-player',
    mainModel: waitingRoomSchema,
    waitingRoomModel: null,
    logLabel: 'Waiting room'
  });
  createSwitchGameHandler({ route: '/api/party-lobbies/switch-game' });

  const partyGameRoutes = [
    {
      route: 'party-game-truth-or-dare',
      partyGameModel: partyGameTruthOrDareSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Truth Or Dare'
    },
    {
      route: 'party-game-paranoia',
      partyGameModel: partyGameParanoiaSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Paranoia'
    },
    {
      route: 'party-game-never-have-i-ever',
      partyGameModel: partyGameNeverHaveIEverSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Never Have I Ever'
    },
    {
      route: 'party-game-most-likely-to',
      partyGameModel: partyGameMostLikelyToSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Most Likely To'
    },
    {
      route: 'party-game-imposter',
      partyGameModel: partyGameImposterSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Imposter'
    },
    {
      route: 'party-game-would-you-rather',
      partyGameModel: partyGameWouldYouRatherSchema,
      partyGameFields: ['session', 'config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Would You Rather'
    },
    {
      route: 'party-game-mafia',
      partyGameModel: partyGameMafiaSchema,
      partyGameFields: ['session', 'config', 'state', 'players'],
      partyGameLogLabel: 'Party Game Mafia'
    }
  ];
  partyGameRoutes.forEach(
    ({ route, partyGameModel, partyGameLogLabel, partyGameFields }) => {
      createUpsertPartyHandler({
        route: `/api/${route}`,
        model: partyGameModel,
        logLabel: partyGameLogLabel,
        fields: partyGameFields,
        allocateGameId: true
      });

      createDeleteHandler({
        route: `/api/${route}/delete`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createPartyActionHandler({
        route: `/api/${route}`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel,
        hasDeck: partyGameFields.includes('deck')
      });

      createDeleteQueryHandler({
        route: `/api/${route}`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createRemoveUserHandler({
        route: `/api/${route}/remove-user`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createJoinUserHandler({
        route: `/api/${route}/join-user`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createLinkPlayerAccountHandler({
        route: `/api/${route}/link-player-account`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createContinuePlayerAsGuestHandler({
        route: `/api/${route}/continue-player-as-guest`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createPatchPlayerHandler({
        route: `/api/${route}/patch-player`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createDisconnectUserHandler({
        route: `/api/${route}/disconnect-user`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createAuthTransitionHandlers({
        route: `/api/${route}/auth-transition`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createPartyErrorHandler({
        route: `/api/${route}/error`,
        mainModel: partyGameModel,
        waitingRoomModel: waitingRoomSchema,
        logLabel: partyGameLogLabel
      });

      createPartyGetHandler({
        route: `/api/${route}`,
        model: partyGameModel,
        logLabel: partyGameLogLabel
      });
    }
  );

  app.post(
    '/api/party-mafia/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})/chat',
    async (req, res) => {
      const { partyCode } = req.params;
      const { username, message, isMafia } = req.body;

      try {
        const update = isMafia
          ? { $push: { mafiaChat: { username, message } } }
          : { $push: { generalChat: { username, message } } };

        const updatedGame = await partyGameMafiaSchema.findOneAndUpdate(
          { partyId: partyCode },
          update,
          { new: true }
        );

        if (!updatedGame) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: 'Party not found'
          });
        }

        res.apiSuccess({ data: updatedGame });
      } catch (err) {
        console.error(`[REQ ${req.id}] Error updating chat:`, err);
        res.apiError({
          status: 500,
          code: 'party_mafia_chat_update_failed',
          message: 'Failed to update party chat'
        });
      }
    }
  );

  app.get(
    '/api/party-qr/:partyCode([a-zA-Z0-9]{3}-[a-zA-Z0-9]{3})',
    async (req, res) => {
      const { partyCode } = req.params;
      const rawColor =
        typeof req.query.color === 'string' ? req.query.color.trim() : '';
      const safeColor = /^#[0-9A-Fa-f]{6}$/.test(rawColor)
        ? rawColor
        : '#000000';
      const requestedPath =
        typeof req.query.path === 'string' ? req.query.path.trim() : '';
      const safePath = /^\/[A-Za-z0-9/_-]+$/.test(requestedPath)
        ? requestedPath
        : `/${partyCode}`;
      const joinUrl = `${req.protocol}://${req.get('host')}${safePath}`;

      try {
        const qrCode = new QRCodeStyling({
          jsdom: JSDOM,
          nodeCanvas,
          width: 512,
          height: 512,
          type: 'canvas',
          data: joinUrl,
          margin: 8,
          qrOptions: {
            errorCorrectionLevel: 'M'
          },
          dotsOptions: {
            color: safeColor,
            type: 'rounded'
          },
          backgroundOptions: {
            color: 'transparent'
          }
        });

        const imageBuffer = await qrCode.getRawData('png');
        const image = await nodeCanvas.loadImage(imageBuffer);
        const transparentCanvas = nodeCanvas.createCanvas(
          image.width,
          image.height
        );
        const transparentCtx = transparentCanvas.getContext('2d');
        transparentCtx.drawImage(image, 0, 0);

        const imageData = transparentCtx.getImageData(
          0,
          0,
          image.width,
          image.height
        );
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r >= 248 && g >= 248 && b >= 248) {
            pixels[i + 3] = 0;
          }
        }
        transparentCtx.putImageData(imageData, 0, 0);
        const outputBuffer = transparentCanvas.toBuffer('image/png');

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.send(outputBuffer);
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to generate QR for party ${partyCode}:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'party_qr_generation_failed',
          message: 'Failed to generate QR code'
        });
      }
    }
  );
}

module.exports = {
  registerPartyGameRoutes
};

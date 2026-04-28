const bcrypt = require('bcryptjs');
const {
  QRCodeStyling
} = require('qr-code-styling/lib/qr-code-styling.common.js');
const nodeCanvas = require('canvas');
const { JSDOM } = require('jsdom');

const { generateDeleteCode } = require('../../utils/generate-delete-code');
const { reserveUniquePartyCode } = require('../services/page-assets');

function registerApiRoutes({ app, models, runtime }) {
  const {
    Confession,
    waitingRoomSchema,
    partyGameTruthOrDareSchema,
    partyGameParanoiaSchema,
    partyGameNeverHaveIEverSchema,
    partyGameMostLikelyToSchema,
    partyGameImposterSchema,
    partyGameWouldYouRatherSchema,
    partyGameMafiaSchema,
    partyGameChatLogSchema
  } = models;
  const {
    createDeleteHandler,
    createDeleteQueryHandler,
    createUpsertPartyHandler,
    createPartyActionHandler,
    createRemoveUserHandler,
    createJoinUserHandler,
    createPatchPlayerHandler,
    createDisconnectUserHandler,
    createPartyGetHandler
  } = runtime;

  app.get('/api/confessions', async (req, res) => {
    try {
      const data = await Confession.find({});
      res.apiSuccess({ data });
    } catch (err) {
      console.error(`[REQ ${req.id}] ❌ Failed to fetch confessions:`, err);
      res.apiError({
        status: 500,
        code: 'confessions_fetch_failed',
        message: 'Failed to fetch confessions'
      });
    }
  });

  app.post('/api/confessions', async (req, res) => {
    try {
      const { title, text, id, date, userIcon, x, y, tag } = req.body;
      const deleteCode = generateDeleteCode();
      const saltRounds = 10;
      const deleteCodeHash = await bcrypt.hash(deleteCode, saltRounds);

      const saved = await Confession.create({
        title,
        text,
        id,
        date,
        userIcon,
        x,
        y,
        tag,
        deleteCodeHash
      });

      res.apiSuccess(
        {
          message: 'Confession saved successfully',
          confession: saved,
          deleteCode
        },
        201
      );
    } catch (err) {
      console.error(`[REQ ${req.id}] ❌ Error saving confession:`, err);
      res.apiError({
        status: 500,
        code: 'confession_save_failed',
        message: 'Failed to save confession'
      });
    }
  });

  app.delete('/api/confessions/:id', async (req, res) => {
    try {
      const publicId = req.params.id;
      const { deleteCode } = req.body;

      if (!deleteCode) {
        return res.apiError({
          status: 400,
          code: 'delete_code_required',
          message: 'Delete code is required'
        });
      }

      const confession = await Confession.findOne({ id: publicId });

      if (!confession || !confession.deleteCodeHash) {
        return res.apiError({
          status: 403,
          code: 'invalid_confession_delete_code',
          message: 'Invalid confession or delete code'
        });
      }

      const matches = await bcrypt.compare(
        deleteCode,
        confession.deleteCodeHash
      );
      if (!matches) {
        return res.apiError({
          status: 403,
          code: 'invalid_confession_delete_code',
          message: 'Invalid confession or delete code'
        });
      }

      await Confession.deleteOne({ id: publicId });

      res.apiSuccess({ message: 'Confession deleted successfully' });
    } catch (err) {
      console.error(`[REQ ${req.id}] ❌ Error deleting confession:`, err);
      res.apiError({
        status: 500,
        code: 'confession_delete_failed',
        message: 'Failed to delete confession'
      });
    }
  });

  createUpsertPartyHandler({
    route: '/api/waiting-room',
    model: waitingRoomSchema,
    logLabel: 'Waiting room',
    fields: ['config', 'state', 'players']
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

  const partyGameRoutes = [
    {
      route: 'party-game-truth-or-dare',
      partyGameModel: partyGameTruthOrDareSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Truth Or Dare'
    },
    {
      route: 'party-game-paranoia',
      partyGameModel: partyGameParanoiaSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Paranoia'
    },
    {
      route: 'party-game-never-have-i-ever',
      partyGameModel: partyGameNeverHaveIEverSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Never Have I Ever'
    },
    {
      route: 'party-game-most-likely-to',
      partyGameModel: partyGameMostLikelyToSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Most Likely To'
    },
    {
      route: 'party-game-imposter',
      partyGameModel: partyGameImposterSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Imposter'
    },
    {
      route: 'party-game-would-you-rather',
      partyGameModel: partyGameWouldYouRatherSchema,
      partyGameFields: ['config', 'state', 'deck', 'players'],
      partyGameLogLabel: 'Party Game Would You Rather'
    },
    {
      route: 'party-game-mafia',
      partyGameModel: partyGameMafiaSchema,
      partyGameFields: ['config', 'state', 'players'],
      partyGameLogLabel: 'Party Game Mafia'
    }
  ];

  partyGameRoutes.forEach(
    ({ route, partyGameModel, partyGameLogLabel, partyGameFields }) => {
      createUpsertPartyHandler({
        route: `/api/${route}`,
        model: partyGameModel,
        logLabel: partyGameLogLabel,
        fields: partyGameFields
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
      const joinUrl = `${req.protocol}://${req.get('host')}/${partyCode}`;

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
          `[REQ ${req.id}] ❌ Failed to generate QR for party ${partyCode}:`,
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

  app.post('/api/party-code/reserve', async (req, res) => {
    try {
      const partyCode = await reserveUniquePartyCode(waitingRoomSchema);
      res.apiSuccess({ partyCode });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] ❌ Failed to reserve unique party code:`,
        error
      );
      res.apiError({
        status: 500,
        code: 'party_code_reserve_failed',
        message: 'Failed to reserve unique party code'
      });
    }
  });

  app.post('/api/chat/:partyId', async (req, res) => {
    try {
      const { partyId } = req.params;
      const { username, message, type = 'generalChat' } = req.body;

      await partyGameChatLogSchema.updateOne(
        { partyId },
        { $push: { [type]: { username, message } } },
        { upsert: true }
      );

      res.apiSuccess({ message: `Chat for party ${partyId} updated` });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to update chat ${req.params.partyId}:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'chat_update_failed',
        message: err.message || 'Failed to update chat'
      });
    }
  });

  app.get('/api/chat/:partyId', async (req, res) => {
    try {
      const { partyId } = req.params;
      const chatLog = await partyGameChatLogSchema.findOne({ partyId });
      res.apiSuccess({
        data: chatLog || { partyId, generalChat: [], mafiaChat: [] }
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch chat ${req.params.partyId}:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'chat_fetch_failed',
        message: err.message || 'Failed to fetch chat'
      });
    }
  });

  app.delete('/api/chat/:partyId', async (req, res) => {
    try {
      const { partyId } = req.params;
      const result = await partyGameChatLogSchema.deleteOne({ partyId });

      if (result.deletedCount === 0) {
        return res.apiError({
          status: 404,
          code: 'chat_not_found',
          message: `No chat found for party ${partyId}`
        });
      }

      res.apiSuccess({ message: `Chat for party ${partyId} deleted` });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to delete chat ${req.params.partyId}:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'chat_delete_failed',
        message: err.message || 'Failed to delete chat'
      });
    }
  });
}

module.exports = {
  registerApiRoutes
};

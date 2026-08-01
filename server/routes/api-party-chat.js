function registerPartyChatRoutes({ app, models, runtime }) {
  const { partyGameChatLogSchema } = models;

  app.post('/api/party-code/reserve', async (req, res) => {
    try {
      if (typeof runtime?.reservePartyCodeForRequest !== 'function') {
        const error = new Error(
          'Party owner lease enforcement is unavailable.'
        );
        error.status = 503;
        error.code = 'party_owner_lease_unavailable';
        throw error;
      }

      const partyCode = await runtime.reservePartyCodeForRequest(req, res);
      res.apiSuccess({ partyCode });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] ❌ Failed to reserve unique party code:`,
        error
      );
      res.apiError({
        status: Number.isInteger(error?.status) ? error.status : 500,
        code:
          typeof error?.code === 'string'
            ? error.code
            : 'party_code_reserve_failed',
        message:
          error?.status && error.status < 500
            ? error.message
            : 'Failed to reserve unique party code',
        details: error?.details
      });
    }
  });

  app.post('/api/chat/:partyId', async (req, res) => {
    try {
      const { partyId } = req.params;
      const { username, message, eventType = 'message' } = req.body;

      await partyGameChatLogSchema.updateOne(
        { partyId },
        {
          $push: {
            chat: { username, message, eventType }
          },
          $set: { lastPinged: new Date() },
          $setOnInsert: { partyId }
        },
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
        data: chatLog || { partyId, chat: [] }
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
  registerPartyChatRoutes
};

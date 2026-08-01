const {
  isPartyRoomActive
} = require('../../../services/party-room-activity');

function createPartyUtilityRoutes(context) {
  const { app, assertPartyId, appendPartyError, createPartyErrorEntry } =
    context;

  function createPartyErrorHandler({
    route,
    mainModel,
    waitingRoomModel,
    logLabel
  }) {
    app.post(route, async (req, res) => {
      try {
        const partyId = req.body?.partyId ?? req.query?.partyCode;
        assertPartyId(partyId);

        const party = await mainModel.findOne({ partyId }).lean();
        if (!party) {
          return res.apiError({
            status: 404,
            code: 'party_not_found',
            message: `${logLabel} not found`
          });
        }

        const clientError = req.body?.error ?? {};
        await appendPartyError({
          mainModel,
          waitingRoomModel,
          partyId,
          entry: createPartyErrorEntry({
            err: clientError,
            req,
            party,
            source: 'client',
            details: {
              partyId,
              message: clientError.message,
              name: clientError.name,
              code: clientError.code,
              stack: clientError.stack,
              action: req.body?.action,
              actorId: req.body?.actorId,
              computerId: req.body?.computerId,
              username: req.body?.username,
              socketId: req.body?.socketId,
              details: req.body?.context ?? null
            }
          })
        });

        res.apiSuccess({ message: `${logLabel} error recorded` });
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error recording ${logLabel.toLowerCase()} error:`,
          err
        );
        res.apiError({
          status,
          code:
            typeof err.code === 'string' ? err.code : 'party_error_log_failed',
          message:
            err.message || `Failed to record ${logLabel.toLowerCase()} error`
        });
      }
    });
  }

  function createPartyGetHandler({ route, model, logLabel }) {
    app.get(route, async (req, res) => {
      try {
        const { partyCode } = req.query;
        assertPartyId(partyCode, 'partyCode');
        const existingData = await model.find({ partyId: partyCode });
        const activeData = existingData.filter((party) =>
          isPartyRoomActive(party)
        );
        res.setHeader('Cache-Control', 'no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(activeData);
      } catch (err) {
        const status = Number.isInteger(err.status) ? err.status : 500;
        console.error(
          `[REQ ${req.id}] ❌ Error fetching ${logLabel.toLowerCase()}:`,
          err
        );
        res.apiError({
          status,
          code: typeof err.code === 'string' ? err.code : 'party_fetch_failed',
          message: err.message || `Failed to fetch ${logLabel.toLowerCase()}`
        });
      }
    });
  }

  return {
    createPartyErrorHandler,
    createPartyGetHandler
  };
}

module.exports = {
  createPartyUtilityRoutes
};

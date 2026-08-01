const {
  addAiBattleOpponent,
  createBattleMatch,
  emitBattleUpdate,
  getBattleMatch,
  joinBattleMatch,
  kickBattleOpponent,
  leaveBattleMatch,
  readyBattlePlayer,
  resolveAiBattleHit,
  resolveBattleHit,
  selectBattlePlayerOling,
  serializeBattleMatch,
  startBattleMatch
} = require('../services/oling-battles');

function sendBattleError(res, error) {
  res.apiError({
    status: Number.isInteger(error?.status) ? error.status : 500,
    code: error?.code || 'oling_battle_request_failed',
    message: error?.message || 'Failed to process that Oling battle request.'
  });
}

function registerOlingBattleRoutes({
  app,
  models,
  runtime,
  getCurrentAccount
}) {
  app.post('/api/olings/battles', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to create an Oling battle.'
        });
      }

      const match = await createBattleMatch({
        account,
        matchLengthSeconds: req.body?.matchLengthSeconds,
        models,
        olingId: req.body?.olingId
      });

      res.apiSuccess({ match: serializeBattleMatch(match) }, 201);
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to create Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.get('/api/olings/battles/:matchCode', async (req, res) => {
    try {
      const match = await getBattleMatch({
        matchCode: req.params.matchCode,
        models
      });
      if (!match) {
        return res.apiError({
          status: 404,
          code: 'oling_battle_not_found',
          message: 'That Oling battle could not be found.'
        });
      }

      res.apiSuccess({ match: serializeBattleMatch(match) });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/join', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to join an Oling battle.'
        });
      }

      const match = await joinBattleMatch({
        account,
        matchCode: req.params.matchCode,
        models,
        olingId: req.body?.olingId
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to join Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/ready', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to ready up for an Oling battle.'
        });
      }

      const match = await readyBattlePlayer({
        account,
        matchCode: req.params.matchCode,
        models,
        ready: req.body?.ready !== false
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to ready Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/ai-opponent', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to add an AI Oling opponent.'
        });
      }

      const match = await addAiBattleOpponent({
        account,
        difficulty: req.body?.difficulty,
        matchCode: req.params.matchCode,
        models
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to add AI Oling battle opponent:`,
        error
      );
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/start', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to start an Oling battle.'
        });
      }

      const match = await startBattleMatch({
        account,
        matchCode: req.params.matchCode,
        models
      });
      const serialized = emitBattleUpdate(
        runtime,
        match,
        'oling-battle:started'
      );
      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to start Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/oling', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to update your Oling battle selection.'
        });
      }

      const match = await selectBattlePlayerOling({
        account,
        matchCode: req.params.matchCode,
        models,
        olingId: req.body?.olingId
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to update Oling battle selection:`,
        error
      );
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/hit', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to attack in an Oling battle.'
        });
      }

      const { battleResult, match } = await resolveBattleHit({
        account,
        matchCode: req.params.matchCode,
        models,
        zone: req.body?.zone
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ battleResult, match: serialized });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to resolve Oling battle hit:`,
        error
      );
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/ai-hit', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to fight an AI Oling opponent.'
        });
      }

      const { battleResult, match } = await resolveAiBattleHit({
        account,
        matchCode: req.params.matchCode,
        models,
        zone: req.body?.zone
      });
      const serialized = emitBattleUpdate(runtime, match);

      res.apiSuccess({ battleResult, match: serialized });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to resolve AI Oling battle hit:`,
        error
      );
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/leave', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to leave an Oling battle.'
        });
      }

      const match = await leaveBattleMatch({
        account,
        matchCode: req.params.matchCode,
        models
      });
      const serialized = emitBattleUpdate(runtime, match, 'oling-battle:left');

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to leave Oling battle:`, error);
      sendBattleError(res, error);
    }
  });

  app.post('/api/olings/battles/:matchCode/kick', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to kick a player from an Oling battle.'
        });
      }

      const match = await kickBattleOpponent({
        account,
        matchCode: req.params.matchCode,
        models
      });
      const serialized = emitBattleUpdate(
        runtime,
        match,
        'oling-battle:kicked'
      );

      res.apiSuccess({ match: serialized });
    } catch (error) {
      console.error(
        `[REQ ${req.id}] Failed to kick Oling battle player:`,
        error
      );
      sendBattleError(res, error);
    }
  });
}

module.exports = {
  registerOlingBattleRoutes
};

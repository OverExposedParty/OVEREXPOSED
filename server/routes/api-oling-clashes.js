const {
  addAiClashOpponent,
  chooseClashReplacement,
  commitClashSelection,
  createClashMatch,
  emitClashUpdate,
  forfeitClashMatch,
  getClashMatch,
  getClashPlayer,
  joinClashMatch,
  leaveClashMatch,
  markClashPlayerLoaded,
  readyClashPlayer,
  requestClashRematch,
  serializeLiveClashMatch,
  startClashMatch,
  updateAiClashOpponentDifficulty,
  updateClashSelectionDraft,
  updateClashTeam
} = require('../services/oling-clashes');

function sendClashError(res, error) {
  res.apiError({
    status: Number.isInteger(error?.status) ? error.status : 500,
    code: error?.code || 'oling_clash_request_failed',
    message: error?.message || 'Failed to process that Oling Clash request.',
    details: error?.details
  });
}

const expectedClashConflictCodes = new Set([
  'oling_clash_selection_closed',
  'oling_clash_selection_committed',
  'oling_clash_selection_stale',
  'oling_clash_timeout_not_reached',
  'oling_clash_timeout_stale'
]);

function registerOlingClashRoutes({
  app,
  models,
  runtime,
  getCurrentAccount,
  requireFeatureAccess
}) {
  app.post('/api/olings/clashes', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to create an Oling Clash.'
        });
      }
      if (!requireFeatureAccess(account, res, 'olings.clash')) return;
      const match = await createClashMatch({
        models,
        account,
        olingIds: req.body?.olingIds,
        rulesetKey: req.body?.rulesetKey
      });
      res.apiSuccess(
        { match: serializeLiveClashMatch(match, account._id) },
        201
      );
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to create Oling Clash:`, error);
      sendClashError(res, error);
    }
  });

  app.get('/api/olings/clashes/:matchCode', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view an Oling Clash.'
        });
      }
      if (!requireFeatureAccess(account, res, 'olings.clash')) return;
      const match = await getClashMatch({
        models,
        matchCode: req.params.matchCode
      });
      if (!match) {
        return res.apiError({
          status: 404,
          code: 'oling_clash_not_found',
          message: 'That Oling Clash could not be found.'
        });
      }
      if (!getClashPlayer(match, account)) {
        return res.apiError({
          status: 403,
          code: 'oling_clash_player_required',
          message: 'You are not part of that Oling Clash.'
        });
      }
      res.apiSuccess({
        match: serializeLiveClashMatch(match, account._id)
      });
    } catch (error) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling Clash:`, error);
      sendClashError(res, error);
    }
  });

  const registerMutation = (
    path,
    operation,
    eventType,
    { emitUpdate = true } = {}
  ) => {
    app.post(path, async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to continue this Oling Clash.'
          });
        }
        if (!requireFeatureAccess(account, res, 'olings.clash')) return;
        const result = await operation({ account, req });
        const isWrappedResult =
          result && Object.prototype.hasOwnProperty.call(result, 'match');
        const match = isWrappedResult ? result.match : result;
        if (result?.roundResult && match?.matchCode) {
          runtime?.io
            ?.to?.(match.matchCode)
            ?.emit?.('oling-clash:round-resolved', {
              gameId: result.archive?.gameId || match.gameId,
              archiveId: result.archive?._id
                ? String(result.archive._id)
                : null,
              completed: Boolean(result.archive),
              match: result.resolvedMatch
                ? serializeLiveClashMatch(result.resolvedMatch)
                : null,
              result: result.roundResult
            });
        }
        if (result?.forfeitResult && match?.matchCode) {
          runtime?.io?.to?.(match.matchCode)?.emit?.('oling-clash:forfeited', {
            archiveId: result.archive?._id ? String(result.archive._id) : null,
            match: result.resolvedMatch
              ? serializeLiveClashMatch(result.resolvedMatch)
              : null,
            rematchMatch: serializeLiveClashMatch(match),
            result: result.forfeitResult
          });
        }
        if (result?.replacement && match?.matchCode) {
          runtime?.io
            ?.to?.(match.matchCode)
            ?.emit?.('oling-clash:replacement-selected', {
              gameId: match.gameId,
              match: serializeLiveClashMatch(match),
              replacement: result.replacement
            });
        }
        if (match && !result?.forfeitResult && emitUpdate) {
          emitClashUpdate(runtime, match, eventType);
        }
        res.apiSuccess({
          ...((result?.roundResult || result?.archive) && {
            roundResult: result.roundResult || null,
            forfeitResult: result.forfeitResult || null,
            resolvedMatch: result.resolvedMatch
              ? serializeLiveClashMatch(result.resolvedMatch, account._id)
              : null,
            archiveId: result.archive?._id ? String(result.archive._id) : null
          }),
          ...(result?.replacement && { replacement: result.replacement }),
          match: serializeLiveClashMatch(match, account._id)
        });
      } catch (error) {
        if (!expectedClashConflictCodes.has(error?.code)) {
          console.error(`[REQ ${req.id}] Failed Oling Clash mutation:`, error);
        }
        sendClashError(res, error);
      }
    });
  };

  registerMutation('/api/olings/clashes/:matchCode/join', ({ account, req }) =>
    joinClashMatch({
      models,
      account,
      matchCode: req.params.matchCode,
      olingIds: req.body?.olingIds
    })
  );
  registerMutation('/api/olings/clashes/:matchCode/team', ({ account, req }) =>
    updateClashTeam({
      models,
      account,
      matchCode: req.params.matchCode,
      olingIds: req.body?.olingIds
    })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/ai-opponent',
    ({ account, req }) =>
      addAiClashOpponent({
        models,
        account,
        matchCode: req.params.matchCode,
        difficulty: req.body?.difficulty
      })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/ai-opponent/difficulty',
    ({ account, req }) =>
      updateAiClashOpponentDifficulty({
        models,
        account,
        matchCode: req.params.matchCode,
        difficulty: req.body?.difficulty
      })
  );
  registerMutation('/api/olings/clashes/:matchCode/ready', ({ account, req }) =>
    readyClashPlayer({
      models,
      account,
      matchCode: req.params.matchCode,
      ready: req.body?.ready !== false
    })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/rematch',
    ({ account, req }) =>
      requestClashRematch({
        models,
        account,
        matchCode: req.params.matchCode,
        accepted: req.body?.accepted !== false
      })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/start',
    ({ account, req }) =>
      startClashMatch({ models, account, matchCode: req.params.matchCode }),
    'oling-clash:started'
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/game-loaded',
    ({ account, req }) =>
      markClashPlayerLoaded({
        models,
        account,
        matchCode: req.params.matchCode
      })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/action-draft',
    ({ account, req }) =>
      updateClashSelectionDraft({
        models,
        account,
        matchCode: req.params.matchCode,
        action: req.body?.action,
        tagTeamSlot: req.body?.tagTeamSlot,
        effectChoice: req.body?.effectChoice
      }),
    null,
    { emitUpdate: false }
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/action',
    ({ account, req }) =>
      commitClashSelection({
        models,
        account,
        matchCode: req.params.matchCode,
        action: req.body?.action,
        tagTeamSlot: req.body?.tagTeamSlot,
        effectChoice: req.body?.effectChoice
      }),
    'oling-clash:round'
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/action-timeout',
    ({ account, req }) =>
      commitClashSelection({
        models,
        account,
        matchCode: req.params.matchCode,
        expectedGameId: req.body?.gameId,
        expectedPhaseEndsAt: req.body?.phaseEndsAt,
        expectedRound: req.body?.round,
        preferredAction: req.body?.preferredAction,
        tagTeamSlot: req.body?.tagTeamSlot,
        timedOut: true
      }),
    'oling-clash:round'
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/replacement',
    ({ account, req }) =>
      chooseClashReplacement({
        models,
        account,
        matchCode: req.params.matchCode,
        teamSlot: req.body?.teamSlot
      }),
    'oling-clash:replacement'
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/forfeit',
    ({ account, req }) =>
      forfeitClashMatch({
        models,
        account,
        matchCode: req.params.matchCode
      })
  );
  registerMutation(
    '/api/olings/clashes/:matchCode/leave',
    ({ account, req }) =>
      leaveClashMatch({ models, account, matchCode: req.params.matchCode }),
    'oling-clash:left'
  );
}

module.exports = { registerOlingClashRoutes };

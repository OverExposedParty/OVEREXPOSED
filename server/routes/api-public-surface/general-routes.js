function registerPublicGeneralRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/site-version', (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.apiSuccess({
        data: {
          websiteCacheVersion: WEBSITE_CACHE_VERSION,
          deploymentVersion: WEBSITE_CACHE_VERSION
        }
      });
    });

    app.get('/api/overexposure-posts', async (req, res) => {
      try {
        const data = await OverexposurePost.find({})
          .select('+title +text +id +date +userIcon +x +y +tag +visibility')
          .lean();
        res.apiSuccess({ data: data.map(serializeOverexposurePost) });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] ❌ Failed to fetch Overexposure posts:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'overexposure_posts_fetch_failed',
          message: 'Failed to fetch Overexposure posts'
        });
      }
    });

    app.get('/api/account/game-progress', async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to view game progress.'
          });
        }

        const gameData = account.gameData || {};
        const matchIds = Array.isArray(gameData.matchHistory)
          ? gameData.matchHistory.slice(-50)
          : [];
        const archivedMatches = matchIds.length
          ? await archivedRoomSchema
              .find({ _id: { $in: matchIds } })
              .sort({ archivedAt: -1 })
              .limit(50)
              .lean()
          : [];

        return res.apiSuccess({
          data: {
            totals: {
              gamesPlayed: Number(gameData.gamesPlayed) || 0,
              roundsPlayed: Number(gameData.roundsPlayed) || 0,
              lastActiveGameMode: gameData.lastActiveGameMode || null,
              lastPlayedAt: gameData.lastPlayedAt || null
            },
            perGameStats: Array.isArray(gameData.perGameStats)
              ? gameData.perGameStats
              : [],
            achievements: Array.isArray(gameData.achievements)
              ? gameData.achievements
              : [],
            matches: archivedMatches.map((match) => ({
              id: String(match._id),
              partyId: match.partyId,
              gamemode: match.gamemode,
              archivedAt: match.archivedAt,
              startedAt:
                match.session?.startedAt || match.session?.createdAt || null,
              selectedPacks: match.config?.selectedPacks || [],
              playerCount: Array.isArray(match.players)
                ? match.players.length
                : 0
            }))
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch game progress:`, err);
        return res.apiError({
          status: 500,
          code: 'game_progress_fetch_failed',
          message: 'Failed to fetch game progress.'
        });
      }
    });
  }
}

module.exports = { registerPublicGeneralRoutes };

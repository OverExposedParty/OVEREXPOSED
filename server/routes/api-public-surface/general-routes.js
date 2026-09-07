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
        const [
          archivedPartyMatches,
          archivedOlingBattles,
          archivedOlingClashes
        ] = matchIds.length
          ? await Promise.all([
              archivedRoomSchema
                .find({ _id: { $in: matchIds } })
                .sort({ archivedAt: -1 })
                .limit(50)
                .lean(),
              context.OlingBattleArchive?.find
                ? context.OlingBattleArchive.find({ _id: { $in: matchIds } })
                    .sort({ archivedAt: -1 })
                    .limit(50)
                    .lean()
                : [],
              context.OlingClashArchive?.find
                ? context.OlingClashArchive.find({ _id: { $in: matchIds } })
                    .sort({ archivedAt: -1 })
                    .limit(50)
                    .lean()
                : []
            ])
          : [[], [], []];
        const archivedMatches = [
          ...archivedPartyMatches.map((match) => ({
            id: String(match._id),
            partyId: match.partyId,
            gameId: match.gameId,
            gamemode: match.gamemode,
            archivedAt: match.archivedAt,
            startedAt:
              match.session?.startedAt || match.session?.createdAt || null,
            selectedPacks: match.config?.selectedPacks || [],
            playerCount: Array.isArray(match.players) ? match.players.length : 0
          })),
          ...archivedOlingBattles.map((match) => ({
            id: String(match._id),
            partyId: null,
            gameId: match.gameId,
            matchCode: match.matchCode,
            gamemode: 'oling-battle',
            archivedAt: match.archivedAt,
            startedAt: match.startedAt || null,
            selectedPacks: [],
            playerCount: Array.isArray(match.players)
              ? match.players.length
              : 0,
            winnerAccountId: match.winnerAccountId
              ? String(match.winnerAccountId)
              : null,
            endReason: match.endReason || null
          })),
          ...archivedOlingClashes.map((match) => ({
            id: String(match._id),
            partyId: null,
            gameId: match.gameId,
            matchCode: match.matchCode,
            gamemode: 'oling-clash',
            archivedAt: match.archivedAt,
            startedAt: match.startedAt || null,
            selectedPacks: [],
            playerCount: Array.isArray(match.players)
              ? match.players.length
              : 0,
            winnerAccountId: match.winnerAccountId
              ? String(match.winnerAccountId)
              : null,
            endReason: match.endReason || null,
            roundsPlayed: Number(match.roundsPlayed || 0)
          }))
        ]
          .sort(
            (left, right) =>
              new Date(right.archivedAt || 0).getTime() -
              new Date(left.archivedAt || 0).getTime()
          )
          .slice(0, 50);

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
            matches: archivedMatches
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

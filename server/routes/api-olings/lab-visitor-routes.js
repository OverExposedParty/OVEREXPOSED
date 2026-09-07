const {
  findOlingLabAccountByUsername,
  getOlingLabAccess
} = require('../../services/oling-lab-access');

function registerOlingLabVisitorRoutes(context) {
  const {
    app,
    getCurrentAccount,
    Account,
    PlayerOling,
    getOlingDefinitions,
    models,
    serializePlayerOling,
    serializeOlingLab,
    OlingLabItems,
    OlingLabWallDecorations,
    OlingLabWallpapers,
    serializeOlingLabItem,
    serializeOlingLabWallDecoration
  } = context;

  app.get('/api/olings/labs/:username', async (req, res) => {
    try {
      const [targetAccount, viewerAccount] = await Promise.all([
        findOlingLabAccountByUsername(Account, req.params.username),
        getCurrentAccount(req)
      ]);
      if (!targetAccount) {
        return res.apiError({
          status: 404,
          code: 'oling_lab_not_found',
          message: 'That Oling Lab could not be found.'
        });
      }

      const access = getOlingLabAccess(targetAccount, viewerAccount);
      if (!access.allowed) {
        return res.apiError({
          status: 403,
          code: access.reason,
          message:
            access.reason === 'oling_lab_friends_only'
              ? 'This Oling Lab is only available to friends of its owner.'
              : 'This Oling Lab is private.'
        });
      }

      if (access.isOwner) {
        return res.apiSuccess({
          canonicalUrl: '/olings/lab',
          viewer: { isOwner: true }
        });
      }

      const olings = await PlayerOling.find({ ownerId: targetAccount._id })
        .sort({ favorite: -1, hatchedAt: -1 })
        .lean();
      const definitions = await getOlingDefinitions(models, olings);

      res.apiSuccess({
        owner: {
          username: targetAccount.username,
          displayName:
            targetAccount.profile?.displayName || targetAccount.username
        },
        viewer: { isOwner: false },
        privacy: { visibility: access.visibility },
        lab: serializeOlingLab(targetAccount.olings?.lab),
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        wallDecorations: Object.values(OlingLabWallDecorations).map(
          serializeOlingLabWallDecoration
        ),
        wallpapers: Object.values(OlingLabWallpapers),
        olings: olings.map((oling) => serializePlayerOling(oling, definitions))
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch visited Oling Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_visit_failed',
        message: 'Failed to load that Oling Lab.'
      });
    }
  });
}

module.exports = { registerOlingLabVisitorRoutes };

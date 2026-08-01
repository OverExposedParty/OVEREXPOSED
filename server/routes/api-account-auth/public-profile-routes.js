function registerAccountPublicProfileRoutes(context) {
  const {
    app,
    Account,
    getCurrentAccount,
    hasPublicProfileAccess,
    serializePublicAccountProfile
  } = context;

  app.get('/api/accounts/public/:accountId', async (req, res) => {
    const accountId = String(req.params.accountId || '').trim();

    if (!/^[a-f0-9]{24}$/i.test(accountId)) {
      return res.apiError({
        status: 400,
        code: 'public_profile_invalid_account',
        message: 'Profile is unavailable'
      });
    }

    try {
      const [targetAccount, viewerAccount] = await Promise.all([
        Account.findOne({
          _id: accountId,
          'profile.accountStatus': {
            $nin: ['suspended', 'banned', 'deleted']
          }
        }).select(
          'username createdAt profile.displayName profile.oeIcon profile.privacySettings gameData.level gameData.xp gameData.gamesPlayed gameData.roundsPlayed gameData.lastActiveGameMode gameData.achievements gameData.friendsAndBlockedUsers olings.olings'
        ),
        getCurrentAccount(req)
      ]);

      if (!targetAccount) {
        return res.apiError({
          status: 404,
          code: 'public_profile_not_found',
          message: 'Profile is unavailable'
        });
      }

      if (!hasPublicProfileAccess(targetAccount, viewerAccount)) {
        return res.apiError({
          status: 403,
          code: 'public_profile_private',
          message: 'This profile is private'
        });
      }

      res.apiSuccess({
        profile: serializePublicAccountProfile(targetAccount, viewerAccount)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch public profile:`, err);
      res.apiError({
        status: 500,
        code: 'public_profile_fetch_failed',
        message: 'Profile is unavailable'
      });
    }
  });
}

module.exports = { registerAccountPublicProfileRoutes };

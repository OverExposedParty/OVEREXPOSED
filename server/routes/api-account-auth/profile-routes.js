function registerAccountProfileRoutes(context) {
  const {
    app,
    getCurrentAccount,
    serializeAccount,
    Account,
    escapeAccountRegex,
    unlockAchievementByKey,
    Achievement,
    recordProfileCompletionAchievement
  } = context;

  app.patch('/api/accounts/me/username', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to update your username'
      });
    }

    const username = String(req.body?.username || '')
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_.-]{3,30}$/.test(username)) {
      return res.apiError({
        status: 400,
        code: 'username_invalid',
        message:
          'Username must be 3-30 characters and only use lowercase letters, numbers, dots, underscores, or hyphens'
      });
    }

    if (
      username.toLowerCase() === String(account.username || '').toLowerCase()
    ) {
      return res.apiSuccess({
        message: 'Username is already up to date',
        account: serializeAccount(account)
      });
    }

    try {
      const existingAccount = await Account.findOne({
        _id: { $ne: account._id },
        username: {
          $regex: `^${escapeAccountRegex(username)}$`,
          $options: 'i'
        }
      }).select('_id');

      if (existingAccount) {
        return res.apiError({
          status: 409,
          code: 'username_taken',
          message: 'That username is already taken'
        });
      }

      const previousUsername = account.username;
      account.username = username;
      account.profile.usernameHistory ||= [];
      if (previousUsername) {
        account.profile.usernameHistory.push({
          value: previousUsername,
          changedAt: new Date(),
          changedBy: account._id
        });
      }
      account.profile.lastProfileUpdatedAt = new Date();

      await unlockAchievementByKey({
        Achievement,
        account,
        key: 'identity-crisis',
        source: 'username-changed',
        save: false
      });
      await recordProfileCompletionAchievement(account, 'username-changed');

      await account.save();

      res.apiSuccess({
        message: 'Username updated',
        account: serializeAccount(account)
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.apiError({
          status: 409,
          code: 'username_taken',
          message: 'That username is already taken'
        });
      }

      console.error(`[REQ ${req.id}] Failed to update username:`, err);
      res.apiError({
        status: 500,
        code: 'username_update_failed',
        message: 'Failed to update username'
      });
    }
  });

  app.patch('/api/accounts/me/site-preferences', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to save site preferences'
        });
      }

      const nextPreferences = {};
      const supportedPreferences = {
        soundEnabled: 'Sound enabled must be true or false',
        nsfwEnabled: 'NSFW enabled must be true or false',
        consoleEnabled: 'Console enabled must be true or false'
      };

      for (const [preference, validationMessage] of Object.entries(
        supportedPreferences
      )) {
        if (!Object.prototype.hasOwnProperty.call(req.body || {}, preference)) {
          continue;
        }

        if (typeof req.body[preference] !== 'boolean') {
          return res.apiError({
            status: 400,
            code: 'invalid_site_preferences',
            message: 'Site preferences are invalid',
            details: {
              [preference]: validationMessage
            }
          });
        }

        nextPreferences[preference] = req.body[preference];
      }

      if (!Object.keys(nextPreferences).length) {
        return res.apiError({
          status: 400,
          code: 'invalid_site_preferences',
          message: 'No supported site preferences were provided'
        });
      }

      account.profile.sitePreferences = {
        ...(account.profile?.sitePreferences?.toObject?.() ||
          account.profile?.sitePreferences ||
          {}),
        ...nextPreferences
      };
      account.markModified('profile.sitePreferences');

      await unlockAchievementByKey({
        Achievement,
        account,
        key: 'tinkerer',
        source: 'site-preferences',
        save: false
      });
      if (
        Object.prototype.hasOwnProperty.call(nextPreferences, 'soundEnabled')
      ) {
        await unlockAchievementByKey({
          Achievement,
          account,
          key: 'sound-engineer',
          source: 'sound-setting',
          save: false
        });
      }

      await account.save();

      res.apiSuccess({
        message: 'Site preferences saved',
        sitePreferences: serializeAccount(account).sitePreferences,
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save site preferences:`, err);
      res.apiError({
        status: 500,
        code: 'site_preferences_save_failed',
        message: 'Failed to save site preferences'
      });
    }
  });

  app.post('/api/accounts/me/achievement-events', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to record achievement progress'
        });
      }

      const eventType = String(req.body?.eventType || '').trim();
      const eventAchievements = {
        'legal.terms-privacy-viewed': 'nerd-xd',
        'page.not-found-viewed': 'nothing-to-see-here-allegedly',
        'party.invite-sent': 'party-invite-sent',
        'seasonal.april-fool-visit': 'april-fool',
        'settings.changed': 'tinkerer'
      };
      const key = eventAchievements[eventType];

      if (!key) {
        return res.apiError({
          status: 400,
          code: 'achievement_event_invalid',
          message: 'Unknown achievement event'
        });
      }

      await unlockAchievementByKey({
        Achievement,
        account,
        key,
        source: eventType
      });

      res.apiSuccess({
        message: 'Achievement event recorded'
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to record achievement event:`, err);
      res.apiError({
        status: 500,
        code: 'achievement_event_failed',
        message: 'Failed to record achievement event'
      });
    }
  });
}

module.exports = { registerAccountProfileRoutes };

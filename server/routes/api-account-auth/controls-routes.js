const {
  runWithFreshDocumentRetry
} = require('../../services/mongoose-version-retry');
const { applyMarketingConsent } = require('../../services/marketing-consent');

function registerAccountControlsRoutes(context) {
  const {
    app,
    getCurrentAccount,
    importLegacyProgressionNotifications,
    serializeOpalWallet,
    serializeOpalTransactions,
    serializePendingAccountNotifications,
    persistAccountNotificationsDelivered,
    normalizeCustomisationPreferences,
    serializeAccount,
    normalizePrivacySettings,
    recordProfileCompletionAchievement,
    EmailSuppression
  } = context;

  app.get('/api/accounts/me/wallet', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view your Opals.'
        });
      }

      res.apiSuccess({
        opals: serializeOpalWallet(account),
        transactions: serializeOpalTransactions(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Opal wallet:`, err);
      res.apiError({
        status: 500,
        code: 'opal_wallet_fetch_failed',
        message: 'Failed to fetch Opal wallet'
      });
    }
  });

  app.get('/api/accounts/me/notifications', async (req, res) => {
    try {
      const notifications = await runWithFreshDocumentRetry({
        loadDocument: () => getCurrentAccount(req),
        run: async (account) => {
          if (!account) return [];

          const imported = importLegacyProgressionNotifications(account);
          const pending = serializePendingAccountNotifications(account);
          if (imported > 0) await account.save();
          return pending;
        }
      });
      res.apiSuccess({ notifications });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch account notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'account_notifications_fetch_failed',
        message: 'Failed to fetch account notifications'
      });
    }
  });

  app.patch('/api/accounts/me/notifications', async (req, res) => {
    const notificationIds = Array.isArray(req.body?.notificationIds)
      ? [
          ...new Set(
            req.body.notificationIds.map((value) => String(value || ''))
          )
        ]
          .filter((value) =>
            /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
              value
            )
          )
          .slice(0, 20)
      : [];

    if (!notificationIds.length) {
      return res.apiError({
        status: 400,
        code: 'account_notifications_invalid',
        message: 'No account notifications were provided'
      });
    }

    try {
      const result = await runWithFreshDocumentRetry({
        loadDocument: () => getCurrentAccount(req),
        run: async (account) => {
          if (!account) return null;

          return persistAccountNotificationsDelivered(account, notificationIds);
        }
      });
      if (result === null) {
        return res.apiError({
          status: 401,
          code: 'account_notifications_auth_required',
          message: 'Sign in to update account notifications'
        });
      }

      res.apiSuccess({ updated: result });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to acknowledge account notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'account_notifications_update_failed',
        message: 'Failed to update account notifications'
      });
    }
  });

  app.patch('/api/accounts/me/customisation-preferences', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to save customisation preferences'
      });
    }

    try {
      const currentPreferences = normalizeCustomisationPreferences(
        account.customisationPreferences || {}
      );
      account.customisationPreferences = normalizeCustomisationPreferences({
        ...currentPreferences,
        ...req.body
      });
      await account.save();

      res.apiSuccess({
        message: 'Customisation preferences saved',
        customisationPreferences: account.customisationPreferences,
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to save customisation preferences:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'customisation_preferences_save_failed',
        message: 'Failed to save customisation preferences'
      });
    }
  });

  app.patch('/api/accounts/me/privacy-settings', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to update privacy settings'
      });
    }

    const privacySettings = normalizePrivacySettings(req.body);
    if (!Object.keys(privacySettings).length) {
      return res.apiError({
        status: 400,
        code: 'privacy_settings_invalid',
        message: 'Choose a valid privacy setting'
      });
    }

    try {
      account.profile.privacySettings = {
        ...(account.profile?.privacySettings?.toObject?.() ||
          account.profile?.privacySettings ||
          {}),
        ...privacySettings
      };
      account.profile.lastProfileUpdatedAt = new Date();
      await recordProfileCompletionAchievement(account, 'privacy-settings');
      await account.save();

      res.apiSuccess({
        message: 'Privacy settings saved',
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save privacy settings:`, err);
      res.apiError({
        status: 500,
        code: 'privacy_settings_save_failed',
        message: 'Failed to save privacy settings'
      });
    }
  });

  app.patch('/api/accounts/me/marketing-consent', async (req, res) => {
    const accepted = req.body?.accepted;
    if (accepted !== true && accepted !== false) {
      return res.apiError({
        status: 400,
        code: 'marketing_consent_invalid',
        message: 'Choose whether to receive marketing emails'
      });
    }

    const account = await getCurrentAccount(req);
    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to update marketing email preferences'
      });
    }

    try {
      const now = new Date();
      if (accepted && EmailSuppression?.updateMany) {
        await EmailSuppression.updateMany(
          {
            email: account.email,
            reason: 'unsubscribed',
            removedAt: null
          },
          { $set: { removedAt: now, removedBy: account._id } }
        );
      }

      applyMarketingConsent(account, {
        accepted,
        req,
        source: 'account_settings'
      });
      account.profile.lastProfileUpdatedAt = now;
      await account.save();

      if (!accepted && EmailSuppression?.findOne) {
        const query = EmailSuppression.findOne({
          email: account.email,
          removedAt: null
        });
        const activeSuppression = query?.lean
          ? await query.lean()
          : await query;
        if (!activeSuppression && EmailSuppression.create) {
          await EmailSuppression.create({
            email: account.email,
            reason: 'unsubscribed',
            source: 'user',
            note: 'Marketing consent withdrawn in account settings'
          });
        }
      }

      res.apiSuccess({
        message: accepted
          ? 'Marketing emails enabled'
          : 'Marketing emails disabled',
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save marketing consent:`, err);
      res.apiError({
        status: 500,
        code: 'marketing_consent_save_failed',
        message: 'Failed to save marketing email preferences'
      });
    }
  });

  app.post('/api/accounts/me/data-export-requests', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to request your data export'
      });
    }

    try {
      const latestRequest = account.legalConsent?.dataExportRequests?.at?.(-1);
      if (latestRequest && latestRequest.status === 'requested') {
        return res.apiSuccess({
          message: 'Your data export request is already queued.',
          account: serializeAccount(account)
        });
      }

      account.legalConsent.dataExportRequests.push({
        type: 'export',
        status: 'requested',
        requestedAt: new Date()
      });
      await account.save();

      res.apiSuccess({
        message: 'Data export requested.',
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to request data export:`, err);
      res.apiError({
        status: 500,
        code: 'data_export_request_failed',
        message: 'Failed to request data export'
      });
    }
  });

  app.post('/api/accounts/me/deletion-requests', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to request account deletion'
      });
    }

    if (String(req.body?.confirmation || '').trim() !== 'DELETE') {
      return res.apiError({
        status: 400,
        code: 'delete_confirmation_required',
        message: 'Type DELETE to request account deletion'
      });
    }

    try {
      const latestRequest =
        account.legalConsent?.accountDeletionRequests?.at?.(-1);
      if (latestRequest && latestRequest.status === 'requested') {
        return res.apiSuccess({
          message: 'Your account deletion request is already queued.',
          account: serializeAccount(account)
        });
      }

      account.legalConsent.accountDeletionRequests.push({
        type: 'deletion',
        status: 'requested',
        requestedAt: new Date()
      });
      await account.save();

      res.apiSuccess({
        message: 'Account deletion requested.',
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to request account deletion:`, err);
      res.apiError({
        status: 500,
        code: 'account_deletion_request_failed',
        message: 'Failed to request account deletion'
      });
    }
  });
}

module.exports = { registerAccountControlsRoutes };

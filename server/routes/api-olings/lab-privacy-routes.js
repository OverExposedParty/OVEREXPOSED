const {
  OLING_LAB_VISIBILITIES,
  normalizeOlingLabVisibility
} = require('../../services/oling-lab-access');

function registerOlingLabPrivacyRoutes(context) {
  const { app, getCurrentAccount, Account, OlingState } = context;

  app.patch('/api/olings/lab/privacy', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to change your Oling Lab privacy.'
        });
      }

      const requestedVisibility = String(req.body?.visibility || '')
        .trim()
        .toLowerCase();
      if (!OLING_LAB_VISIBILITIES.includes(requestedVisibility)) {
        return res.apiError({
          status: 400,
          code: 'oling_lab_visibility_invalid',
          message: 'Choose public, private, or friends-only.'
        });
      }

      await Account.updateOne(
        { _id: account._id },
        {
          $set: {
            'olings.lab.visibility': requestedVisibility,
            'olings.lab.updatedAt': new Date()
          }
        },
        { runValidators: false }
      );
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: account._id },
          {
            $set: {
              'lab.visibility': requestedVisibility,
              'lab.updatedAt': new Date()
            }
          },
          { upsert: true, runValidators: false }
        );
      }

      res.apiSuccess({
        message: 'Oling Lab privacy updated.',
        privacy: {
          visibility: normalizeOlingLabVisibility(requestedVisibility)
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to update Oling Lab privacy:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_privacy_update_failed',
        message: 'Failed to update your Oling Lab privacy.'
      });
    }
  });
}

module.exports = { registerOlingLabPrivacyRoutes };

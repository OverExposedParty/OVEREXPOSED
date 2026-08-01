function registerOlingProfileRoutes(context) {
  const {
    app,
    getCurrentAccount,
    normalizeOlingName,
    normalizeOlingHeadwearKey,
    OlingTrait,
    accountOwnsOlingHeadwear,
    PlayerOling,
    getOlingDefinitions,
    models,
    serializePlayerOling
  } = context;

  app.patch('/api/olings/:olingId', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to update your Oling.'
        });
      }

      const update = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
        update.name = normalizeOlingName(req.body.name);
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'favorite')) {
        update.favorite = Boolean(req.body.favorite);
      }
      if (
        Object.prototype.hasOwnProperty.call(req.body || {}, 'displayOnProfile')
      ) {
        update.displayOnProfile = Boolean(req.body.displayOnProfile);
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'headwearKey')) {
        const headwearKey = normalizeOlingHeadwearKey(req.body.headwearKey);

        if (headwearKey) {
          const headwear = await OlingTrait.findOne({
            key: headwearKey,
            layer: 'headwear',
            enabled: true,
            status: 'published'
          }).lean();

          if (!headwear) {
            return res.apiError({
              status: 404,
              code: 'oling_headwear_not_found',
              message: 'That Oling headwear could not be found.'
            });
          }

          if (!accountOwnsOlingHeadwear(account, headwearKey)) {
            return res.apiError({
              status: 403,
              code: 'oling_headwear_not_owned',
              message: 'You have not unlocked that Oling headwear.'
            });
          }
        }

        update['equipment.headwear'] = headwearKey;
      }

      if (!Object.keys(update).length) {
        return res.apiError({
          status: 400,
          code: 'oling_update_empty',
          message: 'No Oling updates were provided.'
        });
      }

      const oling = await PlayerOling.findOneAndUpdate(
        {
          _id: req.params.olingId,
          ownerId: account._id
        },
        { $set: update },
        { new: true, runValidators: true }
      ).lean();

      if (!oling) {
        return res.apiError({
          status: 404,
          code: 'player_oling_not_found',
          message: 'That Oling could not be found.'
        });
      }

      const definitions = await getOlingDefinitions(models, [oling]);

      res.apiSuccess({
        message: 'Oling updated.',
        oling: serializePlayerOling(oling, definitions)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to update Oling:`, err);
      res.apiError({
        status: 500,
        code: 'oling_update_failed',
        message: 'Failed to update Oling'
      });
    }
  });
}

module.exports = { registerOlingProfileRoutes };

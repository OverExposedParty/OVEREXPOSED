function registerOePanelOlingEggRoutes(context, helpers) {
  const { app } = context;
  const { OlingEgg } = context.models || {};
  const {
    createOePanelEggPayload,
    serializeOePanelOlingEgg,
    upsertOePanelBuildSets
  } = helpers;

  with (context) {
    app.post('/api/oe-panel/olings/eggs', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const { egg, buildSets, error } = createOePanelEggPayload(
          req.body || {}
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_oling_egg_create_invalid',
            message: error
          });
        }

        await upsertOePanelBuildSets(buildSets, egg.collection);
        const createdEgg = await OlingEgg.create(egg);
        await createAdminLog(AdminLog, account, {
          action: 'Created oLing egg',
          area: 'oLings',
          target: {
            type: 'oling_egg',
            id: createdEgg.key,
            label: createdEgg.name
          },
          previousValue: '-',
          newValue: { key: createdEgg.key, status: createdEgg.status },
          severity: 'medium',
          metadata: { collection: 'oling-eggs' }
        });

        res.apiSuccess(
          { data: { row: serializeOePanelOlingEgg(createdEgg.toObject()) } },
          201
        );
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_oling_egg_duplicate',
            message: 'An oLing egg with this key already exists.'
          });
        }
        console.error(`[REQ ${req.id}] Failed to create oLing egg:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_egg_create_failed',
          message: 'Failed to create oLing egg'
        });
      }
    });

    app.patch('/api/oe-panel/olings/eggs/:key', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const currentEgg = await OlingEgg.findOne({
          key: req.params.key
        }).lean();
        if (!currentEgg) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_oling_egg_not_found',
            message: 'oLing egg not found'
          });
        }

        const { egg, buildSets, error } = createOePanelEggPayload(
          req.body || {},
          currentEgg
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_oling_egg_update_invalid',
            message: error
          });
        }

        await upsertOePanelBuildSets(buildSets, egg.collection);
        const updatedEgg = await OlingEgg.findOneAndUpdate(
          { key: req.params.key },
          { $set: egg, $unset: { sets: '', pools: '' } },
          { new: true, runValidators: true }
        );

        await createAdminLog(AdminLog, account, {
          action: 'Updated oLing egg',
          area: 'oLings',
          target: {
            type: 'oling_egg',
            id: updatedEgg.key,
            label: updatedEgg.name
          },
          previousValue: currentEgg,
          newValue: req.body || {},
          severity: 'medium',
          metadata: { collection: 'oling-eggs' }
        });

        res.apiSuccess({
          data: { row: serializeOePanelOlingEgg(updatedEgg.toObject()) }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update oLing egg:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_egg_update_failed',
          message: 'Failed to update oLing egg'
        });
      }
    });

    app.delete('/api/oe-panel/olings/eggs/:key', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const updatedEgg = await OlingEgg.findOneAndUpdate(
          { key: req.params.key },
          { $set: { status: 'archived', enabled: false } },
          { new: true, runValidators: true }
        );
        if (!updatedEgg) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_oling_egg_not_found',
            message: 'oLing egg not found'
          });
        }

        await createAdminLog(AdminLog, account, {
          action: 'Archived oLing egg',
          area: 'oLings',
          target: {
            type: 'oling_egg',
            id: updatedEgg.key,
            label: updatedEgg.name
          },
          previousValue: '-',
          newValue: { status: 'archived', enabled: false },
          severity: 'medium',
          metadata: { collection: 'oling-eggs' }
        });

        res.apiSuccess({ message: 'oLing egg archived.' });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to archive oLing egg:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_egg_archive_failed',
          message: 'Failed to archive oLing egg'
        });
      }
    });
  }
}

module.exports = {
  registerOePanelOlingEggRoutes
};

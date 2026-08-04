function registerOePanelOlingTraitRoutes(context, helpers) {
  const { app } = context;
  const { OlingTrait } = context.models || {};
  const { createOePanelTraitUpdatePayload, serializeOePanelOlingTrait } =
    helpers;

  with (context) {
    app.patch('/api/oe-panel/olings/traits/:key', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const { update, error } = createOePanelTraitUpdatePayload(
          req.body || {}
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_oling_trait_update_invalid',
            message: error
          });
        }
        if (!Object.keys(update).length) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_oling_trait_update_empty',
            message: 'No trait updates were provided.'
          });
        }

        const currentTrait = await OlingTrait.findOne({
          key: req.params.key
        }).lean();
        if (!currentTrait) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_oling_trait_not_found',
            message: 'oLing trait not found'
          });
        }

        const updatedTrait = await OlingTrait.findOneAndUpdate(
          { key: req.params.key },
          { $set: update },
          { new: true, runValidators: true }
        );

        await createAdminLog(AdminLog, account, {
          action: 'Updated oLing trait',
          area: 'oLings',
          target: {
            type: 'oling_trait',
            id: updatedTrait.key,
            label: updatedTrait.name
          },
          previousValue: currentTrait,
          newValue: update,
          severity: 'medium',
          metadata: { collection: 'oling-traits' }
        });

        res.apiSuccess({
          data: { row: serializeOePanelOlingTrait(updatedTrait.toObject()) }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update oLing trait:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_trait_update_failed',
          message: 'Failed to update oLing trait'
        });
      }
    });
  }
}

module.exports = {
  registerOePanelOlingTraitRoutes
};

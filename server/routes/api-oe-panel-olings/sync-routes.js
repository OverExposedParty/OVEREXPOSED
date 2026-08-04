function registerOePanelOlingSyncRoutes(context, helpers) {
  const { app } = context;
  const { OlingConsumable } = context.models || {};
  const {} = helpers;

  with (context) {
    app.post('/api/oe-panel/olings/consumables/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const exported = await exportOlingConsumablesToJson(OlingConsumable);
        await createAdminLog(AdminLog, account, {
          action: 'Exported oLing consumables',
          area: 'oLings',
          target: {
            type: 'oling_consumable_export',
            id: 'oling-consumables',
            label: 'oLing consumables JSON export'
          },
          previousValue: 'Database content',
          newValue: `Exported ${exported.length} oLing consumables`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} oLing consumables to JSON.`
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to export oLing consumables:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_oling_consumable_export_failed',
          message: 'Failed to export oLing consumables'
        });
      }
    });
  }
}

module.exports = {
  registerOePanelOlingSyncRoutes
};

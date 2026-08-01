function registerOePanelAchievementExportRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/oe-panel/achievements/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const exported = await exportAchievementsToJson(Achievement);
        await createAdminLog(AdminLog, account, {
          action: 'Exported achievements',
          area: 'Achievements',
          target: {
            type: 'achievement_export',
            id: 'achievements',
            label: 'Achievements JSON export'
          },
          previousValue: 'Database content',
          newValue: `Exported ${exported.length} achievements`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} achievements to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export achievements:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_achievement_export_failed',
          message: 'Failed to export achievements'
        });
      }
    });
  }
}

module.exports = { registerOePanelAchievementExportRoutes };

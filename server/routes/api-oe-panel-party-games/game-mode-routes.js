function registerOePanelGameModeRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/oe-panel/game-modes/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.export')) {
          return;
        }

        const exported = await exportGameModesToJson(GameMode);
        await createAdminLog(AdminLog, account, {
          action: 'Exported game modes',
          area: 'Party Games',
          target: {
            type: 'game_mode_export',
            id: 'game-modes',
            label: 'Game modes JSON export'
          },
          previousValue: 'Database content',
          newValue: `Exported ${exported.length} game modes`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} game modes to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export game modes:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_mode_export_failed',
          message: 'Failed to export game modes'
        });
      }
    });
  }
}

module.exports = { registerOePanelGameModeRoutes };

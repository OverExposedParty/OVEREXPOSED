const { getContentSyncHealth } = require('../../services/content-sync-health');
const { createPartyGameSyncAlerts } = require('./sync-alerts');

function registerOePanelGameRuleRoutes(context) {
  const { app } = context;

  with (context) {
    app.patch('/api/oe-panel/game-rules/:ruleKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const parsedKey = parseCompositePartyContentKey(req.params.ruleKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_rule_key_required',
            message: 'Rule key is required'
          });
        }

        const currentRule = await GameRule.findOne({
          gameType: parsedKey.gameType,
          key: parsedKey.itemKey
        }).lean();
        if (!currentRule) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_rule_not_found',
            message: 'Game rule not found'
          });
        }

        const { update, error } = createGameRuleUpdatePayload(
          req.body || {},
          currentRule
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_rule_update_invalid',
            message: error
          });
        }

        const updatedRule = await GameRule.findOneAndUpdate(
          { gameType: parsedKey.gameType, key: parsedKey.itemKey },
          { $set: update },
          { new: true, runValidators: true }
        ).lean();

        await createGamemodeSettingsAlert(account, {
          action: getGamemodeSettingsAlertAction(req.body || {}),
          itemType: 'rule',
          itemKey: `${updatedRule.gameType}:${updatedRule.key}`,
          title: updatedRule.title || formatPartyGameLabel(updatedRule.key),
          gamemode: updatedRule.gameType,
          changes: Object.keys(req.body || {})
        });
        await createAdminLog(AdminLog, account, {
          action: 'Edited game rule',
          area: 'Party Games',
          target: {
            type: 'game_rule',
            id: `${updatedRule.gameType}:${updatedRule.key}`,
            label: updatedRule.title || formatPartyGameLabel(updatedRule.key)
          },
          previousValue: {
            title: currentRule.title,
            status: currentRule.status,
            enabled: currentRule.enabled,
            buttonType: currentRule.buttonType
          },
          newValue: update,
          severity: 'medium',
          metadata: {
            collection: 'game-rules',
            gamemode: updatedRule.gameType,
            changedFields: Object.keys(update)
          }
        });

        res.apiSuccess({
          data: { row: serializePartyRuleForPanel(updatedRule) }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update game rule:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_rule_update_failed',
          message: 'Failed to update game rule'
        });
      }
    });

    app.delete('/api/oe-panel/game-rules/:ruleKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.delete')) {
          return;
        }

        const parsedKey = parseCompositePartyContentKey(req.params.ruleKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_rule_key_required',
            message: 'Rule key is required'
          });
        }

        const deletedRule = await GameRule.findOneAndDelete({
          gameType: parsedKey.gameType,
          key: parsedKey.itemKey
        });

        if (!deletedRule) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_rule_not_found',
            message: 'Game rule not found'
          });
        }

        await createGamemodeSettingsAlert(account, {
          action: 'deleted',
          itemType: 'rule',
          itemKey: `${deletedRule.gameType}:${deletedRule.key}`,
          title: deletedRule.title || formatPartyGameLabel(deletedRule.key),
          gamemode: deletedRule.gameType,
          severity: 'warning'
        });
        await createAdminLog(AdminLog, account, {
          action: 'Deleted game rule',
          area: 'Party Games',
          target: {
            type: 'game_rule',
            id: `${deletedRule.gameType}:${deletedRule.key}`,
            label: deletedRule.title || formatPartyGameLabel(deletedRule.key)
          },
          previousValue: {
            title: deletedRule.title,
            status: deletedRule.status,
            enabled: deletedRule.enabled,
            buttonType: deletedRule.buttonType
          },
          newValue: 'Deleted',
          severity: 'high',
          metadata: {
            collection: 'game-rules',
            gamemode: deletedRule.gameType
          }
        });

        res.apiSuccess({ message: 'Game rule deleted' });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to delete game rule:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_rule_delete_failed',
          message: 'Failed to delete game rule'
        });
      }
    });

    app.get('/api/oe-panel/gamemode-settings-alerts', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const alerts = await GamemodeSettingsAlert.find(
          getGamemodeSettingsAlertQuery(req.query.filter)
        )
          .sort({ 'system.createdAt': -1 })
          .limit(50)
          .lean();
        const filter = String(req.query.filter || 'all');
        const contentSync = await getContentSyncHealth(context.models || {});
        const syncAlerts = ['all', 'export-needed'].includes(filter)
          ? createPartyGameSyncAlerts(contentSync)
          : [];

        res.apiSuccess({
          data: {
            alerts: [
              ...syncAlerts,
              ...alerts.map(serializeGamemodeSettingsAlert)
            ]
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch gamemode settings alerts:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_gamemode_settings_alerts_fetch_failed',
          message: 'Failed to fetch gamemode settings alerts'
        });
      }
    });

    app.post('/api/oe-panel/game-rules/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.export')) {
          return;
        }

        const exported = await exportGameRulesToJson(GameRule);
        await GamemodeSettingsAlert.updateMany(
          getGamemodeSettingsAlertQuery('export-needed'),
          {
            $set: {
              exportNeeded: false,
              resolvedAt: new Date()
            }
          }
        )
          .where('itemType')
          .equals('rule');
        await createAdminLog(AdminLog, account, {
          action: 'Exported game rules',
          area: 'Party Games',
          target: {
            type: 'game_rule_export',
            id: 'game-rules',
            label: 'Game rules JSON export'
          },
          previousValue: 'Export needed alerts unresolved',
          newValue: `Exported ${exported.length} game rules`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} game rules to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export game rules:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_rule_export_failed',
          message: 'Failed to export game rules'
        });
      }
    });
  }
}

module.exports = { registerOePanelGameRuleRoutes };

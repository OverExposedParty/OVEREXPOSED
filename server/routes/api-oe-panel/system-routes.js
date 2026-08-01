const { getAnalyticsConfiguration } = require('../../services/google-analytics');
const {
  getRuntimeSnapshot,
  measureDatabaseConnections
} = require('../../services/system-health');
const { getContentSyncHealth } = require('../../services/content-sync-health');

function registerOePanelSystemRoutes(context) {
  const { app } = context;

  with (context) {
app.get('/api/oe-panel/system', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const connectionDefinitions = [
          { label: 'Accounts', connection: accountsConnection },
          { label: 'oLings', connection: olingsConnection },
          { label: 'Party Games', connection: partyGamesConnection },
          {
            label: 'OE Customisation',
            connection: oeCustomisationConnection
          },
          { label: 'Shop', connection: shopConnection },
          { label: 'Moderation', connection: moderationConnection },
          { label: 'Social', connection: socialConnection }
        ];
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [connections, failedAdminActions, criticalAdminActions] =
          await Promise.all([
            measureDatabaseConnections(connectionDefinitions),
            AdminLog.countDocuments({
              result: 'failed',
              'system.createdAt': { $gte: last24Hours }
            }),
            AdminLog.countDocuments({
              severity: 'critical',
              'system.createdAt': { $gte: last24Hours }
            })
          ]);
        const connectedCount = connections.filter(
          (connection) => connection.connected
        ).length;
        const databaseStatus =
          connectedCount === connections.length ? 'Connected' : 'Degraded';
        const runtime = getRuntimeSnapshot();
        const integrationRows = [
          {
            label: 'Google Analytics',
            configured: getAnalyticsConfiguration().configured
          },
          {
            label: 'Email (Resend)',
            configured: Boolean(
              process.env.RESEND_API_KEY && process.env.EMAIL_FROM
            )
          },
          {
            label: 'Google sign-in',
            configured: Boolean(
              process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            )
          },
          {
            label: 'Discord sign-in',
            configured: Boolean(
              process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
            )
          },
          {
            label: 'Video export',
            configured: Boolean(ffmpegPath)
          }
        ];
        const readyIntegrationCount = integrationRows.filter(
          (integration) => integration.configured
        ).length;
        const alerts = [];
        connections.forEach((connection) => {
          if (!connection.connected) {
            alerts.push({
              title: `${connection.label} database is ${connection.state.toLowerCase()}`,
              severity: 'high',
              area: 'Database',
              detail:
                'This database did not respond to the System panel health check.'
            });
          } else if (connection.latencyMs > 500) {
            alerts.push({
              title: `${connection.label} database is responding slowly`,
              severity: 'medium',
              area: 'Database',
              detail: `The latest ping took ${connection.latencyMs}ms.`
            });
          }
        });
        if (runtime.memory.heapUsagePercent >= 85) {
          alerts.push({
            title: 'Node heap usage is high',
            severity: 'high',
            area: 'Runtime',
            detail: `${runtime.memory.heapUsagePercent}% of the allocated heap is in use.`
          });
        }
        if (failedAdminActions) {
          alerts.push({
            title: `${failedAdminActions} failed admin action${failedAdminActions === 1 ? '' : 's'} in the last 24 hours`,
            severity: criticalAdminActions ? 'high' : 'medium',
            area: 'Admin Logs',
            detail: `${criticalAdminActions} critical event${criticalAdminActions === 1 ? '' : 's'} recorded in the same period.`
          });
        }
        if (isProduction && !process.env.COOKIE_SECRET) {
          alerts.push({
            title: 'Cookie secret is not configured',
            severity: 'critical',
            area: 'Security',
            detail: 'Set COOKIE_SECRET before serving production traffic.'
          });
        }
        const storedFeatureFlags = await SystemConfig.find({
          key: { $in: SYSTEM_FEATURE_FLAGS.map((flag) => flag.key) }
        }).lean();
        const contentSync = await getContentSyncHealth(context.models || {});
        alerts.push(...contentSync.alerts);
        const storedFeatureFlagsByKey = new Map(
          storedFeatureFlags.map((flag) => [flag.key, flag])
        );
        const configRows = SYSTEM_FEATURE_FLAGS.map((flag) => {
          const storedFlag = storedFeatureFlagsByKey.get(flag.key);
          const dateChanged =
            storedFlag?.system?.updatedAt || storedFlag?.system?.createdAt;

          return {
            key: flag.key,
            setting: flag.label,
            value: storedFlag?.value || '-',
            area: flag.area,
            dateChanged: formatSystemConfigDate(dateChanged)
          };
        });

        res.apiSuccess({
          data: {
            status: {
              runtime: {
                value: 'Online',
                detail: runtime.uptime,
                rows: [
                  { label: 'Uptime', value: runtime.uptime },
                  {
                    label: 'Started',
                    value: formatOePanelDateTime(runtime.startedAt)
                  },
                  { label: 'Node', value: runtime.nodeVersion },
                  { label: 'Platform', value: runtime.platform },
                  { label: 'Process ID', value: String(runtime.processId) },
                  { label: 'Resident memory', value: runtime.memory.rssLabel },
                  { label: 'Heap used', value: runtime.memory.heapUsedLabel },
                  {
                    label: 'Heap allocated',
                    value: runtime.memory.heapTotalLabel
                  },
                  {
                    label: 'Heap usage',
                    value: `${runtime.memory.heapUsagePercent}%`
                  }
                ]
              },
              databases: {
                value: databaseStatus,
                detail: `${connectedCount}/${connections.length} connections`,
                rows: connections.map((connection) => ({
                  label: connection.label,
                  value: connection.connected
                    ? `${connection.state} · ${connection.latencyMs}ms`
                    : connection.state
                }))
              },
              integrations: {
                value: `${readyIntegrationCount}/${integrationRows.length}`,
                detail: 'services configured',
                rows: integrationRows.map((integration) => ({
                  label: integration.label,
                  value: integration.configured
                    ? 'Configured'
                    : 'Not configured'
                }))
              },
              deployment: {
                value: packageJson.version || '-',
                detail: WEBSITE_CACHE_VERSION,
                rows: [
                  {
                    label: 'Application version',
                    value: packageJson.version || '-'
                  },
                  {
                    label: 'Asset cache version',
                    value: WEBSITE_CACHE_VERSION
                  },
                  {
                    label: 'Environment',
                    value: isProduction ? 'Production' : 'Development'
                  },
                  {
                    label: 'Node environment',
                    value: process.env.NODE_ENV || '-'
                  },
                  {
                    label: 'Server region',
                    value: process.env.SERVER_REGION || '-'
                  },
                  {
                    label: 'Server time',
                    value: formatOePanelDateTime(new Date())
                  }
                ]
              }
            },
            configRows,
            alerts,
            contentSync
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch OE Panel system:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_system_fetch_failed',
          message: 'Failed to fetch system panel data'
        });
      }
    });

    app.patch('/api/oe-panel/system/config/:key', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const key = normalizeReportText(req.params.key, 120);
        const flagConfig = SYSTEM_FEATURE_FLAGS.find(
          (flag) => flag.key === key
        );
        if (!flagConfig) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_system_config_not_found',
            message: 'That system config field could not be found.'
          });
        }

        const value = normalizeReportText(req.body?.value, 240) || '-';
        const previousFlag = await SystemConfig.findOne({ key }).lean();
        const updatedFlag = await SystemConfig.findOneAndUpdate(
          { key },
          {
            $set: {
              key,
              label: flagConfig.label,
              value,
              area: flagConfig.area,
              'system.updatedBy': account.developmentBypass ? null : account._id
            },
            $setOnInsert: {
              'system.createdAt': new Date()
            }
          },
          { upsert: true, new: true, lean: true }
        );
        await createAdminLog(AdminLog, account, {
          action: 'Edited feature flag',
          area: 'System',
          target: {
            type: 'system_config',
            id: key,
            label: flagConfig.label
          },
          previousValue: previousFlag?.value || '-',
          newValue: updatedFlag.value || '-',
          severity: 'medium'
        });

        res.apiSuccess({
          data: {
            config: {
              key,
              setting: flagConfig.label,
              value: updatedFlag.value || '-',
              area: flagConfig.area,
              dateChanged: formatSystemConfigDate(updatedFlag.system?.updatedAt)
            }
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update system config:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_system_config_update_failed',
          message: 'Failed to update system config.'
        });
      }
    });
  }
}

module.exports = { registerOePanelSystemRoutes };

function registerOePanelAdminLogRoutes(context) {
  const {
    app,
    AdminLog,
    clampNumber,
    createAdminLog,
    requireOePanelAccount,
    requireOePanelPermission,
    serializeAdminLog
  } = context;

  app.get('/api/oe-panel/admin-logs', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const activeLogQuery = { 'metadata.archivedAt': { $exists: false } };
      const [
        logs,
        logsToday,
        failedActions,
        criticalEvents,
        totalActions,
        logCountsByDate
      ] = await Promise.all([
        AdminLog.find(activeLogQuery)
          .sort({ 'system.createdAt': -1 })
          .limit(100)
          .lean(),
        AdminLog.countDocuments({
          ...activeLogQuery,
          'system.createdAt': { $gte: todayStart }
        }),
        AdminLog.countDocuments({ ...activeLogQuery, result: 'failed' }),
        AdminLog.countDocuments({
          ...activeLogQuery,
          severity: { $in: ['high', 'critical'] }
        }),
        AdminLog.countDocuments(activeLogQuery),
        AdminLog.aggregate([
          { $match: activeLogQuery },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$system.createdAt'
                }
              },
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      const serializedLogs = logs.map(serializeAdminLog);
      const logCountByDate = Object.fromEntries(
        logCountsByDate
          .filter((entry) => entry._id)
          .map((entry) => [entry._id, entry.count])
      );

      res.apiSuccess({
        data: {
          logs: serializedLogs,
          logCountByDate,
          stats: {
            logsToday,
            totalActions,
            criticalEvents,
            failedActions
          },
          alerts: serializedLogs
            .filter(
              (log) =>
                ['failed'].includes(log.result)
                || ['high', 'critical'].includes(log.severity)
            )
            .slice(0, 8)
            .map((log) => ({
              title: log.action,
              roomCode: log.area,
              detail: `${log.admin} | ${log.target}`,
              severity: log.result === 'failed' ? 'high' : log.severity,
              containerType: 'admin-log',
              'container-type': 'admin-log',
              log
            }))
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch admin logs:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_admin_logs_fetch_failed',
        message: 'Failed to fetch admin logs'
      });
    }
  });

  app.get('/api/oe-panel/admin-logs/export', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;
      if (!requireOePanelPermission(account, res, 'admin_logs.export')) return;

      const logs = await AdminLog.find({
        'metadata.archivedAt': { $exists: false }
      })
        .sort({ 'system.createdAt': -1 })
        .limit(5000)
        .lean();
      const exportedAt = new Date();

      await createAdminLog(AdminLog, account, {
        action: 'Exported admin logs',
        area: 'Admin Logs',
        target: {
          type: 'admin_log_export',
          id: exportedAt.toISOString(),
          label: 'Admin logs export'
        },
        previousValue: '-',
        newValue: `Exported ${logs.length} logs`,
        severity: 'medium',
        metadata: { exportedCount: logs.length }
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="admin-logs-${exportedAt.toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify({
        exportedAt: exportedAt.toISOString(),
        count: logs.length,
        logs: logs.map(serializeAdminLog)
      }, null, 2));
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to export admin logs:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_admin_logs_export_failed',
        message: 'Failed to export admin logs'
      });
    }
  });

  app.post('/api/oe-panel/admin-logs/archive', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;
      if (!requireOePanelPermission(account, res, 'admin_logs.archive')) return;

      const days = clampNumber(req.body?.days, 7, 3650, 90);
      const archiveBefore = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const result = await AdminLog.updateMany(
        {
          'system.createdAt': { $lt: archiveBefore },
          'metadata.archivedAt': { $exists: false }
        },
        {
          $set: {
            'metadata.archivedAt': new Date(),
            'metadata.archivedBy': account?.developmentBypass
              ? 'Development'
              : String(account._id),
            'metadata.archiveReason': `Archived from OE Panel after ${days} days`
          }
        }
      );
      const archivedCount = result.modifiedCount || 0;

      await createAdminLog(AdminLog, account, {
        action: 'Archived admin logs',
        area: 'Admin Logs',
        target: {
          type: 'admin_log_archive',
          id: `${days}-days`,
          label: `Logs older than ${days} days`
        },
        previousValue: `${archivedCount} active logs older than ${days} days`,
        newValue: 'Archived',
        severity: archivedCount ? 'high' : 'low',
        metadata: { days, archivedCount, archiveBefore }
      });

      res.apiSuccess({
        data: {
          message: `Archived ${archivedCount} admin logs.`,
          archivedCount
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to archive admin logs:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_admin_logs_archive_failed',
        message: 'Failed to archive admin logs'
      });
    }
  });
}

module.exports = { registerOePanelAdminLogRoutes };

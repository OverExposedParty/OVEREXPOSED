const { formatDurationSeconds } = require('../shared/api-formatters');

function registerOePanelModerationRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/oe-panel/moderation', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const openReportQuery = { status: { $in: ['open', 'reviewing'] } };
        const accountFlagQuery = {
          $or: [
            { 'profile.accountStatus': { $in: ['suspended', 'banned'] } },
            { 'security.suspiciousActivityFlag': true },
            { 'security.compromisedPasswordFlag': true }
          ]
        };
        const activeRoomIssueGroupsPromise = Promise.all(
          getPartyGameRoomSources().map(async ([sourceCollection, model]) => {
            const rooms = await model
              .find({ 'errors.0': { $exists: true } })
              .sort({ 'state.lastPinged': -1, 'session.createdAt': -1 })
              .limit(10)
              .lean();
            return rooms.map((room) =>
              serializeActiveRoom(room, sourceCollection)
            );
          })
        );

        const [
          openReports,
          urgentReports,
          reportsLast24Hours,
          oldestOpenReport,
          resolutionRows,
          resolvedLast7Days,
          latestOpenReports,
          repeatOffenderRows,
          accountFlags,
          recentDecisionReports,
          activeRoomIssueGroups,
          archivedRoomsWithIssues
        ] = await Promise.all([
          Report.countDocuments(openReportQuery),
          Report.countDocuments({
            ...openReportQuery,
            priority: { $in: ['high', 'urgent'] }
          }),
          Report.countDocuments({
            'system.createdAt': { $gte: last24Hours }
          }),
          Report.findOne(openReportQuery)
            .sort({ 'system.createdAt': 1 })
            .select('system.createdAt')
            .lean(),
          Report.aggregate([
            {
              $match: {
                status: { $in: ['dismissed', 'actioned'] },
                'moderation.reviewedAt': { $gte: last30Days, $type: 'date' },
                'system.createdAt': { $type: 'date' }
              }
            },
            {
              $group: {
                _id: null,
                averageMs: {
                  $avg: {
                    $subtract: ['$moderation.reviewedAt', '$system.createdAt']
                  }
                }
              }
            }
          ]),
          Report.countDocuments({
            status: { $in: ['dismissed', 'actioned'] },
            'moderation.reviewedAt': { $gte: last7Days }
          }),
          Report.find(openReportQuery)
            .sort({ 'system.createdAt': -1 })
            .limit(30)
            .lean(),
          Report.aggregate([
            {
              $match: {
                ...openReportQuery,
                'reportedUser.accountId': { $type: 'objectId' }
              }
            },
            {
              $group: {
                _id: '$reportedUser.accountId',
                count: { $sum: 1 },
                latestAt: { $max: '$system.createdAt' },
                priorities: { $addToSet: '$priority' },
                reasons: { $addToSet: '$reason' }
              }
            },
            { $match: { count: { $gte: 2 } } },
            { $sort: { count: -1, latestAt: -1 } },
            { $limit: 10 }
          ]),
          Account.countDocuments(accountFlagQuery),
          Report.find({
            status: { $in: ['dismissed', 'actioned'] },
            'moderation.reviewedAt': { $gte: last30Days }
          })
            .sort({ 'moderation.reviewedAt': -1 })
            .limit(12)
            .lean(),
          activeRoomIssueGroupsPromise,
          archivedRoomSchema
            .find({ 'errors.0': { $exists: true } })
            .sort({ archivedAt: -1 })
            .limit(20)
            .lean()
        ]);

        const averageResolutionSeconds = resolutionRows[0]?.averageMs
          ? Math.max(0, resolutionRows[0].averageMs / 1000)
          : 0;
        const oldestCreatedAt = oldestOpenReport?.system?.createdAt
          ? new Date(oldestOpenReport.system.createdAt)
          : null;
        const oldestWaitingSeconds = oldestCreatedAt
          ? Math.max(0, (now.getTime() - oldestCreatedAt.getTime()) / 1000)
          : 0;
        const roomRows = [
          ...activeRoomIssueGroups.flat(),
          ...archivedRoomsWithIssues.map(serializeArchivedRoom)
        ];
        const roomIssues = roomRows
          .flatMap((room) =>
            (Array.isArray(room.errors) ? room.errors : []).map((error) =>
              createRoomIssueAlert(room, error, room.roomStatus)
            )
          )
          .sort(
            (left, right) =>
              new Date(right.occurredAt || 0).getTime() -
              new Date(left.occurredAt || 0).getTime()
          )
          .slice(0, 25);
        const reportAlerts = await Promise.all(
          latestOpenReports.map(async (report) => {
            if (report.context?.source === 'overexposure') {
              return serializeOePanelModerationReport(report);
            }

            const createdAt = formatOePanelDateTime(report.system?.createdAt);
            return {
              title:
                report.target?.labelSnapshot ||
                report.reportedUser?.usernameSnapshot ||
                formatReportLabel(report.target?.type || 'Reported item'),
              roomCode: report.context?.partyId || report.target?.id || '-',
              detail: [
                formatReportLabel(report.reason),
                formatReportLabel(report.status),
                createdAt
              ]
                .filter(Boolean)
                .join(' | '),
              severity: ['high', 'urgent'].includes(report.priority)
                ? 'high'
                : 'medium',
              containerType: 'moderation-report',
              'container-type': 'moderation-report',
              reportId: String(report._id),
              report: {
                id: String(report._id),
                reason: formatReportLabel(report.reason),
                details: report.details || '-',
                reporter:
                  report.reporter?.usernameSnapshot || 'Unknown reporter',
                reportedAt: createdAt,
                status: formatReportLabel(report.status),
                priority: formatReportLabel(report.priority)
              },
              moderation: {
                reviewStatus:
                  report.status === 'reviewing' ? 'In review' : 'Needs review',
                reportStatus: formatReportLabel(report.status),
                priority: formatReportLabel(report.priority),
                actionTaken: report.moderation?.actionTaken || '-',
                reviewedAt: formatOePanelDateTime(report.moderation?.reviewedAt)
              }
            };
          })
        );
        const repeatOffenderAccounts = repeatOffenderRows.length
          ? await Account.find({
              _id: { $in: repeatOffenderRows.map((row) => row._id) }
            })
              .select('username email profile.accountStatus')
              .lean()
          : [];
        const repeatOffenderAccountMap = new Map(
          repeatOffenderAccounts.map((user) => [String(user._id), user])
        );
        const repeatOffenders = repeatOffenderRows.map((row) => {
          const user = repeatOffenderAccountMap.get(String(row._id));
          const accountName = user?.username || user?.email || String(row._id);
          return {
            title: `${accountName} has ${row.count} open reports`,
            roomCode: String(row._id),
            detail: [
              row.reasons.map(formatReportLabel).join(', '),
              formatReportLabel(user?.profile?.accountStatus || 'active')
            ]
              .filter(Boolean)
              .join(' | '),
            severity: row.priorities.some((priority) =>
              ['high', 'urgent'].includes(priority)
            )
              ? 'high'
              : 'medium',
            containerType: 'account',
            'container-type': 'account',
            targetGridId: 'users-grid-2',
            query: `[accountId:${String(row._id)}]`,
            expandFirstMatch: true
          };
        });
        const reviewerIds = [
          ...new Set(
            recentDecisionReports
              .map((report) => report.moderation?.reviewedBy)
              .filter(Boolean)
              .map(String)
          )
        ];
        const reviewers = reviewerIds.length
          ? await Account.find({ _id: { $in: reviewerIds } })
              .select('username email')
              .lean()
          : [];
        const reviewerMap = new Map(
          reviewers.map((reviewer) => [String(reviewer._id), reviewer])
        );
        const recentDecisions = recentDecisionReports.map((report) => {
          const reviewer = reviewerMap.get(
            String(report.moderation?.reviewedBy || '')
          );
          return {
            title: `${formatReportLabel(report.moderation?.actionTaken || report.status)} report`,
            roomCode: report.context?.partyId || report.target?.id || '-',
            detail: [
              reviewer?.username || reviewer?.email || 'Unknown moderator',
              formatOePanelDateTime(report.moderation?.reviewedAt),
              formatReportLabel(report.reason)
            ]
              .filter(Boolean)
              .join(' | '),
            severity: 'low',
            containerType: 'moderation-decision',
            'container-type': 'moderation-decision'
          };
        });
        const prioritySignals = [
          ...reportAlerts.filter((alert) => alert.severity === 'high'),
          ...roomIssues.filter((alert) => alert.severity === 'high'),
          ...repeatOffenders
        ].slice(0, 20);

        res.apiSuccess({
          data: {
            stats: {
              openReports,
              urgentReports,
              reportsLast24Hours,
              oldestWaiting: formatDurationSeconds(oldestWaitingSeconds),
              oldestWaitingSeconds,
              resolvedLast7Days,
              averageResolution: formatDurationSeconds(
                averageResolutionSeconds
              ),
              roomIssues: roomIssues.length,
              accountFlags,
              repeatOffenders: repeatOffenders.length
            },
            prioritySignals,
            repeatOffenders,
            recentDecisions
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel moderation:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_moderation_fetch_failed',
          message: 'Failed to fetch moderation panel data'
        });
      }
    });
  }
}

module.exports = { registerOePanelModerationRoutes };

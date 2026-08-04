function registerOePanelOverexposureRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/oe-panel/overexposure', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const now = new Date();
        const todayStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const overexposureReportQuery = {
          'target.type': 'overexposure_post',
          'context.source': 'overexposure'
        };
        const openReportQuery = {
          ...overexposureReportQuery,
          status: { $in: ['open', 'reviewing'] }
        };

        const [
          totalPosts,
          publishedToday,
          reportsLast24Hours,
          openReports,
          highPriorityReports,
          latestReports
        ] = await Promise.all([
          OverexposurePost.countDocuments({}),
          OverexposurePost.countDocuments({
            $or: [
              { 'lifecycle.postedAt': { $gte: todayStart } },
              { 'system.createdAt': { $gte: todayStart } }
            ]
          }),
          Report.countDocuments({
            ...overexposureReportQuery,
            'system.createdAt': { $gte: last24Hours }
          }),
          Report.countDocuments(openReportQuery),
          Report.countDocuments({
            ...openReportQuery,
            priority: { $in: ['high', 'urgent'] }
          }),
          Report.find(overexposureReportQuery)
            .sort({ 'system.createdAt': -1 })
            .limit(25)
            .lean()
        ]);
        const latestReportPostIds = [
          ...new Set(
            latestReports
              .map(
                (report) => report.context?.postId || report.target?.objectId
              )
              .filter(Boolean)
              .map(String)
          )
        ];
        const [reportedPosts, latestReportCounts] = await Promise.all([
          latestReportPostIds.length
            ? OverexposurePost.find({ _id: { $in: latestReportPostIds } })
                .select(
                  '+title +text +id +date +userIcon +x +y +tag +visibility'
                )
                .lean()
            : [],
          latestReportPostIds.length
            ? Report.aggregate([
                {
                  $match: {
                    ...overexposureReportQuery,
                    'target.id': { $in: latestReportPostIds }
                  }
                },
                { $group: { _id: '$target.id', count: { $sum: 1 } } }
              ])
            : []
        ]);
        const reportedPostMap = new Map(
          reportedPosts.map((post) => [String(post._id), post])
        );
        const reportCountMap = new Map(
          latestReportCounts.map((count) => [String(count._id), count.count])
        );

        res.apiSuccess({
          data: {
            stats: {
              totalPosts,
              pendingReview: openReports,
              highPriorityReports,
              reportsLast24Hours,
              publishedToday
            },
            reportedContent: latestReports.map((report) => {
              const postId = String(
                report.context?.postId || report.target?.objectId || ''
              );
              return serializeOePanelOverexposureReport(
                report,
                reportedPostMap.get(postId),
                reportCountMap.get(postId) || 1
              );
            })
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel Overexposure data:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_overexposure_fetch_failed',
          message: 'Failed to fetch Overexposure panel data'
        });
      }
    });

    app.delete(
      '/api/oe-panel/overexposure-posts/:publicId',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;
          if (!requireOePanelPermission(account, res, 'overexposure.delete')) {
            return;
          }

          const publicId = String(req.params.publicId || '').trim();
          if (!publicId || publicId === '-') {
            return res.apiError({
              status: 400,
              code: 'oe_panel_overexposure_post_id_required',
              message: 'Post ID is required'
            });
          }

          const deletedPost = await OverexposurePost.findOneAndDelete({
            $or: [{ 'public.id': publicId }, { id: publicId }]
          });

          if (!deletedPost) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_overexposure_post_not_found',
              message: 'Overexposure post not found'
            });
          }

          await Account.updateMany(
            { 'overexposure.postsCreated.publicId': publicId },
            {
              $set: {
                'overexposure.postsCreated.$[postSummary].status.deletedAt':
                  new Date()
              }
            },
            { arrayFilters: [{ 'postSummary.publicId': publicId }] }
          );
          await createAdminLog(AdminLog, account, {
            action: 'Deleted Overexposure post',
            area: 'Overexposure',
            target: {
              type: 'overexposure_post',
              id: publicId,
              label: deletedPost.title || publicId
            },
            previousValue: {
              publicId,
              ownerId: deletedPost.owner?.accountId,
              visibility: deletedPost.visibility,
              status: deletedPost.status
            },
            newValue: 'Deleted',
            severity: 'high',
            metadata: {
              collection: 'overexposure-posts'
            }
          });

          res.apiSuccess({ message: 'Overexposure post deleted' });
        } catch (err) {
          console.error(
            `[REQ ${req.id}] Failed to delete OE Panel Overexposure post:`,
            err
          );
          res.apiError({
            status: 500,
            code: 'oe_panel_overexposure_post_delete_failed',
            message: 'Failed to delete Overexposure post'
          });
        }
      }
    );

    app.patch('/api/oe-panel/reports/:reportId', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const reportId = normalizeReportText(req.params.reportId, 120);
        if (!reportId.match(/^[a-f\d]{24}$/i)) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_report_id_invalid',
            message: 'Choose a valid report.'
          });
        }

        const action = normalizeReportText(req.body?.action, 80);
        const note = normalizeReportText(req.body?.note, 2000);
        const now = new Date();
        const report = await Report.findOne({
          _id: reportId,
          'target.type': 'overexposure_post',
          'context.source': 'overexposure'
        });

        if (!report) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_report_not_found',
            message: 'That report could not be found.'
          });
        }

        const reportUpdate = {
          moderation: {
            ...(report.moderation?.toObject
              ? report.moderation.toObject()
              : report.moderation || {}),
            reviewedBy: account.developmentBypass ? null : account._id,
            reviewedAt: now
          }
        };
        const postId = getOePanelReportPostId(report);
        const postUpdate = {};

        switch (action) {
          case 'mark-reviewing':
            reportUpdate.status = 'reviewing';
            reportUpdate.moderation.actionTaken = 'reviewing';
            break;
          case 'approve':
            reportUpdate.status = 'actioned';
            reportUpdate.moderation.actionTaken = 'approved';
            break;
          case 'hide':
            reportUpdate.status = 'actioned';
            reportUpdate.moderation.actionTaken = 'hidden';
            postUpdate['public.visibility'] = 'hidden';
            postUpdate['lifecycle.hiddenAt'] = now;
            break;
          case 'delete':
            if (
              !requireOePanelPermission(account, res, 'overexposure.delete')
            ) {
              return;
            }
            reportUpdate.status = 'actioned';
            reportUpdate.moderation.actionTaken = 'deleted';
            postUpdate['public.visibility'] = 'deleted';
            postUpdate['lifecycle.deletedAt'] = now;
            break;
          case 'dismiss-report':
            reportUpdate.status = 'dismissed';
            reportUpdate.moderation.actionTaken = 'dismissed';
            break;
          case 'escalate':
            reportUpdate.status = 'reviewing';
            reportUpdate.priority = 'urgent';
            reportUpdate.moderation.actionTaken = 'escalated';
            break;
          case 'add-note':
            if (!note) {
              return res.apiError({
                status: 400,
                code: 'oe_panel_report_note_required',
                message: 'Add a note before saving.'
              });
            }
            reportUpdate.status =
              report.status === 'open' ? 'reviewing' : report.status;
            reportUpdate.moderation.actionTaken =
              report.moderation?.actionTaken || 'note_added';
            reportUpdate.moderation.notes = note;
            break;
          default:
            return res.apiError({
              status: 400,
              code: 'oe_panel_report_action_invalid',
              message: 'Choose a valid moderation action.'
            });
        }

        if (Object.keys(postUpdate).length && postId) {
          await OverexposurePost.updateOne(
            { _id: postId },
            { $set: postUpdate }
          );
        }

        const updatedReport = await Report.findByIdAndUpdate(
          report._id,
          { $set: reportUpdate },
          { new: true }
        ).lean();
        await createAdminLog(AdminLog, account, {
          action: `Report ${reportUpdate.moderation.actionTaken || action}`,
          area: 'Moderation',
          target: {
            type: 'report',
            id: String(report._id),
            label:
              report.target?.labelSnapshot ||
              report.context?.postPublicId ||
              String(report._id)
          },
          previousValue: report.status,
          newValue: updatedReport.status,
          severity:
            updatedReport.priority === 'urgent' || action === 'delete'
              ? 'high'
              : 'medium',
          note: note || '-',
          metadata: {
            reportAction: action,
            postId
          }
        });

        res.apiSuccess({
          data: {
            reportedContent:
              await serializeOePanelModerationReport(updatedReport)
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to moderate OE report:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_report_moderation_failed',
          message: 'Failed to update report.'
        });
      }
    });
  }
}

module.exports = { registerOePanelOverexposureRoutes };

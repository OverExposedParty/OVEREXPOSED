function registerPublicReportRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/reports', async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to submit a report.'
          });
        }

        if (!requireVerifiedAccount(res, account, 'submit reports')) return;

        const targetType = normalizeReportText(
          req.body?.target?.type || req.body?.targetType,
          80
        );
        const reason = normalizeReportText(req.body?.reason, 80);
        const details = normalizeReportText(req.body?.details, 3000);

        if (!Report.REASONS.includes(reason)) {
          return res.apiError({
            status: 400,
            code: 'report_reason_invalid',
            message: 'Choose a valid report reason.'
          });
        }

        let builtReport;
        if (targetType === 'overexposure_post') {
          builtReport = await buildOverexposurePostReport(req, account);
        } else {
          return res.apiError({
            status: 400,
            code: 'report_target_type_invalid',
            message: 'That report target is not supported yet.'
          });
        }

        if (builtReport.error) {
          return res.apiError(builtReport.error);
        }

        const reportData = {
          ...builtReport.report,
          reason,
          details,
          status: 'open',
          priority: 'normal',
          metadata: {
            userAgent: req.get('user-agent') || null
          }
        };

        const duplicateQuery = {
          'target.type': reportData.target.type,
          'target.id': reportData.target.id
        };

        duplicateQuery['reporter.accountId'] = account._id;

        const existingReport = await Report.findOne(duplicateQuery).lean();
        if (existingReport) {
          return res.apiError({
            status: 409,
            code: 'report_already_submitted',
            message: 'You have already submitted a report for this post.'
          });
        }

        const report = await Report.create(reportData);

        return res.apiSuccess(
          {
            message: 'Report submitted successfully.',
            report: {
              id: report._id,
              status: report.status,
              createdAt: report.system?.createdAt
            }
          },
          201
        );
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'report_already_submitted',
            message: 'You have already submitted a report for this post.'
          });
        }

        console.error(`[REQ ${req.id}] Failed to create report:`, err);
        return res.apiError({
          code: 'report_create_failed',
          message: 'Failed to submit report.'
        });
      }
    });

    app.get('/api/reports/status', async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to view report status.'
          });
        }

        const targetType = normalizeReportText(req.query?.targetType, 80);
        const targetId = normalizeReportText(req.query?.targetId, 120);

        if (targetType !== 'overexposure_post') {
          return res.apiError({
            status: 400,
            code: 'report_target_type_invalid',
            message: 'That report target is not supported yet.'
          });
        }

        const post = await findOverexposurePostForReport(targetId);
        if (!post) {
          return res.apiError({
            status: 404,
            code: 'report_target_not_found',
            message: 'That post could not be found.'
          });
        }

        const report = await Report.findOne({
          'target.type': 'overexposure_post',
          'target.id': String(post._id),
          'reporter.accountId': account._id,
          status: { $in: ['open', 'reviewing'] }
        })
          .select('reason details status system.createdAt')
          .lean();

        res.apiSuccess({
          report: report
            ? {
                id: report._id,
                reason: report.reason,
                details: report.details,
                status: report.status,
                createdAt: report.system?.createdAt || null
              }
            : null
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch report status:`, err);
        res.apiError({
          code: 'report_status_fetch_failed',
          message: 'Failed to fetch report status.'
        });
      }
    });
  }
}

module.exports = { registerPublicReportRoutes };

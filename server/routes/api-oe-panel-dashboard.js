const {
  fetchGoogleAnalyticsData,
  getAnalyticsConfiguration
} = require('../services/google-analytics');
const { getProductAnalyticsSummary } = require('../services/product-analytics');

function registerOePanelDashboardRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/oe-panel/dashboard-overview', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const now = new Date();
        const activeSince = new Date(now.getTime() - 15 * 60 * 1000);
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const [
          activeUsers,
          activeRoomGroups,
          pendingReports,
          urgentReports,
          revenueRows
        ] = await Promise.all([
          Account.countDocuments({
            $or: [
              { 'analytics.lastSeenAt': { $gte: activeSince } },
              { 'profile.lastLoginAt': { $gte: activeSince } }
            ]
          }),
          Promise.all(
            getPartyGameRoomSources().map(([, model]) =>
              model.countDocuments({})
            )
          ),
          Report.countDocuments({ status: { $in: ['open', 'reviewing'] } }),
          Report.countDocuments({
            status: { $in: ['open', 'reviewing'] },
            priority: 'urgent'
          }),
          Account.aggregate([
            { $unwind: '$shop.orderHistory' },
            {
              $match: {
                'shop.orderHistory.status': 'paid',
                'shop.orderHistory.placedAt': { $gte: last24Hours }
              }
            },
            {
              $group: {
                _id: '$shop.orderHistory.total.currency',
                amount: { $sum: '$shop.orderHistory.total.amount' }
              }
            }
          ])
        ]);
        const liveRooms = activeRoomGroups.reduce(
          (total, count) => total + Number(count || 0),
          0
        );
        const primaryRevenue = revenueRows[0] || { _id: 'GBP', amount: 0 };

        res.apiSuccess({
          data: {
            activeUsers,
            liveRooms,
            pendingReports,
            urgentReports,
            shopRevenueLast24h: {
              value: formatCurrencyValue(
                primaryRevenue.amount,
                primaryRevenue._id
              ),
              amount: primaryRevenue.amount || 0,
              currency: primaryRevenue._id || 'GBP'
            }
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel dashboard overview:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_dashboard_overview_fetch_failed',
          message: 'Failed to fetch dashboard overview'
        });
      }
    });

    app.get('/api/oe-panel/dashboard-activity', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const activeRoomCountMaps = await Promise.all(
          getPartyGameRoomSources().map(([, model]) =>
            getDateCountMap(model, 'session.createdAt', {
              'session.createdAt': { $type: 'date' }
            })
          )
        );
        const [signups, archivedRooms, overexposurePosts, reports] =
          await Promise.all([
            getDateCountMap(Account, 'createdAt', {
              createdAt: { $type: 'date' }
            }),
            getDateCountMap(archivedRoomSchema, 'archivedAt', {
              archivedAt: { $type: 'date' }
            }),
            getDateCountMap(OverexposurePost, 'lifecycle.postedAt', {
              'lifecycle.postedAt': { $type: 'date' }
            }),
            getDateCountMap(Report, 'system.createdAt', {
              'system.createdAt': { $type: 'date' }
            })
          ]);

        res.apiSuccess({
          data: {
            signups,
            partyRooms: mergeDateCountMaps(
              archivedRooms,
              ...activeRoomCountMaps
            ),
            overexposurePosts,
            reports
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel dashboard activity:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_dashboard_activity_fetch_failed',
          message: 'Failed to fetch dashboard activity'
        });
      }
    });

    app.get('/api/oe-panel/analytics', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const previous7Days = new Date(
          now.getTime() - 14 * 24 * 60 * 60 * 1000
        );
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const productAnalyticsPromise = getProductAnalyticsSummary(
          AnalyticsEvent,
          { since: last30Days }
        );
        const hasSignupAttribution = {
          $or: [
            { 'analytics.signupContext.source': { $type: 'string', $ne: '' } },
            {
              'analytics.signupContext.referrerPath': {
                $type: 'string',
                $ne: ''
              }
            },
            { 'analytics.referralSource': { $type: 'string', $ne: '' } }
          ]
        };
        const [
          totalAccounts,
          activeAccounts,
          newAccounts,
          previousNewAccounts,
          returningAccounts,
          attributedSignups,
          popularPageRows,
          acquisitionRows
        ] = await Promise.all([
          Account.countDocuments({}),
          Account.countDocuments({
            $or: [
              { 'analytics.lastSeenAt': { $gte: last24Hours } },
              { 'profile.lastLoginAt': { $gte: last24Hours } }
            ]
          }),
          Account.countDocuments({ createdAt: { $gte: last7Days } }),
          Account.countDocuments({
            createdAt: { $gte: previous7Days, $lt: last7Days }
          }),
          Account.countDocuments({
            createdAt: { $lt: last7Days },
            'profile.lastLoginAt': { $gte: last7Days }
          }),
          Account.countDocuments(hasSignupAttribution),
          Account.aggregate([
            {
              $project: {
                page: {
                  $ifNull: [
                    '$analytics.signupContext.referrerPath',
                    '$analytics.firstLandingPage'
                  ]
                }
              }
            },
            { $match: { page: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$page', accounts: { $sum: 1 } } },
            { $sort: { accounts: -1, _id: 1 } },
            { $limit: 20 }
          ]),
          Account.aggregate([
            {
              $project: {
                source: {
                  $ifNull: [
                    '$analytics.signupContext.source',
                    {
                      $ifNull: [
                        '$analytics.referralSource',
                        '$analytics.signupContext.referrerPath'
                      ]
                    }
                  ]
                }
              }
            },
            { $match: { source: { $type: 'string', $ne: '' } } },
            { $group: { _id: '$source', accounts: { $sum: 1 } } },
            { $sort: { accounts: -1, _id: 1 } },
            { $limit: 12 }
          ])
        ]);

        const signupChange = previousNewAccounts
          ? Math.round(
              ((newAccounts - previousNewAccounts) / previousNewAccounts) * 100
            )
          : null;
        const attributionCoverage = totalAccounts
          ? Math.round((attributedSignups / totalAccounts) * 100)
          : 0;
        const popularPages = popularPageRows.map((row) => ({
          page: row._id,
          accounts: String(row.accounts || 0),
          share: attributedSignups
            ? `${Math.round((Number(row.accounts || 0) / attributedSignups) * 100)}%`
            : '0%',
          scope: 'signup context'
        }));
        const acquisitionSources = acquisitionRows.map((row) => ({
          source: row._id,
          accounts: String(row.accounts || 0),
          share: attributedSignups
            ? `${Math.round((Number(row.accounts || 0) / attributedSignups) * 100)}%`
            : '0%'
        }));
        const productAnalytics = await productAnalyticsPromise;
        const gaConfiguration = getAnalyticsConfiguration();
        let googleAnalytics = null;

        if (gaConfiguration.configured) {
          try {
            googleAnalytics = await fetchGoogleAnalyticsData();
          } catch (analyticsError) {
            console.warn(
              `[REQ ${req.id}] Google Analytics reporting is unavailable:`,
              analyticsError.message
            );
          }
        }
        const topPages = googleAnalytics
          ? googleAnalytics.topPages
          : popularPages.map((page) => ({
              page: page.page,
              pageViews: '-',
              users: page.accounts,
              sessions: '-'
            }));
        const analyticsAlerts = googleAnalytics
          ? [
              {
                title: 'Google Analytics connected',
                severity: 'low',
                detail:
                  'Live GA4 traffic reporting is available and cached for five minutes.',
                area: 'External analytics'
              }
            ]
          : [
              {
                title: gaConfiguration.configured
                  ? 'Google Analytics unavailable'
                  : 'Google Analytics is not configured',
                severity: 'high',
                detail: gaConfiguration.configured
                  ? 'The panel is using account activity as a fallback. Check the server log for the GA4 connection error.'
                  : 'Add GA4_PROPERTY_ID and Application Default Credentials to enable live traffic reporting.',
                area: 'External analytics'
              }
            ];
        analyticsAlerts.push({
          title: 'Signup attribution coverage',
          severity: attributionCoverage < 50 ? 'medium' : 'low',
          detail: `${attributionCoverage}% of accounts have a recorded signup source or entry page.`,
          area: 'Acquisition analytics'
        });

        res.apiSuccess({
          data: {
            stats: {
              activeAccounts,
              newAccounts,
              previousNewAccounts,
              signupChange,
              returningAccounts,
              attributedSignups,
              attributionCoverage,
              totalAccounts
            },
            ga4: {
              configured: gaConfiguration.configured,
              available: Boolean(googleAnalytics),
              current: googleAnalytics?.current || null,
              previous: googleAnalytics?.previous || null,
              dailyActivity: googleAnalytics?.dailyActivity || {},
              fetchedAt: googleAnalytics?.fetchedAt || null
            },
            popularPages: topPages,
            acquisitionSources,
            productAnalytics,
            alerts: analyticsAlerts
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel analytics:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_analytics_fetch_failed',
          message: 'Failed to fetch analytics panel data'
        });
      }
    });
  }
}

module.exports = { registerOePanelDashboardRoutes };

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function registerOePanelUserQueryRoutes(context) {
  const {
    app,
    Account,
    AdminLog,
    Report,
    formatOePanelDateTime,
    requireOePanelAccount,
    serializeOePanelUser
  } = context;

  app.get('/api/oe-panel/users/search', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;

      const query = String(req.query?.q || '').trim();
      const limit = Math.min(Math.max(Number(req.query?.limit) || 8, 1), 12);
      if (query.length < 2) return res.apiSuccess({ data: { users: [] } });

      const filters = [
        { username: { $regex: escapeRegExp(query), $options: 'i' } }
      ];
      if (/^[a-f\d]{2,24}$/i.test(query)) {
        filters.unshift({
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: `^${escapeRegExp(query)}`,
              options: 'i'
            }
          }
        });
      }
      if (/^[a-f\d]{24}$/i.test(query)) filters.unshift({ _id: query });

      const users = await Account.find({ $or: filters })
        .sort({ 'analytics.lastSeenAt': -1, createdAt: -1 })
        .limit(limit)
        .lean();

      res.apiSuccess({ data: { users: users.map(serializeOePanelUser) } });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to search OE Panel users:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_users_search_failed',
        message: 'Failed to search users'
      });
    }
  });

  app.get('/api/oe-panel/users', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const activeSince = new Date(Date.now() - 15 * 60 * 1000);
      const [
        users,
        accountFlags,
        signupCounts,
        totalUsers,
        onlineNow,
        newToday,
        suspended,
        banned,
        verifiedUsers,
        securityFlagged,
        flaggedAccounts
      ] = await Promise.all([
        Account.find({})
          .select('+security')
          .sort({ createdAt: -1 })
          .limit(100)
          .lean(),
        Account.find({
          $or: [
            { 'profile.accountStatus': { $in: ['suspended', 'banned'] } },
            { 'security.suspiciousActivityFlag': true },
            { 'security.compromisedPasswordFlag': true }
          ]
        })
          .select('+security')
          .sort({ 'profile.updatedAt': -1, updatedAt: -1, createdAt: -1 })
          .limit(100)
          .lean(),
        Account.aggregate([
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          }
        ]),
        Account.countDocuments({}),
        Account.countDocuments({
          $or: [
            { 'analytics.lastSeenAt': { $gte: activeSince } },
            { 'profile.lastLoginAt': { $gte: activeSince } }
          ]
        }),
        Account.countDocuments({ createdAt: { $gte: startOfToday } }),
        Account.countDocuments({ 'profile.accountStatus': 'suspended' }),
        Account.countDocuments({ 'profile.accountStatus': 'banned' }),
        Account.countDocuments({ 'profile.emailVerified': true }),
        Account.countDocuments({
          $or: [
            { 'security.suspiciousActivityFlag': true },
            { 'security.compromisedPasswordFlag': true }
          ]
        }),
        Account.countDocuments({
          $or: [
            { 'profile.accountStatus': { $in: ['suspended', 'banned'] } },
            { 'security.suspiciousActivityFlag': true },
            { 'security.compromisedPasswordFlag': true }
          ]
        })
      ]);
      const signupCountByDate = Object.fromEntries(
        signupCounts.map((day) => [day._id, day.count])
      );
      const accountsById = new Map(
        [...users, ...accountFlags].map((user) => [String(user._id), user])
      );
      const accountIds = [...accountsById.values()].map((user) => user._id);
      const accountIdStrings = accountIds.map(String);
      const [userReports, userAdminLogs] = await Promise.all([
        Report.find({
          $or: [
            { 'reportedUser.accountId': { $in: accountIds } },
            { 'target.type': 'account', 'target.id': { $in: accountIdStrings } }
          ]
        })
          .select('reportedUser.accountId target.type target.id status')
          .lean(),
        AdminLog.find({
          'target.type': 'account',
          'target.id': { $in: accountIdStrings }
        })
          .sort({ 'system.createdAt': -1 })
          .limit(500)
          .lean()
      ]);
      const enrichmentByAccountId = new Map();
      const getEnrichment = (accountId) => {
        const key = String(accountId || '');
        if (!enrichmentByAccountId.has(key)) {
          enrichmentByAccountId.set(key, {
            reportsReceived: 0,
            openReportsReceived: 0,
            adminActionCount: 0,
            adminActions: []
          });
        }
        return enrichmentByAccountId.get(key);
      };
      userReports.forEach((report) => {
        const reportedAccountId =
          report.reportedUser?.accountId ||
          (report.target?.type === 'account' ? report.target.id : null);
        if (!reportedAccountId) return;

        const enrichment = getEnrichment(reportedAccountId);
        enrichment.reportsReceived += 1;
        if (['open', 'reviewing'].includes(report.status)) {
          enrichment.openReportsReceived += 1;
        }
      });
      userAdminLogs.forEach((log) => {
        const enrichment = getEnrichment(log.target?.id);
        enrichment.adminActionCount += 1;
        if (enrichment.adminActions.length < 3) {
          enrichment.adminActions.push(
            [
              formatOePanelDateTime(log.system?.createdAt),
              log.action,
              log.result
            ]
              .filter(Boolean)
              .join(' · ')
          );
        }
      });
      enrichmentByAccountId.forEach((enrichment) => {
        enrichment.recentAdminActions =
          enrichment.adminActions.join('\n') || '-';
      });
      const serializeUser = (user) =>
        serializeOePanelUser(
          user,
          enrichmentByAccountId.get(String(user._id)) || {}
        );

      res.apiSuccess({
        data: {
          users: users.map(serializeUser),
          accountFlags: accountFlags.map(serializeUser),
          signupCountByDate,
          stats: {
            totalUsers,
            onlineNow,
            newToday,
            suspended,
            banned,
            verifiedUsers,
            securityFlagged,
            flaggedAccounts
          }
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch OE Panel users:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_users_fetch_failed',
        message: 'Failed to fetch users'
      });
    }
  });
}

module.exports = { registerOePanelUserQueryRoutes };

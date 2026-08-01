const { formatDurationSeconds } = require('../shared/api-formatters');

function createPanelUserContext(context) {
  const { formatOePanelDateTime, formatReportLabel } = context;

  function getAccountRoleLabel(account) {
    const roles = [
      ...(Array.isArray(account.admin?.roles) ? account.admin.roles : []),
      account.admin?.role
    ].filter(Boolean);
    if (roles.length) return formatReportLabel(roles[0]);
    return 'User';
  }

  function serializeOePanelUser(account, enrichment = {}) {
    const signupContext = account.analytics?.signupContext || {};
    const providers = Array.isArray(account.profile?.loginProviders)
      ? account.profile.loginProviders.map((provider) => provider.name)
      : [];
    const now = Date.now();
    const createdAt = account.createdAt ? new Date(account.createdAt) : null;
    const accountAgeDays = createdAt
      ? Math.max(0, Math.floor((now - createdAt.getTime()) / 86400000))
      : null;
    const adminRoles = Array.isArray(account.admin?.roles)
      ? account.admin.roles
      : [];
    const permissions = Array.isArray(account.admin?.permissionSet)
      ? account.admin.permissionSet
      : [];
    const loginHistory = Array.isArray(account.security?.loginHistory)
      ? account.security.loginHistory
      : [];
    const latestLogin = [...loginHistory].sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime()
    )[0];
    const sessions = Array.isArray(account.security?.sessions)
      ? account.security.sessions
      : [];
    const activeSessions = sessions.filter((session) => {
      if (session.revokedAt) return false;
      return !session.expiresAt || new Date(session.expiresAt).getTime() > now;
    }).length;
    const orders = Array.isArray(account.shop?.orderHistory)
      ? account.shop.orderHistory
      : [];
    const paidOrders = orders.filter((order) =>
      ['paid', 'fulfilled'].includes(order.status)
    );
    const spendByCurrency = paidOrders.reduce((totals, order) => {
      const currency = order.total?.currency || 'GBP';
      totals[currency] =
        Number(totals[currency] || 0) + Number(order.total?.amount || 0);
      return totals;
    }, {});
    const totalSpend =
      Object.entries(spendByCurrency)
        .map(([currency, amount]) =>
          new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency
          }).format(Number(amount || 0) / 100)
        )
        .join(', ') || '-';
    const opalTransactions = Array.isArray(account.gameData?.opalTransactions)
      ? account.gameData.opalTransactions
      : [];
    const recentOpalTransactions =
      opalTransactions
        .slice(-3)
        .reverse()
        .map((transaction) =>
          [
            formatOePanelDateTime(transaction.createdAt),
            formatReportLabel(transaction.type),
            `${Number(transaction.amount || 0) >= 0 ? '+' : ''}${Number(transaction.amount || 0)}`,
            transaction.reason
          ]
            .filter(Boolean)
            .join(' · ')
        )
        .join('\n') || '-';
    const achievements = Array.isArray(account.gameData?.achievements)
      ? account.gameData.achievements
      : [];
    const unlocks = Array.isArray(account.gameData?.inGamePurchasesAndUnlocks)
      ? account.gameData.inGamePurchasesAndUnlocks
      : [];
    const relationships = Array.isArray(
      account.gameData?.friendsAndBlockedUsers
    )
      ? account.gameData.friendsAndBlockedUsers
      : [];
    const olings = account.olings || {};
    const eggCount = (olings.eggs || []).reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    const consumableCount = (olings.consumables || []).reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    const furnitureCount = (olings.furniture || []).reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    const lastSeenAt =
      account.analytics?.lastSeenAt || account.profile?.lastLoginAt;

    return {
      joined: account.createdAt
        ? new Date(account.createdAt).toLocaleDateString()
        : '-',
      date: account.createdAt
        ? new Date(account.createdAt).toISOString().slice(0, 10)
        : '-',
      user: account.username,
      email: account.email,
      displayName: account.profile?.displayName || '-',
      emailVerified: account.profile?.emailVerified ? 'Yes' : 'No',
      country: account.profile?.country || '-',
      language: account.profile?.preferredLanguage || '-',
      accountAge: accountAgeDays === null ? '-' : `${accountAgeDays} days`,
      role: getAccountRoleLabel(account),
      adminRoles: adminRoles.join(', ') || '-',
      permissions: permissions.join(', ') || '-',
      permissionCount: String(permissions.length),
      adminTwoFactor: account.admin?.twoFactorEnabled ? 'Enabled' : 'Disabled',
      status: formatReportLabel(account.profile?.accountStatus || 'active'),
      suspensionReason: account.profile?.suspensionReason || '-',
      suspensionExpires: formatOePanelDateTime(
        account.profile?.suspensionExpiresAt
      ),
      lastLogin: formatOePanelDateTime(account.profile?.lastLoginAt),
      lastSeen: formatOePanelDateTime(lastSeenAt),
      provider: providers.join(', ') || 'email',
      twoFactor: account.security?.twoFactorEnabled ? 'Enabled' : 'Disabled',
      failedLoginAttempts: String(account.security?.failedLoginAttempts || 0),
      lockoutExpires: formatOePanelDateTime(account.security?.lockoutExpiresAt),
      suspiciousActivity: account.security?.suspiciousActivityFlag
        ? 'Flagged'
        : 'No',
      compromisedPassword: account.security?.compromisedPasswordFlag
        ? 'Flagged'
        : 'No',
      activeSessions: String(activeSessions),
      latestLogin: latestLogin
        ? [
            formatOePanelDateTime(latestLogin.createdAt),
            formatReportLabel(latestLogin.provider),
            latestLogin.successful ? 'Successful' : 'Failed',
            latestLogin.device?.browser,
            latestLogin.device?.os,
            latestLogin.approximateLocation
          ]
            .filter(Boolean)
            .join(' · ')
        : '-',
      signupSource: signupContext.source
        ? formatReportLabel(signupContext.source)
        : '-',
      signupReferrer: signupContext.referrerPath || '-',
      signupCapturedAt: formatOePanelDateTime(signupContext.capturedAt),
      oeIcon: account.profile?.oeIcon || '-',
      opalsBalance: String(account.gameData?.opals?.balance || 0),
      opalsLifetimeEarned: String(account.gameData?.opals?.lifetimeEarned || 0),
      opalsLifetimeSpent: String(account.gameData?.opals?.lifetimeSpent || 0),
      opalTransactionCount: String(opalTransactions.length),
      recentOpalTransactions,
      orderCount: String(orders.length),
      paidOrderCount: String(paidOrders.length),
      totalSpend,
      purchasedProducts: String(account.shop?.purchasedProducts?.length || 0),
      digitalEntitlements: String(
        account.shop?.digitalProductAccess?.length || 0
      ),
      unlockCount: String(unlocks.length),
      achievements: String(achievements.length),
      level: String(account.gameData?.level || 1),
      xp: String(account.gameData?.xp || 0),
      gamesPlayed: String(account.gameData?.gamesPlayed || 0),
      roundsPlayed: String(account.gameData?.roundsPlayed || 0),
      playtime: formatDurationSeconds(
        account.gameData?.totalPlaytimeSeconds || 0
      ),
      lastGameMode: account.gameData?.lastActiveGameMode
        ? formatReportLabel(account.gameData.lastActiveGameMode)
        : '-',
      lastPlayed: formatOePanelDateTime(account.gameData?.lastPlayedAt),
      reputation: String(account.gameData?.reputationScore ?? 100),
      moderationStrikes: String(account.gameData?.moderationStrikes || 0),
      friends: String(
        relationships.filter(
          (relationship) => relationship.status === 'friends'
        ).length
      ),
      blockedUsers: String(
        relationships.filter(
          (relationship) => relationship.status === 'blocked'
        ).length
      ),
      olingCount: String(olings.olings?.length || 0),
      olingEggs: String(eggCount),
      olingConsumables: String(consumableCount),
      olingFurniture: String(furnitureCount),
      olingHatches: String(olings.hatchHistory?.length || 0),
      olingLabLevel: String(olings.lab?.roomLevel || 1),
      overexposurePosts: String(
        account.overexposure?.postsCreated?.length || 0
      ),
      reportsCreated: String(account.gameData?.reports?.length || 0),
      reportsReceived: String(enrichment.reportsReceived || 0),
      openReportsReceived: String(enrichment.openReportsReceived || 0),
      adminActionCount: String(enrichment.adminActionCount || 0),
      recentAdminActions: enrichment.recentAdminActions || '-',
      accountId: String(account._id)
    };
  }

  async function getDateCountMap(model, dateField, match = {}) {
    const results = await model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: `$${dateField}`
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    return Object.fromEntries(
      results.filter((day) => day._id).map((day) => [day._id, day.count])
    );
  }

  function mergeDateCountMaps(...maps) {
    return maps.reduce((merged, map) => {
      Object.entries(map || {}).forEach(([date, count]) => {
        merged[date] = (merged[date] || 0) + Number(count || 0);
      });
      return merged;
    }, {});
  }

  return {
    getAccountRoleLabel,
    serializeOePanelUser,
    getDateCountMap,
    mergeDateCountMaps
  };
}

module.exports = {
  createPanelUserContext
};

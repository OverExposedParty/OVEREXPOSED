const { getContentSyncHealth } = require('../../services/content-sync-health');
const {
  normalizeAchievementTaxonomy
} = require('../../../models/content/achievement-taxonomy');
const { createOePanelAchievementHelpers } = require('./achievement-helpers');

function registerOePanelAchievementListRoutes(context) {
  const { app } = context;
  const {
    formatAchievementPanelValue,
    serializeAchievementForPanel,
    createAchievementReviewAlerts,
    getContentSyncAlertsForArea
  } = createOePanelAchievementHelpers(context);

  with (context) {
    app.get('/api/oe-panel/achievements', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [
          storedAchievements,
          totalUsers,
          playersWithAchievements,
          unlockCounts,
          unlocksToday,
          recentUnlocks
        ] = await Promise.all([
          Achievement.find({}).sort({ sortOrder: 1, key: 1 }).lean(),
          Account.countDocuments({}),
          Account.countDocuments({
            'gameData.achievements.0': { $exists: true }
          }),
          Account.aggregate([
            { $unwind: '$gameData.achievements' },
            {
              $group: {
                _id: '$gameData.achievements.key',
                count: { $sum: 1 },
                lastUnlockedAt: { $max: '$gameData.achievements.unlockedAt' }
              }
            }
          ]),
          Account.aggregate([
            { $unwind: '$gameData.achievements' },
            {
              $match: {
                'gameData.achievements.unlockedAt': { $gte: todayStart }
              }
            },
            { $count: 'count' }
          ]),
          Account.aggregate([
            { $unwind: '$gameData.achievements' },
            { $sort: { 'gameData.achievements.unlockedAt': -1 } },
            { $limit: 100 },
            {
              $project: {
                username: '$username',
                email: '$email',
                accountId: '$_id',
                achievement: '$gameData.achievements'
              }
            }
          ])
        ]);

        const achievements = storedAchievements.map((achievement) => ({
          ...achievement,
          ...normalizeAchievementTaxonomy(achievement)
        }));
        const unlockCountsByKey = Object.fromEntries(
          unlockCounts.map((row) => [row._id, row.count])
        );
        const totalUnlocks = unlockCounts.reduce(
          (total, row) => total + Number(row.count || 0),
          0
        );
        const activeAchievements = achievements.filter(
          (achievement) =>
            achievement.enabled !== false && achievement.status === 'published'
        );
        const draftAchievements = achievements.filter(
          (achievement) => achievement.status === 'draft'
        );
        const archivedAchievements = achievements.filter(
          (achievement) => achievement.status === 'archived'
        );
        const library = achievements.map((achievement) =>
          serializeAchievementForPanel(
            achievement,
            unlockCountsByKey[achievement.key] || 0
          )
        );
        const analytics = achievements
          .map((achievement) => {
            const unlocks = Number(unlockCountsByKey[achievement.key] || 0);
            const unlockRate = totalUsers
              ? `${Math.round((unlocks / totalUsers) * 100)}%`
              : '0%';

            return {
              key: achievement.key || '-',
              achievement: achievement.name || achievement.key || '-',
              category: achievement.category || '-',
              subcategory: achievement.subcategory || '-',
              rarity: achievement.rarity || '-',
              unlocks: String(unlocks),
              unlockRate,
              active: achievement.enabled !== false ? 'Yes' : 'No',
              status: achievement.status || '-'
            };
          })
          .sort((left, right) => Number(right.unlocks) - Number(left.unlocks));
        const playerProgress = recentUnlocks.map((row) => ({
          user: row.username || row.email || '-',
          accountId: String(row.accountId || ''),
          achievement: row.achievement?.key || '-',
          gamemode: row.achievement?.gamemode || '-',
          source: row.achievement?.source || '-',
          progress: formatAchievementPanelValue(
            row.achievement?.progressAtUnlock
          ),
          unlockedAt: formatOePanelDateTime(row.achievement?.unlockedAt),
          rewardStatus:
            row.achievement?.rewardStatus ||
            (row.achievement?.rewardGranted ? 'granted' : 'none'),
          partyId: row.achievement?.partyId || '-'
        }));
        const triggers = achievements.map((achievement) => ({
          key: achievement.key || '-',
          achievement: achievement.name || achievement.key || '-',
          requirementType: achievement.requirementType || 'event',
          eventType: achievement.eventType || '-',
          statPath: achievement.statPath || '-',
          statKey: achievement.statKey || '-',
          requirementValue: String(achievement.requirementValue ?? 1),
          minPlayers: String(achievement.minPlayers ?? 0),
          status: achievement.status || '-'
        }));
        const contentSync = await getContentSyncHealth(context.models || {});
        const reviewAlerts = [
          ...getContentSyncAlertsForArea(contentSync, 'Achievements'),
          ...createAchievementReviewAlerts(achievements, unlockCountsByKey)
        ];

        res.apiSuccess({
          data: {
            stats: {
              totalAchievements: achievements.length,
              activeAchievements: activeAchievements.length,
              draftAchievements: draftAchievements.length,
              archivedAchievements: archivedAchievements.length,
              totalUnlocks,
              unlocksToday: unlocksToday[0]?.count || 0,
              playersWithAchievements,
              reviewItems: reviewAlerts.length
            },
            library,
            analytics,
            playerProgress,
            triggers,
            reviewAlerts
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel achievements:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_achievements_fetch_failed',
          message: 'Failed to fetch achievements'
        });
      }
    });
  }
}

module.exports = { registerOePanelAchievementListRoutes };

function registerOePanelSocialMediaListRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/oe-panel/social-media', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const platform = String(req.query.platform || 'all').toLowerCase();
        const query = { 'system.archivedAt': null };
        if (
          platform !== 'all' &&
          SocialContentItem.PLATFORMS.includes(platform)
        ) {
          query.platforms = platform;
        }

        const items = await SocialContentItem.find(query)
          .sort({ 'schedule.plannedFor': 1, 'system.createdAt': -1 })
          .limit(250)
          .lean();
        const rows = items.map(serializeSocialContentItem);
        const now = new Date();
        const platformCounts = rows.reduce((counts, item) => {
          item.platforms.forEach((itemPlatform) => {
            counts[itemPlatform] = Number(counts[itemPlatform] || 0) + 1;
          });

          return counts;
        }, {});
        const ideaItems = rows.filter((item) => item.status === 'idea');
        const draftItems = rows.filter((item) => item.status === 'draft');
        const readyItems = rows.filter((item) => item.status === 'ready');
        const scheduledItems = rows.filter(
          (item) => item.status === 'scheduled'
        );
        const uploadedItems = rows.filter((item) => item.status === 'uploaded');
        const alertItems = rows
          .filter(
            (item) =>
              (item.status === 'ready' && !item.scheduledFor) ||
              (item.status === 'draft' && !item.hook && !item.caption)
          )
          .slice(0, 8)
          .map((item) => ({
            title: item.title || item.platforms.join(', '),
            meta: `${item.platforms.join(', ') || '-'} | ${item.status}`,
            severity: 'medium',
            detail:
              item.status === 'ready'
                ? 'Ready content needs a calendar slot'
                : 'Draft needs a hook or caption',
            containerType: 'social-content',
            'container-type': 'social-content',
            id: item.id
          }));
        const nextPost = scheduledItems
          .filter(
            (item) => item.scheduledFor && new Date(item.scheduledFor) >= now
          )
          .sort(
            (left, right) =>
              new Date(left.scheduledFor).getTime() -
              new Date(right.scheduledFor).getTime()
          )[0];

        res.apiSuccess({
          data: {
            rows,
            stats: {
              totalItems: rows.length,
              ideaItems: ideaItems.length,
              draftItems: draftItems.length,
              readyItems: readyItems.length,
              scheduledItems: scheduledItems.length,
              uploadedItems: uploadedItems.length,
              nextPostDate: nextPost?.postDate || '-',
              platformCounts
            },
            alerts: alertItems,
            platforms: SocialContentItem.PLATFORMS
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch social media panel:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_social_media_fetch_failed',
          message: 'Failed to fetch social media panel data'
        });
      }
    });
  }
}

module.exports = { registerOePanelSocialMediaListRoutes };

function registerOePanelSocialMediaDeleteRoutes(context) {
  const { app } = context;

  with (context) {
    app.delete('/api/oe-panel/social-media/:id', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'social_media.delete')) {
          return;
        }

        const currentItem = await SocialContentItem.findById(
          req.params.id
        ).lean();
        if (!currentItem) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_social_media_not_found',
            message: 'Social media item not found'
          });
        }

        const item = await SocialContentItem.findByIdAndUpdate(
          req.params.id,
          {
            $set: {
              'system.archivedAt': new Date(),
              'system.updatedAt': new Date()
            },
            $push: {
              log: {
                action: 'deleted',
                adminId: account?.developmentBypass
                  ? null
                  : account?._id || null,
                message: `Deleted from OE Social Media panel by ${
                  account?.developmentBypass ? 'Development' : account.username
                }.`
              }
            }
          },
          { new: true }
        );

        await createAdminLog(AdminLog, account, {
          action: 'Deleted social content',
          area: 'Social Media',
          target: {
            type: 'social_content',
            id: String(item._id),
            label: item.idea?.title || String(item._id)
          },
          previousValue: {
            title: currentItem.idea?.title,
            status: currentItem.status,
            platforms: currentItem.platforms
          },
          newValue: 'Archived',
          severity: 'high',
          metadata: {
            collection: 'social-content',
            archivedAt: item.system?.archivedAt
          }
        });

        res.apiSuccess({ message: 'Social media item deleted' });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to delete social media item:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_social_media_delete_failed',
          message: 'Failed to delete social media item'
        });
      }
    });
  }
}

module.exports = { registerOePanelSocialMediaDeleteRoutes };

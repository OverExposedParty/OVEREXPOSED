function registerOePanelSocialMediaUpdateRoutes(context) {
  const { app } = context;

  with (context) {
    app.patch('/api/oe-panel/social-media/:id', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const set = {};
        const allowedStringFields = {
          status: 'status',
          type: 'type',
          title: 'idea.title',
          hook: 'idea.hook',
          angle: 'idea.angle',
          prompt: 'idea.prompt',
          notes: 'idea.notes',
          caption: 'content.caption',
          script: 'content.script',
          callToAction: 'content.callToAction'
        };

        Object.entries(allowedStringFields).forEach(
          ([bodyKey, documentKey]) => {
            if (!Object.prototype.hasOwnProperty.call(req.body, bodyKey))
              return;
            set[documentKey] = String(req.body[bodyKey] || '').trim();
          }
        );

        if (Object.prototype.hasOwnProperty.call(req.body, 'hashtags')) {
          set['content.hashtags'] = String(req.body.hashtags || '')
            .split(',')
            .map((tag) => tag.trim().replace(/^#/, ''))
            .filter(Boolean);
        }

        if (
          set.status &&
          !SocialContentItem.STATUSES.includes(String(set.status).toLowerCase())
        ) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_status_invalid',
            message: 'Status is invalid'
          });
        }

        if (set.status) {
          set.status = String(set.status).toLowerCase();
        }

        if (
          Object.prototype.hasOwnProperty.call(set, 'idea.title') &&
          !set['idea.title']
        ) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_required_fields',
            message: 'Title is required'
          });
        }

        if (!Object.keys(set).length) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_no_changes',
            message: 'Choose at least one editable field to update'
          });
        }

        set['system.updatedAt'] = new Date();

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
            $set: set,
            $push: {
              log: {
                action: 'updated',
                adminId: account?.developmentBypass
                  ? null
                  : account?._id || null,
                message: 'Updated from OE Social Media panel.'
              }
            }
          },
          { new: true }
        );

        await createAdminLog(AdminLog, account, {
          action: 'Edited social content',
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
          newValue: set,
          severity: 'medium',
          metadata: {
            collection: 'social-content',
            changedFields: Object.keys(set).filter(
              (field) => field !== 'system.updatedAt'
            )
          }
        });

        res.apiSuccess({ data: { row: serializeSocialContentItem(item) } });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update social content:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_social_media_update_failed',
          message: 'Failed to update social content'
        });
      }
    });
  }
}

module.exports = { registerOePanelSocialMediaUpdateRoutes };

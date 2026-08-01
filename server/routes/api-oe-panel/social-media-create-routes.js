function registerOePanelSocialMediaCreateRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/oe-panel/social-media', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const platforms = normalizeSocialPlatforms(req.body.platforms);
        const status = String(req.body.status || 'draft').toLowerCase();
        const title = String(req.body.title || '').trim();
        const postDate = String(req.body.postDate || '').trim();
        const postTime = String(req.body.postTime || '').trim();
        const plannedFor = postDate
          ? new Date(`${postDate}T${postTime || '09:00'}:00`)
          : null;
        const hasValidPlannedFor =
          plannedFor && !Number.isNaN(plannedFor.getTime());

        if (!platforms.length) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_platform_invalid',
            message: 'Choose at least one valid platform'
          });
        }

        if (!SocialContentItem.STATUSES.includes(status)) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_status_invalid',
            message: 'Status is invalid'
          });
        }

        if (!title || (status === 'scheduled' && !hasValidPlannedFor)) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_social_media_required_fields',
            message: 'Title is required, and scheduled content needs a date'
          });
        }

        const item = await SocialContentItem.create({
          platforms,
          status,
          type: String(req.body.type || '').trim(),
          idea: {
            title,
            hook: String(req.body.hook || '').trim(),
            angle: String(req.body.angle || '').trim(),
            prompt: String(req.body.prompt || '').trim(),
            notes: String(req.body.notes || '').trim(),
            sourceType: String(req.body.sourceType || '').trim(),
            sourceUrl: String(req.body.sourceUrl || '').trim()
          },
          content: {
            caption: String(req.body.caption || '').trim(),
            script: String(req.body.script || '').trim(),
            hashtags: String(req.body.hashtags || '')
              .split(',')
              .map((tag) => tag.trim().replace(/^#/, ''))
              .filter(Boolean),
            callToAction: String(req.body.callToAction || '').trim(),
            generatedText: String(req.body.generatedText || '').trim()
          },
          schedule: {
            plannedFor: hasValidPlannedFor ? plannedFor : null,
            postTime,
            timezone: req.body.timezone || 'Europe/London'
          },
          log: [
            {
              action: 'created',
              adminId: account?.developmentBypass ? null : account?._id || null,
              message: 'Created from OE Social Media panel.'
            }
          ],
          system: {
            createdBy: account?.developmentBypass ? null : account?._id || null
          }
        });

        await createAdminLog(AdminLog, account, {
          action: 'Created social content',
          area: 'Social Media',
          target: {
            type: 'social_content',
            id: String(item._id),
            label: item.idea?.title || String(item._id)
          },
          previousValue: '-',
          newValue: {
            title: item.idea?.title,
            status: item.status,
            platforms: item.platforms,
            plannedFor: item.schedule?.plannedFor
          },
          severity: 'medium',
          metadata: {
            collection: 'social-content',
            platforms: item.platforms
          }
        });

        res.apiSuccess({ data: serializeSocialContentItem(item) }, 201);
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to create social content:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_social_media_create_failed',
          message: 'Failed to create social content'
        });
      }
    });
  }
}

module.exports = { registerOePanelSocialMediaCreateRoutes };

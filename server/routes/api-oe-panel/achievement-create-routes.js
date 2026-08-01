const { createOePanelAchievementHelpers } = require('./achievement-helpers');

function registerOePanelAchievementCreateRoutes(context) {
  const { app } = context;
  const {
    createAchievementCreatePayload,
    saveAchievementSvgUpload,
    serializeAchievementForPanel
  } = createOePanelAchievementHelpers(context);

  with (context) {
    app.post(
      '/api/oe-panel/achievements',
      OE_PANEL_SVG_UPLOAD.single('svg'),
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;

          const { achievement, error } = createAchievementCreatePayload(
            req.body || {}
          );
          if (error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_achievement_create_invalid',
              message: error
            });
          }

          const existingAchievement = await Achievement.exists({
            key: achievement.key
          });
          if (existingAchievement) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_achievement_duplicate',
              message: 'An achievement with this key already exists.'
            });
          }

          const savedSvg = saveAchievementSvgUpload({
            file: req.file,
            key: achievement.key,
            category: achievement.category,
            subcategory: achievement.subcategory,
            gamemode: achievement.gamemode
          });
          if (savedSvg.error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_achievement_svg_invalid',
              message: savedSvg.error
            });
          }
          achievement.image = savedSvg.filePath;

          const createdAchievement = await Achievement.create(achievement);
          await exportAchievementsToJson(Achievement);
          await createAdminLog(AdminLog, account, {
            action: 'Created achievement',
            area: 'Achievements',
            target: {
              type: 'achievement',
              id: createdAchievement.key,
              label: createdAchievement.name || createdAchievement.key
            },
            previousValue: '-',
            newValue: {
              key: createdAchievement.key,
              name: createdAchievement.name,
              status: createdAchievement.status,
              enabled: createdAchievement.enabled
            },
            severity: 'medium',
            metadata: {
              collection: 'achievements',
              uploadedSvg: savedSvg.filePath
            }
          });

          res.apiSuccess(
            {
              data: {
                row: serializeAchievementForPanel(
                  createdAchievement.toObject(),
                  0
                )
              }
            },
            201
          );
        } catch (err) {
          if (err?.code === 11000) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_achievement_duplicate',
              message: 'An achievement with this key already exists.'
            });
          }

          console.error(`[REQ ${req.id}] Failed to create achievement:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_achievement_create_failed',
            message: 'Failed to create achievement'
          });
        }
      }
    );
  }
}

module.exports = { registerOePanelAchievementCreateRoutes };

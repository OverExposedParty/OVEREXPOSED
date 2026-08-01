function registerOePanelCustomisationPackRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/oe-panel/oe-customisation/packs', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const { pack, error } = createOeCustomisationPackCreatePayload(
          req.body || {}
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_customisation_pack_create_invalid',
            message: error
          });
        }

        const createdPack = await OeCustomisation.create(pack);
        await createAdminLog(AdminLog, account, {
          action: 'Created OE pack',
          area: 'OE Customisation',
          target: {
            type: 'oe_pack',
            id: createdPack.slug,
            label: createdPack.title || createdPack.slug
          },
          previousValue: '-',
          newValue: {
            slug: createdPack.slug,
            title: createdPack.title,
            prefix: createdPack.prefix,
            status: createdPack.status
          },
          severity: 'medium',
          metadata: {
            collection: 'oe-customisation',
            recordType: 'pack'
          }
        });

        res.apiSuccess({
          data: {
            row: serializeOeCustomisationPackForPanel(createdPack.toObject(), 0)
          }
        });
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_customisation_pack_duplicate',
            message: 'An OE pack with this slug already exists.'
          });
        }

        console.error(`[REQ ${req.id}] Failed to create OE pack:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_customisation_pack_create_failed',
          message: 'Failed to create OE pack'
        });
      }
    });

    app.patch(
      '/api/oe-panel/oe-customisation/packs/:slug',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;

          const { update, error } = createOeCustomisationPackUpdatePayload(
            req.body || {}
          );
          if (error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_pack_update_invalid',
              message: error
            });
          }

          const currentPack = await OeCustomisation.findOne({
            recordType: 'pack',
            slug: req.params.slug
          }).lean();
          if (!currentPack) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_customisation_pack_not_found',
              message: 'OE pack not found'
            });
          }

          const updatedPack = await OeCustomisation.findOneAndUpdate(
            { recordType: 'pack', slug: req.params.slug },
            { $set: update },
            { new: true, runValidators: true }
          ).lean();

          if (update.slug && update.slug !== currentPack.slug) {
            await OeCustomisation.updateMany(
              { recordType: 'image', packSlug: currentPack.slug },
              { $set: { packSlug: update.slug } }
            );
          }
          await createAdminLog(AdminLog, account, {
            action: 'Edited OE pack',
            area: 'OE Customisation',
            target: {
              type: 'oe_pack',
              id: updatedPack.slug,
              label: updatedPack.title || updatedPack.slug
            },
            previousValue: {
              slug: currentPack.slug,
              title: currentPack.title,
              prefix: currentPack.prefix,
              status: currentPack.status,
              enabled: currentPack.enabled
            },
            newValue: update,
            severity: 'medium',
            metadata: {
              collection: 'oe-customisation',
              recordType: 'pack',
              changedFields: Object.keys(update)
            }
          });

          const imageCount = await OeCustomisation.countDocuments({
            recordType: 'image',
            packSlug: updatedPack.slug
          });

          res.apiSuccess({
            data: {
              row: serializeOeCustomisationPackForPanel(updatedPack, imageCount)
            }
          });
        } catch (err) {
          if (err?.code === 11000) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_customisation_pack_duplicate',
              message: 'An OE pack with this slug already exists.'
            });
          }

          console.error(`[REQ ${req.id}] Failed to update OE pack:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_customisation_pack_update_failed',
            message: 'Failed to update OE pack'
          });
        }
      }
    );

    app.delete(
      '/api/oe-panel/oe-customisation/packs/:slug',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;
          if (
            !requireOePanelPermission(account, res, 'oe_customisation.delete')
          ) {
            return;
          }

          const deletedPack = await OeCustomisation.findOneAndDelete({
            recordType: 'pack',
            slug: req.params.slug
          }).lean();

          if (!deletedPack) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_customisation_pack_not_found',
              message: 'OE pack not found'
            });
          }

          const deletedImageCount = await OeCustomisation.countDocuments({
            recordType: 'image',
            packSlug: deletedPack.slug
          });
          await OeCustomisation.deleteMany({
            recordType: 'image',
            packSlug: deletedPack.slug
          });
          await createAdminLog(AdminLog, account, {
            action: 'Deleted OE pack',
            area: 'OE Customisation',
            target: {
              type: 'oe_pack',
              id: deletedPack.slug,
              label: deletedPack.title || deletedPack.slug
            },
            previousValue: {
              slug: deletedPack.slug,
              title: deletedPack.title,
              prefix: deletedPack.prefix,
              childImages: deletedImageCount
            },
            newValue: 'Deleted',
            severity: 'high',
            metadata: {
              collection: 'oe-customisation',
              recordType: 'pack',
              deletedImageCount
            }
          });

          res.apiSuccess({ message: 'OE pack deleted' });
        } catch (err) {
          console.error(`[REQ ${req.id}] Failed to delete OE pack:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_customisation_pack_delete_failed',
            message: 'Failed to delete OE pack'
          });
        }
      }
    );
  }
}

module.exports = { registerOePanelCustomisationPackRoutes };

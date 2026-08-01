const {
  registerOePanelCustomisationPackRoutes
} = require('./api-oe-panel/customisation-pack-routes');

function registerOePanelCustomisationRoutes(context) {
  const { app } = context;

  with (context) {
    app.get('/api/oe-panel/oe-customisation', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const [packs, images] = await Promise.all([
          OeCustomisation.find({ recordType: 'pack' }).sort({ slug: 1 }).lean(),
          OeCustomisation.find({ recordType: 'image' })
            .sort({ packSlug: 1, oeId: 1 })
            .lean()
        ]);
        const imageCountsByPack = images.reduce((counts, image) => {
          counts[image.packSlug] = Number(counts[image.packSlug] || 0) + 1;
          return counts;
        }, {});
        const issues = getOeCustomisationIssues({ packs, images });
        const activePacks = packs.filter(
          (pack) => pack.enabled && pack.status === 'published'
        );
        const blacklistedImages = images.filter((image) => image.blacklist);
        const packRows = packs.map((pack) =>
          serializeOeCustomisationPackForPanel(
            pack,
            imageCountsByPack[pack.slug] || 0
          )
        );
        const imageRows = images.map(serializeOeCustomisationImageForPanel);

        res.apiSuccess({
          data: {
            stats: {
              totalPacks: packs.length,
              totalImages: images.length,
              issueCount: issues.length,
              blacklistedImages: blacklistedImages.length,
              activePacks: activePacks.length
            },
            packs: packRows,
            images: imageRows,
            galleryItems: imageRows,
            issues
          }
        });
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to fetch OE Panel customisation:`,
          err
        );
        res.apiError({
          status: 500,
          code: 'oe_panel_customisation_fetch_failed',
          message: 'Failed to fetch OE customisation'
        });
      }
    });

    registerOePanelCustomisationPackRoutes(context);

    app.post(
      '/api/oe-panel/oe-customisation/images',
      OE_PANEL_SVG_UPLOAD.single('svg'),
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;

          const folder = normalizeOeCustomisationImageFolder(
            req.body?.filePath
          );
          if (folder.error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_image_folder_invalid',
              message: folder.error
            });
          }
          const savedSvg = saveOeCustomisationSvgUpload({
            file: req.file,
            folderPath: folder.folderPath,
            resolvedFolder: folder.resolvedFolder,
            name: req.body?.name
          });
          if (savedSvg.error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_image_svg_invalid',
              message: savedSvg.error
            });
          }
          req.body.filePath = savedSvg.filePath;

          const { image, error } = createOeCustomisationImageCreatePayload(
            req.body || {}
          );
          if (error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_image_create_invalid',
              message: error
            });
          }

          const packExists = await OeCustomisation.exists({
            recordType: 'pack',
            slug: image.packSlug
          });
          if (!packExists) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_image_pack_missing',
              message: 'The selected OE pack does not exist.'
            });
          }

          const createdImage = await OeCustomisation.create(image);
          await createAdminLog(AdminLog, account, {
            action: 'Created OE image',
            area: 'OE Customisation',
            target: {
              type: 'oe_image',
              id: createdImage.oeId,
              label: createdImage.name || createdImage.oeId
            },
            previousValue: '-',
            newValue: {
              oeId: createdImage.oeId,
              name: createdImage.name,
              packSlug: createdImage.packSlug,
              slot: createdImage.slot,
              filePath: createdImage.filePath
            },
            severity: 'medium',
            metadata: {
              collection: 'oe-customisation',
              recordType: 'image',
              uploadedSvg: savedSvg.filePath
            }
          });

          res.apiSuccess({
            data: {
              row: serializeOeCustomisationImageForPanel(
                createdImage.toObject()
              )
            }
          });
        } catch (err) {
          if (err?.code === 11000) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_customisation_image_duplicate',
              message: 'An OE image with this OE ID already exists.'
            });
          }

          console.error(`[REQ ${req.id}] Failed to create OE image:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_customisation_image_create_failed',
            message: 'Failed to create OE image'
          });
        }
      }
    );

    app.patch(
      '/api/oe-panel/oe-customisation/images/:oeId',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;

          const { update, error } = createOeCustomisationImageUpdatePayload(
            req.body || {}
          );
          if (error) {
            return res.apiError({
              status: 400,
              code: 'oe_panel_customisation_image_update_invalid',
              message: error
            });
          }

          if (update.packSlug) {
            const packExists = await OeCustomisation.exists({
              recordType: 'pack',
              slug: update.packSlug
            });
            if (!packExists) {
              return res.apiError({
                status: 400,
                code: 'oe_panel_customisation_image_pack_missing',
                message: 'The selected OE pack does not exist.'
              });
            }
          }

          const currentImage = await OeCustomisation.findOne({
            recordType: 'image',
            oeId: req.params.oeId
          }).lean();
          if (!currentImage) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_customisation_image_not_found',
              message: 'OE image not found'
            });
          }

          const updatedImage = await OeCustomisation.findOneAndUpdate(
            { recordType: 'image', oeId: req.params.oeId },
            { $set: update },
            { new: true, runValidators: true }
          ).lean();

          await createAdminLog(AdminLog, account, {
            action: 'Edited OE image',
            area: 'OE Customisation',
            target: {
              type: 'oe_image',
              id: updatedImage.oeId,
              label: updatedImage.name || updatedImage.oeId
            },
            previousValue: {
              oeId: currentImage.oeId,
              name: currentImage.name,
              packSlug: currentImage.packSlug,
              slot: currentImage.slot,
              status: currentImage.status,
              enabled: currentImage.enabled,
              blacklist: currentImage.blacklist,
              filePath: currentImage.filePath
            },
            newValue: update,
            severity: 'medium',
            metadata: {
              collection: 'oe-customisation',
              recordType: 'image',
              changedFields: Object.keys(update)
            }
          });

          res.apiSuccess({
            data: { row: serializeOeCustomisationImageForPanel(updatedImage) }
          });
        } catch (err) {
          if (err?.code === 11000) {
            return res.apiError({
              status: 409,
              code: 'oe_panel_customisation_image_duplicate',
              message: 'An OE image with this OE ID already exists.'
            });
          }

          console.error(`[REQ ${req.id}] Failed to update OE image:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_customisation_image_update_failed',
            message: 'Failed to update OE image'
          });
        }
      }
    );

    app.delete(
      '/api/oe-panel/oe-customisation/images/:oeId',
      async (req, res) => {
        try {
          const account = await requireOePanelAccount(req, res);
          if (!account) return;
          if (
            !requireOePanelPermission(account, res, 'oe_customisation.delete')
          ) {
            return;
          }

          const deletedImage = await OeCustomisation.findOneAndDelete({
            recordType: 'image',
            oeId: req.params.oeId
          }).lean();

          if (!deletedImage) {
            return res.apiError({
              status: 404,
              code: 'oe_panel_customisation_image_not_found',
              message: 'OE image not found'
            });
          }

          await createAdminLog(AdminLog, account, {
            action: 'Deleted OE image',
            area: 'OE Customisation',
            target: {
              type: 'oe_image',
              id: deletedImage.oeId,
              label: deletedImage.name || deletedImage.oeId
            },
            previousValue: {
              oeId: deletedImage.oeId,
              name: deletedImage.name,
              packSlug: deletedImage.packSlug,
              slot: deletedImage.slot,
              filePath: deletedImage.filePath
            },
            newValue: 'Deleted',
            severity: 'high',
            metadata: {
              collection: 'oe-customisation',
              recordType: 'image'
            }
          });

          res.apiSuccess({ message: 'OE image deleted' });
        } catch (err) {
          console.error(`[REQ ${req.id}] Failed to delete OE image:`, err);
          res.apiError({
            status: 500,
            code: 'oe_panel_customisation_image_delete_failed',
            message: 'Failed to delete OE image'
          });
        }
      }
    );
  }
}

module.exports = { registerOePanelCustomisationRoutes };

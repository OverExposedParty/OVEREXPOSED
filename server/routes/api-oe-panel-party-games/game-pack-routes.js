function registerOePanelGamePackRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/oe-panel/game-packs', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const { pack, error } = createGamePackCreatePayload(req.body || {});
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_pack_create_invalid',
            message: error
          });
        }

        const createdPack = await GamePack.create(pack);
        await createAdminLog(AdminLog, account, {
          action: 'Created game pack',
          area: 'Party Games',
          target: {
            type: 'game_pack',
            id: `${createdPack.gameType}:${createdPack.slug}`,
            label: createdPack.title || formatPartyGameLabel(createdPack.slug)
          },
          previousValue: '-',
          newValue: {
            gameType: createdPack.gameType,
            slug: createdPack.slug,
            title: createdPack.title,
            questionCount: createdPack.questions?.length || 0
          },
          severity: 'medium',
          metadata: {
            collection: 'game-packs',
            gamemode: createdPack.gameType
          }
        });

        await createGamemodeSettingsAlert(account, {
          action: 'created',
          itemType: 'pack',
          itemKey: `${createdPack.gameType}:${createdPack.slug}`,
          title: createdPack.title || formatPartyGameLabel(createdPack.slug),
          gamemode: createdPack.gameType,
          changes: ['created']
        });

        res.apiSuccess(
          { data: { row: serializePartyPackForPanel(createdPack.toObject()) } },
          201
        );
      } catch (err) {
        if (err?.code === 11000) {
          return res.apiError({
            status: 409,
            code: 'oe_panel_game_pack_duplicate',
            message: 'A pack with this gamemode and slug already exists.'
          });
        }

        console.error(`[REQ ${req.id}] Failed to create game pack:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_pack_create_failed',
          message: 'Failed to create game pack'
        });
      }
    });

    app.get('/api/oe-panel/game-packs/:packKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const parsedKey = parseCompositePartyContentKey(req.params.packKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_pack_key_required',
            message: 'Pack key is required'
          });
        }

        const pack = await GamePack.findOne({
          gameType: parsedKey.gameType,
          slug: parsedKey.itemKey
        }).lean();
        if (!pack) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_pack_not_found',
            message: 'Game pack not found'
          });
        }

        const panelPack = serializePartyPackForPanel(pack);
        const editableColour = (value) =>
          /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? value : '';
        res.apiSuccess({
          data: {
            pack: {
              key: panelPack.key,
              gameType: pack.gameType,
              slug: pack.slug,
              title: pack.title,
              description: pack.description || '',
              status: pack.status,
              active: pack.enabled ? 'yes' : 'no',
              availabilityMode: panelPack.availabilityMode,
              availabilityTimeZone: panelPack.availabilityTimeZone,
              availableFrom:
                panelPack.availableFrom === '-' ? '' : panelPack.availableFrom,
              availableUntil:
                panelPack.availableUntil === '-'
                  ? ''
                  : panelPack.availableUntil,
              difficulty: pack.difficulty || '',
              restriction: pack.restriction || '',
              colour: editableColour(pack.assets?.colour),
              secondaryColour: editableColour(pack.assets?.secondaryColour),
              questions: Array.isArray(pack.questions)
                ? pack.questions.map((question) => ({
                    question: question.question,
                    type: question.type || null,
                    alternatives: Array.isArray(question.alternatives)
                      ? question.alternatives
                      : [],
                    punishment: question.punishment || null
                  }))
                : []
            }
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to fetch game pack:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_pack_fetch_failed',
          message: 'Failed to fetch game pack'
        });
      }
    });

    app.patch('/api/oe-panel/game-packs/:packKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;

        const parsedKey = parseCompositePartyContentKey(req.params.packKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_pack_key_required',
            message: 'Pack key is required'
          });
        }

        const currentPack = await GamePack.findOne({
          gameType: parsedKey.gameType,
          slug: parsedKey.itemKey
        }).lean();
        if (!currentPack) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_pack_not_found',
            message: 'Game pack not found'
          });
        }

        const { update, error } = createGamePackUpdatePayload(
          req.body || {},
          currentPack
        );
        if (error) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_pack_update_invalid',
            message: error
          });
        }

        const updatedPack = await GamePack.findOneAndUpdate(
          { gameType: parsedKey.gameType, slug: parsedKey.itemKey },
          { $set: update },
          { new: true, runValidators: true }
        ).lean();

        await createGamemodeSettingsAlert(account, {
          action: getGamemodeSettingsAlertAction(req.body || {}),
          itemType: 'pack',
          itemKey: `${updatedPack.gameType}:${updatedPack.slug}`,
          title: updatedPack.title || formatPartyGameLabel(updatedPack.slug),
          gamemode: updatedPack.gameType,
          changes: Object.keys(req.body || {})
        });
        await createAdminLog(AdminLog, account, {
          action: 'Edited game pack',
          area: 'Party Games',
          target: {
            type: 'game_pack',
            id: `${updatedPack.gameType}:${updatedPack.slug}`,
            label: updatedPack.title || formatPartyGameLabel(updatedPack.slug)
          },
          previousValue: {
            title: currentPack.title,
            status: currentPack.status,
            enabled: currentPack.enabled,
            questionCount: currentPack.questions?.length || 0
          },
          newValue: update,
          severity: 'medium',
          metadata: {
            collection: 'game-packs',
            gamemode: updatedPack.gameType,
            changedFields: Object.keys(update)
          }
        });

        res.apiSuccess({
          data: { row: serializePartyPackForPanel(updatedPack) }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to update game pack:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_pack_update_failed',
          message: 'Failed to update game pack'
        });
      }
    });

    app.delete('/api/oe-panel/game-packs/:packKey', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.delete')) {
          return;
        }

        const parsedKey = parseCompositePartyContentKey(req.params.packKey);
        if (!parsedKey) {
          return res.apiError({
            status: 400,
            code: 'oe_panel_game_pack_key_required',
            message: 'Pack key is required'
          });
        }

        const deletedPack = await GamePack.findOneAndDelete({
          gameType: parsedKey.gameType,
          slug: parsedKey.itemKey
        });

        if (!deletedPack) {
          return res.apiError({
            status: 404,
            code: 'oe_panel_game_pack_not_found',
            message: 'Game pack not found'
          });
        }

        await createGamemodeSettingsAlert(account, {
          action: 'deleted',
          itemType: 'pack',
          itemKey: `${deletedPack.gameType}:${deletedPack.slug}`,
          title: deletedPack.title || formatPartyGameLabel(deletedPack.slug),
          gamemode: deletedPack.gameType,
          severity: 'warning'
        });
        await createAdminLog(AdminLog, account, {
          action: 'Deleted game pack',
          area: 'Party Games',
          target: {
            type: 'game_pack',
            id: `${deletedPack.gameType}:${deletedPack.slug}`,
            label: deletedPack.title || formatPartyGameLabel(deletedPack.slug)
          },
          previousValue: {
            title: deletedPack.title,
            status: deletedPack.status,
            enabled: deletedPack.enabled,
            questionCount: deletedPack.questions?.length || 0
          },
          newValue: 'Deleted',
          severity: 'high',
          metadata: {
            collection: 'game-packs',
            gamemode: deletedPack.gameType
          }
        });

        res.apiSuccess({ message: 'Game pack deleted' });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to delete game pack:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_pack_delete_failed',
          message: 'Failed to delete game pack'
        });
      }
    });

    app.post('/api/oe-panel/game-packs/export', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'party_games.export')) {
          return;
        }

        const exported = await exportGamePacksToJson(GamePack);
        await GamemodeSettingsAlert.updateMany(
          getGamemodeSettingsAlertQuery('export-needed'),
          {
            $set: {
              exportNeeded: false,
              resolvedAt: new Date()
            }
          }
        )
          .where('itemType')
          .equals('pack');
        await createAdminLog(AdminLog, account, {
          action: 'Exported game packs',
          area: 'Party Games',
          target: {
            type: 'game_pack_export',
            id: 'game-packs',
            label: 'Game packs JSON export'
          },
          previousValue: 'Export needed alerts unresolved',
          newValue: `Exported ${exported.length} game packs`,
          severity: 'low',
          metadata: {
            exportedCount: exported.length
          }
        });
        res.apiSuccess({
          data: {
            message: `Exported ${exported.length} game packs to JSON.`
          }
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to export game packs:`, err);
        res.apiError({
          status: 500,
          code: 'oe_panel_game_pack_export_failed',
          message: 'Failed to export game packs'
        });
      }
    });
  }
}

module.exports = { registerOePanelGamePackRoutes };

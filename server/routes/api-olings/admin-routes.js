function registerOlingAdminRoutes(context) {
  const {
    app,
    requireAdminOlingTarget,
    serializeAdminOlingRoom,
    hatchOling,
    models,
    createAdminLog,
    OlingHatchReceipt,
    serializeHatchReceipt
  } = context;

  app.get('/api/olings/admin/room', async (req, res) => {
    try {
      const context = await requireAdminOlingTarget(req, res);
      if (!context) return;

      res.apiSuccess({
        room: serializeAdminOlingRoom(context.targetAccount, context.olingState)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch admin Oling room:`, err);
      res.apiError({
        status: 500,
        code: 'oling_admin_room_fetch_failed',
        message: 'Failed to fetch Oling room.'
      });
    }
  });

  app.get('/api/olings/admin/hatch-preview', async (req, res) => {
    try {
      const context = await requireAdminOlingTarget(req, res);
      if (!context) return;

      const room = serializeAdminOlingRoom(
        context.targetAccount,
        context.olingState
      );
      if (!room.currentEgg) {
        return res.apiError({
          status: 409,
          code: 'oling_admin_room_egg_missing',
          message: 'That user does not have an egg in their Oling room.'
        });
      }

      res.apiSuccess({
        preview: {
          eggKey: room.currentEgg.eggKey,
          hatchContext: room.currentEgg.hatchContext,
          influenceSlots: room.currentEgg.influenceSlots,
          slot: room.currentEgg.slot
        },
        room
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to preview admin Oling hatch:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_admin_hatch_preview_failed',
        message: 'Failed to preview Oling hatch.'
      });
    }
  });

  app.post('/api/olings/admin/hatch', async (req, res) => {
    try {
      const context = await requireAdminOlingTarget(req, res);
      if (!context) return;

      const room = serializeAdminOlingRoom(
        context.targetAccount,
        context.olingState
      );
      if (!room.currentEgg) {
        return res.apiError({
          status: 409,
          code: 'oling_admin_room_egg_missing',
          message: 'That user does not have an egg in their Oling room.'
        });
      }

      const result = await hatchOling({
        models,
        accountId: context.targetAccount._id,
        eggKey: room.currentEgg.eggKey,
        hatchContext: room.currentEgg.hatchContext,
        request: {
          ip: req.ip,
          userAgent: req.get('user-agent') || null
        }
      });

      if (result.error) {
        return res.apiError(result.error);
      }

      await createAdminLog(models.AdminLog, context.account, {
        action: 'Hatched Oling room egg',
        area: 'Olings',
        target: {
          type: 'account',
          id: String(context.targetAccount._id),
          label:
            context.targetAccount.username || context.targetAccount.email || '-'
        },
        newValue: {
          eggKey: room.currentEgg.eggKey,
          olingId: result.serialized?.oling?.id || null,
          receiptId: result.serialized?.receipt?.id || null,
          reason: String(req.body?.reason || '').trim() || null
        },
        severity: 'medium',
        metadata: {
          hatchContext: room.currentEgg.hatchContext,
          influenceSlots: room.currentEgg.influenceSlots
        }
      });

      res.apiSuccess(
        {
          message: 'Oling room egg hatched.',
          target: room.target,
          oling: result.serialized.oling,
          receipt: result.serialized.receipt,
          room: serializeAdminOlingRoom(result.account, result.olingState)
        },
        201
      );
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to admin hatch Oling egg:`, err);
      res.apiError({
        status: 500,
        code: 'oling_admin_hatch_failed',
        message: 'Failed to hatch Oling room egg.'
      });
    }
  });

  app.get('/api/olings/admin/hatch-receipt', async (req, res) => {
    try {
      const context = await requireAdminOlingTarget(req, res);
      if (!context) return;

      const receipt = await OlingHatchReceipt.findOne({
        ownerId: context.targetAccount._id
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!receipt) {
        return res.apiError({
          status: 404,
          code: 'oling_admin_hatch_receipt_not_found',
          message: 'That user does not have any hatch receipts yet.'
        });
      }

      res.apiSuccess({
        target: {
          id: String(context.targetAccount._id),
          username: context.targetAccount.username || null,
          email: context.targetAccount.email || null
        },
        receipt: serializeHatchReceipt(receipt)
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch admin hatch receipt:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_admin_hatch_receipt_failed',
        message: 'Failed to fetch hatch receipt.'
      });
    }
  });
}

module.exports = { registerOlingAdminRoutes };

function registerOlingNotificationRoutes(context) {
  const {
    app,
    getCurrentAccount,
    OlingState,
    OlingEgg,
    OlingConsumable,
    listOlingConsumables,
    getIncubatorReadyNotifications,
    Account
  } = context;

  app.get('/api/olings/notifications', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view Oling notifications.'
        });
      }
      const olingState = OlingState?.findOne
        ? await OlingState.findOne({ ownerId: account._id })
        : null;
      const [eggs, consumables] = await Promise.all([
        OlingEgg.find({ enabled: true, status: 'published' })
          .select('key name collection assets metadata')
          .lean(),
        listOlingConsumables({ OlingConsumable })
      ]);
      const notifications = getIncubatorReadyNotifications(
        olingState?.lab || account.olings?.lab,
        eggs,
        new Date(),
        consumables
      ).map(({ slot, ...notification }) => notification);
      res.apiSuccess({ notifications });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to fetch Oling notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_notifications_fetch_failed',
        message: 'Failed to fetch Oling notifications.'
      });
    }
  });

  app.patch('/api/olings/notifications', async (req, res) => {
    const notificationIds = new Set(
      (Array.isArray(req.body?.notificationIds) ? req.body.notificationIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 20)
    );
    if (!notificationIds.size) {
      return res.apiError({
        status: 400,
        code: 'oling_notifications_invalid',
        message: 'No Oling notifications were provided.'
      });
    }

    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to update Oling notifications.'
        });
      }
      const olingState = OlingState?.findOne
        ? await OlingState.findOne({ ownerId: account._id })
        : null;
      const lab = olingState?.lab || account.olings?.lab;
      const [eggs, consumables] = await Promise.all([
        OlingEgg.find({ enabled: true, status: 'published' })
          .select('key metadata')
          .lean(),
        listOlingConsumables({ OlingConsumable })
      ]);
      const deliveredAt = new Date();
      let updated = 0;
      getIncubatorReadyNotifications(
        lab,
        eggs,
        deliveredAt,
        consumables
      ).forEach((notification) => {
        if (!notificationIds.has(notification.id)) return;
        notification.slot.readyNotificationDeliveredAt = deliveredAt;
        updated += 1;
      });

      if (updated) {
        await Account.updateOne(
          { _id: account._id },
          { $set: { 'olings.lab': lab } },
          { runValidators: false }
        );
        if (OlingState?.updateOne) {
          await OlingState.updateOne(
            { ownerId: account._id },
            { $set: { lab } },
            { upsert: true, runValidators: false }
          );
        }
      }
      res.apiSuccess({ updated });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to update Oling notifications:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_notifications_update_failed',
        message: 'Failed to update Oling notifications.'
      });
    }
  });
}

module.exports = { registerOlingNotificationRoutes };

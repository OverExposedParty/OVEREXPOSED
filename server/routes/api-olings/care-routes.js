function registerOlingCareRoutes(context) {
  const {
    app,
    getCurrentAccount,
    PlayerOling,
    OlingHatchReceipt,
    getOlingDefinitions,
    models,
    getOrCreateOlingState,
    OlingState,
    serializeAccount,
    serializePlayerOling,
    serializeHatchReceipt,
    useOlingConsumable,
    OLING_ACTIVITY_ENERGY_COSTS,
    spendOlingEnergy,
    OlingLabItems,
    getOlingBedRestDurationMs,
    getOlingEnergy,
    hatchOling
  } = context;

  app.get('/api/olings/mine', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view your Olings.'
        });
      }

      const olings = await PlayerOling.find({ ownerId: account._id })
        .sort({ favorite: -1, hatchedAt: -1 })
        .lean();
      const receipts = await OlingHatchReceipt.find({ ownerId: account._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      const definitions = await getOlingDefinitions(models, olings);
      const olingState = await getOrCreateOlingState(OlingState, account);

      res.apiSuccess({
        account: serializeAccount(account, { olingState }),
        activeAdventure: account.olings?.adventures?.active || null,
        olings: olings.map((oling) => serializePlayerOling(oling, definitions)),
        receipts: receipts.map(serializeHatchReceipt)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch player Olings:`, err);
      res.apiError({
        status: 500,
        code: 'player_olings_fetch_failed',
        message: 'Failed to fetch your Olings'
      });
    }
  });

  app.post('/api/olings/:olingId/consume', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use Oling consumables.'
        });
      }

      const result = await useOlingConsumable({
        models,
        accountId: account._id,
        olingId: req.params.olingId,
        consumableKey: req.body?.consumableKey
      });

      if (result.error) {
        return res.apiError(result.error);
      }

      res.apiSuccess({
        message: 'Consumable used.',
        account: serializeAccount(result.account, {
          olingState: result.olingState
        }),
        consumable: result.serialized.consumable,
        inventoryChange: result.inventoryChange,
        oling: result.serialized.oling
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to use Oling consumable:`, err);
      res.apiError({
        status: 500,
        code: 'oling_consumable_use_failed',
        message: 'Failed to use Oling consumable'
      });
    }
  });

  app.post(
    '/api/olings/:olingId/activities/:activityType/start',
    async (req, res) => {
      try {
        const account = await getCurrentAccount(req);
        if (!account) {
          return res.apiError({
            status: 401,
            code: 'account_required',
            message: 'Sign in to take an Oling on an activity.'
          });
        }

        const activityType = String(req.params.activityType || '')
          .trim()
          .toLowerCase();
        const energyCost = OLING_ACTIVITY_ENERGY_COSTS[activityType];
        if (!energyCost) {
          return res.apiError({
            status: 400,
            code: 'oling_activity_invalid',
            message: 'That is not an available Oling activity.'
          });
        }

        const result = await spendOlingEnergy({
          PlayerOling,
          accountId: account._id,
          olingId: req.params.olingId,
          amount: energyCost
        });
        if (result.error) return res.apiError(result.error);

        const definitions = await getOlingDefinitions(models, [result.oling]);
        res.apiSuccess({
          activityType,
          energyCost,
          oling: serializePlayerOling(result.oling, definitions)
        });
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to start Oling activity:`, err);
        res.apiError({
          status: 500,
          code: 'oling_activity_start_failed',
          message: 'Failed to start that Oling activity.'
        });
      }
    }
  );

  app.patch('/api/olings/:olingId/sleep', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to manage an Oling’s rest.'
        });
      if (typeof req.body?.isSleeping !== 'boolean')
        return res.apiError({
          status: 400,
          code: 'oling_sleep_state_invalid',
          message: 'Choose whether this Oling should sleep.'
        });

      const oling = await PlayerOling.findOne({
        _id: req.params.olingId,
        ownerId: account._id
      });
      if (!oling)
        return res.apiError({
          status: 404,
          code: 'player_oling_not_found',
          message: 'That Oling could not be found.'
        });
      if (
        req.body.isSleeping &&
        String(account.olings?.adventures?.active?.olingId || '') ===
          String(oling._id)
      ) {
        return res.apiError({
          status: 409,
          code: 'oling_rest_oling_adventuring',
          message: 'This Oling is currently on an adventure.'
        });
      }

      const now = new Date();
      const wasSleeping = Boolean(oling.care?.isSleeping);
      if (req.body.isSleeping && !wasSleeping) {
        const placedBed = (account.olings?.lab?.placedItems || []).find(
          (placed) =>
            String(placed?.placedId || '') === String(req.body?.placedId || '')
        );
        const bedDefinition = OlingLabItems[placedBed?.itemId];
        if (
          !placedBed ||
          (bedDefinition?.type !== 'bed' && bedDefinition?.category !== 'bed')
        ) {
          return res.apiError({
            status: 400,
            code: 'oling_rest_bed_invalid',
            message: 'Choose a placed Oling bed.'
          });
        }
        const sleepSlots =
          Array.isArray(bedDefinition.sleepSlots) &&
          bedDefinition.sleepSlots.length
            ? bedDefinition.sleepSlots
            : [{ slotId: 'sleep-1', x: 256, y: 256 }];
        const sleepingOlings = await PlayerOling.find({
          ownerId: account._id,
          _id: { $ne: oling._id },
          'care.isSleeping': true,
          'care.sleepBedPlacedId': String(placedBed.placedId)
        })
          .select('care.sleepBedSlotId')
          .lean();
        const occupiedSlotIds = new Set(
          sleepingOlings.map((sleepingOling) =>
            String(sleepingOling.care?.sleepBedSlotId || 'sleep-1')
          )
        );
        const sleepSlot = sleepSlots.find(
          (slot) => !occupiedSlotIds.has(String(slot.slotId))
        );
        if (!sleepSlot) {
          return res.apiError({
            status: 400,
            code: 'oling_rest_bed_full',
            message: 'Every sleep space in this bed is occupied.'
          });
        }
        oling.set('care.sleepBedRarity', bedDefinition.rarity || 'common');
        oling.set('care.sleepBedPlacedId', String(placedBed.placedId));
        oling.set('care.sleepBedSlotId', String(sleepSlot.slotId));
        oling.set(
          'care.sleepDurationMs',
          getOlingBedRestDurationMs(bedDefinition.rarity, oling.personalityKey)
        );
        oling.set('care.sleepUpdatedAt', now);
      } else if (!req.body.isSleeping && wasSleeping) {
        oling.set('care.energy', getOlingEnergy(oling, now.getTime()));
        oling.set('care.energyUpdatedAt', now);
        oling.set('care.sleepBedSlotId', null);
      }
      oling.set('care.isSleeping', req.body.isSleeping);
      await oling.save();
      const definitions = await getOlingDefinitions(models, [oling]);
      res.apiSuccess({
        message: `${oling.name || 'Your Oling'} is now ${req.body.isSleeping ? 'sleeping' : 'awake'}.`,
        oling: serializePlayerOling(oling, definitions)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to update Oling sleep state:`, err);
      res.apiError({
        status: 500,
        code: 'oling_sleep_update_failed',
        message: 'Failed to update that Oling’s rest state.'
      });
    }
  });

  app.post('/api/olings/hatch', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to hatch an Oling egg.'
        });
      }

      const result = await hatchOling({
        models,
        accountId: account._id,
        eggKey: req.body?.eggKey,
        hatchContext: req.body?.hatchContext,
        request: {
          ip: req.ip,
          userAgent: req.get('user-agent') || null
        }
      });

      if (result.error) {
        return res.apiError(result.error);
      }

      res.apiSuccess(
        {
          message: 'Oling hatched.',
          account: serializeAccount(result.account, {
            olingState: result.olingState
          }),
          oling: result.serialized.oling,
          receipt: result.serialized.receipt
        },
        201
      );
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to hatch Oling egg:`, err);
      res.apiError({
        status: 500,
        code: 'oling_hatch_failed',
        message: 'Failed to hatch Oling egg'
      });
    }
  });
}

module.exports = { registerOlingCareRoutes };

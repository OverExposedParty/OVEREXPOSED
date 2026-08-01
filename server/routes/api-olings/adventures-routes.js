function registerOlingAdventuresRoutes(context) {
  const {
    app,
    getCurrentAccount,
    getOrCreateOlingState,
    OlingState,
    PlayerOling,
    getOlingDefinitions,
    models,
    OLING_ADVENTURES,
    serializePlayerOling,
    OlingLabItems,
    getOlingAdventureEnergyCost,
    spendOlingEnergy,
    awardOlingXp
  } = context;

  app.get('/api/olings/adventures', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use the Explorer Gateway.'
        });
      await getOrCreateOlingState(OlingState, account);
      const olings = await PlayerOling.find({ ownerId: account._id }).sort({
        favorite: -1,
        hatchedAt: -1
      });
      const definitions = await getOlingDefinitions(models, olings);
      const adventures = account.olings?.adventures || {
        active: null,
        history: []
      };
      res.apiSuccess({
        gatewayLevel: 1,
        active: adventures.active || null,
        history: Array.isArray(adventures.history)
          ? adventures.history.slice(0, 30)
          : [],
        adventures: OLING_ADVENTURES.map(({ xp, ...adventure }) => ({
          ...adventure,
          possibleRewards: adventure.rewards,
          xp
        })),
        olings: olings.map((oling) => serializePlayerOling(oling, definitions))
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Oling adventures:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventures_fetch_failed',
        message: 'Failed to load Explorer Gateway.'
      });
    }
  });

  app.post('/api/olings/adventures/start', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to start an adventure.'
        });
      await getOrCreateOlingState(OlingState, account);
      const adventure = OLING_ADVENTURES.find(
        (item) => item.key === String(req.body?.adventureKey || '').trim()
      );
      if (!adventure)
        return res.apiError({
          status: 400,
          code: 'oling_adventure_invalid',
          message: 'That adventure is unavailable.'
        });
      if (account.olings?.adventures?.active)
        return res.apiError({
          status: 409,
          code: 'oling_adventure_active',
          message: 'An Oling is already on an adventure.'
        });
      const oling = await PlayerOling.findOne({
        _id: req.body?.olingId,
        ownerId: account._id
      });
      if (!oling)
        return res.apiError({
          status: 404,
          code: 'player_oling_not_found',
          message: 'That Oling could not be found.'
        });
      if (oling.care?.isSleeping) {
        return res.apiError({
          status: 409,
          code: 'oling_adventure_oling_resting',
          message: 'Wake this Oling before sending it on an adventure.'
        });
      }
      const placedDoor = (account.olings?.lab?.placedItems || []).find(
        (placed) =>
          String(placed?.placedId || '') ===
          String(req.body?.doorPlacedId || '')
      );
      const doorDefinition = OlingLabItems[placedDoor?.itemId];
      if (
        !placedDoor ||
        doorDefinition?.type !== 'door' ||
        !doorDefinition.exitGridPlacement
      ) {
        return res.apiError({
          status: 400,
          code: 'oling_adventure_door_invalid',
          message: 'Choose a placed door with an exit area.'
        });
      }
      if (oling.level < adventure.recommendedLevel)
        return res.apiError({
          status: 409,
          code: 'oling_adventure_level_low',
          message: `This adventure recommends level ${adventure.recommendedLevel}.`
        });
      const energyCost = getOlingAdventureEnergyCost(
        adventure.energyCost,
        oling.personalityKey
      );
      const spent = await spendOlingEnergy({
        PlayerOling,
        accountId: account._id,
        olingId: oling._id,
        amount: energyCost
      });
      if (spent.error) return res.apiError(spent.error);
      const startedAt = new Date();
      const active = {
        adventureKey: adventure.key,
        adventureName: adventure.name,
        olingId: String(oling._id),
        olingName: oling.name || 'Oling',
        doorPlacedId: String(placedDoor.placedId),
        startedAt,
        completesAt: new Date(startedAt.getTime() + adventure.durationMs),
        durationMs: adventure.durationMs,
        energyCost
      };
      account.set('olings.adventures.active', active);
      account.markModified('olings');
      await account.save({ validateBeforeSave: false });
      res.apiSuccess({
        message: `${active.olingName} set off on ${adventure.name}.`,
        active
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to start Oling adventure:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventure_start_failed',
        message: 'Failed to start that adventure.'
      });
    }
  });

  app.post('/api/olings/adventures/return', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      const active = account?.olings?.adventures?.active;
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to return an Oling.'
        });
      if (!active)
        return res.apiError({
          status: 409,
          code: 'oling_adventure_missing',
          message: 'No Oling is currently away.'
        });
      if (new Date(active.completesAt).getTime() > Date.now())
        return res.apiError({
          status: 409,
          code: 'oling_adventure_incomplete',
          message: 'This adventure is not complete yet.'
        });
      const adventure = OLING_ADVENTURES.find(
        (item) => item.key === active.adventureKey
      );
      if (!adventure)
        return res.apiError({
          status: 400,
          code: 'oling_adventure_invalid',
          message: 'This adventure is no longer available.'
        });
      const oling = await awardOlingXp({
        PlayerOling,
        accountId: account._id,
        olingId: active.olingId,
        amount: adventure.xp
      });
      const rewardItem = Math.random() < 0.45 ? 'oling-cookie' : null;
      if (rewardItem) {
        const list = account.olings.consumables || [];
        const owned = list.find((item) => item.key === rewardItem);
        if (owned) owned.quantity = Number(owned.quantity || 0) + 1;
        else list.push({ key: rewardItem, quantity: 1, rarity: 'common' });
        account.set('olings.consumables', list);
      }
      const completion = {
        ...active,
        completedAt: new Date(),
        rewards: [`${adventure.xp} XP`, ...(rewardItem ? ['Oling Cookie'] : [])]
      };
      account.set('olings.adventures.active', null);
      account.olings.adventures.history = [
        completion,
        ...(account.olings.adventures.history || [])
      ].slice(0, 30);
      account.markModified('olings');
      await account.save({ validateBeforeSave: false });
      res.apiSuccess({
        message: `${active.olingName} returned from ${adventure.name}.`,
        completion,
        rewardItem,
        olingId: String(oling?._id || active.olingId)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to return Oling adventure:`, err);
      res.apiError({
        status: 500,
        code: 'oling_adventure_return_failed',
        message: 'Failed to complete that adventure.'
      });
    }
  });
}

module.exports = { registerOlingAdventuresRoutes };

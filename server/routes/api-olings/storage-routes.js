function registerOlingStorageRoutes(context) {
  const {
    app,
    getCurrentAccount,
    clampInteger,
    getReservedLabItemQuantity,
    getQuickSellQuote,
    getOrCreateOlingState,
    OlingState,
    ensureAccountOlingDocument,
    QUICK_SELL_RATE,
    serializeAccount
  } = context;

  app.post('/api/olings/storage/quick-sell/quote', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account)
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view quick sell prices.'
        });
      const itemType = String(req.body?.itemType || '')
        .trim()
        .toLowerCase();
      const itemKey = String(req.body?.itemKey || '').trim();
      const quantity = clampInteger(req.body?.quantity, 1, 999, 1);
      const inventoryKey =
        itemType === 'egg'
          ? 'eggs'
          : itemType === 'consumable'
            ? 'consumables'
            : null;
      const owned = inventoryKey
        ? account.olings?.[inventoryKey]?.find((item) => item?.key === itemKey)
        : null;
      const reserved =
        itemType === 'egg'
          ? getReservedLabItemQuantity(account.olings?.lab, itemType, itemKey)
          : 0;
      if (
        !inventoryKey ||
        !itemKey ||
        Number(owned?.quantity || 0) - reserved < quantity
      ) {
        return res.apiError({
          status: 403,
          code: 'oling_quick_sell_not_owned',
          message: 'You do not own enough of that item.'
        });
      }
      const quote = await getQuickSellQuote(itemType, itemKey, quantity);
      if (!quote || quote.unitPayout < 1) {
        return res.apiError({
          status: 400,
          code: 'oling_quick_sell_unavailable',
          message: 'This item cannot be quick sold right now.'
        });
      }
      res.apiSuccess({ quote });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to quote Oling quick sell:`, err);
      res.apiError({
        status: 500,
        code: 'oling_quick_sell_quote_failed',
        message: 'Could not price that item.'
      });
    }
  });

  app.post('/api/olings/storage/quick-sell', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to quick sell items.'
        });
      }
      const itemType = String(req.body?.itemType || '')
        .trim()
        .toLowerCase();
      const itemKey = String(req.body?.itemKey || '').trim();
      const quantity = clampInteger(req.body?.quantity, 1, 999, 1);
      if (!['egg', 'consumable'].includes(itemType) || !itemKey) {
        return res.apiError({
          status: 400,
          code: 'oling_quick_sell_item_invalid',
          message: 'That item cannot be quick sold.'
        });
      }

      const olingState = await getOrCreateOlingState(OlingState, account);
      ensureAccountOlingDocument(account, olingState);
      const inventoryKey = itemType === 'egg' ? 'eggs' : 'consumables';
      const inventory = Array.isArray(account.olings?.[inventoryKey])
        ? account.olings[inventoryKey]
        : [];
      const ownedItem = inventory.find((item) => item?.key === itemKey);
      const reserved =
        itemType === 'egg'
          ? getReservedLabItemQuantity(
              olingState?.lab || account.olings?.lab,
              itemType,
              itemKey
            )
          : 0;
      if (Number(ownedItem?.quantity || 0) - reserved < quantity) {
        return res.apiError({
          status: 403,
          code: 'oling_quick_sell_not_owned',
          message: 'You do not own enough of that item.'
        });
      }

      const quote = await getQuickSellQuote(itemType, itemKey, quantity);
      if (!quote || quote.unitPayout < 1) {
        return res.apiError({
          status: 400,
          code: 'oling_quick_sell_unavailable',
          message: 'This item cannot be quick sold right now.'
        });
      }

      const nextInventory = inventory
        .map((item) =>
          item?.key === itemKey
            ? {
                ...item,
                quantity: Math.max(0, Number(item.quantity || 0) - quantity),
                lastUpdatedAt: new Date()
              }
            : item
        )
        .filter((item) => Number(item?.quantity || 0) > 0);
      const currentBalance = Math.max(
        0,
        Number(account.gameData?.opals?.balance || 0)
      );
      const balanceAfter = currentBalance + quote.payout;
      const transactions = Array.isArray(account.gameData?.opalTransactions)
        ? account.gameData.opalTransactions
        : [];
      account.set(`olings.${inventoryKey}`, nextInventory);
      account.set('gameData.opals.balance', balanceAfter);
      account.set(
        'gameData.opals.lifetimeEarned',
        Math.max(0, Number(account.gameData?.opals?.lifetimeEarned || 0)) +
          quote.payout
      );
      account.set('gameData.opalTransactions', [
        ...transactions,
        {
          type: 'earn',
          amount: quote.payout,
          reason: `Quick sold ${quantity} ${quote.productName}`,
          sourceType: 'oling_quick_sell',
          sourceId: itemKey,
          balanceAfter,
          metadata: {
            itemType,
            itemKey,
            quantity,
            shopValue: quote.shopValue,
            rate: QUICK_SELL_RATE
          },
          createdAt: new Date()
        }
      ]);
      await account.save({ validateBeforeSave: false });
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: account._id },
          { $set: { [`inventory.${inventoryKey}`]: nextInventory } },
          { upsert: true, runValidators: false }
        );
      }

      res.apiSuccess({
        message: `Quick sold for ${quote.payout} Opals.`,
        quote: { ...quote, balanceAfter },
        account: serializeAccount(account, { olingState }),
        inventory: {
          eggs:
            inventoryKey === 'eggs'
              ? nextInventory
              : account.olings?.eggs || [],
          consumables:
            inventoryKey === 'consumables'
              ? nextInventory
              : account.olings?.consumables || []
        }
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to quick sell Oling storage item:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_quick_sell_failed',
        message: 'Could not quick sell that item.'
      });
    }
  });
}

module.exports = { registerOlingStorageRoutes };

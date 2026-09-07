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
    serializeAccount,
    getOlingDefinitions,
    serializePlayerOling,
    storeOlingInPod,
    transferStoredOling,
    releaseOlingFromPod,
    recordOlingStorageDiagnostic,
    models
  } = context;

  const recordStorageAttempt = ({
    operation,
    outcome,
    req,
    account,
    result,
    error
  }) =>
    recordOlingStorageDiagnostic?.({
      operation,
      outcome,
      accountId: account?._id,
      olingId: req.params?.olingId,
      podKey: result?.pod?.key || req.body?.podKey,
      releaseOutcome: result?.pod?.releaseOutcome,
      rosterActiveCount: result?.roster?.activeCount,
      error,
      requestId: req.id
    });

  const serializeRoster = (roster) => ({
    limit: Number(roster?.limit || 0),
    activeCount: Number(roster?.activeCount || 0),
    availableSlots: Number(roster?.availableSlots || 0),
    nextAvailableSlot: roster?.nextAvailableSlot ?? null
  });

  async function serializeStorageResult(result) {
    const definitions = await getOlingDefinitions(models, [result.oling]);
    return {
      account: serializeAccount(result.account),
      oling: serializePlayerOling(result.oling, definitions),
      pod: result.pod,
      roster: serializeRoster(result.roster),
      inventory: {
        pods: Array.isArray(result.account?.olings?.pods)
          ? result.account.olings.pods
          : []
      }
    };
  }

  app.post('/api/olings/storage/:olingId/store', async (req, res) => {
    let account = null;
    try {
      account = await getCurrentAccount(req);
      if (!account) {
        const error = {
          status: 401,
          code: 'account_required',
          message: 'Sign in to store an Oling.'
        };
        recordStorageAttempt({
          operation: 'store',
          outcome: 'rejected',
          req,
          account,
          error
        });
        return res.apiError(error);
      }

      const result = await storeOlingInPod({
        models,
        accountId: account._id,
        olingId: req.params.olingId,
        podKey: req.body?.podKey,
        containerPlacedId: req.body?.containerPlacedId
      });
      if (result.error) {
        recordStorageAttempt({
          operation: 'store',
          outcome: 'rejected',
          req,
          account,
          result,
          error: result.error
        });
        return res.apiError(result.error);
      }

      recordStorageAttempt({
        operation: 'store',
        outcome: 'succeeded',
        req,
        account,
        result
      });

      res.apiSuccess({
        message: `${result.oling?.name || 'Your Oling'} was stored in an Oling Pod.`,
        ...(await serializeStorageResult(result))
      });
    } catch (err) {
      recordStorageAttempt({
        operation: 'store',
        outcome: 'failed',
        req,
        account,
        error: { status: 500, code: 'oling_storage_store_failed' }
      });
      console.error(`[REQ ${req.id}] Failed to store Oling:`, err);
      res.apiError({
        status: 500,
        code: 'oling_storage_store_failed',
        message: 'Could not store that Oling.'
      });
    }
  });

  app.post('/api/olings/storage/:olingId/transfer', async (req, res) => {
    let account = null;
    try {
      account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to move a stored Oling.'
        });
      }
      const result = await transferStoredOling({
        models,
        accountId: account._id,
        olingId: req.params.olingId,
        containerPlacedId: req.body?.containerPlacedId
      });
      if (result.error) return res.apiError(result.error);
      res.apiSuccess({
        message: `${result.oling?.name || 'Your Oling'} was moved to another Pod Rack.`,
        ...(await serializeStorageResult(result))
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to move stored Oling:`, err);
      res.apiError({
        status: 500,
        code: 'oling_storage_transfer_failed',
        message: 'Could not move that stored Oling.'
      });
    }
  });

  app.post('/api/olings/storage/:olingId/release', async (req, res) => {
    let account = null;
    try {
      account = await getCurrentAccount(req);
      if (!account) {
        const error = {
          status: 401,
          code: 'account_required',
          message: 'Sign in to release an Oling.'
        };
        recordStorageAttempt({
          operation: 'release',
          outcome: 'rejected',
          req,
          account,
          error
        });
        return res.apiError(error);
      }

      const result = await releaseOlingFromPod({
        models,
        accountId: account._id,
        olingId: req.params.olingId
      });
      if (result.error) {
        recordStorageAttempt({
          operation: 'release',
          outcome: 'rejected',
          req,
          account,
          result,
          error: result.error
        });
        return res.apiError(result.error);
      }

      recordStorageAttempt({
        operation: 'release',
        outcome: 'succeeded',
        req,
        account,
        result
      });

      const podMessage = result.pod?.destroyed
        ? ' The one-use pod broke during release.'
        : ' The pod was returned to storage.';
      res.apiSuccess({
        message: `${result.oling?.name || 'Your Oling'} was released.${podMessage}`,
        ...(await serializeStorageResult(result))
      });
    } catch (err) {
      recordStorageAttempt({
        operation: 'release',
        outcome: 'failed',
        req,
        account,
        error: { status: 500, code: 'oling_storage_release_failed' }
      });
      console.error(`[REQ ${req.id}] Failed to release stored Oling:`, err);
      res.apiError({
        status: 500,
        code: 'oling_storage_release_failed',
        message: 'Could not release that Oling.'
      });
    }
  });

  app.post('/api/olings/storage/quick-sell/prices', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to view quick sell prices.'
        });
      }
      const requestedItems = Array.isArray(req.body?.items)
        ? req.body.items
        : [];
      const uniqueItems = [];
      const seen = new Set();
      requestedItems.slice(0, 32).forEach((item) => {
        const itemType = String(item?.itemType || '')
          .trim()
          .toLowerCase();
        const itemKey = String(item?.itemKey || '').trim();
        const identity = `${itemType}:${itemKey}`;
        if (
          !['egg', 'consumable'].includes(itemType) ||
          !itemKey ||
          seen.has(identity)
        ) {
          return;
        }
        seen.add(identity);
        uniqueItems.push({ itemType, itemKey });
      });
      const prices = (
        await Promise.all(
          uniqueItems.map(async ({ itemType, itemKey }) => {
            const inventoryKey = itemType === 'egg' ? 'eggs' : 'consumables';
            const owned = account.olings?.[inventoryKey]?.find(
              (item) => item?.key === itemKey
            );
            const reserved = getReservedLabItemQuantity(
              account.olings?.lab,
              itemType,
              itemKey
            );
            if (Number(owned?.quantity || 0) - reserved < 1) return null;
            const quote = await getQuickSellQuote(itemType, itemKey, 1);
            if (!quote || quote.unitPayout < 1) return null;
            return {
              itemType,
              itemKey,
              productName: quote.productName,
              shopValue: quote.shopValue,
              unitPayout: quote.unitPayout
            };
          })
        )
      ).filter(Boolean);
      res.apiSuccess({ prices });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to load Oling quick sell prices:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oling_quick_sell_prices_failed',
        message: 'Could not load quick sell prices.'
      });
    }
  });

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
      const reserved = getReservedLabItemQuantity(
        account.olings?.lab,
        itemType,
        itemKey
      );
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
      const reserved = getReservedLabItemQuantity(
        olingState?.lab || account.olings?.lab,
        itemType,
        itemKey
      );
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

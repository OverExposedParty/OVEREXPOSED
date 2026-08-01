const {
  registerOlingLabPublicCatalogRoutes
} = require('./lab-public-catalog-routes');

function registerOlingLabRoutes(context) {
  const {
    app,
    getCurrentAccount,
    OlingEgg,
    listOlingConsumables,
    OlingConsumable,
    getOrCreateOlingState,
    OlingState,
    serializeAccount,
    serializeOlingLab,
    getLabExpansionDetails,
    getOwnedLabFurniture,
    OlingLabItems,
    serializeOlingLabItem,
    serializeOlingConsumable,
    serializeOlingEgg,
    getIncubatorReadyNotifications,
    Account,
    ensureAccountOlingDocument,
    normalizeLabPayload,
    applyHatchInfluenceDeductions,
    getLabCellKey,
    STARTER_LAB_COLUMNS,
    LAB_ROWS
  } = context;

  app.get('/api/olings/lab', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use your Olings Lab.'
        });
      }

      const eggs = await OlingEgg.find({
        enabled: true,
        status: 'published'
      })
        .sort({ collection: 1, key: 1 })
        .lean();
      const consumables = await listOlingConsumables({ OlingConsumable });
      const olingState = await getOrCreateOlingState(OlingState, account);

      res.apiSuccess({
        account: serializeAccount(account, { olingState }),
        lab: serializeOlingLab(olingState?.lab),
        expansion: getLabExpansionDetails(olingState?.lab, account),
        inventory: {
          furniture: [...getOwnedLabFurniture(account, olingState)].map(
            (key) => ({ key })
          ),
          consumables: Array.isArray(olingState?.inventory?.consumables)
            ? olingState.inventory.consumables
            : [],
          eggs: Array.isArray(olingState?.inventory?.eggs)
            ? olingState.inventory.eggs
            : []
        },
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        consumables: consumables.map(serializeOlingConsumable),
        eggs: eggs.map(serializeOlingEgg)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch Olings Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_fetch_failed',
        message: 'Failed to fetch your Olings Lab'
      });
    }
  });

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
      const eggs = await OlingEgg.find({ enabled: true, status: 'published' })
        .select('key name collection assets metadata')
        .lean();
      const notifications = getIncubatorReadyNotifications(
        olingState?.lab || account.olings?.lab,
        eggs
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
      const eggs = await OlingEgg.find({ enabled: true, status: 'published' })
        .select('key metadata')
        .lean();
      const deliveredAt = new Date();
      let updated = 0;
      getIncubatorReadyNotifications(lab, eggs, deliveredAt).forEach(
        (notification) => {
          if (!notificationIds.has(notification.id)) return;
          notification.slot.readyNotificationDeliveredAt = deliveredAt;
          updated += 1;
        }
      );

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

  app.put('/api/olings/lab', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to save your Olings Lab.'
        });
      }

      const olingState = await getOrCreateOlingState(OlingState, account);
      ensureAccountOlingDocument(account, olingState);
      const normalized = normalizeLabPayload(
        req.body?.lab || req.body,
        account,
        olingState
      );
      if (normalized.error) {
        return res.apiError(normalized.error);
      }

      const consumables = await listOlingConsumables({ OlingConsumable });
      const deductionResult = applyHatchInfluenceDeductions(
        normalized.lab,
        olingState?.lab,
        account,
        consumables
      );
      if (deductionResult.error) {
        return res.apiError(deductionResult.error);
      }

      const consumableInventory = Array.isArray(account.olings?.consumables)
        ? account.olings.consumables
        : [];
      await Account.updateOne(
        { _id: account._id },
        {
          $set: {
            'olings.lab': normalized.lab,
            'olings.consumables': consumableInventory
          }
        },
        { runValidators: false }
      );
      const updatedAccount = (await Account.findById(account._id)) || account;
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: updatedAccount._id },
          { $set: { lab: normalized.lab } },
          { upsert: true, runValidators: false }
        );
      }
      const updatedOlingState = await getOrCreateOlingState(
        OlingState,
        updatedAccount
      );

      const eggs = await OlingEgg.find({
        enabled: true,
        status: 'published'
      })
        .sort({ collection: 1, key: 1 })
        .lean();

      res.apiSuccess({
        message: 'Olings Lab saved.',
        account: serializeAccount(updatedAccount, {
          olingState: updatedOlingState
        }),
        lab: serializeOlingLab(normalized.lab),
        expansion: getLabExpansionDetails(normalized.lab, updatedAccount),
        inventory: {
          furniture: [...getOwnedLabFurniture(account, updatedOlingState)].map(
            (key) => ({ key })
          ),
          consumables: Array.isArray(updatedOlingState?.inventory?.consumables)
            ? updatedOlingState.inventory.consumables
            : [],
          eggs: Array.isArray(updatedOlingState?.inventory?.eggs)
            ? updatedOlingState.inventory.eggs
            : []
        },
        catalog: Object.values(OlingLabItems).map(serializeOlingLabItem),
        consumables: consumables.map(serializeOlingConsumable),
        eggs: eggs.map(serializeOlingEgg)
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to save Olings Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_save_failed',
        message: 'Failed to save your Olings Lab'
      });
    }
  });

  app.post('/api/olings/lab/expand', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to expand your Olings Lab.'
        });
      }

      const olingState = await getOrCreateOlingState(OlingState, account);
      ensureAccountOlingDocument(account, olingState);
      const currentLab = serializeOlingLab(
        account.olings?.lab?.placedItems ? account.olings.lab : olingState?.lab
      );
      const expansion = getLabExpansionDetails(currentLab, account);
      const row = Number(req.body?.row);
      const col = Number(req.body?.col);
      const cell = expansion.cells.find(
        (candidate) => candidate.row === row && candidate.col === col
      );
      const cellKey = getLabCellKey(row, col);

      if (!Number.isInteger(row) || !Number.isInteger(col) || !cell) {
        return res.apiError({
          status: 400,
          code: 'oling_lab_cell_invalid',
          message: 'That lab space cannot be purchased.'
        });
      }
      if (cell.unlocked) {
        return res.apiError({
          status: 409,
          code: 'oling_lab_cell_already_unlocked',
          message: 'That lab space is already unlocked.'
        });
      }
      if (!cell.eligible) {
        return res.apiError({
          status: 409,
          code: 'oling_lab_previous_column_incomplete',
          message: 'Unlock both spaces in the closest column first.'
        });
      }
      if (expansion.balance < cell.price) {
        return res.apiError({
          status: 400,
          code: 'insufficient_opals',
          message: `You need ${cell.price - expansion.balance} more Opals to unlock that space.`
        });
      }

      await Account.updateOne(
        { _id: account._id, 'olings.lab.unlockedCells': { $exists: false } },
        { $set: { 'olings.lab': currentLab } },
        { runValidators: false }
      );

      const nextColumns = Math.max(currentLab.columns, col + 1);
      const balanceAfter = expansion.balance - cell.price;
      const purchasedAt = new Date();
      const requiredUnlockedCells = [];
      for (
        let requiredCol = STARTER_LAB_COLUMNS;
        requiredCol < col;
        requiredCol += 1
      ) {
        for (let requiredRow = 0; requiredRow < LAB_ROWS; requiredRow += 1) {
          requiredUnlockedCells.push(getLabCellKey(requiredRow, requiredCol));
        }
      }
      const updatedAccount = await Account.findOneAndUpdate(
        {
          _id: account._id,
          'olings.lab.unlockedCells': {
            $ne: cellKey,
            $all: requiredUnlockedCells
          },
          'gameData.opals.balance': expansion.balance
        },
        {
          $set: {
            'olings.lab.columns': nextColumns,
            'olings.lab.updatedAt': purchasedAt
          },
          $inc: {
            'gameData.opals.balance': -cell.price,
            'gameData.opals.lifetimeSpent': cell.price
          },
          $push: {
            'olings.lab.unlockedCells': cellKey,
            'gameData.opalTransactions': {
              $each: [
                {
                  type: 'spend',
                  amount: -cell.price,
                  reason: `Unlocked Olings Lab space ${row + 1}:${col + 1}`,
                  sourceType: 'system',
                  sourceId: `oling_lab_cell_${row}_${col}`,
                  balanceAfter,
                  metadata: {
                    purchaseType: 'oling_lab_cell',
                    row,
                    col,
                    columns: nextColumns
                  },
                  createdAt: purchasedAt
                }
              ]
            }
          }
        },
        { new: true, runValidators: false }
      );

      if (!updatedAccount) {
        return res.apiError({
          status: 409,
          code: 'oling_lab_expansion_conflict',
          message: 'Your Opal balance or lab changed. Please try again.'
        });
      }

      const expandedLab = {
        ...currentLab,
        columns: nextColumns,
        unlockedCells: [...currentLab.unlockedCells, cellKey],
        updatedAt: purchasedAt
      };
      if (OlingState?.updateOne) {
        await OlingState.updateOne(
          { ownerId: updatedAccount._id },
          { $set: { lab: expandedLab } },
          { upsert: true, runValidators: false }
        );
      }
      const updatedOlingState = await getOrCreateOlingState(
        OlingState,
        updatedAccount
      );

      res.apiSuccess({
        message: 'Olings Lab space unlocked.',
        account: serializeAccount(updatedAccount, {
          olingState: updatedOlingState
        }),
        lab: serializeOlingLab(expandedLab),
        expansion: getLabExpansionDetails(expandedLab, updatedAccount),
        purchase: {
          row,
          col,
          price: cell.price,
          balanceBefore: expansion.balance,
          balanceAfter
        }
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to expand Olings Lab:`, err);
      res.apiError({
        status: 500,
        code: 'oling_lab_expansion_failed',
        message: 'Failed to expand your Olings Lab'
      });
    }
  });

  registerOlingLabPublicCatalogRoutes(context);
}

module.exports = { registerOlingLabRoutes };

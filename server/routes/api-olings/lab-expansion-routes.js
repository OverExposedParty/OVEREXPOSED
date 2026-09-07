function registerOlingLabExpansionRoutes(context) {
  const {
    app,
    getCurrentAccount,
    getOrCreateOlingState,
    OlingState,
    serializeAccount,
    serializeOlingLab,
    getLabExpansionDetails,
    ensureAccountOlingDocument,
    getLabColumnCellKeys,
    STARTER_LAB_COLUMNS,
    Account
  } = context;

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
      const col = Number(req.body?.col);
      const column = expansion.columns.find(
        (candidate) => candidate.col === col
      );

      if (!Number.isInteger(col) || !column) {
        return res.apiError({
          status: 400,
          code: 'oling_lab_column_invalid',
          message: 'That lab column cannot be purchased.'
        });
      }
      if (column.unlocked) {
        return res.apiError({
          status: 409,
          code: 'oling_lab_column_already_unlocked',
          message: 'That lab column is already unlocked.'
        });
      }
      if (!column.eligible) {
        return res.apiError({
          status: 409,
          code: 'oling_lab_previous_column_incomplete',
          message: 'Unlock the closest lab column first.'
        });
      }
      if (expansion.balance < column.price) {
        return res.apiError({
          status: 400,
          code: 'insufficient_opals',
          message: `You need ${column.price - expansion.balance} more Opals to unlock that column.`
        });
      }

      await Account.updateOne(
        { _id: account._id, 'olings.lab.unlockedCells': { $exists: false } },
        { $set: { 'olings.lab': currentLab } },
        { runValidators: false }
      );

      // Completing legacy partial columns is free. $addToSet also preserves any
      // column unlock that may have been written since this request was read.
      await Account.updateOne(
        { _id: account._id },
        {
          $addToSet: {
            'olings.lab.unlockedCells': { $each: currentLab.unlockedCells }
          }
        },
        { runValidators: false }
      );

      const nextColumns = Math.max(currentLab.columns, col + 1);
      const balanceAfter = expansion.balance - column.price;
      const purchasedAt = new Date();
      const requiredUnlockedCells = [];
      for (
        let requiredCol = STARTER_LAB_COLUMNS;
        requiredCol < col;
        requiredCol += 1
      ) {
        requiredUnlockedCells.push(...getLabColumnCellKeys(requiredCol));
      }
      const updatedAccount = await Account.findOneAndUpdate(
        {
          _id: account._id,
          'olings.lab.unlockedCells': {
            $nin: column.cellKeys,
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
            'gameData.opals.balance': -column.price,
            'gameData.opals.lifetimeSpent': column.price
          },
          $addToSet: {
            'olings.lab.unlockedCells': { $each: column.cellKeys }
          },
          $push: {
            'gameData.opalTransactions': {
              $each: [
                {
                  type: 'spend',
                  amount: -column.price,
                  reason: `Unlocked Olings Lab column ${col + 1}`,
                  sourceType: 'system',
                  sourceId: `oling_lab_column_${col}`,
                  balanceAfter,
                  metadata: {
                    purchaseType: 'oling_lab_column',
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
        unlockedCells: [
          ...new Set([...currentLab.unlockedCells, ...column.cellKeys])
        ],
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
        message: 'Olings Lab column unlocked.',
        account: serializeAccount(updatedAccount, {
          olingState: updatedOlingState
        }),
        lab: serializeOlingLab(expandedLab),
        expansion: getLabExpansionDetails(expandedLab, updatedAccount),
        purchase: {
          col,
          cellKeys: column.cellKeys,
          price: column.price,
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
}

module.exports = { registerOlingLabExpansionRoutes };

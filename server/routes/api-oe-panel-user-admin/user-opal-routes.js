const {
  createAccountNotificationState,
  queueAccountNotification
} = require('../../services/account-notifications');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function registerOePanelUserOpalRoutes(context) {
  const {
    app,
    Account,
    AdminLog,
    createAdminLog,
    requireOePanelAccount,
    requireOePanelPermission,
    serializeOePanelUser
  } = context;

  async function adjustUserOpals(req, res, direction) {
    const account = await requireOePanelAccount(req, res);
    if (!account) return;
    if (!requireOePanelPermission(account, res, 'users.opals.manage')) return;

    const body = req.body || {};
    const accountLookup = String(body.accountId || body.username || '').trim();
    const amount = Number(body.amount);
    const normalizedAmount = Number.isFinite(amount) ? Math.trunc(amount) : 0;
    const reason = String(body.reason || '').trim();
    const isRemoving = direction === 'remove';

    if (!accountLookup) {
      return res.apiError({
        status: 400,
        code: 'oe_panel_user_opals_account_required',
        message: 'Account ID or username is required.'
      });
    }
    if (normalizedAmount <= 0) {
      return res.apiError({
        status: 400,
        code: 'oe_panel_user_opals_amount_invalid',
        message: 'Opal amount must be a positive whole number.'
      });
    }
    if (!reason) {
      return res.apiError({
        status: 400,
        code: 'oe_panel_user_opals_reason_required',
        message: 'A reason is required.'
      });
    }

    const targetAccount = /^[a-f\d]{24}$/i.test(accountLookup)
      ? await Account.findById(accountLookup)
      : await Account.findOne({
          username: {
            $regex: `^${escapeRegExp(accountLookup)}$`,
            $options: 'i'
          }
        });
    if (!targetAccount) {
      return res.apiError({
        status: 404,
        code: 'oe_panel_user_not_found',
        message: 'User not found'
      });
    }

    const currentBalance = Math.max(
      0,
      Number(targetAccount.gameData?.opals?.balance) || 0
    );
    const signedAmount = isRemoving ? -normalizedAmount : normalizedAmount;
    const nextBalance = currentBalance + signedAmount;
    if (nextBalance < 0) {
      return res.apiError({
        status: 400,
        code: 'oe_panel_user_opals_insufficient_balance',
        message: 'That account does not have enough Opals to remove.'
      });
    }

    const currentLifetimeEarned = Math.max(
      0,
      Number(targetAccount.gameData?.opals?.lifetimeEarned) || 0
    );
    const currentLifetimeSpent = Math.max(
      0,
      Number(targetAccount.gameData?.opals?.lifetimeSpent) || 0
    );
    const now = new Date();
    const transaction = {
      type: 'admin_adjustment',
      amount: signedAmount,
      reason,
      sourceType: 'admin',
      sourceId: account?.developmentBypass
        ? 'development'
        : String(account._id),
      balanceAfter: nextBalance,
      metadata: {
        adminUsername: account?.username || 'Development',
        direction
      },
      ...(!isRemoving ? createAccountNotificationState() : {}),
      createdAt: now
    };

    targetAccount.set('gameData.opals.balance', nextBalance);
    targetAccount.set(
      'gameData.opals.lifetimeEarned',
      isRemoving
        ? currentLifetimeEarned
        : currentLifetimeEarned + normalizedAmount
    );
    targetAccount.set('gameData.opals.lifetimeSpent', currentLifetimeSpent);
    targetAccount.set('profile.updatedAt', now);
    targetAccount.gameData.opalTransactions.push(transaction);
    if (!isRemoving && transaction.notificationId) {
      queueAccountNotification(targetAccount, {
        id: transaction.notificationId,
        type: 'opal_reward',
        createdAt: now,
        metadata: {
          amount: normalizedAmount,
          balance: nextBalance,
          label: 'Admin Opal grant',
          reason: 'Opals added to your account',
          sourceType: transaction.sourceType,
          sourceId: transaction.sourceId
        }
      });
    }
    await targetAccount.save();

    await createAdminLog(AdminLog, account, {
      action: isRemoving ? 'Removed user Opals' : 'Added user Opals',
      area: 'Users',
      target: {
        type: 'account',
        id: String(targetAccount._id),
        label: targetAccount.username || targetAccount.email || '-'
      },
      previousValue: { opalsBalance: currentBalance },
      newValue: {
        opalsBalance: nextBalance,
        amount: signedAmount,
        reason
      },
      severity: 'medium',
      metadata: {
        collection: 'accounts',
        transaction
      }
    });

    res.apiSuccess({
      data: {
        user: serializeOePanelUser(targetAccount),
        transaction
      },
      message: isRemoving ? 'Opals removed.' : 'Opals added.'
    });
  }

  app.post('/api/oe-panel/users/opals/add', async (req, res) => {
    try {
      await adjustUserOpals(req, res, 'add');
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to add OE Panel user Opals:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_user_opals_add_failed',
        message: 'Failed to add Opals'
      });
    }
  });

  app.post('/api/oe-panel/users/opals/remove', async (req, res) => {
    try {
      await adjustUserOpals(req, res, 'remove');
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to remove OE Panel user Opals:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'oe_panel_user_opals_remove_failed',
        message: 'Failed to remove Opals'
      });
    }
  });
}

module.exports = { registerOePanelUserOpalRoutes };

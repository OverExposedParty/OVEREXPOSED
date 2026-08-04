function registerOePanelUserDeletionRoutes(context) {
  const {
    app,
    Account,
    AdminLog,
    createAdminLog,
    requireOePanelAccount,
    requireOePanelPermission
  } = context;

  app.delete('/api/oe-panel/users/:accountId', async (req, res) => {
    try {
      const account = await requireOePanelAccount(req, res);
      if (!account) return;
      if (!requireOePanelPermission(account, res, 'users.delete')) return;

      const currentAccount = await Account.findById(
        req.params.accountId
      ).lean();
      if (!currentAccount) {
        return res.apiError({
          status: 404,
          code: 'oe_panel_user_not_found',
          message: 'User not found'
        });
      }

      const updatedAccount = await Account.findByIdAndUpdate(
        req.params.accountId,
        {
          $set: {
            'profile.accountStatus': 'deleted',
            'profile.updatedAt': new Date()
          }
        },
        { new: true }
      );

      await createAdminLog(AdminLog, account, {
        action: 'Deleted user',
        area: 'Users',
        target: {
          type: 'account',
          id: String(updatedAccount._id),
          label: updatedAccount.username || updatedAccount.email || '-'
        },
        previousValue: {
          username: currentAccount.username,
          email: currentAccount.email,
          status: currentAccount.profile?.accountStatus
        },
        newValue: { status: updatedAccount.profile?.accountStatus },
        severity: 'high',
        metadata: { collection: 'accounts' }
      });

      res.apiSuccess({ message: 'User marked as deleted' });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to delete OE Panel user:`, err);
      res.apiError({
        status: 500,
        code: 'oe_panel_user_delete_failed',
        message: 'Failed to delete user'
      });
    }
  });
}

module.exports = { registerOePanelUserDeletionRoutes };

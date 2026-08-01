function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeShopGrantType(value) {
  const type = String(value || '')
    .trim()
    .toLowerCase();
  const aliases = {
    consumable: 'oling_consumable',
    oling_consumable: 'oling_consumable',
    egg: 'oling_egg',
    oling_egg: 'oling_egg',
    headwear: 'oling_headwear',
    hat: 'oling_headwear',
    oling_headwear: 'oling_headwear',
    oe: 'oe',
    layer: 'oe',
    pack: 'pack',
    cosmetic: 'cosmetic',
    badge: 'badge'
  };

  return aliases[type] || type;
}

function normalizeShopGrantKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function registerPublicShopAdminRoutes(context) {
  const { app } = context;

  with (context) {
    app.post('/api/shop/admin/grant', async (req, res) => {
      try {
        const account = await requireOePanelAccount(req, res);
        if (!account) return;
        if (!requireOePanelPermission(account, res, 'shop.grants.manage')) {
          return;
        }

        const body = req.body || {};
        const accountLookup = String(
          body.accountId || body.username || body.target || ''
        )
          .trim()
          .replace(/^@+/, '');
        const type = normalizeShopGrantType(body.type || body.itemType);
        const key = normalizeShopGrantKey(body.key || body.itemKey);
        const quantityNumber = Number(body.quantity ?? 1);
        const quantity = Number.isFinite(quantityNumber)
          ? Math.trunc(quantityNumber)
          : 1;
        const reason =
          String(body.reason || '').trim() || 'Admin console shop grant';
        const validTypes = new Set([
          'oe',
          'pack',
          'cosmetic',
          'badge',
          'oling_egg',
          'oling_consumable',
          'oling_headwear'
        ]);

        if (!accountLookup) {
          return res.apiError({
            status: 400,
            code: 'shop_admin_grant_account_required',
            message: 'Account ID, username, or email is required.'
          });
        }

        if (!validTypes.has(type)) {
          return res.apiError({
            status: 400,
            code: 'shop_admin_grant_type_invalid',
            message:
              'Item type must be oe, pack, cosmetic, badge, egg, consumable, or headwear.'
          });
        }

        if (!key) {
          return res.apiError({
            status: 400,
            code: 'shop_admin_grant_key_required',
            message: 'Item key is required.'
          });
        }

        if (quantity <= 0 || quantity > 999) {
          return res.apiError({
            status: 400,
            code: 'shop_admin_grant_quantity_invalid',
            message: 'Quantity must be a whole number from 1 to 999.'
          });
        }

        let targetAccount = null;
        if (/^[a-f\d]{24}$/i.test(accountLookup)) {
          targetAccount = await Account.findById(accountLookup);
        }
        if (!targetAccount && accountLookup.includes('@')) {
          targetAccount = await Account.findOne({
            email: accountLookup.toLowerCase()
          });
        }
        if (!targetAccount) {
          targetAccount = await Account.findOne({
            username: {
              $regex: `^${escapeRegExp(accountLookup)}$`,
              $options: 'i'
            }
          });
        }

        if (!targetAccount) {
          return res.apiError({
            status: 404,
            code: 'shop_admin_grant_user_not_found',
            message: 'User not found.'
          });
        }

        const result = await grantShopItemsToAccount({
          Account,
          Achievement,
          OlingState,
          accountId: targetAccount._id,
          grants: [
            {
              type,
              key,
              quantity
            }
          ],
          metadata: {
            reason,
            adminAccountId: account?.developmentBypass
              ? 'development'
              : String(account._id),
            adminUsername: account?.username || 'Development'
          }
        });

        if (result.error) {
          return res.apiError(result.error);
        }

        await createAdminLog(AdminLog, account, {
          action: 'Granted shop item',
          area: 'Shop',
          target: {
            type: 'account',
            id: String(targetAccount._id),
            label: targetAccount.username || targetAccount.email || '-'
          },
          newValue: {
            type,
            key,
            quantity,
            reason
          },
          severity: 'medium',
          metadata: {
            collection: 'accounts',
            grant: result.grant
          }
        });

        return res.apiSuccess(
          {
            message: 'Shop item granted.',
            grant: result.grant,
            target: {
              id: String(targetAccount._id),
              username: targetAccount.username || null,
              email: targetAccount.email || null
            }
          },
          201
        );
      } catch (err) {
        console.error(`[REQ ${req.id}] Failed to grant shop item:`, err);
        return res.apiError({
          status: 500,
          code: 'shop_admin_grant_failed',
          message: 'Failed to grant shop item.'
        });
      }
    });
  }
}

module.exports = {
  registerPublicShopAdminRoutes
};

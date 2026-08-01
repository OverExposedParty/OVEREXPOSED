function createOlingRouteSupport(context) {
  const {
    getCurrentAccount,
    requireFeatureAccess,
    Product,
    QUICK_SELL_RATE,
    clampInteger,
    Account,
    serializeOlingLab,
    findCurrentRoomEgg,
    requireOePanelAccount,
    requireOePanelPermission,
    getOrCreateOlingState,
    OlingState
  } = context;

  async function requireOlingLabAccess(req, res, next) {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to use your Olings Lab.'
        });
      }
      if (!requireFeatureAccess(account, res, 'olings.lab')) return;
      return next();
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to verify Olings Lab access:`, err);
      return res.apiError({
        status: 500,
        code: 'oling_lab_access_check_failed',
        message: 'Failed to check Olings Lab access.'
      });
    }
  }

  async function getQuickSellQuote(itemType, itemKey, quantity) {
    const grantType = itemType === 'egg' ? 'oling_egg' : 'oling_consumable';
    if (!Product || !grantType || !itemKey) return null;
    const product = await Product.findOne({
      $or: [
        {
          'digitalEntitlement.grants': {
            $elemMatch: { type: grantType, key: itemKey }
          }
        },
        {
          'variants.digitalEntitlement.grants': {
            $elemMatch: { type: grantType, key: itemKey }
          }
        }
      ]
    }).lean();
    if (!product) return null;

    const entitlements = [
      ...(product.variants || []).map(
        (variant) => variant.digitalEntitlement || {}
      ),
      product.digitalEntitlement || {}
    ];
    const entitlement = entitlements.find((entry) =>
      (entry.grants || []).some(
        (grant) => grant.type === grantType && grant.key === itemKey
      )
    );
    const grant = (entitlement?.grants || []).find(
      (entry) => entry.type === grantType && entry.key === itemKey
    );
    const shopValue = Math.max(0, Number(entitlement?.opalPrice?.amount || 0));
    const grantQuantity = Math.max(1, Number(grant?.quantity || 1));
    const unitValue = Math.floor(shopValue / grantQuantity);
    const unitPayout = Math.floor(unitValue * QUICK_SELL_RATE);
    const normalizedQuantity = clampInteger(quantity, 1, 999, 1);

    return {
      itemType,
      itemKey,
      quantity: normalizedQuantity,
      productName: product.identity?.name || itemKey,
      shopValue: unitValue,
      unitPayout,
      payout: unitPayout * normalizedQuantity
    };
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function findAdminOlingTargetAccount(accountLookup) {
    const lookup = String(accountLookup || '')
      .trim()
      .replace(/^@+/, '');
    if (!lookup) return null;

    if (/^[a-f\d]{24}$/i.test(lookup)) {
      const account = await Account.findById(lookup);
      if (account) return account;
    }

    if (lookup.includes('@')) {
      const account = await Account.findOne({ email: lookup.toLowerCase() });
      if (account) return account;
    }

    return Account.findOne({
      username: { $regex: `^${escapeRegExp(lookup)}$`, $options: 'i' }
    });
  }

  function serializeAdminOlingRoom(targetAccount, olingState) {
    const lab = serializeOlingLab(olingState?.lab);
    const currentEgg = findCurrentRoomEgg(lab);

    return {
      target: {
        id: String(targetAccount._id),
        username: targetAccount.username || null,
        email: targetAccount.email || null
      },
      lab,
      currentEgg,
      inventory: {
        eggs: Array.isArray(olingState?.inventory?.eggs)
          ? olingState.inventory.eggs
          : [],
        consumables: Array.isArray(olingState?.inventory?.consumables)
          ? olingState.inventory.consumables
          : [],
        olings: Array.isArray(olingState?.inventory?.pets)
          ? olingState.inventory.pets
          : []
      }
    };
  }

  async function requireAdminOlingTarget(req, res) {
    const account = await requireOePanelAccount(req, res);
    if (!account) return null;
    if (!requireOePanelPermission(account, res, 'olings.hatch.manage')) {
      return null;
    }

    const targetLookup =
      req.body?.target ||
      req.body?.username ||
      req.body?.accountId ||
      req.query?.target ||
      req.query?.username ||
      req.query?.accountId;
    const targetAccount = await findAdminOlingTargetAccount(targetLookup);

    if (!targetAccount) {
      res.apiError({
        status: 404,
        code: 'oling_admin_user_not_found',
        message: 'User not found.'
      });
      return null;
    }

    const olingState = await getOrCreateOlingState(OlingState, targetAccount);

    return { account, targetAccount, olingState };
  }

  return {
    requireOlingLabAccess,
    getQuickSellQuote,
    escapeRegExp,
    findAdminOlingTargetAccount,
    serializeAdminOlingRoom,
    requireAdminOlingTarget
  };
}

module.exports = { createOlingRouteSupport };

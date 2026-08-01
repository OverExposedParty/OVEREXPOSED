const { recordPackOwnershipAchievements } = require('../achievements');
const { findProductVariant, getEntitlementConfig, normalizeGrant, normalizeAdminGrant } = require('./catalog');
const { grantOlingInventory } = require('./inventory');

async function spendOpalsForProduct({
  Account,
  Achievement = null,
  OlingState = null,
  accountId,
  product,
  variantSku = null
}) {
  const variant = findProductVariant(product, variantSku);
  if (!variant) {
    return {
      error: {
        status: 404,
        code: 'product_variant_not_found',
        message: 'That product option could not be found.'
      }
    };
  }

  const entitlement = getEntitlementConfig(product, variant);
  if (!entitlement.purchaseMethods.includes('opals')) {
    return {
      error: {
        status: 400,
        code: 'opals_not_supported',
        message: 'This item cannot be bought with Opals.'
      }
    };
  }

  if (entitlement.opalPrice <= 0) {
    return {
      error: {
        status: 400,
        code: 'opal_price_missing',
        message: 'This item does not have an Opal price yet.'
      }
    };
  }

  const grants = entitlement.grants
    .map((grant) => normalizeGrant(grant, product, variant))
    .filter(Boolean)
    .map((grant) => ({
      ...grant,
      metadata: {
        ...grant.metadata,
        opalPrice: entitlement.opalPrice
      }
    }));
  const eggGrants = grants.filter((grant) => grant.type === 'oling_egg');
  const consumableGrants = grants.filter(
    (grant) => grant.type === 'oling_consumable'
  );
  const furnitureGrants = grants.filter(
    (grant) => grant.type === 'oling_furniture'
  );
  const unlockGrants = grants.filter(
    (grant) => !['oling_egg', 'oling_consumable'].includes(grant.type)
  );

  if (!grants.length) {
    return {
      error: {
        status: 400,
        code: 'product_grants_missing',
        message: 'This item does not grant anything yet.'
      }
    };
  }

  const ownershipGuards = unlockGrants.map((grant) => ({
    'gameData.inGamePurchasesAndUnlocks': {
      $not: {
        $elemMatch: {
          type: grant.type,
          key: grant.key
        }
      }
    }
  }));
  const now = new Date();
  const transaction = {
    type: 'spend',
    amount: -entitlement.opalPrice,
    reason: `Bought ${product.identity?.name || 'shop item'}`,
    sourceType: 'shop_purchase',
    sourceId: product._id?.toString?.() || product.system?.id || null,
    balanceAfter: {
      $subtract: [
        {
          $ifNull: ['$gameData.opals.balance', 0]
        },
        entitlement.opalPrice
      ]
    },
    metadata: {
      productId: product._id?.toString?.() || product.system?.id || null,
      productSlug: product.identity?.slug || null,
      productName: product.identity?.name || null,
      variantSku: variant.inventory?.sku || null,
      variantName: variant.name || null,
      grants: grants.map((grant) => ({
        type: grant.type,
        key: grant.key,
        quantity: grant.quantity || 1
      }))
    },
    createdAt: now
  };

  let account = await Account.findOneAndUpdate(
    {
      _id: accountId,
      'gameData.opals.balance': { $gte: entitlement.opalPrice },
      ...(ownershipGuards.length ? { $and: ownershipGuards } : {})
    },
    [
      {
        $set: {
          'gameData.opals.balance': {
            $subtract: [
              {
                $ifNull: ['$gameData.opals.balance', 0]
              },
              entitlement.opalPrice
            ]
          },
          'gameData.opals.lifetimeSpent': {
            $add: [
              {
                $ifNull: ['$gameData.opals.lifetimeSpent', 0]
              },
              entitlement.opalPrice
            ]
          },
          'gameData.inGamePurchasesAndUnlocks': {
            $concatArrays: [
              {
                $ifNull: ['$gameData.inGamePurchasesAndUnlocks', []]
              },
              unlockGrants
            ]
          },
          'gameData.opalTransactions': {
            $concatArrays: [
              {
                $ifNull: ['$gameData.opalTransactions', []]
              },
              [transaction]
            ]
          }
        }
      }
    ],
    { new: true }
  );

  if (!account) {
    return {
      error: {
        status: 409,
        code: 'opals_purchase_rejected',
        message:
          'You may not have enough Opals, or this item is already unlocked.'
      }
    };
  }

  const inventoryGrant = await grantOlingInventory({
    OlingState,
    account,
    accountId,
    eggGrants,
    consumableGrants,
    furnitureGrants,
    now
  });
  if (inventoryGrant?.account) {
    account = inventoryGrant.account;
  }
  const olingState = inventoryGrant?.olingState || null;

  await recordPackOwnershipAchievements({
    Achievement,
    account,
    source: 'shop-opals-purchase'
  });

  return {
    account,
    olingState,
    purchase: {
      productId: product._id?.toString?.() || product.system?.id || null,
      productSlug: product.identity?.slug || null,
      productName: product.identity?.name || null,
      variantSku: variant.inventory?.sku || null,
      variantName: variant.name || null,
      opalPrice: entitlement.opalPrice,
      grants
    }
  };
}

async function grantShopItemsToAccount({
  Account,
  Achievement = null,
  OlingState = null,
  accountId,
  grants,
  metadata = {}
}) {
  const normalizedGrants = (Array.isArray(grants) ? grants : [])
    .map((grant) => normalizeAdminGrant(grant, metadata))
    .filter(Boolean);

  if (!normalizedGrants.length) {
    return {
      error: {
        status: 400,
        code: 'shop_admin_grants_missing',
        message: 'Choose at least one valid shop item to grant.'
      }
    };
  }

  let account = await Account.findById(accountId);
  if (!account) {
    return {
      error: {
        status: 404,
        code: 'shop_admin_target_not_found',
        message: 'That account could not be found.'
      }
    };
  }

  const now = new Date();
  const eggGrants = normalizedGrants.filter(
    (grant) => grant.type === 'oling_egg'
  );
  const consumableGrants = normalizedGrants.filter(
    (grant) => grant.type === 'oling_consumable'
  );
  const furnitureGrants = normalizedGrants.filter(
    (grant) => grant.type === 'oling_furniture'
  );
  const unlockGrants = normalizedGrants.filter(
    (grant) => !['oling_egg', 'oling_consumable'].includes(grant.type)
  );
  const existingUnlocks = Array.isArray(
    account.gameData?.inGamePurchasesAndUnlocks
  )
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];
  const addedUnlocks = [];
  const skippedUnlocks = [];

  unlockGrants.forEach((grant) => {
    const alreadyUnlocked = existingUnlocks.some(
      (unlock) => unlock?.type === grant.type && unlock?.key === grant.key
    );

    if (alreadyUnlocked) {
      skippedUnlocks.push({
        type: grant.type,
        key: grant.key,
        reason: 'already_unlocked'
      });
      return;
    }

    addedUnlocks.push(grant);
  });

  if (addedUnlocks.length) {
    account.set('gameData.inGamePurchasesAndUnlocks', [
      ...existingUnlocks,
      ...addedUnlocks
    ]);
    account.set('profile.updatedAt', now);
    await account.save({ validateBeforeSave: false });
  }

  const inventoryGrant = await grantOlingInventory({
    OlingState,
    account,
    accountId,
    eggGrants,
    consumableGrants,
    furnitureGrants,
    now
  });

  if (inventoryGrant?.account) {
    account = inventoryGrant.account;
  } else if (addedUnlocks.length) {
    account = (await Account.findById(accountId)) || account;
  }

  await recordPackOwnershipAchievements({
    Achievement,
    account,
    source: 'shop-admin-grant'
  });

  return {
    account,
    olingState: inventoryGrant?.olingState || null,
    grant: {
      grants: normalizedGrants,
      addedUnlocks,
      skippedUnlocks
    }
  };
}

module.exports = {
  spendOpalsForProduct,
  grantShopItemsToAccount
};

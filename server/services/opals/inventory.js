const { toPositiveInteger } = require('./catalog');

function mergeQuantityInventoryItems(items, grants, now) {
  const nextItems = Array.isArray(items) ? [...items] : [];

  grants.forEach((grant) => {
    const existing = nextItems.find((item) => item?.key === grant.key);
    if (existing) {
      existing.quantity = toPositiveInteger(existing.quantity) + grant.quantity;
      existing.rarity =
        existing.rarity || grant.metadata?.rarity || grant.rarity || 'common';
      existing.lastUpdatedAt = now;
      existing.metadata = grant.metadata || {};
      return;
    }

    nextItems.push({
      key: grant.key,
      rarity: grant.metadata?.rarity || grant.rarity || 'common',
      quantity: grant.quantity,
      acquiredAt: now,
      lastUpdatedAt: now,
      metadata: grant.metadata || {}
    });
  });

  return nextItems;
}

function getLegacyOlingInventory(account) {
  const inventory = account?.olings || {};
  const legacyInventory = account?.gameData?.olingInventory || {};
  const list = (current, legacy) =>
    Array.isArray(current) && current.length
      ? current
      : Array.isArray(legacy)
        ? legacy
        : [];

  return {
    eggs: list(inventory.eggs, legacyInventory.eggs),
    consumables: list(inventory.consumables, legacyInventory.consumables),
    furniture: list(inventory.furniture, legacyInventory.furniture),
    pets: list(inventory.olings || inventory.pets, legacyInventory.pets),
    hatchHistory: list(inventory.hatchHistory, legacyInventory.hatchHistory)
  };
}

async function clearLegacyOlingInventory(account) {
  if (!account?._id || !account.constructor?.updateOne) return;

  await account.constructor.updateOne(
    { _id: account._id },
    {
      $unset: {
        'gameData.olingInventory': '',
        'gameData.olingLab': ''
      }
    },
    { runValidators: false }
  );
}

async function grantOlingInventory({
  OlingState = null,
  account,
  accountId,
  eggGrants,
  consumableGrants,
  furnitureGrants,
  now
}) {
  if (
    !account ||
    (!eggGrants.length && !consumableGrants.length && !furnitureGrants.length)
  ) {
    return null;
  }

  const inventory = getLegacyOlingInventory(account);
  const storedState = OlingState?.findOne
    ? await OlingState.findOne({ ownerId: accountId }).lean()
    : null;
  const storedInventory = storedState?.inventory || {};
  const list = (current, stored) =>
    Array.isArray(current) && current.length
      ? current
      : Array.isArray(stored)
        ? stored
        : [];
  const baseInventory = {
    eggs: list(inventory.eggs, storedInventory.eggs),
    consumables: list(inventory.consumables, storedInventory.consumables),
    furniture: list(inventory.furniture, storedInventory.furniture),
    pets: list(inventory.pets, storedInventory.pets),
    hatchHistory: list(inventory.hatchHistory, storedInventory.hatchHistory)
  };
  const nextOlings = {
    ...(account.olings?.toObject?.() || account.olings || {}),
    eggs: mergeQuantityInventoryItems(baseInventory.eggs, eggGrants, now),
    consumables: mergeQuantityInventoryItems(
      baseInventory.consumables,
      consumableGrants,
      now
    ),
    furniture: mergeQuantityInventoryItems(
      baseInventory.furniture,
      furnitureGrants,
      now
    ),
    olings: baseInventory.pets,
    hatchHistory: baseInventory.hatchHistory,
    lab:
      account.olings?.lab ||
      account.gameData?.olingLab ||
      storedState?.lab ||
      {}
  };

  let savedAccount = account;
  const AccountModel = account.constructor;

  if (AccountModel?.findByIdAndUpdate) {
    savedAccount =
      (await AccountModel.findByIdAndUpdate(
        accountId,
        { $set: { olings: nextOlings } },
        { new: true }
      )) || account;
  } else {
    account.set('olings', nextOlings);
    await account.save();
  }

  await clearLegacyOlingInventory(savedAccount);

  return {
    account: savedAccount,
    olingState: {
      ownerId: accountId,
      inventory: {
        eggs: savedAccount.olings?.eggs || [],
        consumables: savedAccount.olings?.consumables || [],
        furniture: savedAccount.olings?.furniture || [],
        pets: savedAccount.olings?.olings || [],
        hatchHistory: savedAccount.olings?.hatchHistory || []
      },
      lab: savedAccount.olings?.lab || null
    }
  };
}

module.exports = {
  mergeQuantityInventoryItems,
  getLegacyOlingInventory,
  clearLegacyOlingInventory,
  grantOlingInventory
};

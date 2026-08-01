const { STARTER_OLING_EGG_KEY } = require('./shared');

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

function getLegacyOlingLab(account) {
  const lab = account?.olings?.lab || account?.gameData?.olingLab;
  return lab && Array.isArray(lab.placedItems) ? lab : {};
}

function createStarterOlingInventory(acquiredAt = new Date()) {
  return {
    eggs: [
      {
        key: STARTER_OLING_EGG_KEY,
        rarity: 'common',
        quantity: 1,
        acquiredAt,
        lastUpdatedAt: acquiredAt,
        metadata: { source: 'starter_oling_lab' }
      }
    ],
    consumables: [],
    furniture: [],
    pets: [],
    hatchHistory: []
  };
}

function createStarterOlingLab(placedAt = new Date()) {
  return {
    roomLevel: 1,
    columns: 3,
    rows: 2,
    unlockedCells: ['0:0', '0:1', '0:2', '1:0', '1:1', '1:2'],
    placedItems: [
      {
        placedId: 'door',
        itemId: 'standard_door',
        itemType: 'door',
        rarity: 'common',
        row: 1,
        col: 0,
        width: 1,
        height: 1,
        locked: true,
        containerSlots: [
          {
            slotId: 'door-module',
            itemId: null,
            itemType: null,
            inventorySlots: [],
            placedId: null,
            placedAt: null
          }
        ],
        placedAt
      },
      {
        placedId: 'starter_table',
        itemId: 'standard_table',
        itemType: 'table',
        rarity: 'common',
        row: 1,
        col: 1,
        width: 1,
        height: 1,
        locked: false,
        containerSlots: [
          {
            slotId: 'tabletop',
            itemId: 'incubeta',
            itemType: 'incubator',
            placedId: 'starter_incubeta',
            placedAt,
            inventorySlots: [
              {
                slotId: 'egg',
                slotType: 'egg',
                itemKey: STARTER_OLING_EGG_KEY,
                itemType: 'egg',
                quantity: 1,
                placedAt,
                influenceSlots: []
              }
            ]
          }
        ],
        placedAt
      }
    ],
    updatedAt: placedAt
  };
}

function hasLegacyOlingData(account) {
  const inventory = account?.gameData?.olingInventory || {};
  const lab = account?.gameData?.olingLab;

  return (
    ['eggs', 'consumables', 'furniture', 'pets', 'hatchHistory'].some(
      (key) => Array.isArray(inventory[key]) && inventory[key].length > 0
    ) ||
    (lab && Array.isArray(lab.placedItems) && lab.placedItems.length > 0)
  );
}

async function clearLegacyOlingState(account) {
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

function getAccountOlingState(account) {
  if (!account?._id) return null;

  const inventory = getLegacyOlingInventory(account);
  return {
    ownerId: account._id,
    inventory,
    lab: getLegacyOlingLab(account)
  };
}

function hasOlingInventoryData(inventory) {
  return ['eggs', 'consumables', 'furniture', 'pets', 'hatchHistory'].some(
    (key) => Array.isArray(inventory?.[key]) && inventory[key].length > 0
  );
}

function hasOlingLabData(lab) {
  return lab && Array.isArray(lab.placedItems) && lab.placedItems.length > 0;
}

async function getOrCreateOlingState(_OlingState, account) {
  const ownerId = account?._id || account;
  if (!ownerId) return null;
  if (!account?._id || !account.constructor?.updateOne) {
    return null;
  }

  const storedState = _OlingState?.findOne
    ? await _OlingState.findOne({ ownerId }).lean()
    : null;
  const inventory = getLegacyOlingInventory(account);
  const storedInventory = storedState?.inventory || {};
  const list = (current, stored) =>
    Array.isArray(current) && current.length
      ? current
      : Array.isArray(stored)
        ? stored
        : [];
  let mergedInventory = {
    eggs: list(inventory.eggs, storedInventory.eggs),
    consumables: list(inventory.consumables, storedInventory.consumables),
    furniture: list(inventory.furniture, storedInventory.furniture),
    pets: list(inventory.pets, storedInventory.pets),
    hatchHistory: list(inventory.hatchHistory, storedInventory.hatchHistory)
  };
  const accountLab = getLegacyOlingLab(account);
  const storedLab = storedState?.lab;
  let lab =
    accountLab && Array.isArray(accountLab.placedItems)
      ? accountLab
      : storedLab && Array.isArray(storedLab.placedItems)
        ? storedLab
        : {};
  const firstTimeLab =
    !storedState &&
    !hasLegacyOlingData(account) &&
    !hasOlingInventoryData(mergedInventory) &&
    !hasOlingLabData(accountLab) &&
    !hasOlingLabData(storedLab);

  if (firstTimeLab) {
    const starterAt = new Date();
    mergedInventory = createStarterOlingInventory(starterAt);
    lab = createStarterOlingLab(starterAt);
  }
  const hasCompleteOlings =
    account.olings &&
    Array.isArray(account.olings.eggs) &&
    Array.isArray(account.olings.consumables) &&
    Array.isArray(account.olings.furniture) &&
    Array.isArray(account.olings.olings) &&
    Array.isArray(account.olings.hatchHistory) &&
    account.olings.lab;
  const hasAccountOlingData =
    ['eggs', 'consumables', 'furniture', 'olings', 'hatchHistory'].some(
      (key) =>
        Array.isArray(account.olings?.[key]) && account.olings[key].length
    ) ||
    (account.olings?.lab &&
      Array.isArray(account.olings.lab.placedItems) &&
      account.olings.lab.placedItems.length);

  if (
    !hasCompleteOlings ||
    hasLegacyOlingData(account) ||
    (storedState && !hasAccountOlingData)
  ) {
    const nextOlings = {
      eggs: mergedInventory.eggs,
      consumables: mergedInventory.consumables,
      furniture: mergedInventory.furniture,
      olings: mergedInventory.pets,
      hatchHistory: mergedInventory.hatchHistory,
      adventures: account.olings?.adventures || { active: null, history: [] },
      lab
    };
    await account.constructor.updateOne(
      { _id: account._id },
      { $set: { olings: nextOlings } },
      { runValidators: false }
    );
    account.set('olings', nextOlings);
    await clearLegacyOlingState(account);
  }

  return getAccountOlingState(account);
}

async function consumeOwnedConsumable({ Account }, accountId, consumableKey) {
  const account = await Account.findById(accountId);
  if (!account) return null;
  await getOrCreateOlingState(null, account);

  const updatedAccount = await Account.findOneAndUpdate(
    {
      _id: accountId,
      'olings.consumables': {
        $elemMatch: {
          key: consumableKey,
          quantity: { $gt: 0 }
        }
      }
    },
    {
      $inc: {
        'olings.consumables.$.quantity': -1
      },
      $set: {
        'olings.consumables.$.lastUpdatedAt': new Date()
      }
    },
    { new: true, runValidators: false }
  );

  if (!updatedAccount) return null;

  const olingState = getAccountOlingState(updatedAccount);
  const consumableInventory = olingState.inventory?.consumables || [];
  const inventoryItem = consumableInventory.find(
    (item) => item.key === consumableKey
  );
  const quantityAfter = Number(inventoryItem?.quantity) || 0;

  return {
    account: updatedAccount,
    olingState,
    quantityAfter,
    quantityBefore: quantityAfter + 1
  };
}

async function consumeOwnedEgg({ Account }, accountId, eggKey) {
  const account = await Account.findById(accountId);
  if (!account) return null;
  await getOrCreateOlingState(null, account);

  const updatedAccount = await Account.findOneAndUpdate(
    {
      _id: accountId,
      'olings.eggs': {
        $elemMatch: {
          key: eggKey,
          quantity: { $gt: 0 }
        }
      }
    },
    {
      $inc: {
        'olings.eggs.$.quantity': -1
      },
      $set: {
        'olings.eggs.$.lastUpdatedAt': new Date()
      }
    },
    { new: true, runValidators: false }
  );

  if (!updatedAccount) return null;

  const olingState = getAccountOlingState(updatedAccount);
  const eggInventory = olingState.inventory?.eggs || [];
  const inventoryEgg = eggInventory.find((egg) => egg.key === eggKey);
  const quantityAfter = Number(inventoryEgg?.quantity) || 0;

  return {
    account: updatedAccount,
    olingState,
    quantityAfter,
    quantityBefore: quantityAfter + 1
  };
}


module.exports = {
  getOrCreateOlingState,
  getAccountOlingState,
  consumeOwnedConsumable,
  consumeOwnedEgg
};

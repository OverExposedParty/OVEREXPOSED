const {
  STARTER_FURNITURE_KEYS,
  OlingLabItems
} = require('../lab-catalog');
const { normalizeInfluenceSlots } = require('../lab-incubation');
const { clampInteger } = require('./defaults');

function getOwnedLabFurniture(account, olingState = null) {
  const owned = new Set(STARTER_FURNITURE_KEYS);
  const furniture = Array.isArray(olingState?.inventory?.furniture)
    ? olingState.inventory.furniture
    : [];
  const unlocks = Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];

  furniture.forEach((item) => {
    if (item?.key && Number(item.quantity || 0) > 0) owned.add(item.key);
  });
  unlocks.forEach((unlock) => {
    if (unlock?.type === 'oling_furniture' && unlock.key) {
      owned.add(unlock.key);
    }
  });

  return owned;
}

function ensureAccountOlingDocument(account, olingState = null) {
  const current =
    account?.olings && !Array.isArray(account.olings) ? account.olings : {};
  const inventory = olingState?.inventory || {};
  account.set('olings', {
    eggs: Array.isArray(current.eggs) ? current.eggs : inventory.eggs || [],
    consumables: Array.isArray(current.consumables)
      ? current.consumables
      : inventory.consumables || [],
    furniture: Array.isArray(current.furniture)
      ? current.furniture
      : inventory.furniture || [],
    olings: Array.isArray(current.olings)
      ? current.olings
      : inventory.pets || [],
    hatchHistory: Array.isArray(current.hatchHistory)
      ? current.hatchHistory
      : inventory.hatchHistory || [],
    lab:
      current.lab && Array.isArray(current.lab.placedItems)
        ? current.lab
        : olingState?.lab || {}
  });
}

function ensureContainerSlots(placedItem) {
  const definition = OlingLabItems[placedItem.itemId];
  const slotDefinitions = Array.isArray(definition?.containerSlots)
    ? definition.containerSlots
    : [];
  const existingSlots = Array.isArray(placedItem.containerSlots)
    ? placedItem.containerSlots
    : [];

  return slotDefinitions.map((slot) => {
    const existing = existingSlots.find((item) => item?.slotId === slot.slotId);
    return {
      slotId: slot.slotId,
      itemId: existing?.itemId || null,
      itemType:
        existing?.itemType ||
        OlingLabItems[existing?.itemId]?.type ||
        OlingLabItems[existing?.itemId]?.category ||
        null,
      inventorySlots: ensureItemInventorySlots(
        existing?.itemId,
        existing?.inventorySlots
      ),
      placedId: existing?.placedId || null,
      placedAt: existing?.placedAt || null
    };
  });
}

function ensureItemInventorySlots(itemId, existingInventorySlots) {
  const definition = OlingLabItems[itemId];
  const slotDefinitions = Array.isArray(definition?.inventorySlots)
    ? definition.inventorySlots
    : [];
  const existingSlots = Array.isArray(existingInventorySlots)
    ? existingInventorySlots
    : [];

  return slotDefinitions.map((slot) => {
    const existing = existingSlots.find((item) => item?.slotId === slot.slotId);
    return {
      slotId: slot.slotId,
      slotType: slot.slotType || 'item',
      itemKey: slot.slotType === 'storage' ? null : existing?.itemKey || null,
      itemType: slot.slotType === 'storage' ? null : existing?.itemType || null,
      quantity:
        slot.slotType === 'storage'
          ? 0
          : existing?.itemKey
            ? clampInteger(existing?.quantity, 1, slot.maxStack || 1, 1)
            : 0,
      placedAt: slot.slotType === 'storage' ? null : existing?.placedAt || null,
      readyNotificationDeliveredAt:
        slot.slotType === 'storage'
          ? null
          : existing?.readyNotificationDeliveredAt || null,
      influenceSlots: normalizeInfluenceSlots(existing?.influenceSlots)
    };
  });
}

function getContainerSlotDefinition(parentItemId, slotId) {
  const parentDefinition = OlingLabItems[parentItemId];
  const slotDefinitions = Array.isArray(parentDefinition?.containerSlots)
    ? parentDefinition.containerSlots
    : [];
  return slotDefinitions.find((slot) => slot?.slotId === slotId) || null;
}

function containerSlotAcceptsItem(parentItemId, slotId, childDefinition) {
  const slotDefinition = getContainerSlotDefinition(parentItemId, slotId);
  const acceptedTypes = Array.isArray(slotDefinition?.accepts)
    ? slotDefinition.accepts
    : [];
  if (!acceptedTypes.length) return true;

  return acceptedTypes.includes(
    childDefinition?.type || childDefinition?.category
  );
}

function getOwnedEggQuantities(olingState) {
  const eggs = Array.isArray(olingState?.inventory?.eggs)
    ? olingState.inventory.eggs
    : [];
  const quantities = new Map();

  eggs.forEach((egg) => {
    if (!egg?.key) return;
    quantities.set(egg.key, Number(egg.quantity || 0));
  });

  return quantities;
}

function getOwnedConsumableQuantities(olingState) {
  const consumables = Array.isArray(olingState?.inventory?.consumables)
    ? olingState.inventory.consumables
    : [];
  return new Map(
    consumables
      .filter((item) => item?.key)
      .map((item) => [item.key, Number(item.quantity || 0)])
  );
}

function getReservedLabItemQuantity(lab, itemType, itemKey) {
  let quantity = 0;
  const countSlots = (slots) =>
    (slots || []).forEach((slot) => {
      if (slot?.itemType === itemType && slot?.itemKey === itemKey) {
        quantity += Number(slot.quantity || 1);
      }
    });
  (lab?.placedItems || []).forEach((placedItem) => {
    countSlots(placedItem.inventorySlots);
    (placedItem.containerSlots || []).forEach((containerSlot) => {
      countSlots(containerSlot.inventorySlots);
    });
  });
  return quantity;
}

module.exports = {
  getOwnedLabFurniture,
  ensureAccountOlingDocument,
  ensureContainerSlots,
  ensureItemInventorySlots,
  getContainerSlotDefinition,
  containerSlotAcceptsItem,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  getReservedLabItemQuantity
};

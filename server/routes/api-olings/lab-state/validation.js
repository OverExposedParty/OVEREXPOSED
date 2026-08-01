const { OlingLabItems } = require('../lab-catalog');
const { clampInteger } = require('./defaults');
const {
  containerSlotAcceptsItem,
  ensureItemInventorySlots
} = require('./inventory');

function validateItemInventorySlots(itemId, normalizedSlots, context) {
  const definition = OlingLabItems[itemId];
  const slotDefinitions = Array.isArray(definition?.inventorySlots)
    ? definition.inventorySlots
    : [];

  for (const slot of normalizedSlots) {
    if (!slot.itemKey) continue;
    const slotDefinition = slotDefinitions.find(
      (item) => item.slotId === slot.slotId
    );
    const quantity = clampInteger(
      slot.quantity,
      1,
      slotDefinition?.maxStack || 1,
      1
    );
    const isEgg = slot.itemType === 'egg';
    const isConsumable = slot.itemType === 'consumable';
    if (slotDefinition?.slotType === 'egg' && !isEgg) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_inventory_slot_invalid',
          message: 'That inventory slot cannot hold that item.'
        }
      };
    }
    if (slotDefinition?.slotType === 'storage' && !isEgg && !isConsumable) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_inventory_slot_invalid',
          message: 'Shelves can only hold eggs and consumables.'
        }
      };
    }
    const ownedQuantities = isEgg
      ? context.ownedEggQuantities
      : context.ownedConsumableQuantities;
    const usedQuantities = isEgg
      ? context.usedEggQuantities
      : context.usedConsumableQuantities;
    if (!ownedQuantities || !usedQuantities) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_inventory_item_invalid',
          message: 'That item cannot be stored here.'
        }
      };
    }
    const nextUsed = (usedQuantities.get(slot.itemKey) || 0) + quantity;
    if (nextUsed > (ownedQuantities.get(slot.itemKey) || 0)) {
      return {
        error: {
          status: 403,
          code: 'oling_lab_inventory_item_not_owned',
          message: 'You do not own enough of that item.'
        }
      };
    }
    slot.quantity = quantity;
    slot.itemType = isEgg ? 'egg' : 'consumable';
    slot.placedAt = slot.placedAt || new Date();
    usedQuantities.set(slot.itemKey, nextUsed);
  }
  return null;
}

function validateContainerSlotItems(
  parentItemId,
  parentPlacedId,
  normalizedSlots,
  context
) {
  for (const slot of normalizedSlots) {
    if (!slot.itemId) continue;
    const childDefinition = OlingLabItems[slot.itemId];
    if (!childDefinition || childDefinition.layer !== 'container') {
      return {
        error: {
          status: 400,
          code: 'oling_lab_container_item_invalid',
          message: 'That item cannot be placed inside this furniture.'
        }
      };
    }
    if (!context.owned.has(slot.itemId)) {
      return {
        error: {
          status: 403,
          code: 'oling_lab_container_item_not_owned',
          message: 'You do not own that lab item.'
        }
      };
    }
    if (
      Array.isArray(childDefinition.acceptedSlots) &&
      !childDefinition.acceptedSlots.includes(slot.slotId)
    ) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_container_slot_invalid',
          message: 'That item does not fit there.'
        }
      };
    }
    if (!containerSlotAcceptsItem(parentItemId, slot.slotId, childDefinition)) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_container_slot_invalid',
          message: 'That item does not fit there.'
        }
      };
    }
    if (context.usedItemIds.has(slot.itemId)) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_item_already_placed',
          message: 'That lab item is already placed.'
        }
      };
    }
    slot.itemType = childDefinition.type || childDefinition.category || null;
    slot.inventorySlots = ensureItemInventorySlots(
      slot.itemId,
      slot.inventorySlots
    );

    const inventoryValidation = validateItemInventorySlots(
      slot.itemId,
      slot.inventorySlots,
      context
    );
    if (inventoryValidation?.error) return inventoryValidation;
    slot.placedId =
      String(slot.placedId || '')
        .trim()
        .slice(0, 80) || `${slot.itemId}_${parentPlacedId}_${slot.slotId}`;
    slot.placedAt = slot.placedAt || new Date();
    context.usedItemIds.add(slot.itemId);
  }

  return null;
}

module.exports = {
  validateItemInventorySlots,
  validateContainerSlotItems
};

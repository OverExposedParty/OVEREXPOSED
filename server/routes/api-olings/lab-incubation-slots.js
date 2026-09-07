const { OlingLabItems } = require('./lab-catalog');
const {
  getIncubatorInfluenceSlotDefinitions
} = require('./lab-incubation-config');

const LEGACY_INFLUENCE_SLOT_KEYS = new Set(['hatch', 'rarity', 'matching-set']);

function normalizeInfluenceSlots(value, incubator) {
  if (!Array.isArray(value)) return [];
  const slotDefinitions = getIncubatorInfluenceSlotDefinitions(incubator);
  const availableSlotKeys = slotDefinitions.map((slot) => slot.key);
  const allowedSlotKeys = new Set(availableSlotKeys);
  const usedSlots = new Set();
  const usedItems = new Set();
  return value
    .map((item) => {
      const requestedSlotKey = String(item?.slotKey || '').trim();
      const itemKey = String(item?.itemKey || '').trim();
      if (!requestedSlotKey || !itemKey || usedItems.has(itemKey)) return null;
      let slotKey = allowedSlotKeys.has(requestedSlotKey)
        ? requestedSlotKey
        : null;
      if (!slotKey && LEGACY_INFLUENCE_SLOT_KEYS.has(requestedSlotKey)) {
        slotKey = availableSlotKeys.find((key) => !usedSlots.has(key)) || null;
      }
      if (!slotKey || usedSlots.has(slotKey)) return null;
      usedSlots.add(slotKey);
      usedItems.add(itemKey);
      return {
        slotKey,
        itemKey,
        itemType: 'consumable',
        reservedAt: item?.reservedAt || null,
        consumedAt: item?.consumedAt || null
      };
    })
    .filter(Boolean);
}

function collectLabEggSlotContexts(lab) {
  const slots = new Map();
  const placedItems = Array.isArray(lab?.placedItems) ? lab.placedItems : [];
  placedItems.forEach((item) => {
    const rootDefinition = OlingLabItems[item.itemId] || null;
    (item.inventorySlots || []).forEach((inventorySlot) => {
      slots.set(`${item.placedId}:root:${inventorySlot.slotId}`, {
        slot: inventorySlot,
        incubator: rootDefinition
      });
    });
    (item.containerSlots || []).forEach((containerSlot) => {
      const containerDefinition = OlingLabItems[containerSlot.itemId] || null;
      (containerSlot.inventorySlots || []).forEach((inventorySlot) => {
        slots.set(
          `${item.placedId}:${containerSlot.slotId}:${inventorySlot.slotId}`,
          { slot: inventorySlot, incubator: containerDefinition }
        );
      });
    });
  });
  return slots;
}

function collectLabEggSlots(lab) {
  return new Map(
    [...collectLabEggSlotContexts(lab)].map(([slotPath, context]) => [
      slotPath,
      context.slot
    ])
  );
}

function findCurrentRoomEgg(lab) {
  const placedItems = Array.isArray(lab?.placedItems) ? lab.placedItems : [];

  for (const placedItem of placedItems) {
    for (const inventorySlot of placedItem.inventorySlots || []) {
      if (inventorySlot?.slotType === 'egg' && inventorySlot.itemKey) {
        return {
          eggKey: String(inventorySlot.itemKey).trim().toLowerCase(),
          hatchContext: {
            parentPlacedId: placedItem.placedId
          },
          influenceSlots: normalizeInfluenceSlots(
            inventorySlot.influenceSlots,
            OlingLabItems[placedItem.itemId]
          ),
          slot: {
            parentPlacedId: placedItem.placedId,
            parentItemId: placedItem.itemId,
            slotId: inventorySlot.slotId,
            containerSlotId: null
          }
        };
      }
    }

    for (const containerSlot of placedItem.containerSlots || []) {
      for (const inventorySlot of containerSlot.inventorySlots || []) {
        if (inventorySlot?.slotType === 'egg' && inventorySlot.itemKey) {
          return {
            eggKey: String(inventorySlot.itemKey).trim().toLowerCase(),
            hatchContext: {
              parentPlacedId: placedItem.placedId,
              slotId: containerSlot.slotId
            },
            influenceSlots: normalizeInfluenceSlots(
              inventorySlot.influenceSlots,
              OlingLabItems[containerSlot.itemId]
            ),
            slot: {
              parentPlacedId: placedItem.placedId,
              parentItemId: placedItem.itemId,
              slotId: inventorySlot.slotId,
              containerSlotId: containerSlot.slotId,
              containerItemId: containerSlot.itemId,
              containerPlacedId: containerSlot.placedId
            }
          };
        }
      }
    }
  }

  return null;
}

module.exports = {
  normalizeInfluenceSlots,
  collectLabEggSlotContexts,
  collectLabEggSlots,
  findCurrentRoomEgg
};

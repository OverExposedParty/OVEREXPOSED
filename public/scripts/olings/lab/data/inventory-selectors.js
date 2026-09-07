(function () {
  function createOlingLabInventorySelectors({ state }) {
    function countPlacedItems(itemType, itemKey) {
      let count = 0;
      const countSlots = (slots) => {
        (slots || []).forEach((slot) => {
          if (slot.itemType === itemType && slot.itemKey === itemKey) {
            count += Number(slot.quantity || 1);
          }
          if (itemType !== 'consumable') return;
          (slot.influenceSlots || []).forEach((influence) => {
            if (
              (!influence.itemType || influence.itemType === 'consumable') &&
              influence.itemKey === itemKey &&
              !influence.consumedAt
            ) {
              count += 1;
            }
          });
        });
      };
      state.lab.placedItems.forEach((item) => {
        countSlots(item.inventorySlots);
        (item.containerSlots || []).forEach((containerSlot) => {
          countSlots(containerSlot.inventorySlots);
        });
      });
      return count;
    }
    const getUsedEggQuantity = (eggKey) => countPlacedItems('egg', eggKey);
    const getUsedConsumableQuantity = (key) =>
      countPlacedItems('consumable', key);
    function getAvailableEggQuantity(eggKey) {
      const owned = state.ownedEggs.find((egg) => egg.key === eggKey);
      return Math.max(
        0,
        Number(owned?.quantity || 0) - getUsedEggQuantity(eggKey)
      );
    }
    function getAvailableConsumableQuantity(consumableKey) {
      const owned = state.ownedConsumables.find(
        (item) => item.key === consumableKey
      );
      return Math.max(
        0,
        Number(owned?.quantity || 0) - getUsedConsumableQuantity(consumableKey)
      );
    }
    return {
      getUsedEggQuantity,
      getAvailableEggQuantity,
      getUsedConsumableQuantity,
      getAvailableConsumableQuantity
    };
  }
  window.createOlingLabInventorySelectors = createOlingLabInventorySelectors;
})();

(function () {
  function createOlingLabFurnitureMutations({
    state,
    getItem,
    isPlaced,
    closeMenu,
    closeSelectedTarget,
    renderLab,
    saveLab,
    gridState
  }) {
    function placeRoomItem(itemId, row, col, options = {}) {
      const item = getItem(itemId);
      if (!gridState.canPlaceRoomItem(item, row, col)) return;

      state.lab.placedItems.push({
        placedId: gridState.createPlacedId(itemId),
        itemId,
        itemType: item.type || item.category || null,
        rarity: item.rarity || 'common',
        row: gridState.getAnchorRow(item, row),
        col,
        width: item.width,
        height: item.height,
        locked: false,
        inventorySlots: (item.inventorySlots || []).map((inventorySlot) => ({
          slotId: inventorySlot.slotId,
          slotType: inventorySlot.slotType || 'item',
          itemKey: null,
          itemType: null,
          quantity: 0,
          placedAt: null,
          influenceSlots: []
        })),
        containerSlots: (item.containerSlots || []).map((slot) => ({
          slotId: slot.slotId,
          itemId: null,
          itemType: null,
          inventorySlots: [],
          placedId: null,
          placedAt: null
        })),
        placedAt: new Date().toISOString()
      });
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
    }

    function moveRoomItem(placedId, row, col) {
      const placed = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      const item = getItem(placed?.itemId);
      if (!gridState.canMoveRoomItem(placed, item, row, col)) return;

      placed.row = gridState.getAnchorRow(item, row);
      placed.col = col;
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab();
    }

    function placeContainerItem(parentPlacedId, slotId, itemId, options = {}) {
      const parent = state.lab.placedItems.find(
        (item) => item.placedId === parentPlacedId
      );
      const slot = parent?.containerSlots?.find(
        (item) => item.slotId === slotId
      );
      const item = getItem(itemId);

      if (!parent || !slot || !item || isPlaced(itemId)) return;

      slot.itemId = itemId;
      slot.itemType = item.type || item.category || null;
      slot.inventorySlots = (item.inventorySlots || []).map(
        (inventorySlot) => ({
          slotId: inventorySlot.slotId,
          slotType: inventorySlot.slotType || 'item',
          itemKey: null,
          itemType: null,
          placedAt: null
        })
      );
      slot.placedId = gridState.createPlacedId(itemId);
      slot.placedAt = new Date().toISOString();
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
    }

    function storeRoomItem(placedId) {
      const item = state.lab.placedItems.find(
        (placed) => placed.placedId === placedId
      );
      if (!item || item.locked) return;

      state.owned.add(item.itemId);
      state.lab.placedItems = state.lab.placedItems.filter(
        (placed) => placed.placedId !== placedId
      );
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab();
    }

    function storeContainerItem(parentPlacedId, slotId) {
      const parent = state.lab.placedItems.find(
        (item) => item.placedId === parentPlacedId
      );
      const slot = parent?.containerSlots?.find(
        (item) => item.slotId === slotId
      );
      if (!slot) return;

      if (slot.itemId) state.owned.add(slot.itemId);
      slot.itemId = null;
      slot.itemType = null;
      slot.inventorySlots = [];
      slot.placedId = null;
      slot.placedAt = null;
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab();
    }

    return {
      placeRoomItem,
      moveRoomItem,
      placeContainerItem,
      storeRoomItem,
      storeContainerItem
    };
  }

  window.createOlingLabFurnitureMutations =
    createOlingLabFurnitureMutations;
})();

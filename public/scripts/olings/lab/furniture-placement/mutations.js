(function () {
  function createOlingLabFurnitureMutations({
    state,
    getItem,
    isPlaced,
    closeMenu,
    closeSelectedTarget,
    renderLab,
    saveLab,
    setStatus = () => {},
    gridState
  }) {
    function playPlacedSound(item) {
      if (typeof window.playSoundEffect !== 'function') return;
      const soundKey = item?.sounds?.placed || 'uiDragPlace';
      Promise.resolve(window.playSoundEffect(soundKey)).catch(() => {});
    }

    function inventorySlotsContainItems(inventorySlots) {
      return (inventorySlots || []).some(
        (slot) =>
          Boolean(slot?.itemKey) ||
          Number(slot?.quantity || 0) > 0 ||
          (slot?.influenceSlots || []).some((influence) =>
            Boolean(influence?.itemKey)
          )
      );
    }

    function storageFurnitureContainsItems(placed) {
      if (inventorySlotsContainItems(placed?.inventorySlots)) return true;
      const definition = getItem(placed?.itemId);
      const displaysAccountInventory = (definition?.inventorySlots || []).some(
        (slot) => slot?.slotType === 'storage'
      );
      if (!displaysAccountInventory) return false;
      return [
        ...(state.ownedEggs || []),
        ...(state.ownedConsumables || [])
      ].some((item) => Number(item?.quantity || 0) > 0);
    }

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
      window.dispatchEvent(
        new CustomEvent('oling-lab:tutorial-furniture-placed', {
          detail: { itemId, row, col }
        })
      );
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
      playPlacedSound(item);
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
      playPlacedSound(item);
    }

    function swapRoomItems(firstPlacedId, secondPlacedId) {
      const firstPlaced = state.lab.placedItems.find(
        (item) => item.placedId === firstPlacedId
      );
      const secondPlaced = state.lab.placedItems.find(
        (item) => item.placedId === secondPlacedId
      );
      const swap = gridState.getRoomItemSwap(firstPlaced, secondPlaced);
      if (!swap) return false;

      firstPlaced.row = swap.first.row;
      firstPlaced.col = swap.first.col;
      secondPlaced.row = swap.second.row;
      secondPlaced.col = swap.second.col;
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab();
      playPlacedSound(getItem(firstPlaced.itemId));
      return true;
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
      playPlacedSound(item);
    }

    function storeRoomItem(placedId) {
      const item = state.lab.placedItems.find(
        (placed) => placed.placedId === placedId
      );
      if (!item || item.locked) return;
      const hasStoredOlings = (state.olings || []).some(
        (oling) =>
          oling?.residency?.state === 'stored' &&
          String(oling?.residency?.pod?.containerPlacedId || '') ===
            String(placedId)
      );
      if (hasStoredOlings) {
        setStatus(
          'Move or release every Oling in this Pod Rack before storing it.'
        );
        return false;
      }
      if (storageFurnitureContainsItems(item)) {
        setStatus(
          `Remove every item from ${getItem(item.itemId)?.name || 'this storage'} before storing it.`
        );
        return false;
      }
      if ((item.containerSlots || []).some((slot) => Boolean(slot?.itemId))) {
        setStatus('Remove every attached item before storing this furniture.');
        return false;
      }

      state.owned.add(item.itemId);
      state.lab.placedItems = state.lab.placedItems.filter(
        (placed) => placed.placedId !== placedId
      );
      closeSelectedTarget();
      closeMenu();
      renderLab();
      saveLab();
      return true;
    }

    function storeContainerItem(parentPlacedId, slotId) {
      const parent = state.lab.placedItems.find(
        (item) => item.placedId === parentPlacedId
      );
      const slot = parent?.containerSlots?.find(
        (item) => item.slotId === slotId
      );
      if (!slot) return false;

      if (inventorySlotsContainItems(slot.inventorySlots)) {
        setStatus(
          `Remove every item from ${getItem(slot.itemId)?.name || 'this item'} before storing it.`
        );
        return false;
      }

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
      return true;
    }

    return {
      placeRoomItem,
      moveRoomItem,
      swapRoomItems,
      placeContainerItem,
      storeRoomItem,
      storeContainerItem
    };
  }

  window.createOlingLabFurnitureMutations = createOlingLabFurnitureMutations;
})();

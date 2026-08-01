(function () {
  function createOlingLabFurniturePlacementMenu(dependencies) {
    const {
      state,
      getItem,
      createItemButton,
      createEmptyMessage,
      openMenu,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      placeRoomItem
    } = dependencies;

function openSlotMenu(row, col) {
      const grid = document.createElement('div');
      grid.className = 'oling-lab-menu-grid oling-lab-place-items-grid';
      const availableItems = getRoomItemsForSlot(row, col);

      availableItems.forEach((item) => {
        grid.appendChild(
          createItemButton(item, {
            onClick: () => placeRoomItem(item.id, row, col)
          })
        );
      });

      [...state.owned].map(getItem).forEach((item) => {
        if (
          !item ||
          item.layer !== 'room' ||
          item.locked ||
          availableItems.includes(item)
        ) {
          return;
        }
        const reason = getRoomPlacementBlockReason(item, row, col);
        if (!reason) return;
        grid.appendChild(
          createItemButton(item, {
            disabled: true,
            badge: reason
          })
        );
      });

      openMenu(
        'Place Item',
        grid.children.length
          ? [grid]
          : [createEmptyMessage('No owned items fit here.')],
        {
          theme: 'olings-lab'
        }
      );
    }

    return { openSlotMenu };
  }

  window.createOlingLabFurniturePlacementMenu =
    createOlingLabFurniturePlacementMenu;
})();

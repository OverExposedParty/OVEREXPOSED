(function () {
  function createOlingLabFurnitureMenus(dependencies) {
    const {
      state,
      getItem,
      formatTitle,
      createTabMenu,
      openMenu
    } = dependencies;
    const actionPanels = window.createOlingLabFurnitureActionPanels(
      dependencies
    );
    const placementMenu = window.createOlingLabFurniturePlacementMenu(
      dependencies
    );
    const furnitureTabs = window.createOlingLabFurnitureTabs(dependencies);
    const slotTabs = window.createOlingLabFurnitureSlotTabs(dependencies);
    const shelfInventory = window.createOlingLabShelfInventory(dependencies);
    const shelfStorage = window.createOlingLabShelfStorage(
      dependencies,
      shelfInventory
    );

    function openPlacedItemMenu(placedId) {
      const placed = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      const item = getItem(placed?.itemId);
      if (!placed || !item) return;

      const tabs = [
        {
          label: 'Info',
          content: () => furnitureTabs.createFurnitureInfoTab(placed, item)
        },
        {
          label: 'Move',
          content: () => furnitureTabs.createFurnitureMoveTab(placed, item)
        }
      ];
      if ((item.containerSlots || []).length) {
        const slotTabLabel =
          item.containerSlots.length === 1
            ? item.containerSlots[0].label ||
              formatTitle(item.containerSlots[0].slotId)
            : 'Slots';
        tabs.push({
          label: slotTabLabel,
          content: () => slotTabs.createFurnitureSlotsTab(placed, item)
        });
      }
      if (
        (item.inventorySlots || []).some((slot) => slot.slotType === 'storage')
      ) {
        tabs.push({
          label: 'Storage',
          content: () => shelfStorage.createShelfStorageTab(placed, item)
        });
      }

      openMenu(`${item.name} Edit`, [createTabMenu(tabs)], {
        theme: 'olings-lab'
      });
    }

    return {
      ...actionPanels,
      ...placementMenu,
      getShelfInventoryItems: shelfInventory.getShelfInventoryItems,
      createShelfStorageTab: shelfStorage.createShelfStorageTab,
      openPlacedItemMenu
    };
  }

  window.createOlingLabFurnitureMenus = createOlingLabFurnitureMenus;
})();

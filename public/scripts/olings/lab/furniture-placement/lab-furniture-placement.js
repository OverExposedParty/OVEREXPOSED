(function () {
  function createOlingLabFurniturePlacement(deps) {
    const gridState = window.createOlingLabFurnitureGridState(deps);
    const mutations = window.createOlingLabFurnitureMutations({
      ...deps,
      gridState
    });
    const art = window.createOlingLabFurnitureArtAndPlacement(deps);

    return {
      getOccupiedMap: gridState.getOccupiedMap,
      isLabCellUnlocked: gridState.isLabCellUnlocked,
      getLabExpansionCell: gridState.getLabExpansionCell,
      canMoveRoomItem: gridState.canMoveRoomItem,
      getRoomPlacementBlockReason: gridState.getRoomPlacementBlockReason,
      getRoomItemsForSlot: gridState.getRoomItemsForSlot,
      getContainerItemsForSlot: gridState.getContainerItemsForSlot,
      placeRoomItem: mutations.placeRoomItem,
      moveRoomItem: mutations.moveRoomItem,
      placeContainerItem: mutations.placeContainerItem,
      storeRoomItem: mutations.storeRoomItem,
      storeContainerItem: mutations.storeContainerItem,
      createImage: art.createImage,
      getFurniturePlacement: art.getFurniturePlacement,
      createFurnitureArt: art.createFurnitureArt,
      loadFurnitureGridPlacements: art.loadFurnitureGridPlacements
    };
  }

  window.createOlingLabFurniturePlacement = createOlingLabFurniturePlacement;
})();

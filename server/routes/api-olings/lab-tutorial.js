function createOlingLabTutorial() {
  return {
    roomLevel: 1,
    appearance: { wallpaperKey: 'brick' },
    columns: 3,
    rows: 2,
    unlockedCells: ['0:0', '0:1', '0:2', '1:0', '1:1', '1:2'],
    placedItems: [
      {
        placedId: 'tutorial-door',
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
            itemId: 'explorer_gateway',
            itemType: 'door-module',
            placedId: 'tutorial-explorer-gateway',
            placedAt: null,
            inventorySlots: []
          }
        ]
      },
      {
        placedId: 'tutorial-table',
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
            placedId: 'tutorial-incubator',
            placedAt: null,
            inventorySlots: []
          }
        ]
      },
      {
        placedId: 'tutorial-bed',
        itemId: 'oling_bed',
        itemType: 'bed',
        rarity: 'uncommon',
        row: 1,
        col: 2,
        width: 1,
        height: 1,
        locked: false
      }
    ],
    updatedAt: null
  };
}

module.exports = { createOlingLabTutorial };

const { LAB_ROWS, STARTER_LAB_COLUMNS } = require('../lab-catalog');

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function createDefaultOlingLab() {
  return {
    roomLevel: 1,
    columns: STARTER_LAB_COLUMNS,
    rows: LAB_ROWS,
    unlockedCells: Array.from(
      { length: STARTER_LAB_COLUMNS * LAB_ROWS },
      (_, index) =>
        `${Math.floor(index / STARTER_LAB_COLUMNS)}:${index % STARTER_LAB_COLUMNS}`
    ),
    placedItems: [
      {
        placedId: 'door',
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
            itemId: null,
            itemType: null,
            inventorySlots: [],
            placedId: null,
            placedAt: null
          }
        ]
      },
      {
        placedId: 'starter_table',
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
            itemId: null,
            itemType: null,
            placedId: null,
            placedAt: null
          }
        ]
      }
    ]
  };
}

module.exports = {
  clampInteger,
  createDefaultOlingLab
};

const {
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS
} = require('../lab-catalog');
const { clampInteger, createDefaultOlingLab } = require('./defaults');
const {
  ensureContainerSlots,
  ensureItemInventorySlots
} = require('./inventory');
const { getUnlockedLabCellKeys } = require('./expansion');

function serializeOlingLab(lab) {
  const source =
    lab && Array.isArray(lab.placedItems) ? lab : createDefaultOlingLab();
  const unlockedCells = getUnlockedLabCellKeys(source);
  return {
    roomLevel: clampInteger(source.roomLevel, 1, 99, 1),
    columns: clampInteger(
      source.columns,
      LAB_MIN_COLUMNS,
      LAB_MAX_COLUMNS,
      STARTER_LAB_COLUMNS
    ),
    rows: LAB_ROWS,
    unlockedCells,
    placedItems: source.placedItems.map((item) => ({
      placedId: item.placedId,
      itemId: item.itemId,
      itemType:
        item.itemType ||
        OlingLabItems[item.itemId]?.type ||
        OlingLabItems[item.itemId]?.category ||
        null,
      rarity: item.rarity || OlingLabItems[item.itemId]?.rarity || 'common',
      row: item.row,
      col: item.col,
      width: item.width,
      height: item.height,
      locked: Boolean(item.locked),
      inventorySlots: ensureItemInventorySlots(
        item.itemId,
        item.inventorySlots
      ),
      containerSlots: ensureContainerSlots(item),
      placedAt: item.placedAt || null
    })),
    updatedAt: source.updatedAt || null
  };
}

module.exports = {
  serializeOlingLab
};

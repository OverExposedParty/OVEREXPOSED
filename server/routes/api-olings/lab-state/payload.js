const {
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS
} = require('../lab-catalog');
const { createLabPayloadNormalizer } = require('./normalize');
const { clampInteger } = require('./defaults');
const { canUseRoomRow } = require('./catalog');
const {
  getOwnedLabFurniture,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  ensureContainerSlots,
  ensureItemInventorySlots
} = require('./inventory');
const {
  getUnlockedLabCellKeys,
  getItemCells
} = require('./expansion');
const {
  validateContainerSlotItems,
  validateItemInventorySlots
} = require('./validation');

const normalizeLabPayload = createLabPayloadNormalizer({
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  clampInteger,
  getUnlockedLabCellKeys,
  getOwnedLabFurniture,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  ensureContainerSlots,
  ensureItemInventorySlots,
  validateContainerSlotItems,
  validateItemInventorySlots,
  canUseRoomRow,
  getItemCells
});

module.exports = {
  normalizeLabPayload
};

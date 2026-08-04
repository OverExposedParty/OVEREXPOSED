const { clampInteger, createDefaultOlingLab } = require('./lab-state/defaults');
const {
  serializeOlingLabItem,
  getAllowedRoomRows,
  canUseRoomRow
} = require('./lab-state/catalog');
const {
  getOwnedLabFurniture,
  ensureAccountOlingDocument,
  ensureContainerSlots,
  ensureItemInventorySlots,
  getContainerSlotDefinition,
  containerSlotAcceptsItem,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  getReservedLabItemQuantity
} = require('./lab-state/inventory');
const { serializeOlingLab } = require('./lab-state/serialization');
const {
  getLabCellKey,
  getUnlockedLabCellKeys,
  getLabExpansionDetails,
  getItemCells
} = require('./lab-state/expansion');
const {
  validateItemInventorySlots,
  validateContainerSlotItems
} = require('./lab-state/validation');
const { normalizeLabPayload } = require('./lab-state/payload');

module.exports = {
  clampInteger,
  createDefaultOlingLab,
  serializeOlingLabItem,
  getAllowedRoomRows,
  canUseRoomRow,
  getOwnedLabFurniture,
  ensureAccountOlingDocument,
  ensureContainerSlots,
  ensureItemInventorySlots,
  getContainerSlotDefinition,
  containerSlotAcceptsItem,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  getReservedLabItemQuantity,
  validateItemInventorySlots,
  serializeOlingLab,
  getLabCellKey,
  getUnlockedLabCellKeys,
  getLabExpansionDetails,
  getItemCells,
  validateContainerSlotItems,
  normalizeLabPayload
};

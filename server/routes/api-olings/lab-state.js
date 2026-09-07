const { clampInteger, createDefaultOlingLab } = require('./lab-state/defaults');
const {
  serializeOlingLabItem,
  serializeOlingLabWallDecoration,
  getAllowedRoomRows,
  canUseRoomRow
} = require('./lab-state/catalog');
const {
  getOwnedWallDecorationQuantities,
  normalizePlacedWallDecorations
} = require('./lab-state/wall-decorations');
const {
  getOwnedLabFurniture,
  getOwnedLabWallpapers,
  getOwnedLabWallpaperVariants,
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
  getLabColumnCellKeys,
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
  serializeOlingLabWallDecoration,
  getAllowedRoomRows,
  canUseRoomRow,
  getOwnedLabFurniture,
  getOwnedLabWallpapers,
  getOwnedLabWallpaperVariants,
  getOwnedWallDecorationQuantities,
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
  getLabColumnCellKeys,
  getUnlockedLabCellKeys,
  getLabExpansionDetails,
  getItemCells,
  validateContainerSlotItems,
  normalizeLabPayload,
  normalizePlacedWallDecorations
};

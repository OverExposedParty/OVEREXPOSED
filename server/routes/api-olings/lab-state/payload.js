const {
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  DEFAULT_OLING_LAB_WALLPAPER_KEY,
  OlingLabWallpapers
} = require('../lab-catalog');
const { createLabPayloadNormalizer } = require('./normalize');
const { clampInteger } = require('./defaults');
const { canUseRoomRow } = require('./catalog');
const {
  getOwnedLabFurniture,
  getOwnedLabWallpapers,
  getOwnedLabWallpaperVariants,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  ensureContainerSlots,
  ensureItemInventorySlots
} = require('./inventory');
const { getUnlockedLabCellKeys, getItemCells } = require('./expansion');
const {
  validateContainerSlotItems,
  validateItemInventorySlots
} = require('./validation');
const { normalizePlacedWallDecorations } = require('./wall-decorations');

const normalizeLabPayload = createLabPayloadNormalizer({
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  DEFAULT_OLING_LAB_WALLPAPER_KEY,
  OlingLabWallpapers,
  clampInteger,
  getUnlockedLabCellKeys,
  getOwnedLabFurniture,
  getOwnedLabWallpapers,
  getOwnedLabWallpaperVariants,
  getOwnedEggQuantities,
  getOwnedConsumableQuantities,
  ensureContainerSlots,
  ensureItemInventorySlots,
  validateContainerSlotItems,
  validateItemInventorySlots,
  normalizePlacedWallDecorations,
  canUseRoomRow,
  getItemCells
});

module.exports = {
  normalizeLabPayload
};

const {
  STARTER_LAB_COLUMNS,
  LAB_ROWS,
  OlingLabItems,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  DEFAULT_OLING_LAB_WALLPAPER_KEY,
  OlingLabWallpapers,
  getOlingLabWallpaperVariant,
  getOlingLabWallpaperVariantEntitlementKey
} = require('../lab-catalog');
const { clampInteger, createDefaultOlingLab } = require('./defaults');
const {
  ensureContainerSlots,
  ensureItemInventorySlots
} = require('./inventory');
const { getUnlockedLabCellKeys } = require('./expansion');
const {
  normalizeOlingLabVisibility
} = require('../../../services/oling-lab-access');

function serializeOlingLab(lab, options = {}) {
  const source =
    lab && Array.isArray(lab.placedItems) ? lab : createDefaultOlingLab();
  const unlockedCells = getUnlockedLabCellKeys(source);
  const requestedWallpaperKey =
    source.appearance?.wallpaperKey ?? source.wallpaperKey;
  let wallpaperKey = Object.hasOwn(OlingLabWallpapers, requestedWallpaperKey)
    ? requestedWallpaperKey
    : DEFAULT_OLING_LAB_WALLPAPER_KEY;
  const requestedVariantKey = String(
    source.appearance?.wallpaperVariantKey || ''
  )
    .trim()
    .toLowerCase();
  let wallpaperVariantKey = getOlingLabWallpaperVariant(
    wallpaperKey,
    requestedVariantKey
  )
    ? requestedVariantKey
    : null;
  const checksOwnership = options.ownedWallpaperKeys instanceof Set;
  const ownsSelection = wallpaperVariantKey
    ? options.ownedWallpaperVariantKeys instanceof Set &&
      options.ownedWallpaperVariantKeys.has(
        getOlingLabWallpaperVariantEntitlementKey(
          wallpaperKey,
          wallpaperVariantKey
        )
      )
    : !checksOwnership || options.ownedWallpaperKeys.has(wallpaperKey);
  if (checksOwnership && !ownsSelection) {
    wallpaperKey = DEFAULT_OLING_LAB_WALLPAPER_KEY;
    wallpaperVariantKey = null;
  }
  return {
    visibility: normalizeOlingLabVisibility(source.visibility),
    roomLevel: clampInteger(source.roomLevel, 1, 99, 1),
    appearance: { wallpaperKey, wallpaperVariantKey },
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
    placedWallDecorations: (source.placedWallDecorations || []).map((item) => ({
      placedId: item.placedId,
      itemId: item.itemId,
      anchorRow: item.anchorRow,
      anchorCol: item.anchorCol,
      offsetX: item.offsetX,
      offsetY: item.offsetY,
      placedAt: item.placedAt || null
    })),
    updatedAt: source.updatedAt || null
  };
}

module.exports = {
  serializeOlingLab
};

const {
  normalizeOlingLabVisibility
} = require('../../../services/oling-lab-access');

function createLabPayloadNormalizer(dependencies) {
  const {
    STARTER_LAB_COLUMNS,
    LAB_ROWS,
    OlingLabItems,
    OlingLabWallpapers,
    DEFAULT_OLING_LAB_WALLPAPER_KEY,
    LAB_MIN_COLUMNS,
    LAB_MAX_COLUMNS,
    clampInteger,
    getUnlockedLabCellKeys,
    getOwnedLabFurniture,
    getOwnedLabWallpapers,
    getOwnedLabWallpaperVariants = () => new Set(),
    getOwnedEggQuantities,
    getOwnedConsumableQuantities,
    ensureContainerSlots,
    ensureItemInventorySlots,
    validateContainerSlotItems,
    validateItemInventorySlots,
    canUseRoomRow,
    getItemCells,
    normalizePlacedWallDecorations = () => ({ placedWallDecorations: [] })
  } = dependencies;

  function normalizeLabPayload(value, account, olingState) {
    const input = value && typeof value === 'object' ? value : {};
    const explicitWallpaperKey =
      input.appearance?.wallpaperKey ?? input.wallpaperKey;
    const hasExplicitWallpaperKey = explicitWallpaperKey !== undefined;
    const explicitWallpaperVariantKey =
      input.appearance?.wallpaperVariantKey ?? input.wallpaperVariantKey;
    const persistedWallpaperKey =
      olingState?.lab?.appearance?.wallpaperKey ??
      olingState?.lab?.wallpaperKey ??
      account?.olings?.lab?.appearance?.wallpaperKey ??
      account?.olings?.lab?.wallpaperKey ??
      DEFAULT_OLING_LAB_WALLPAPER_KEY;
    const requestedWallpaperKey = String(
      explicitWallpaperKey ?? persistedWallpaperKey
    )
      .trim()
      .toLowerCase();
    const wallpaperExists = Object.hasOwn(
      OlingLabWallpapers,
      requestedWallpaperKey
    );
    if (explicitWallpaperKey !== undefined && !wallpaperExists) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wallpaper_invalid',
          message: 'That wallpaper is not available.'
        }
      };
    }
    const wallpaperKey = wallpaperExists
      ? requestedWallpaperKey
      : DEFAULT_OLING_LAB_WALLPAPER_KEY;
    const persistedWallpaperVariantKey =
      olingState?.lab?.appearance?.wallpaperVariantKey ??
      account?.olings?.lab?.appearance?.wallpaperVariantKey ??
      null;
    const requestedWallpaperVariantKey = String(
      explicitWallpaperVariantKey !== undefined
        ? explicitWallpaperVariantKey || ''
        : hasExplicitWallpaperKey
          ? ''
          : persistedWallpaperVariantKey || ''
    )
      .trim()
      .toLowerCase();
    const wallpaperVariantExists = requestedWallpaperVariantKey
      ? Object.hasOwn(
          OlingLabWallpapers[wallpaperKey]?.variants || {},
          requestedWallpaperVariantKey
        )
      : false;
    if (requestedWallpaperVariantKey && !wallpaperVariantExists) {
      return {
        error: {
          status: 400,
          code: 'oling_lab_wallpaper_variant_invalid',
          message: 'That wallpaper variant is not available.'
        }
      };
    }
    const wallpaperVariantKey = wallpaperVariantExists
      ? requestedWallpaperVariantKey
      : null;
    const variantEntitlementKey = wallpaperVariantKey
      ? `${wallpaperKey}:${wallpaperVariantKey}`
      : null;
    const ownsWallpaper = wallpaperVariantKey
      ? getOwnedLabWallpaperVariants(account).has(variantEntitlementKey)
      : getOwnedLabWallpapers(account).has(wallpaperKey);
    if (!ownsWallpaper) {
      return {
        error: {
          status: 403,
          code: wallpaperVariantKey
            ? 'oling_lab_wallpaper_variant_not_owned'
            : 'oling_lab_wallpaper_not_owned',
          message: wallpaperVariantKey
            ? 'You do not own that wallpaper variant.'
            : 'You do not own that wallpaper.'
        }
      };
    }
    const requestedItems = Array.isArray(input.placedItems)
      ? input.placedItems
      : [];
    const requestedDoorItem = requestedItems.find(
      (item) => item?.itemId === 'standard_door' || item?.placedId === 'door'
    );
    const columns = clampInteger(
      olingState?.lab?.columns ?? account?.olings?.lab?.columns,
      LAB_MIN_COLUMNS,
      LAB_MAX_COLUMNS,
      STARTER_LAB_COLUMNS
    );
    const unlockedCells = getUnlockedLabCellKeys(
      olingState?.lab || account?.olings?.lab
    );
    const unlockedCellSet = new Set(unlockedCells);
    const owned = getOwnedLabFurniture(account, olingState);
    const ownedEggQuantities = getOwnedEggQuantities(olingState);
    const ownedConsumableQuantities = getOwnedConsumableQuantities(olingState);
    const usedEggQuantities = new Map();
    const usedConsumableQuantities = new Map();
    const occupied = new Map();
    const usedItemIds = new Set();
    const placedItems = [
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
        inventorySlots: [],
        containerSlots: ensureContainerSlots({
          itemId: 'standard_door',
          containerSlots: requestedDoorItem?.containerSlots
        })
      }
    ];
    const containerValidationContext = {
      owned,
      usedItemIds,
      ownedEggQuantities,
      usedEggQuantities,
      ownedConsumableQuantities,
      usedConsumableQuantities
    };
    const doorSlotValidation = validateContainerSlotItems(
      'standard_door',
      'door',
      placedItems[0].containerSlots,
      containerValidationContext
    );
    if (doorSlotValidation?.error) return doorSlotValidation;

    occupied.set('1:0', 'door');

    for (const requested of requestedItems) {
      const itemId = String(requested?.itemId || '').trim();
      if (!itemId || itemId === 'standard_door') continue;

      const definition = OlingLabItems[itemId];
      if (!definition || definition.layer !== 'room') {
        return {
          error: {
            status: 400,
            code: 'oling_lab_item_invalid',
            message: 'That lab item cannot be placed in the room.'
          }
        };
      }
      if (!owned.has(itemId)) {
        return {
          error: {
            status: 403,
            code: 'oling_lab_item_not_owned',
            message: 'You do not own that lab item.'
          }
        };
      }
      if (usedItemIds.has(itemId)) {
        return {
          error: {
            status: 400,
            code: 'oling_lab_item_already_placed',
            message: 'That lab item is already placed.'
          }
        };
      }

      const width = definition.width;
      const height = definition.height;
      const col = clampInteger(requested.col, 0, columns - width, 0);
      const maxRow = LAB_ROWS - height;
      const row =
        height >= LAB_ROWS ? 0 : clampInteger(requested.row, 0, maxRow, 1);
      if (!canUseRoomRow(definition, row)) {
        return {
          error: {
            status: 400,
            code: 'oling_lab_row_invalid',
            message: 'That lab item cannot be placed on that row.'
          }
        };
      }
      const placedId =
        String(requested.placedId || '')
          .trim()
          .slice(0, 80) || `${itemId}_${row}_${col}`;
      const normalized = {
        placedId,
        itemId,
        itemType: definition.type || definition.category || null,
        rarity: definition.rarity || 'common',
        row,
        col,
        width,
        height,
        locked: false,
        inventorySlots: ensureItemInventorySlots(
          itemId,
          requested.inventorySlots
        ),
        containerSlots: ensureContainerSlots({
          itemId,
          containerSlots: requested.containerSlots
        }),
        placedAt: requested.placedAt || new Date()
      };

      if (getItemCells(normalized).some((cell) => !unlockedCellSet.has(cell))) {
        return {
          error: {
            status: 403,
            code: 'oling_lab_cell_locked',
            message: 'That lab space has not been unlocked.'
          }
        };
      }

      for (const cell of getItemCells(normalized)) {
        if (occupied.has(cell)) {
          return {
            error: {
              status: 400,
              code: 'oling_lab_cell_occupied',
              message: 'That lab space is already occupied.'
            }
          };
        }
      }

      const slotValidation = validateContainerSlotItems(
        itemId,
        placedId,
        normalized.containerSlots,
        containerValidationContext
      );
      if (slotValidation?.error) return slotValidation;
      const inventoryValidation = validateItemInventorySlots(
        itemId,
        normalized.inventorySlots,
        containerValidationContext
      );
      if (inventoryValidation?.error) return inventoryValidation;

      getItemCells(normalized).forEach((cell) => occupied.set(cell, placedId));
      usedItemIds.add(itemId);
      placedItems.push(normalized);
    }

    const wallDecorationsResult = normalizePlacedWallDecorations(
      input.placedWallDecorations,
      { account, olingState, columns, unlockedCellSet, placedItems }
    );
    if (wallDecorationsResult.error) return wallDecorationsResult;

    return {
      lab: {
        visibility: normalizeOlingLabVisibility(
          olingState?.lab?.visibility ?? account?.olings?.lab?.visibility
        ),
        roomLevel: clampInteger(input.roomLevel, 1, 99, 1),
        appearance: { wallpaperKey, wallpaperVariantKey },
        columns,
        rows: LAB_ROWS,
        unlockedCells,
        placedItems,
        placedWallDecorations: wallDecorationsResult.placedWallDecorations,
        updatedAt: new Date()
      }
    };
  }

  return normalizeLabPayload;
}

module.exports = {
  createLabPayloadNormalizer
};

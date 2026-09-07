const furnitureCatalog = require('../../../public/json-files/olings/lab/furniture.json');
const wallpaperCatalog = require('../../../public/json-files/olings/lab/wallpapers.json');
const wallDecorationCatalog = require('../../../public/json-files/olings/lab/wall-decorations.json');

const LAB_ROWS = 2;

const LAB_MIN_COLUMNS = 3;

const LAB_MAX_COLUMNS = 16;

const STARTER_LAB_COLUMNS = 3;

const LAB_PURCHASE_MAX_COLUMNS = 10;

const LAB_COLUMN_PRICES = Object.freeze({
  4: 150,
  5: 225,
  6: 325,
  7: 450,
  8: 600,
  9: 800,
  10: 1050
});

const DEFAULT_OLING_LAB_WALLPAPER_KEY = 'brick';

const OLING_LAB_WALLPAPER_VARIANT_SEPARATOR = ':';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function createCatalogMap(entries, identityField, catalogName) {
  if (!Array.isArray(entries)) {
    throw new TypeError(`${catalogName} catalogue must be an array.`);
  }

  const seen = new Set();
  const pairs = entries.map((entry) => {
    const key = String(entry?.[identityField] || '').trim();
    if (!key) {
      throw new TypeError(
        `${catalogName} catalogue entries require ${identityField}.`
      );
    }
    if (seen.has(key)) {
      throw new TypeError(
        `${catalogName} catalogue contains duplicate "${key}".`
      );
    }

    seen.add(key);
    return [key, entry];
  });

  return deepFreeze(Object.fromEntries(pairs));
}

const OlingLabWallpapers = createCatalogMap(
  wallpaperCatalog.wallpapers,
  'key',
  'Oling Lab wallpaper'
);

const STARTER_WALLPAPER_KEYS = Object.freeze([DEFAULT_OLING_LAB_WALLPAPER_KEY]);

function getOlingLabWallpaperVariant(wallpaperKey, variantKey) {
  const wallpaper = Object.hasOwn(OlingLabWallpapers, wallpaperKey)
    ? OlingLabWallpapers[wallpaperKey]
    : null;
  if (!wallpaper || !variantKey) return null;
  return Object.hasOwn(wallpaper.variants || {}, variantKey)
    ? wallpaper.variants[variantKey]
    : null;
}

function getOlingLabWallpaperVariantEntitlementKey(wallpaperKey, variantKey) {
  return `${wallpaperKey}${OLING_LAB_WALLPAPER_VARIANT_SEPARATOR}${variantKey}`;
}

function parseOlingLabWallpaperVariantEntitlementKey(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  const separatorIndex = normalized.indexOf(
    OLING_LAB_WALLPAPER_VARIANT_SEPARATOR
  );
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) {
    return null;
  }
  const wallpaperKey = normalized.slice(0, separatorIndex);
  const variantKey = normalized.slice(separatorIndex + 1);
  return getOlingLabWallpaperVariant(wallpaperKey, variantKey)
    ? { wallpaperKey, variantKey, key: normalized }
    : null;
}

const OlingLabItems = createCatalogMap(
  furnitureCatalog.furniture,
  'id',
  'Oling Lab furniture'
);

const OlingLabWallDecorations = createCatalogMap(
  wallDecorationCatalog.wallDecorations,
  'id',
  'Oling Lab wall decoration'
);

const STARTER_FURNITURE_KEYS = Object.freeze(['standard_table', 'incubeta']);

module.exports = {
  LAB_ROWS,
  LAB_MIN_COLUMNS,
  LAB_MAX_COLUMNS,
  STARTER_LAB_COLUMNS,
  LAB_PURCHASE_MAX_COLUMNS,
  LAB_COLUMN_PRICES,
  DEFAULT_OLING_LAB_WALLPAPER_KEY,
  OLING_LAB_WALLPAPER_VARIANT_SEPARATOR,
  OlingLabWallpapers,
  STARTER_WALLPAPER_KEYS,
  getOlingLabWallpaperVariant,
  getOlingLabWallpaperVariantEntitlementKey,
  parseOlingLabWallpaperVariantEntitlementKey,
  OlingLabItems,
  OlingLabWallDecorations,
  STARTER_FURNITURE_KEYS
};

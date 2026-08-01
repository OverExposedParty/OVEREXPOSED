let loadedHomepageTiles = [];
let isReloadingHomepageTiles = false;

const COMING_SOON_TILE = {
  label: 'COMING SOON',
  description: 'This mode is coming soon.',
  colour: '#D8D8D8',
  secondaryColour: '#9A9A9A',
  canAccess: false
};
const COMING_SOON_MOBILE_ORDER_OFFSET = 1000;

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }

  return response.json();
}

function normaliseHomepageTilesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.data?.homepageTiles || payload?.homepageTiles || [];
}

async function loadHomepageTiles() {
  if (isReloadingHomepageTiles) return;

  isReloadingHomepageTiles = true;
  try {
    const payload = await fetchJson('/api/homepage-tiles');
    loadedHomepageTiles = normaliseHomepageTilesPayload(payload);
  } catch (error) {
    loadedHomepageTiles = [];
    console.error('Error loading homepage tiles from site-content:', error);
  } finally {
    isReloadingHomepageTiles = false;
    renderHomepageGrid();
  }
}

function getTileBounds(values = []) {
  const positions = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  const start = Math.min(...positions);
  const end = Math.max(...positions);

  return {
    start: Number.isFinite(start) ? start : 1,
    span: Number.isFinite(end) ? end - start + 1 : 1
  };
}

function getCompactDesktopRowMap(configs = []) {
  const occupiedRows = [
    ...new Set(
      configs.flatMap((config) =>
        (Array.isArray(config.y) ? config.y : [])
          .map(Number)
          .filter((value) => Number.isInteger(value) && value > 0)
      )
    )
  ].sort((left, right) => left - right);

  return new Map(occupiedRows.map((row, index) => [row, index + 1]));
}

function applyTileLayout(tile, config, desktopRowMap = new Map()) {
  const column = getTileBounds(config.x);
  const compactRows = (Array.isArray(config.y) ? config.y : []).map(
    (row) => desktopRowMap.get(Number(row)) || Number(row)
  );
  const row = getTileBounds(compactRows);
  const mobile = config.mobile || {};
  const mobileOrder = Number(mobile.order) || 999;
  const isComingSoon = tile.classList.contains('is-coming-soon');

  tile.style.setProperty('--tile-col-start', column.start);
  tile.style.setProperty('--tile-col-span', column.span);
  tile.style.setProperty('--tile-row-start', row.start);
  tile.style.setProperty('--tile-row-span', row.span);
  tile.style.setProperty(
    '--mobile-col-span',
    Math.min(Number(mobile.cols) || column.span, 2)
  );
  tile.style.setProperty('--mobile-row-span', Number(mobile.rows) || 1);
  tile.style.setProperty(
    '--mobile-order',
    isComingSoon ? COMING_SOON_MOBILE_ORDER_OFFSET + mobileOrder : mobileOrder
  );
}

function getComingSoonTileData() {
  return { ...COMING_SOON_TILE };
}

function normalizeTileImageConfig(image, fallbackAlt = '') {
  const src = typeof image === 'string' ? image : image?.src;
  if (!src) return null;

  return {
    src,
    alt: image?.alt || fallbackAlt
  };
}

function getTileImagesConfig(config, fallback = {}) {
  const fallbackAlt = config.label || fallback.label || '';
  const configuredImages = config.images || fallback.images || null;
  const desktopImage =
    configuredImages?.desktop ||
    config.desktopImage ||
    fallback.desktopImage ||
    config.image ||
    fallback.image ||
    null;
  const mobileImage =
    configuredImages?.mobile ||
    config.mobileImage ||
    fallback.mobileImage ||
    config.image ||
    fallback.image ||
    desktopImage;
  const desktop = normalizeTileImageConfig(desktopImage, fallbackAlt);
  const mobile = normalizeTileImageConfig(mobileImage, fallbackAlt);

  if (!desktop && !mobile) return null;

  return {
    desktop: desktop || mobile,
    mobile: mobile || desktop
  };
}

function getTileData(config) {
  if (config.canAccess === false) return getComingSoonTileData();

  return {
    label: config.label,
    description: config.description,
    link: config.link,
    colour: config.colour,
    secondaryColour: config.secondaryColour,
    splashScreen: config.splashScreen,
    images: getTileImagesConfig(config),
    canAccess: true
  };
}

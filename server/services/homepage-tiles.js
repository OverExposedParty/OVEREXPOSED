const fs = require('fs/promises');
const path = require('path');

const HOMEPAGE_TILES_FILE = path.join(
  process.cwd(),
  'data',
  'site-content',
  'homepage-tiles.json'
);

function normalizeImage(image = {}) {
  return {
    src: String(image.src || '').trim(),
    alt: String(image.alt || '').trim()
  };
}

function normalizeHomepageTile(tile = {}, index = 0) {
  return {
    key: String(tile.key || '')
      .trim()
      .toLowerCase(),
    kind: tile.kind === 'gamemode' ? 'gamemode' : 'page',
    label: String(tile.label || '').trim(),
    description: String(tile.description || '').trim(),
    link: String(tile.link || '').trim(),
    colours: {
      primary: String(tile.colours?.primary || '').trim(),
      secondary: String(tile.colours?.secondary || '').trim()
    },
    splashScreen: String(tile.splashScreen || '').trim(),
    images: {
      desktop: normalizeImage(tile.images?.desktop),
      mobile: normalizeImage(tile.images?.mobile)
    },
    layout: {
      columns: Array.isArray(tile.layout?.columns)
        ? tile.layout.columns.map(Number)
        : [],
      rows: Array.isArray(tile.layout?.rows)
        ? tile.layout.rows.map(Number)
        : [],
      mobile: {
        cols: Number(tile.layout?.mobile?.cols) || 1,
        rows: Number(tile.layout?.mobile?.rows) || 1,
        order: Number(tile.layout?.mobile?.order) || index + 1
      },
      size: tile.layout?.size || 'default'
    },
    access: {
      type: tile.access?.type || 'public',
      feature: tile.access?.feature || null
    },
    enabled: tile.enabled !== false,
    status: tile.status || 'published',
    sortOrder: Number.isFinite(Number(tile.sortOrder))
      ? Number(tile.sortOrder)
      : index
  };
}

function serializeHomepageTileForApi(tile, canAccess) {
  return {
    id: tile.key,
    kind: tile.kind,
    label: tile.label,
    description: tile.description,
    link: tile.link,
    colour: tile.colours?.primary || '',
    secondaryColour: tile.colours?.secondary || '',
    splashScreen: tile.splashScreen || '',
    images: {
      desktop: normalizeImage(tile.images?.desktop),
      mobile: normalizeImage(tile.images?.mobile)
    },
    x: Array.isArray(tile.layout?.columns) ? tile.layout.columns : [],
    y: Array.isArray(tile.layout?.rows) ? tile.layout.rows : [],
    mobile: {
      cols: tile.layout?.mobile?.cols || 1,
      rows: tile.layout?.mobile?.rows || 1,
      order: tile.layout?.mobile?.order || tile.sortOrder + 1
    },
    size: tile.layout?.size || 'default',
    canAccess: Boolean(canAccess)
  };
}

async function readHomepageTilesMigrationData() {
  const payload = JSON.parse(await fs.readFile(HOMEPAGE_TILES_FILE, 'utf8'));
  return Array.isArray(payload) ? payload : payload.homepageTiles || [];
}

async function importHomepageTiles(HomepageTile) {
  const sourceTiles = await readHomepageTilesMigrationData();
  const imported = [];
  const keys = [];

  for (const [index, sourceTile] of sourceTiles.entries()) {
    const tile = normalizeHomepageTile(sourceTile, index);
    if (!tile.key) continue;

    const savedTile = await HomepageTile.findOneAndUpdate(
      { key: tile.key },
      { $set: tile },
      { new: true, upsert: true, runValidators: true }
    );
    imported.push(savedTile);
    keys.push(tile.key);
  }

  await HomepageTile.deleteMany({ key: { $nin: keys } });
  return imported;
}

async function exportHomepageTiles(HomepageTile) {
  const tiles = await HomepageTile.find({})
    .sort({ sortOrder: 1, key: 1 })
    .lean();
  const serialized = tiles.map(normalizeHomepageTile);

  await fs.mkdir(path.dirname(HOMEPAGE_TILES_FILE), { recursive: true });
  await fs.writeFile(
    HOMEPAGE_TILES_FILE,
    `${JSON.stringify({ homepageTiles: serialized }, null, 2)}\n`
  );

  return serialized;
}

async function getHomepageTiles(HomepageTile) {
  return HomepageTile.find({ status: 'published', enabled: true })
    .sort({ sortOrder: 1, key: 1 })
    .lean();
}

module.exports = {
  HOMEPAGE_TILES_FILE,
  exportHomepageTiles,
  getHomepageTiles,
  importHomepageTiles,
  normalizeHomepageTile,
  serializeHomepageTileForApi
};

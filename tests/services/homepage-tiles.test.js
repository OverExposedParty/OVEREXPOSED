const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const HomepageTile = require('../../models/content/homepage-tile-schema');
const {
  getHomepageTiles,
  normalizeHomepageTile,
  serializeHomepageTileForApi
} = require('../../server/services/homepage-tiles');

const migrationFile = path.join(
  process.cwd(),
  'data',
  'site-content',
  'homepage-tiles.json'
);

function readMigrationTiles() {
  return JSON.parse(fs.readFileSync(migrationFile, 'utf8')).homepageTiles;
}

test('homepage tile migration data contains 15 valid, fully described pages', () => {
  const tiles = readMigrationTiles();
  const keys = tiles.map((tile) => tile.key);

  assert.equal(tiles.length, 15);
  assert.equal(new Set(keys).size, tiles.length);
  assert.deepEqual(
    keys.sort(),
    [
      'faqs',
      'imposter',
      'mafia',
      'most-likely-to',
      'never-have-i-ever',
      'oe-library',
      'oe-os',
      'oling-lab',
      'olings-battle',
      'overexposure',
      'paranoia',
      'shop',
      'terms-and-privacy',
      'truth-or-dare',
      'would-you-rather'
    ].sort()
  );

  tiles.forEach((sourceTile, index) => {
    const tile = normalizeHomepageTile(sourceTile, index);
    const validationError = new HomepageTile(tile).validateSync();

    assert.equal(validationError, undefined, `${tile.key} should be valid`);
    assert.ok(tile.description);
    assert.ok(tile.description.length <= 500);
    assert.ok(tile.layout.columns.length);
    assert.ok(tile.layout.rows.length);
  });
});

test('homepage tile API serialization exposes database layout and access state', () => {
  const [sourceTile] = readMigrationTiles();
  const tile = normalizeHomepageTile(sourceTile);
  const serialized = serializeHomepageTileForApi(tile, true);

  assert.equal(serialized.id, 'truth-or-dare');
  assert.equal(
    serialized.description,
    'Choose between answering a revealing question or completing a daring challenge. A familiar party game packed with confessions, surprises and chaotic moments.'
  );
  assert.deepEqual(serialized.x, [1, 2]);
  assert.deepEqual(serialized.y, [1]);
  assert.equal(serialized.mobile.order, 1);
  assert.equal(serialized.canAccess, true);
});

test('OE Library homepage access matches its account-protected page route', () => {
  const oeLibrary = readMigrationTiles().find(
    (tile) => tile.key === 'oe-library'
  );

  assert.ok(oeLibrary);
  assert.equal(oeLibrary.access?.type, 'account');
});

test('homepage tile query excludes disabled tiles', async () => {
  let filter;
  const expectedTiles = [{ key: 'truth-or-dare' }];
  const HomepageTile = {
    find(query) {
      filter = query;
      return {
        sort(sortOrder) {
          assert.deepEqual(sortOrder, { sortOrder: 1, key: 1 });
          return {
            lean: async () => expectedTiles
          };
        }
      };
    }
  };

  const tiles = await getHomepageTiles(HomepageTile);

  assert.deepEqual(filter, { status: 'published', enabled: true });
  assert.equal(tiles, expectedTiles);
});

test('homepage layout compacts empty desktop rows', () => {
  const accessSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'public',
      'scripts',
      'party-games',
      'homepage',
      'homepage',
      'access-and-data.js'
    ),
    'utf8'
  );
  const context = {};

  vm.runInNewContext(
    `${accessSource}
globalThis.getCompactDesktopRowMapForTest = getCompactDesktopRowMap;`,
    context
  );

  const rowMap = context.getCompactDesktopRowMapForTest([
    { y: [1] },
    { y: [2] },
    { y: [3, 4] },
    { y: [6] }
  ]);

  assert.equal(rowMap.size, 5);
  assert.equal(rowMap.get(1), 1);
  assert.equal(rowMap.get(2), 2);
  assert.equal(rowMap.get(3), 3);
  assert.equal(rowMap.get(4), 4);
  assert.equal(rowMap.get(6), 5);
});

test('homepage runtime has no static tile or gamemode fallback', () => {
  const homepageDirectory = path.join(
    process.cwd(),
    'public',
    'scripts',
    'party-games',
    'homepage',
    'homepage'
  );
  const accessSource = fs.readFileSync(
    path.join(homepageDirectory, 'access-and-data.js'),
    'utf8'
  );
  const tileUiSource = fs.readFileSync(
    path.join(homepageDirectory, 'tile-ui.js'),
    'utf8'
  );
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), 'public', 'pages', 'homepages', 'homepage.html'),
    'utf8'
  );

  assert.equal(
    fs.existsSync(path.join(homepageDirectory, 'tile-config.js')),
    false
  );
  assert.match(accessSource, /fetchJson\('\/api\/homepage-tiles'\)/);
  assert.doesNotMatch(accessSource, /party-game-gamemodes|gamemodes\.json/);
  assert.doesNotMatch(tileUiSource, /More information will be added soon/);
  assert.doesNotMatch(pageSource, /tile-config\.js/);
});

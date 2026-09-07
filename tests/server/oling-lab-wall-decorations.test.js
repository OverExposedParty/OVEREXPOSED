const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getOwnedWallDecorationQuantities,
  normalizePlacedWallDecorations
} = require('../../server/routes/api-olings/lab-state/wall-decorations');

const POSTER_KEY = 'oling_clash_beta_poster';
const unlockedCellSet = new Set(['0:0', '0:1', '0:2', '1:0', '1:1', '1:2']);

function accountWithPosters(quantity = 1) {
  return {
    olings: {
      wallDecorations: [{ key: POSTER_KEY, quantity }]
    }
  };
}

function placement(
  placedId,
  anchorCol,
  anchorRow,
  offsetX = 0.5,
  offsetY = 0.5
) {
  return {
    placedId,
    itemId: POSTER_KEY,
    anchorCol,
    anchorRow,
    offsetX,
    offsetY
  };
}

function normalize(items, options = {}) {
  return normalizePlacedWallDecorations(items, {
    account: options.account || accountWithPosters(items.length || 1),
    olingState: null,
    columns: 3,
    unlockedCellSet,
    placedItems: options.placedItems || []
  });
}

test('wall-decoration ownership retains quantities for duplicate posters', () => {
  const owned = getOwnedWallDecorationQuantities(accountWithPosters(2));
  assert.equal(owned.get(POSTER_KEY), 2);
});

test('free wall placements are normalized to their majority-overlap cell', () => {
  const result = normalize([placement('poster-1', 0, 0, 1.1, 0.5)]);
  assert.equal(result.error, undefined);
  assert.deepEqual(
    {
      anchorCol: result.placedWallDecorations[0].anchorCol,
      anchorRow: result.placedWallDecorations[0].anchorRow,
      offsetX: result.placedWallDecorations[0].offsetX,
      offsetY: result.placedWallDecorations[0].offsetY
    },
    { anchorCol: 1, anchorRow: 0, offsetX: 0.10000000000000009, offsetY: 0.5 }
  );
});

test('wall decorations cannot overlap each other', () => {
  const result = normalize(
    [placement('poster-1', 1, 0), placement('poster-2', 1, 0, 0.7, 0.5)],
    { account: accountWithPosters(2) }
  );
  assert.equal(result.error?.code, 'oling_lab_wall_decoration_overlap');
});

test('wall decorations cannot overlap the door placement artwork', () => {
  const result = normalize([placement('poster-1', 0, 1)], {
    placedItems: [
      {
        placedId: 'door',
        itemId: 'standard_door',
        row: 1,
        col: 0,
        width: 1,
        height: 1,
        containerSlots: []
      }
    ]
  });
  assert.equal(
    result.error?.code,
    'oling_lab_wall_decoration_furniture_overlap'
  );
});

test('wall-decoration quantities cap how many copies can be placed', () => {
  const result = normalize(
    [placement('poster-1', 1, 0), placement('poster-2', 2, 0)],
    { account: accountWithPosters(1) }
  );
  assert.equal(result.error?.code, 'oling_lab_wall_decoration_not_owned');
});

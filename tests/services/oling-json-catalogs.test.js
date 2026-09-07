const assert = require('node:assert/strict');
const test = require('node:test');

const furnitureCatalog = require('../../public/json-files/olings/lab/furniture.json');
const podCatalog = require('../../public/json-files/olings/lab/pods.json');
const wallpaperCatalog = require('../../public/json-files/olings/lab/wallpapers.json');
const wallDecorationCatalog = require('../../public/json-files/olings/lab/wall-decorations.json');
const {
  OlingLabItems,
  OlingLabWallDecorations,
  OlingLabWallpapers
} = require('../../server/routes/api-olings/lab-catalog');
const {
  listOlingPodDefinitions,
  serializeOlingPodDefinition
} = require('../../server/services/olings/pod-catalog');

test('Oling Lab catalogue maps are loaded from the JSON catalogues', () => {
  assert.deepEqual(Object.values(OlingLabItems), furnitureCatalog.furniture);
  assert.deepEqual(
    Object.values(OlingLabWallpapers),
    wallpaperCatalog.wallpapers
  );
  assert.deepEqual(
    Object.values(OlingLabWallDecorations),
    wallDecorationCatalog.wallDecorations
  );
});

test('Oling Pod definitions are loaded from the JSON catalogue', () => {
  assert.deepEqual(
    listOlingPodDefinitions().map(serializeOlingPodDefinition),
    podCatalog.pods
  );
});

test('loaded JSON catalogue definitions are immutable', () => {
  assert.equal(Object.isFrozen(OlingLabItems), true);
  assert.equal(Object.isFrozen(OlingLabItems.standard_door), true);
  assert.equal(
    Object.isFrozen(OlingLabItems.standard_door.wallCollisionBounds),
    true
  );
  assert.equal(Object.isFrozen(OlingLabWallpapers.prototype.variants), true);
  assert.equal(Object.isFrozen(listOlingPodDefinitions()[0]), true);
});

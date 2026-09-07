const assert = require('node:assert/strict');
const test = require('node:test');

const { registerOlingRoutes } = require('../../server/routes/api-olings');
const labState = require('../../server/routes/api-olings/lab-state');
const {
  createOlingLabTutorial
} = require('../../server/routes/api-olings/lab-tutorial');

test('registerOlingRoutes preserves the Oling endpoint contract and order', () => {
  const registrations = [];
  const app = {};

  ['use', 'get', 'post', 'put', 'patch'].forEach((method) => {
    app[method] = (path) => registrations.push([method, path]);
  });

  registerOlingRoutes({ app, models: {} });

  assert.deepEqual(registrations, [
    ['use', '/api/olings/storage'],
    ['use', '/api/olings/lab'],
    ['use', '/api/olings/adventures'],
    ['use', '/api/olings/mine'],
    ['use', '/api/olings/hatch'],
    ['use', '/api/olings/:olingId/consume'],
    ['use', '/api/olings/:olingId/activities'],
    ['use', '/api/olings/:olingId/sleep'],
    ['patch', '/api/olings/:olingId'],
    ['post', '/api/olings/storage/:olingId/store'],
    ['post', '/api/olings/storage/:olingId/transfer'],
    ['post', '/api/olings/storage/:olingId/release'],
    ['post', '/api/olings/storage/quick-sell/prices'],
    ['post', '/api/olings/storage/quick-sell/quote'],
    ['post', '/api/olings/storage/quick-sell'],
    ['get', '/api/olings/lab/tutorial'],
    ['get', '/api/olings/lab'],
    ['patch', '/api/olings/lab/privacy'],
    ['get', '/api/olings/notifications'],
    ['patch', '/api/olings/notifications'],
    ['put', '/api/olings/lab'],
    ['post', '/api/olings/lab/furniture-sale/quote'],
    ['post', '/api/olings/lab/furniture-sale'],
    ['post', '/api/olings/lab/expand'],
    ['get', '/api/olings/eggs'],
    ['get', '/api/olings/traits'],
    ['get', '/api/olings/consumables'],
    ['get', '/api/olings/labs/:username'],
    ['get', '/api/olings/adventures'],
    ['post', '/api/olings/adventures/start'],
    ['post', '/api/olings/adventures/return'],
    ['get', '/api/olings/mine'],
    ['post', '/api/olings/:olingId/consume'],
    ['post', '/api/olings/:olingId/activities/:activityType/start'],
    ['patch', '/api/olings/:olingId/sleep'],
    ['post', '/api/olings/hatch'],
    ['get', '/api/olings/admin/room'],
    ['get', '/api/olings/admin/hatch-preview'],
    ['post', '/api/olings/admin/hatch'],
    ['get', '/api/olings/admin/hatch-receipt'],
    ['patch', '/api/olings/:olingId']
  ]);
});

test('Oling Lab state facade preserves its helper contract', () => {
  assert.deepEqual(Object.keys(labState), [
    'clampInteger',
    'createDefaultOlingLab',
    'serializeOlingLabItem',
    'serializeOlingLabWallDecoration',
    'getAllowedRoomRows',
    'canUseRoomRow',
    'getOwnedLabFurniture',
    'getOwnedLabWallpapers',
    'getOwnedLabWallpaperVariants',
    'getOwnedWallDecorationQuantities',
    'ensureAccountOlingDocument',
    'ensureContainerSlots',
    'ensureItemInventorySlots',
    'getContainerSlotDefinition',
    'containerSlotAcceptsItem',
    'getOwnedEggQuantities',
    'getOwnedConsumableQuantities',
    'getReservedLabItemQuantity',
    'validateItemInventorySlots',
    'serializeOlingLab',
    'getLabCellKey',
    'getLabColumnCellKeys',
    'getUnlockedLabCellKeys',
    'getLabExpansionDetails',
    'getItemCells',
    'validateContainerSlotItems',
    'normalizeLabPayload',
    'normalizePlacedWallDecorations'
  ]);

  assert.equal(typeof labState.createDefaultOlingLab, 'function');
  assert.equal(typeof labState.normalizeLabPayload, 'function');
});

test('Oling Lab catalog serializes generic furniture drag interactions', () => {
  const {
    OlingLabItems
  } = require('../../server/routes/api-olings/lab-catalog');
  const bed = labState.serializeOlingLabItem(OlingLabItems.oling_bed);
  const incubeta = labState.serializeOlingLabItem(OlingLabItems.incubeta);
  const podRack = labState.serializeOlingLabItem(OlingLabItems.pod_rack);
  const standardDoor = labState.serializeOlingLabItem(
    OlingLabItems.standard_door
  );

  assert.deepEqual(bed.dragInteractions, [
    {
      accepts: ['oling'],
      action: 'rest',
      collisionArea: 'placement-grid',
      snapTarget: 'rest-grid'
    }
  ]);
  assert.equal(incubeta.influenceSlotCount, 1);
  assert.equal(incubeta.sounds.placed, 'olingLabFurnitureIncubetaPlaced');
  assert.deepEqual(podRack.podStorage, { capacity: 6 });
  assert.equal(podRack.inventorySlots.length, 6);
  assert.ok(
    podRack.inventorySlots.every(
      (slot) => slot.slotType === 'oling-pod-storage'
    )
  );
  assert.equal(OlingLabItems.standard_door.sounds, undefined);
  assert.equal(standardDoor.sounds, null);
});

test('Oling Lab tutorial fixture is deterministic and includes an incubator', () => {
  const first = labState.serializeOlingLab(createOlingLabTutorial());
  const second = labState.serializeOlingLab(createOlingLabTutorial());
  const table = first.placedItems.find(
    (item) => item.placedId === 'tutorial-table'
  );

  assert.deepEqual(first, second);
  assert.equal(first.appearance.wallpaperKey, 'brick');
  assert.equal(first.columns, 3);
  assert.equal(first.unlockedCells.length, 6);
  assert.equal(table.containerSlots[0].itemId, 'incubeta');
  assert.equal(table.containerSlots[0].inventorySlots[0].slotId, 'egg');
  assert.equal(
    first.placedItems.find((item) => item.placedId === 'tutorial-door')
      .containerSlots[0].itemId,
    'explorer_gateway'
  );
  assert.equal(
    first.placedItems.some((item) => item.itemId === 'basic_hanging_light'),
    false
  );
});

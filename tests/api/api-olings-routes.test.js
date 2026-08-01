const assert = require('node:assert/strict');
const test = require('node:test');

const { registerOlingRoutes } = require('../../server/routes/api-olings');
const labState = require('../../server/routes/api-olings/lab-state');

test('registerOlingRoutes preserves the Oling endpoint contract and order', () => {
  const registrations = [];
  const app = {};

  ['use', 'get', 'post', 'put', 'patch'].forEach((method) => {
    app[method] = (path) => registrations.push([method, path]);
  });

  registerOlingRoutes({ app, models: {} });

  assert.deepEqual(registrations, [
    ['use', '/api/olings/storage/quick-sell'],
    ['use', '/api/olings/lab'],
    ['use', '/api/olings/adventures'],
    ['use', '/api/olings/mine'],
    ['use', '/api/olings/hatch'],
    ['use', '/api/olings/:olingId/consume'],
    ['use', '/api/olings/:olingId/activities'],
    ['use', '/api/olings/:olingId/sleep'],
    ['patch', '/api/olings/:olingId'],
    ['post', '/api/olings/storage/quick-sell/quote'],
    ['post', '/api/olings/storage/quick-sell'],
    ['get', '/api/olings/lab'],
    ['get', '/api/olings/notifications'],
    ['patch', '/api/olings/notifications'],
    ['put', '/api/olings/lab'],
    ['post', '/api/olings/lab/expand'],
    ['get', '/api/olings/eggs'],
    ['get', '/api/olings/traits'],
    ['get', '/api/olings/personalities'],
    ['get', '/api/olings/consumables'],
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
    'getAllowedRoomRows',
    'canUseRoomRow',
    'getOwnedLabFurniture',
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
    'getUnlockedLabCellKeys',
    'getLabExpansionDetails',
    'getItemCells',
    'validateContainerSlotItems',
    'normalizeLabPayload'
  ]);

  assert.equal(typeof labState.createDefaultOlingLab, 'function');
  assert.equal(typeof labState.normalizeLabPayload, 'function');
});

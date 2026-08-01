const test = require('node:test');
const assert = require('node:assert/strict');

const { getOrCreateOlingState } = require('../../server/services/olings');

class FakeAccount {
  constructor(values = {}) {
    Object.assign(this, values);
    this.constructor.lastUpdate = null;
  }

  static async updateOne(query, update, options) {
    this.lastUpdate = { query, update, options };
  }

  set(path, value) {
    this[path] = value;
  }
}

test('first-time Olings Lab users start with a base egg in the incubator', async () => {
  const account = new FakeAccount({ _id: 'account-one', gameData: {} });

  const state = await getOrCreateOlingState(null, account);

  assert.equal(state.inventory.eggs.length, 1);
  assert.equal(state.inventory.eggs[0].key, 'base-egg');
  assert.equal(state.inventory.eggs[0].quantity, 1);
  assert.equal(state.lab.placedItems.length, 2);

  const table = state.lab.placedItems.find(
    (item) => item.placedId === 'starter_table'
  );
  const incubator = table.containerSlots.find(
    (slot) => slot.slotId === 'tabletop'
  );
  const eggSlot = incubator.inventorySlots.find(
    (slot) => slot.slotId === 'egg'
  );

  assert.equal(incubator.itemId, 'incubeta');
  assert.equal(incubator.itemType, 'incubator');
  assert.equal(eggSlot.itemKey, 'base-egg');
  assert.equal(eggSlot.itemType, 'egg');
  assert.equal(eggSlot.quantity, 1);
});

test('existing Oling data is preserved without adding a starter egg', async () => {
  const existingLab = {
    roomLevel: 1,
    columns: 3,
    rows: 2,
    placedItems: [{ placedId: 'custom', itemId: 'standard_table' }]
  };
  const account = new FakeAccount({
    _id: 'account-two',
    gameData: {},
    olings: {
      eggs: [{ key: 'rare-egg', quantity: 2 }],
      consumables: [],
      furniture: [],
      olings: [],
      hatchHistory: [],
      lab: existingLab
    }
  });

  const state = await getOrCreateOlingState(null, account);

  assert.deepEqual(state.inventory.eggs, [{ key: 'rare-egg', quantity: 2 }]);
  assert.equal(state.lab, existingLab);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getOlingLabRemovalBlock
} = require('../../server/routes/api-olings/lab-save-routes');
const { OlingLabItems } = require('../../server/routes/api-olings/lab-catalog');

function createPlacedItem(overrides = {}) {
  return {
    placedId: 'placed-item',
    itemId: 'standard_table',
    inventorySlots: [],
    containerSlots: [],
    ...overrides
  };
}

function getRemovalBlock(previousItems, nextItems, overrides = {}) {
  return getOlingLabRemovalBlock({
    previousLab: { placedItems: previousItems },
    nextLab: { placedItems: nextItems },
    account: { olings: { eggs: [], consumables: [] } },
    olingState: { inventory: { eggs: [], consumables: [] } },
    definitions: OlingLabItems,
    ...overrides
  });
}

test('an account storage item cannot be removed while inventory is displayed in it', () => {
  const shelf = createPlacedItem({
    placedId: 'placed-shelf',
    itemId: 'supply_shelf'
  });
  const block = getRemovalBlock([shelf], [], {
    olingState: {
      inventory: {
        eggs: [{ key: 'base_egg', quantity: 1 }],
        consumables: []
      }
    }
  });

  assert.equal(block.code, 'oling_lab_storage_not_empty');
  assert.match(block.message, /Supply Shelf/);
});

test('an incubator cannot be removed while it contains an egg or influence', () => {
  const occupiedTable = createPlacedItem({
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: 'incubeta',
        inventorySlots: [
          {
            slotId: 'egg',
            itemKey: 'base_egg',
            quantity: 1,
            influenceSlots: []
          }
        ]
      }
    ]
  });
  const emptyTable = createPlacedItem({
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: null,
        inventorySlots: []
      }
    ]
  });
  const block = getRemovalBlock([occupiedTable], [emptyTable]);

  assert.equal(block.code, 'oling_lab_container_not_empty');
  assert.match(block.message, /Incubeta/);
});

test('parent furniture cannot be removed with an attached container item', () => {
  const table = createPlacedItem({
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: 'incubeta',
        inventorySlots: []
      }
    ]
  });
  const block = getRemovalBlock([table], []);

  assert.equal(block.code, 'oling_lab_furniture_has_attached_items');
});

test('empty storage and empty container items can still be removed', () => {
  const shelf = createPlacedItem({
    placedId: 'placed-shelf',
    itemId: 'supply_shelf'
  });
  const tableWithIncubator = createPlacedItem({
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: 'incubeta',
        inventorySlots: []
      }
    ]
  });
  const tableWithoutIncubator = createPlacedItem({
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: null,
        inventorySlots: []
      }
    ]
  });

  assert.equal(getRemovalBlock([shelf], []), null);
  assert.equal(
    getRemovalBlock([tableWithIncubator], [tableWithoutIncubator]),
    null
  );
});

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FURNITURE_QUICK_SELL_RATE,
  findPlacedFurniture,
  getFurnitureSaleBlock,
  createFurnitureSaleQuote,
  removePlacedFurniture,
  decrementFurnitureInventory
} = require('../../server/routes/api-olings/lab-furniture-sale-routes');
const { OlingLabItems } = require('../../server/routes/api-olings/lab-catalog');

function createLab() {
  return {
    placedItems: [
      {
        placedId: 'table-1',
        itemId: 'standard_table',
        locked: false,
        inventorySlots: [],
        containerSlots: [
          {
            slotId: 'tabletop',
            placedId: 'incubator-1',
            itemId: 'incubeta',
            itemType: 'incubator',
            inventorySlots: []
          }
        ]
      }
    ]
  };
}

test('furniture quick sales pay 60% of the recorded unit purchase price', async () => {
  const target = findPlacedFurniture(
    {
      placedItems: [
        {
          placedId: 'bed-1',
          itemId: 'oling_bed',
          inventorySlots: [],
          containerSlots: []
        }
      ]
    },
    'bed-1',
    OlingLabItems
  );
  const quote = await createFurnitureSaleQuote({
    account: {
      olings: {
        furniture: [
          {
            key: 'oling_bed',
            quantity: 1,
            metadata: { opalUnitPrice: 101 }
          }
        ]
      }
    },
    olingState: null,
    target,
    Product: null
  });

  assert.equal(FURNITURE_QUICK_SELL_RATE, 0.6);
  assert.equal(quote.paidPrice, 101);
  assert.equal(quote.payout, 60);
});

test('contained furniture is found and removed without removing its parent', () => {
  const lab = createLab();
  const target = findPlacedFurniture(lab, 'incubator-1', OlingLabItems);
  const nextLab = removePlacedFurniture(lab, target);

  assert.equal(target.kind, 'container');
  assert.equal(target.definition.id, 'incubeta');
  assert.equal(nextLab.placedItems.length, 1);
  assert.equal(nextLab.placedItems[0].containerSlots[0].itemId, null);
  assert.equal(nextLab.placedItems[0].containerSlots[0].placedId, null);
});

test('furniture with inventory or attached items is blocked from sale', () => {
  const occupied = findPlacedFurniture(
    {
      placedItems: [
        {
          placedId: 'shelf-1',
          itemId: 'supply_shelf',
          inventorySlots: [],
          containerSlots: []
        }
      ]
    },
    'shelf-1',
    OlingLabItems
  );
  const storageBlock = getFurnitureSaleBlock({
    target: occupied,
    account: {
      olings: { eggs: [{ key: 'base_egg', quantity: 1 }], consumables: [] }
    },
    olingState: null
  });
  const parentBlock = getFurnitureSaleBlock({
    target: findPlacedFurniture(createLab(), 'table-1', OlingLabItems),
    account: { olings: { eggs: [], consumables: [] } },
    olingState: null
  });

  assert.equal(storageBlock.code, 'oling_lab_furniture_not_empty');
  assert.equal(parentBlock.code, 'oling_lab_furniture_has_attached_items');
});

test('selling one furniture unit decrements and removes empty stacks', () => {
  const now = new Date('2026-09-06T12:00:00.000Z');
  const next = decrementFurnitureInventory(
    [
      { key: 'oling_bed', quantity: 2 },
      { key: 'pod_rack', quantity: 1 }
    ],
    'oling_bed',
    now
  );
  const withoutRack = decrementFurnitureInventory(next, 'pod_rack', now);

  assert.equal(next.find((item) => item.key === 'oling_bed').quantity, 1);
  assert.equal(
    withoutRack.some((item) => item.key === 'pod_rack'),
    false
  );
});

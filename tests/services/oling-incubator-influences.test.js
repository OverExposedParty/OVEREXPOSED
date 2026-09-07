const assert = require('node:assert/strict');
const test = require('node:test');

const { OlingLabItems } = require('../../server/routes/api-olings/lab-catalog');
const {
  getReservedLabItemQuantity,
  validateItemInventorySlots
} = require('../../server/routes/api-olings/lab-state');
const {
  getIncubatorInfluenceSlotDefinitions,
  normalizeInfluenceSlots,
  consumableMatchesHatchInfluenceSlot,
  applyHatchInfluenceReservations
} = require('../../server/routes/api-olings/lab-incubation');
const {
  applyHatchSpeedToDuration,
  applyRarityChanceToOdds,
  createHatchInfluenceSnapshots
} = require('../../server/services/olings/hatch-influences');

function createLab(influenceSlots = []) {
  return {
    placedItems: [
      {
        placedId: 'table-1',
        itemId: 'hatching_table',
        inventorySlots: [],
        containerSlots: [
          {
            slotId: 'tabletop',
            itemId: 'incubeta',
            inventorySlots: [
              {
                slotId: 'egg',
                slotType: 'egg',
                itemKey: 'starter-egg',
                placedAt: '2026-08-31T12:00:00.000Z',
                influenceSlots
              }
            ]
          }
        ]
      }
    ]
  };
}

test('Incubeta exposes one generic influence slot', () => {
  assert.equal(OlingLabItems.incubeta.influenceSlotCount, 1);
  assert.deepEqual(
    getIncubatorInfluenceSlotDefinitions(OlingLabItems.incubeta),
    [{ key: 'influence-1', label: 'Influence Slot' }]
  );
  assert.deepEqual(
    getIncubatorInfluenceSlotDefinitions({
      influenceSlotCount: 3
    }),
    [
      { key: 'influence-1', label: 'Influence Slot 1' },
      { key: 'influence-2', label: 'Influence Slot 2' },
      { key: 'influence-3', label: 'Influence Slot 3' }
    ]
  );
});

test('legacy typed influence data maps into available generic slots', () => {
  assert.deepEqual(
    normalizeInfluenceSlots(
      [{ slotKey: 'rarity', itemKey: 'lucky-dust', consumedAt: 'earlier' }],
      OlingLabItems.incubeta
    ),
    [
      {
        slotKey: 'influence-1',
        itemKey: 'lucky-dust',
        itemType: 'consumable',
        reservedAt: null,
        consumedAt: 'earlier'
      }
    ]
  );
});

test('generic influence slots accept egg hatching items but not O-Juice', () => {
  assert.equal(
    consumableMatchesHatchInfluenceSlot({
      category: 'hatching',
      target: 'egg',
      effect: { type: 'rarity_chance' }
    }),
    true
  );
  assert.equal(
    consumableMatchesHatchInfluenceSlot({
      category: 'care',
      target: 'oling',
      effect: { type: 'energy' }
    }),
    false
  );
});

test('the same influence item cannot occupy multiple generic slots', () => {
  assert.deepEqual(
    normalizeInfluenceSlots(
      [
        { slotKey: 'influence-1', itemKey: 'lucky-dust' },
        { slotKey: 'influence-2', itemKey: 'lucky-dust' }
      ],
      { influenceSlotCount: 2 }
    ),
    [
      {
        slotKey: 'influence-1',
        itemKey: 'lucky-dust',
        itemType: 'consumable',
        reservedAt: null,
        consumedAt: null
      }
    ]
  );
});

test('saving a generic egg influence reserves the selected item', () => {
  const nextLab = createLab([
    { slotKey: 'influence-1', itemKey: 'lucky-dust' }
  ]);
  const account = {
    olings: { consumables: [{ key: 'lucky-dust', quantity: 2 }] }
  };
  const result = applyHatchInfluenceReservations(
    nextLab,
    createLab(),
    account,
    [
      {
        key: 'lucky-dust',
        category: 'hatching',
        target: 'egg',
        effect: { type: 'rarity_chance' }
      }
    ]
  );

  assert.equal(result.error, undefined);
  assert.equal(account.olings.consumables[0].quantity, 2);
  assert.equal(result.reservations.get('lucky-dust'), 1);
  const savedInfluence =
    nextLab.placedItems[0].containerSlots[0].inventorySlots[0]
      .influenceSlots[0];
  assert.equal(savedInfluence.slotKey, 'influence-1');
  assert.ok(savedInfluence.reservedAt instanceof Date);
  assert.equal(savedInfluence.consumedAt, null);
});

test('an influence remains saved and unavailable before an egg is inserted', () => {
  const nextLab = createLab([
    { slotKey: 'influence-1', itemKey: 'oling-blanket' }
  ]);
  const eggSlot = nextLab.placedItems[0].containerSlots[0].inventorySlots[0];
  eggSlot.itemKey = null;
  eggSlot.itemType = null;
  eggSlot.placedAt = null;
  const previousLab = createLab();
  const previousEggSlot =
    previousLab.placedItems[0].containerSlots[0].inventorySlots[0];
  previousEggSlot.itemKey = null;
  previousEggSlot.itemType = null;
  previousEggSlot.placedAt = null;

  const result = applyHatchInfluenceReservations(
    nextLab,
    previousLab,
    { olings: { consumables: [{ key: 'oling-blanket', quantity: 1 }] } },
    [
      {
        key: 'oling-blanket',
        category: 'hatching',
        target: 'egg',
        effect: { type: 'hatch_speed' }
      }
    ]
  );

  assert.equal(result.error, undefined);
  assert.equal(result.reservations.get('oling-blanket'), 1);
  assert.equal(eggSlot.influenceSlots[0].itemKey, 'oling-blanket');
});

test('saving an inserted egg does not start its hatch timer', () => {
  const slots = [
    {
      slotId: 'egg',
      slotType: 'egg',
      itemKey: 'starter-egg',
      itemType: 'egg',
      quantity: 1,
      placedAt: null,
      influenceSlots: []
    }
  ];
  const result = validateItemInventorySlots('incubeta', slots, {
    ownedEggQuantities: new Map([['starter-egg', 1]]),
    ownedConsumableQuantities: new Map(),
    usedEggQuantities: new Map(),
    usedConsumableQuantities: new Map()
  });

  assert.equal(result, null);
  assert.equal(slots[0].placedAt, null);
});

test('saving rejects more hatch influence reservations than are owned', () => {
  const nextLab = createLab([
    { slotKey: 'influence-1', itemKey: 'lucky-dust' }
  ]);
  nextLab.placedItems.push({
    ...createLab([{ slotKey: 'influence-1', itemKey: 'lucky-dust' }])
      .placedItems[0],
    placedId: 'table-2'
  });
  const account = {
    olings: { consumables: [{ key: 'lucky-dust', quantity: 1 }] }
  };

  const result = applyHatchInfluenceReservations(
    nextLab,
    createLab(),
    account,
    [
      {
        key: 'lucky-dust',
        category: 'hatching',
        target: 'egg',
        effect: { type: 'rarity_chance' }
      }
    ]
  );

  assert.equal(result.error.code, 'oling_lab_consumable_not_owned');
  assert.equal(account.olings.consumables[0].quantity, 1);
});

test('legacy start-consumed influences stay marked consumed without reserving again', () => {
  const previousLab = createLab([
    {
      slotKey: 'influence-1',
      itemKey: 'lucky-dust',
      consumedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);
  const nextLab = createLab([
    { slotKey: 'influence-1', itemKey: 'lucky-dust' }
  ]);
  const account = { olings: { consumables: [] } };

  const result = applyHatchInfluenceReservations(
    nextLab,
    previousLab,
    account,
    [
      {
        key: 'lucky-dust',
        category: 'hatching',
        target: 'egg',
        effect: { type: 'rarity_chance' }
      }
    ]
  );

  assert.equal(result.error, undefined);
  assert.equal(result.reservations.size, 0);
  assert.equal(
    nextLab.placedItems[0].containerSlots[0].inventorySlots[0].influenceSlots[0]
      .consumedAt,
    '2026-09-05T12:00:00.000Z'
  );
});

test('cancelling an incubation releases its influence reservation', () => {
  const previousLab = createLab([
    {
      slotKey: 'influence-1',
      itemKey: 'lucky-dust',
      reservedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);
  const nextLab = createLab();
  const account = {
    olings: { consumables: [{ key: 'lucky-dust', quantity: 1 }] }
  };

  const result = applyHatchInfluenceReservations(
    nextLab,
    previousLab,
    account,
    [
      {
        key: 'lucky-dust',
        category: 'hatching',
        target: 'egg',
        effect: { type: 'rarity_chance' }
      }
    ]
  );

  assert.equal(result.error, undefined);
  assert.equal(result.reservations.size, 0);
  assert.equal(account.olings.consumables[0].quantity, 1);
  assert.equal(
    getReservedLabItemQuantity(nextLab, 'consumable', 'lucky-dust'),
    0
  );
});

test('only unconsumed influence slots reduce available storage quantity', () => {
  const lab = createLab([
    {
      slotKey: 'influence-1',
      itemKey: 'lucky-dust',
      reservedAt: '2026-09-05T12:00:00.000Z'
    }
  ]);

  assert.equal(getReservedLabItemQuantity(lab, 'consumable', 'lucky-dust'), 1);
  lab.placedItems[0].containerSlots[0].inventorySlots[0].influenceSlots[0].consumedAt =
    '2026-09-05T12:01:00.000Z';
  assert.equal(getReservedLabItemQuantity(lab, 'consumable', 'lucky-dust'), 0);
});

test('Oling Blanket increases hatch speed by 25 percent', () => {
  const influenceSlots = [{ slotKey: 'influence-1', itemKey: 'oling-blanket' }];
  const consumables = [
    {
      key: 'oling-blanket',
      effect: { type: 'hatch_speed', amount: 25 }
    }
  ];

  assert.equal(
    applyHatchSpeedToDuration(2 * 60 * 60 * 1000, influenceSlots, consumables),
    96 * 60 * 1000
  );
});

test('rarity influences shift percentage points from common proportionally', () => {
  const baseOdds = { common: 0.7, uncommon: 0.18, rare: 0.1, epic: 0.02 };
  const influenceSlots = [{ slotKey: 'influence-1', itemKey: 'opal-dust' }];
  const consumables = [
    {
      key: 'opal-dust',
      name: 'Opal Dust',
      effect: { type: 'rarity_chance', amount: 10 },
      metadata: { rarity: 'rare' },
      assets: { icon: '/opal-dust.svg' }
    }
  ];

  const adjusted = applyRarityChanceToOdds(
    baseOdds,
    influenceSlots,
    consumables
  );
  assert.equal(adjusted.common, 0.6);
  assert.ok(Math.abs(adjusted.uncommon - 0.24) < Number.EPSILON);
  assert.ok(Math.abs(adjusted.rare - 0.13333333333333333) < Number.EPSILON);
  assert.ok(Math.abs(adjusted.epic - 0.026666666666666665) < Number.EPSILON);
  assert.ok(
    Math.abs(
      Object.values(adjusted).reduce((sum, value) => sum + value, 0) - 1
    ) < Number.EPSILON
  );
  assert.deepEqual(createHatchInfluenceSnapshots(influenceSlots, consumables), [
    {
      slotKey: 'influence-1',
      itemKey: 'opal-dust',
      itemName: 'Opal Dust',
      itemRarity: 'rare',
      effect: { type: 'rarity_chance', amount: 10 },
      assets: { icon: '/opal-dust.svg' },
      consumedAt: null
    }
  ]);
});

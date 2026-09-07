const assert = require('node:assert/strict');
const test = require('node:test');

const {
  cleanAccountDocument,
  cleanBattlePlayers,
  cleanClashPlayers,
  cleanOlingStateDocument,
  collectRetiredConsumableKeys,
  isRetiredPersonalityConsumable,
  isRetiredPersonalityProduct,
  removeLegacyOlingSnapshotFields
} = require('../../scripts/migrate-oling-personality-removal');

function createPersonalityProduct(overrides = {}) {
  return {
    _id: 'retired-product-1',
    slug: 'teddy-bear',
    identity: {
      slug: 'teddy-bear',
      tags: ['oling', 'personality']
    },
    digitalEntitlement: {
      grants: [
        {
          type: 'oling_consumable',
          key: 'teddy-bear',
          metadata: {
            consumableSubcategory: 'personality',
            effectType: 'personality_chance'
          }
        }
      ]
    },
    ...overrides
  };
}

test('migration detects retired personality definitions while preserving O-Juice', () => {
  const retiredConsumable = {
    key: 'teddy-bear',
    category: 'hatching',
    subcategory: 'personality',
    effect: { type: 'personality_chance' }
  };
  const retiredProduct = createPersonalityProduct();
  const legacyOJuiceProduct = createPersonalityProduct({
    slug: 'o-juice',
    identity: { slug: 'o-juice', tags: ['personality'] }
  });

  assert.equal(isRetiredPersonalityConsumable(retiredConsumable), true);
  assert.equal(
    isRetiredPersonalityConsumable({
      ...retiredConsumable,
      key: 'o-juice'
    }),
    false
  );
  assert.equal(isRetiredPersonalityProduct(retiredProduct), true);
  assert.equal(isRetiredPersonalityProduct(legacyOJuiceProduct), false);

  const retiredKeys = collectRetiredConsumableKeys(
    [retiredConsumable],
    [retiredProduct]
  );
  assert.equal(retiredKeys.has('teddy-bear'), true);
  assert.equal(retiredKeys.has('o-juice'), false);
});

test('migration removes legacy progression and personality snapshot fields only', () => {
  const snapshot = {
    name: 'Pip',
    level: 4,
    xp: 80,
    personalityKey: 'friendly',
    personality: { key: 'friendly' },
    battleStats: { wins: 2 },
    build: { body: 'moss-body' }
  };
  const cleaned = removeLegacyOlingSnapshotFields(snapshot);

  assert.equal(cleaned.changed, true);
  assert.deepEqual(cleaned.value, {
    name: 'Pip',
    build: { body: 'moss-body' }
  });

  const battle = cleanBattlePlayers([{ olingSnapshot: snapshot, level: 20 }]);
  assert.equal(battle.value[0].level, 20);
  assert.equal('level' in battle.value[0].olingSnapshot, false);

  const clash = cleanClashPlayers([
    { team: [{ teamSlot: 0, snapshot }], level: 20 }
  ]);
  assert.equal(clash.value[0].level, 20);
  assert.equal('personalityKey' in clash.value[0].team[0].snapshot, false);
});

test('account cleanup removes retired inventory, incubator influences, and product references', () => {
  const retiredKeys = new Set(['teddy-bear']);
  const retiredProductIds = new Set(['retired-product-1']);
  const account = {
    olings: {
      consumables: [
        { key: 'teddy-bear', quantity: 2 },
        { key: 'o-juice', quantity: 1 }
      ],
      inventory: {
        consumables: [
          { key: 'teddy-bear', quantity: 1 },
          { key: 'o-juice', quantity: 3 }
        ]
      },
      lab: {
        placedItems: [
          {
            placedId: 'table',
            inventorySlots: [],
            containerSlots: [
              {
                slotId: 'incubator',
                inventorySlots: [
                  {
                    slotId: 'egg',
                    influenceSlots: [
                      {
                        slotKey: 'personality',
                        itemKey: 'o-juice'
                      },
                      { slotKey: 'rarity', itemKey: 'lucky-clover' }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    },
    shop: {
      cart: [
        { productId: 'retired-product-1' },
        { productId: 'active-product-1' }
      ],
      purchasedProducts: [{ productId: 'retired-product-1' }]
    }
  };

  const cleaned = cleanAccountDocument(account, retiredKeys, retiredProductIds);

  assert.equal(cleaned.changed, true);
  assert.deepEqual(cleaned.updates['olings.consumables'], [
    { key: 'o-juice', quantity: 1 }
  ]);
  assert.deepEqual(cleaned.updates['olings.inventory.consumables'], [
    { key: 'o-juice', quantity: 3 }
  ]);
  assert.deepEqual(cleaned.updates['shop.cart'], [
    { productId: 'active-product-1' }
  ]);
  assert.deepEqual(cleaned.updates['shop.purchasedProducts'], []);
  assert.deepEqual(
    cleaned.updates['olings.lab'].placedItems[0].containerSlots[0]
      .inventorySlots[0].influenceSlots,
    [{ slotKey: 'rarity', itemKey: 'lucky-clover' }]
  );
  assert.equal(cleaned.removedInventoryItems, 2);
  assert.equal(cleaned.removedInfluences, 1);
  assert.equal(cleaned.removedProductReferences, 2);

  const cleanedAgain = cleanAccountDocument(
    {
      ...account,
      olings: {
        ...account.olings,
        consumables: cleaned.updates['olings.consumables'],
        inventory: {
          consumables: cleaned.updates['olings.inventory.consumables']
        },
        lab: cleaned.updates['olings.lab']
      },
      shop: {
        ...account.shop,
        cart: cleaned.updates['shop.cart'],
        purchasedProducts: cleaned.updates['shop.purchasedProducts']
      }
    },
    retiredKeys,
    retiredProductIds
  );
  assert.equal(cleanedAgain.changed, false);
});

test('Oling state cleanup preserves O-Juice and non-personality influences', () => {
  const cleaned = cleanOlingStateDocument(
    {
      inventory: {
        consumables: [
          { key: 'toy-sword', quantity: 1 },
          { key: 'o-juice', quantity: 2 }
        ]
      },
      lab: {
        placedItems: [
          {
            inventorySlots: [
              {
                influenceSlots: [
                  { slotKey: 'personality', itemKey: 'toy-sword' },
                  { slotKey: 'hatch', itemKey: 'oling-blanket' }
                ]
              }
            ],
            containerSlots: []
          }
        ]
      }
    },
    new Set(['toy-sword'])
  );

  assert.deepEqual(cleaned.updates['inventory.consumables'], [
    { key: 'o-juice', quantity: 2 }
  ]);
  assert.deepEqual(
    cleaned.updates.lab.placedItems[0].inventorySlots[0].influenceSlots,
    [{ slotKey: 'hatch', itemKey: 'oling-blanket' }]
  );
});

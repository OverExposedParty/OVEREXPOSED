const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAchievementRewardCatalog
} = require('../../server/services/achievements/reward-catalog');

test('achievement reward catalog resolves official item names and artwork', () => {
  const catalog = createAchievementRewardCatalog({
    products: [
      {
        identity: { name: 'Soft Ears' },
        media: {
          mainImage: {
            url: '/images/olings/headwear/soft-ears.svg'
          }
        },
        digitalEntitlement: {
          grants: [
            { type: 'oling_headwear', key: 'base-soft-ears', quantity: 1 }
          ]
        }
      },
      {
        identity: { name: 'Refined Opal Dust' },
        variants: [
          {
            media: {
              mainImage: {
                url: '/images/olings/consumables/refined-opal-dust.svg'
              }
            },
            digitalEntitlement: {
              grants: [
                {
                  type: 'oling_consumable',
                  key: 'opal-dust',
                  quantity: 2
                }
              ]
            }
          }
        ]
      }
    ],
    eggs: [{ key: 'base-egg', name: 'Base Egg', collection: 'base' }],
    consumables: [
      {
        key: 'opal-dust',
        name: 'Opal Dust',
        assets: { image: '/images/olings/consumables/opal-dust.svg' }
      }
    ],
    oeCustomisation: [
      {
        recordType: 'image',
        oeId: '0101',
        name: 'Party Hat',
        filePath: '/images/user-customisation/head-slot/party-hat.svg'
      }
    ]
  });

  assert.deepEqual(catalog, [
    {
      type: 'oe',
      key: '0101',
      name: 'Party Hat',
      image: '/images/user-customisation/head-slot/party-hat.svg'
    },
    {
      type: 'oling_consumable',
      key: 'opal-dust',
      name: 'Refined Opal Dust',
      image: '/images/olings/consumables/refined-opal-dust.svg'
    },
    {
      type: 'oling_egg',
      key: 'base-egg',
      name: 'Base Egg',
      image: '/images/olings/eggs/base/egg.svg'
    },
    {
      type: 'oling_headwear',
      key: 'base-soft-ears',
      name: 'Soft Ears',
      image: '/images/olings/headwear/soft-ears.svg'
    }
  ]);
});

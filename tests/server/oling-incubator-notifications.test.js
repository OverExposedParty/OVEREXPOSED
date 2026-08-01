const test = require('node:test');
const assert = require('node:assert/strict');

const { __test } = require('../../server/routes/api-olings');

function createLab(slotOverrides = {}) {
  return {
    placedItems: [
      {
        placedId: 'starter_table',
        itemId: 'standard_table',
        containerSlots: [
          {
            slotId: 'tabletop',
            placedId: 'starter_incubeta',
            itemId: 'incubeta',
            inventorySlots: [
              {
                slotId: 'egg',
                slotType: 'egg',
                itemKey: 'base-egg',
                placedAt: '2026-07-05T08:00:00.000Z',
                ...slotOverrides
              }
            ]
          }
        ]
      }
    ]
  };
}

test('an incubator egg becomes a notification after its hatch timer', () => {
  const notifications = __test.getIncubatorReadyNotifications(
    createLab(),
    [
      {
        key: 'base-egg',
        name: 'Base Egg',
        collection: 'base',
        assets: {},
        metadata: { hatchMinutes: 30 }
      }
    ],
    new Date('2026-07-05T08:30:00.000Z')
  );

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'incubator_ready');
  assert.equal(notifications[0].eggName, 'Base Egg');
  assert.equal(notifications[0].image, '/images/olings/eggs/base/egg.svg');
  assert.equal(notifications[0].readyAt, '2026-07-05T08:30:00.000Z');
});

test('an incubator notification waits until ready and is not repeated after delivery', () => {
  const egg = { key: 'base-egg', metadata: { hatchMinutes: 30 } };
  assert.equal(
    __test.getIncubatorReadyNotifications(
      createLab(),
      [egg],
      new Date('2026-07-05T08:29:59.000Z')
    ).length,
    0
  );
  assert.equal(
    __test.getIncubatorReadyNotifications(
      createLab({ readyNotificationDeliveredAt: '2026-07-05T08:31:00.000Z' }),
      [egg],
      new Date('2026-07-05T09:00:00.000Z')
    ).length,
    0
  );
});

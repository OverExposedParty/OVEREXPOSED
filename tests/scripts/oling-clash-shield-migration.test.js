const assert = require('node:assert/strict');
const test = require('node:test');

const {
  migrateClashDocument,
  migrateTeamOling
} = require('../../scripts/migrate-oling-clash-shields');

test('Clash Shield migration rounds legacy Armour up to whole Shields', () => {
  assert.equal(migrateTeamOling({ armourUnits: 0 }).shieldCount, 0);
  assert.equal(migrateTeamOling({ armourUnits: 1 }).shieldCount, 1);
  assert.equal(migrateTeamOling({ armourUnits: 2 }).shieldCount, 1);
  assert.equal(migrateTeamOling({ armourUnits: 3 }).shieldCount, 2);
  assert.equal(
    Object.hasOwn(migrateTeamOling({ armourUnits: 1 }), 'armourUnits'),
    false
  );
});

test('Clash Shield migration updates embedded rules and abilities', () => {
  const migrated = migrateClashDocument({
    players: [
      {
        team: [
          {
            armourUnits: 1,
            snapshot: {
              abilities: [
                {
                  key: 'moss-canopy',
                  revision: 1,
                  effects: [
                    {
                      mechanic: 'grant-armour',
                      handler: 'grant_armour_to_most_damaged_ally',
                      parameters: { amountUnits: 1 }
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    ],
    ruleset: {
      key: 'standard',
      revision: 1,
      snapshot: {
        engineVersion: 2,
        health: {
          layerOrder: ['armour', 'overgrowth', 'hearts'],
          armourStacks: true
        },
        damage: {
          routing: { normal: ['armour', 'overgrowth', 'hearts'] }
        }
      }
    },
    events: [{ payload: { layers: [{ layer: 'armour', units: 1 }] } }]
  });

  assert.equal(migrated.ruleset.revision, 2);
  assert.equal(migrated.ruleset.snapshot.engineVersion, 3);
  assert.deepEqual(migrated.ruleset.snapshot.health.layerOrder, [
    'shields',
    'overgrowth',
    'hearts'
  ]);
  assert.equal(migrated.players[0].team[0].shieldCount, 1);
  assert.equal(
    migrated.players[0].team[0].snapshot.abilities[0].effects[0].mechanic,
    'grant-shield'
  );
  assert.equal(migrated.players[0].team[0].snapshot.abilities[0].revision, 2);
  assert.equal(
    migrated.players[0].team[0].snapshot.abilities[0].description,
    'Every second survived Draw, grant the most damaged living allied Oling 1 Shield.'
  );
  assert.equal(migrated.events[0].payload.layers[0].layer, 'shields');
});

test('Clash Shield migration preserves the Harden cadence in its description', () => {
  const migrated = migrateTeamOling({
    snapshot: {
      abilities: [
        {
          key: 'stone-harden',
          revision: 1,
          effects: [
            {
              mechanic: 'grant-armour',
              handler: 'grant_armour',
              parameters: { amountUnits: 2 }
            }
          ]
        }
      ]
    }
  });

  assert.equal(
    migrated.snapshot.abilities[0].description,
    'Every second survived Draw, gain 1 Shield.'
  );
});

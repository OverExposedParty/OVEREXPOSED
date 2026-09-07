const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ACTIVE_SLOT_INDEX,
  auditRollout,
  normalizePodInventory
} = require('../../scripts/verify-oling-pod-rollout');

function createProduct() {
  return {
    identity: { slug: 'oling_pod' },
    publishing: { status: 'active', visibility: 'public', isActive: true },
    digitalEntitlement: {
      opalPrice: { amount: 75 },
      grants: [
        {
          type: 'oling_pod',
          key: 'oling_pod',
          quantity: 1,
          metadata: { lifecycle: 'one-use', releaseOutcome: 'destroy' }
        }
      ]
    }
  };
}

function createIndex() {
  return {
    name: ACTIVE_SLOT_INDEX,
    unique: true,
    partialFilterExpression: {
      'residency.state': 'active',
      'residency.labSlot': { $type: 'number' }
    }
  };
}

test('rollout audit accepts synchronized active, stored, and adventuring Olings', () => {
  const result = auditRollout({
    accounts: [
      {
        _id: 'account-1',
        olings: {
          pods: [{ key: 'oling_pod', rarity: 'common', quantity: 2 }],
          adventures: { active: { olingId: 'oling-active' } }
        }
      }
    ],
    states: [
      {
        ownerId: 'account-1',
        inventory: {
          pods: [{ key: 'OLING_POD', rarity: 'COMMON', quantity: 2 }]
        }
      }
    ],
    olings: [
      {
        _id: 'oling-active',
        ownerId: 'account-1',
        residency: { state: 'active', labSlot: 1, pod: null }
      },
      {
        _id: 'oling-stored',
        ownerId: 'account-1',
        residency: {
          state: 'stored',
          labSlot: null,
          pod: {
            key: 'oling_pod',
            definitionRevision: 1,
            releaseOutcome: 'destroy',
            storedAt: new Date()
          }
        }
      }
    ],
    products: [createProduct()],
    indexes: [createIndex()]
  });

  assert.equal(result.ok, true);
  assert.equal(result.activeOlings, 1);
  assert.equal(result.storedOlings, 1);
  assert.equal(result.activeAdventures, 1);
  assert.deepEqual(result.errors, []);
});

test('rollout audit reports cap, inventory, adventure, and index failures', () => {
  const olings = Array.from({ length: 8 }, (_, index) => ({
    _id: `oling-${index + 1}`,
    ownerId: 'account-1',
    residency: { state: 'active', labSlot: index + 1, pod: null }
  }));
  olings[0].residency = {
    state: 'stored',
    labSlot: 1,
    pod: null
  };

  const result = auditRollout({
    accounts: [
      {
        _id: 'account-1',
        olings: {
          pods: [{ key: 'oling_pod', quantity: 1 }],
          adventures: { active: { olingId: 'oling-1' } }
        }
      }
    ],
    states: [{ ownerId: 'account-1', inventory: { pods: [] } }],
    olings,
    products: [createProduct()],
    indexes: []
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unsynchronised pod inventories/);
  assert.match(result.errors.join('\n'), /7 active Olings; limit is 6/);
  assert.match(result.errors.join('\n'), /invalid or duplicate active slots/);
  assert.match(result.errors.join('\n'), /invalid pod snapshot/);
  assert.match(result.errors.join('\n'), /stored Oling on an adventure/);
  assert.match(result.errors.join('\n'), /unique partial index is missing/);
});

test('pod inventory normalization is order and case insensitive', () => {
  assert.deepEqual(
    normalizePodInventory([
      { key: 'Reusable_Pod', quantity: 1, rarity: 'RARE' },
      { key: 'OLING_POD', quantity: 2, rarity: 'COMMON' }
    ]),
    [
      { key: 'oling_pod', rarity: 'common', quantity: 2, metadata: {} },
      { key: 'reusable_pod', rarity: 'rare', quantity: 1, metadata: {} }
    ]
  );
});

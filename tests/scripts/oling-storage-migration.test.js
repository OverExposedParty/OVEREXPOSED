const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildAccountStorageBackfill,
  buildOlingResidencyPlan,
  normalizePodInventory
} = require('../../scripts/migrate-oling-storage');

function createOling(id, residency = undefined, extra = {}) {
  return {
    _id: id,
    hatchedAt: new Date(
      `2026-01-${String(Number(id.replace(/\D/g, '')) || 1).padStart(2, '0')}T00:00:00.000Z`
    ),
    residency,
    care: { isSleeping: false },
    ...extra
  };
}

test('storage migration assigns unique active slots and stores overflow', () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const olings = Array.from({ length: 8 }, (_, index) =>
    createOling(`oling-${index + 1}`)
  );

  const plan = buildOlingResidencyPlan({ olings, now });
  const active = plan.updates.filter(
    (update) => update.residency.state === 'active'
  );
  const stored = plan.updates.filter(
    (update) => update.residency.state === 'stored'
  );

  assert.deepEqual(
    active.map((update) => update.residency.labSlot).sort(),
    [1, 2, 3, 4, 5, 6]
  );
  assert.equal(stored.length, 2);
  assert.equal(plan.overflowStored, 2);
  stored.forEach((update) => {
    assert.equal(update.residency.labSlot, null);
    assert.equal(update.residency.pod.key, 'oling_pod');
    assert.equal(update.residency.pod.releaseOutcome, 'destroy');
  });
});

test('storage migration keeps an adventuring Oling in the six-slot roster', () => {
  const olings = Array.from({ length: 7 }, (_, index) =>
    createOling(`oling-${index + 1}`)
  );

  const plan = buildOlingResidencyPlan({
    olings,
    activeAdventureOlingId: 'oling-7'
  });
  const adventuring = plan.updates.find(
    (update) => String(update.olingId) === 'oling-7'
  );

  assert.equal(adventuring.residency.state, 'active');
  assert.equal(plan.activeCount, 6);
  assert.equal(plan.overflowStored, 1);
});

test('storage migration repairs a legacy stored adventure back to active', () => {
  const adventure = createOling('oling-1', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: new Date()
    }
  });

  const plan = buildOlingResidencyPlan({
    olings: [adventure],
    activeAdventureOlingId: 'oling-1'
  });

  assert.equal(plan.updates[0].residency.state, 'active');
  assert.equal(plan.updates[0].residency.labSlot, 1);
  assert.equal(plan.storedCount, 0);
});

test('storage migration preserves valid stored snapshots and repairs invalid ones', () => {
  const storedAt = new Date('2026-08-01T00:00:00.000Z');
  const valid = createOling('oling-1', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'reusable_oling_pod',
      definitionRevision: 4,
      releaseOutcome: 'return-to-inventory',
      storedAt
    }
  });
  const invalid = createOling(
    'oling-2',
    { state: 'stored', labSlot: 3, pod: null },
    { care: { isSleeping: true } }
  );

  const first = buildOlingResidencyPlan({ olings: [valid, invalid] });
  const validUpdate = first.updates.find(
    (update) => String(update.olingId) === 'oling-1'
  );
  const repairedUpdate = first.updates.find(
    (update) => String(update.olingId) === 'oling-2'
  );

  assert.equal(validUpdate.residency.pod.key, 'reusable_oling_pod');
  assert.equal(validUpdate.residency.pod.definitionRevision, 4);
  assert.equal(repairedUpdate.residency.labSlot, null);
  assert.equal(repairedUpdate.residency.pod.key, 'oling_pod');
  assert.equal(repairedUpdate.wake, true);
  assert.equal(first.repairedStored, 1);

  const second = buildOlingResidencyPlan({
    olings: first.updates.map((update) => ({
      _id: update.olingId,
      residency: update.residency,
      care: { isSleeping: false }
    }))
  });
  assert.equal(second.overflowStored, 0);
  assert.equal(second.repairedStored, 0);
});

test('storage migration canonicalizes pod quantities without minting pods', () => {
  assert.deepEqual(
    normalizePodInventory([
      { key: ' OLING_POD ', quantity: 2 },
      { key: 'oling_pod', quantity: 3 },
      { key: 'unused', quantity: 0 }
    ]).map(({ key, quantity }) => ({ key, quantity })),
    [{ key: 'oling_pod', quantity: 5 }]
  );

  const plan = buildAccountStorageBackfill({
    account: { olings: { adventures: { active: null } } },
    olingState: { inventory: { pods: [{ key: 'oling_pod', quantity: 2 }] } },
    olings: []
  });
  assert.equal(plan.pods[0].quantity, 2);

  const consumedPlan = buildAccountStorageBackfill({
    account: { olings: { pods: [], adventures: { active: null } } },
    olingState: { inventory: { pods: [{ key: 'oling_pod', quantity: 9 }] } },
    olings: []
  });
  assert.deepEqual(consumedPlan.pods, []);
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildUatReadiness,
  getPodQuantity,
  verifyReleaseOutcome
} = require('../../scripts/prepare-oling-pod-uat');

function createAccount({ pods = 0, adventureOlingId = null } = {}) {
  return {
    olings: {
      pods: pods ? [{ key: 'oling_pod', quantity: pods }] : [],
      adventures: {
        active: adventureOlingId ? { olingId: adventureOlingId } : null
      }
    }
  };
}

function createOling(id, residency = 'active', sleeping = false) {
  return {
    _id: id,
    care: { isSleeping: sleeping },
    residency: {
      state: residency,
      labSlot: residency === 'active' ? 1 : null,
      pod:
        residency === 'stored'
          ? { key: 'oling_pod', releaseOutcome: 'destroy' }
          : null
    }
  };
}

test('UAT readiness selects an awake active Oling when a pod is available', () => {
  const readiness = buildUatReadiness({
    account: createAccount({ pods: 1 }),
    olings: [createOling('sleeping', 'active', true), createOling('ready')]
  });

  assert.equal(readiness.phase, 'ready_to_store');
  assert.equal(readiness.eligibleOlings, 1);
  assert.equal(readiness.emptyPodQuantity, 1);
  assert.equal(readiness.suggestedOlingId, 'ready');
});

test('UAT readiness directs stored Olings to release and excludes adventures', () => {
  const readiness = buildUatReadiness({
    account: createAccount({ pods: 1, adventureOlingId: 'adventure' }),
    olings: [createOling('adventure'), createOling('stored', 'stored')]
  });

  assert.equal(readiness.phase, 'ready_to_release');
  assert.equal(readiness.adventuringOlings, 1);
  assert.equal(readiness.eligibleOlings, 0);
  assert.equal(readiness.suggestedOlingId, 'stored');
});

test('one-use release verification requires active residency and baseline pods', () => {
  const account = createAccount({ pods: 2 });
  const olings = [createOling('target')];

  assert.deepEqual(
    verifyReleaseOutcome({
      account,
      olings,
      olingId: 'target',
      startingPods: 2
    }),
    {
      ok: true,
      olingId: 'target',
      expectedEmptyPods: 2,
      actualEmptyPods: 2,
      residency: 'active',
      errors: []
    }
  );

  const failed = verifyReleaseOutcome({
    account,
    olings: [createOling('target', 'stored')],
    olingId: 'target',
    startingPods: 1
  });
  assert.equal(failed.ok, false);
  assert.match(failed.errors.join('\n'), /still stored/);
  assert.match(failed.errors.join('\n'), /Expected 1 empty pods/);
});

test('pod quantity combines duplicate legacy entries', () => {
  assert.equal(
    getPodQuantity({
      olings: {
        pods: [
          { key: 'OLING_POD', quantity: 1 },
          { key: 'oling_pod', quantity: 2 }
        ]
      }
    }),
    3
  );
});

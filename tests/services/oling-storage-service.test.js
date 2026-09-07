const assert = require('node:assert/strict');
const test = require('node:test');

const PlayerOling = require('../../models/olings/player-oling-schema');
const {
  getAvailableLabSlotFromOlings,
  getOlingRoster
} = require('../../server/services/olings/residency');
const {
  ACTIVE_LAB_SLOT_INDEX_NAME,
  assignLegacyStoredOlingsToPodStorage,
  releaseOlingFromPod,
  runStorageTransaction,
  storeOlingInPod,
  transferStoredOling
} = require('../../server/services/olings/storage');

function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (value instanceof Date) return new Date(value);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => typeof entry !== 'function')
      .map(([key, entry]) => [key, clonePlain(entry)])
  );
}

function setPath(target, path, value) {
  const segments = path.split('.');
  let current = target;
  segments.slice(0, -1).forEach((segment) => {
    current[segment] ||= {};
    current = current[segment];
  });
  current[segments.at(-1)] = value;
}

class FakeDocument {
  constructor(values) {
    Object.assign(this, clonePlain(values));
  }

  set(path, value) {
    setPath(this, path, clonePlain(value));
  }

  markModified() {}

  async save() {
    return this;
  }

  toObject() {
    return clonePlain(this);
  }
}

class FakeQuery {
  constructor(read) {
    this.read = read;
  }

  session() {
    return this;
  }

  sort() {
    return this;
  }

  async lean() {
    const value = this.read();
    return Array.isArray(value)
      ? value.map((entry) => entry.toObject?.() || clonePlain(entry))
      : value?.toObject?.() || clonePlain(value);
  }

  then(resolve, reject) {
    return Promise.resolve(this.read()).then(resolve, reject);
  }
}

function createOling(id, residency, values = {}) {
  return new FakeDocument({
    _id: id,
    ownerId: 'account-one',
    care: { isSleeping: false },
    residency,
    ...values
  });
}

function createModels({
  olings,
  pods = [],
  statePods = [],
  activeAdventure = null,
  serializeTransactions = false,
  placedItems = [{ placedId: 'pod-rack-one', itemId: 'pod_rack' }]
}) {
  const account = new FakeDocument({
    _id: 'account-one',
    olings: {
      pods,
      adventures: { active: activeAdventure, history: [] }
    }
  });
  const olingState = new FakeDocument({
    ownerId: 'account-one',
    inventory: { pods: statePods },
    lab: {
      placedItems
    }
  });
  const accountUpdates = [];
  let transactionTail = Promise.resolve();
  const connection = {
    transaction(operation) {
      if (!serializeTransactions) return operation({ transaction: true });
      const result = transactionTail.then(() =>
        operation({ transaction: true })
      );
      transactionTail = result.catch(() => {});
      return result;
    }
  };

  const Account = {
    db: connection,
    findById(accountId) {
      return new FakeQuery(() =>
        String(accountId) === String(account._id) ? account : null
      );
    },
    async updateOne(filter, update) {
      assert.equal(String(filter._id), String(account._id));
      accountUpdates.push(clonePlain(update));
      if (update.$set?.['olings.pods']) {
        account.olings.pods = clonePlain(update.$set['olings.pods']);
      }
    }
  };
  const OlingState = {
    db: connection,
    findOne({ ownerId }) {
      return new FakeQuery(() =>
        String(ownerId) === String(olingState.ownerId) ? olingState : null
      );
    },
    async updateOne(filter, update) {
      assert.equal(String(filter.ownerId), String(olingState.ownerId));
      if (update.$set?.['inventory.pods']) {
        olingState.inventory.pods = clonePlain(update.$set['inventory.pods']);
      }
    }
  };
  const PlayerOlingModel = {
    db: connection,
    findOne({ _id, ownerId }) {
      return new FakeQuery(
        () =>
          olings.find(
            (oling) =>
              String(oling._id) === String(_id) &&
              String(oling.ownerId) === String(ownerId)
          ) || null
      );
    },
    find(filter) {
      const { ownerId } = filter;
      return new FakeQuery(() =>
        olings.filter(
          (oling) =>
            String(oling.ownerId) === String(ownerId) &&
            (filter['residency.state'] === 'stored'
              ? oling.residency?.state === 'stored'
              : oling.residency?.state !== 'stored')
        )
      );
    },
    async updateOne(filter, update) {
      const oling = olings.find(
        (item) =>
          String(item._id) === String(filter._id) &&
          String(item.ownerId) === String(filter.ownerId)
      );
      Object.entries(update.$set || {}).forEach(([path, value]) =>
        setPath(oling, path, clonePlain(value))
      );
    }
  };

  return {
    models: { Account, OlingState, PlayerOling: PlayerOlingModel },
    account,
    accountUpdates,
    olingState,
    olings
  };
}

test('active roster allocation counts legacy Olings that do not have slots', () => {
  const olings = [1, 2, 3, 4, 5].map((slot) =>
    createOling(`active-${slot}`, { state: 'active', labSlot: slot, pod: null })
  );
  olings.push(createOling('legacy', undefined));

  assert.equal(getAvailableLabSlotFromOlings(olings), null);
});

test('active lab slots have a concurrency-safe partial unique index', () => {
  const [, options] = PlayerOling.schema
    .indexes()
    .find(
      ([, indexOptions]) => indexOptions.name === ACTIVE_LAB_SLOT_INDEX_NAME
    );

  assert.equal(options.unique, true);
  assert.deepEqual(options.partialFilterExpression, {
    'residency.state': 'active',
    'residency.labSlot': { $type: 'number' }
  });
});

test('storing an Oling consumes an empty pod and snapshots its lifecycle', async () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const oling = createOling('oling-one', {
    state: 'active',
    labSlot: 1,
    pod: null
  });
  const context = createModels({
    olings: [oling],
    pods: [{ key: 'oling_pod', quantity: 2 }]
  });

  const result = await storeOlingInPod({
    models: context.models,
    accountId: 'account-one',
    olingId: 'oling-one',
    podKey: 'oling_pod',
    containerPlacedId: 'pod-rack-one',
    now
  });

  assert.equal(result.error, undefined);
  assert.equal(context.account.olings.pods[0].quantity, 1);
  assert.deepEqual(context.accountUpdates, [
    { $set: { 'olings.pods': [context.account.olings.pods[0]] } }
  ]);
  assert.equal('olings.olings.pods' in context.accountUpdates[0].$set, false);
  assert.equal(context.olingState.inventory.pods[0].quantity, 1);
  assert.deepEqual(oling.residency, {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: now,
      containerPlacedId: 'pod-rack-one'
    }
  });
  assert.equal(result.roster.activeCount, 0);
});

test('one-use pods are destroyed when their Oling is released', async () => {
  const oling = createOling('stored-one', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: new Date()
    }
  });
  const context = createModels({ olings: [oling] });

  const result = await releaseOlingFromPod({
    models: context.models,
    accountId: 'account-one',
    olingId: 'stored-one'
  });

  assert.equal(result.pod.destroyed, true);
  assert.equal(result.pod.returnedToInventory, false);
  assert.deepEqual(context.account.olings.pods, []);
  assert.deepEqual(oling.residency, {
    state: 'active',
    labSlot: 1,
    pod: null
  });
});

test('reusable pods return to empty inventory when their Oling is released', async () => {
  const oling = createOling('stored-reusable', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'reusable_oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'return-to-inventory',
      storedAt: new Date()
    }
  });
  const context = createModels({ olings: [oling] });

  const result = await releaseOlingFromPod({
    models: context.models,
    accountId: 'account-one',
    olingId: 'stored-reusable'
  });

  assert.equal(result.pod.destroyed, false);
  assert.equal(result.pod.returnedToInventory, true);
  assert.deepEqual(
    context.account.olings.pods.map(({ key, quantity }) => ({ key, quantity })),
    [{ key: 'reusable_oling_pod', quantity: 1 }]
  );
  assert.equal(context.olingState.inventory.pods[0].quantity, 1);
});

test('release leaves the Oling stored when all six active slots are occupied', async () => {
  const activeOlings = [1, 2, 3, 4, 5, 6].map((slot) =>
    createOling(`active-${slot}`, { state: 'active', labSlot: slot, pod: null })
  );
  const storedOling = createOling('stored-one', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: new Date()
    }
  });
  const context = createModels({ olings: [...activeOlings, storedOling] });

  const result = await releaseOlingFromPod({
    models: context.models,
    accountId: 'account-one',
    olingId: 'stored-one'
  });

  assert.equal(result.error.code, 'oling_lab_roster_full');
  assert.equal(storedOling.residency.state, 'stored');
  assert.equal(storedOling.residency.pod.key, 'oling_pod');
});

test('adventuring and sleeping Olings cannot be stored', async () => {
  const adventuring = createOling('adventuring', {
    state: 'active',
    labSlot: 1,
    pod: null
  });
  const adventureContext = createModels({
    olings: [adventuring],
    pods: [{ key: 'oling_pod', quantity: 1 }],
    activeAdventure: { olingId: 'adventuring' }
  });
  const adventureResult = await storeOlingInPod({
    models: adventureContext.models,
    accountId: 'account-one',
    olingId: 'adventuring',
    podKey: 'oling_pod'
  });
  assert.equal(adventureResult.error.code, 'oling_storage_adventuring');
  assert.equal(adventureContext.account.olings.pods[0].quantity, 1);

  const sleeping = createOling(
    'sleeping',
    { state: 'active', labSlot: 1, pod: null },
    { care: { isSleeping: true } }
  );
  const sleepContext = createModels({
    olings: [sleeping],
    pods: [{ key: 'oling_pod', quantity: 1 }]
  });
  const sleepResult = await storeOlingInPod({
    models: sleepContext.models,
    accountId: 'account-one',
    olingId: 'sleeping',
    podKey: 'oling_pod'
  });
  assert.equal(sleepResult.error.code, 'oling_storage_sleeping');
  assert.equal(sleepContext.account.olings.pods[0].quantity, 1);
});

test('a Pod Rack rejects a seventh occupied pod without consuming inventory', async () => {
  const stored = Array.from({ length: 6 }, (_, index) =>
    createOling(`stored-${index + 1}`, {
      state: 'stored',
      labSlot: null,
      pod: {
        key: 'oling_pod',
        definitionRevision: 1,
        releaseOutcome: 'destroy',
        storedAt: new Date(),
        containerPlacedId: 'pod-rack-one'
      }
    })
  );
  const active = createOling('active-one', {
    state: 'active',
    labSlot: 1,
    pod: null
  });
  const context = createModels({
    olings: [...stored, active],
    pods: [{ key: 'oling_pod', quantity: 1 }]
  });

  const result = await storeOlingInPod({
    models: context.models,
    accountId: 'account-one',
    olingId: active._id,
    podKey: 'oling_pod',
    containerPlacedId: 'pod-rack-one'
  });

  assert.equal(result.error.code, 'oling_pod_storage_full');
  assert.equal(context.account.olings.pods[0].quantity, 1);
  assert.equal(active.residency.state, 'active');
});

test('occupied pods transfer between placed Pod Racks without changing empty pods', async () => {
  const stored = createOling('stored-one', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: new Date(),
      containerPlacedId: 'pod-rack-one'
    }
  });
  const context = createModels({
    olings: [stored],
    pods: [{ key: 'oling_pod', quantity: 3 }],
    placedItems: [
      { placedId: 'pod-rack-one', itemId: 'pod_rack' },
      { placedId: 'pod-rack-two', itemId: 'pod_rack' }
    ]
  });

  const result = await transferStoredOling({
    models: context.models,
    accountId: 'account-one',
    olingId: stored._id,
    containerPlacedId: 'pod-rack-two'
  });

  assert.equal(result.error, undefined);
  assert.equal(stored.residency.pod.containerPlacedId, 'pod-rack-two');
  assert.equal(context.account.olings.pods[0].quantity, 3);
});

test('legacy stored Olings are assigned to the first available placed rack', async () => {
  const stored = createOling('legacy-stored', {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt: new Date()
    }
  });
  const context = createModels({ olings: [stored] });

  const result = await assignLegacyStoredOlingsToPodStorage({
    models: context.models,
    accountId: 'account-one',
    account: context.account,
    olingState: context.olingState
  });

  assert.deepEqual(result, { assigned: 1, unassigned: 0 });
  assert.equal(stored.residency.pod.containerPlacedId, 'pod-rack-one');
});

test('concurrent releases cannot both claim the final active slot', async () => {
  const activeOlings = [1, 2, 3, 4, 5].map((slot) =>
    createOling(`active-${slot}`, { state: 'active', labSlot: slot, pod: null })
  );
  const storedOlings = ['stored-one', 'stored-two'].map((id) =>
    createOling(id, {
      state: 'stored',
      labSlot: null,
      pod: {
        key: 'oling_pod',
        definitionRevision: 1,
        releaseOutcome: 'destroy',
        storedAt: new Date()
      }
    })
  );
  const context = createModels({
    olings: [...activeOlings, ...storedOlings],
    serializeTransactions: true
  });

  const [first, second] = await Promise.all(
    storedOlings.map((oling) =>
      releaseOlingFromPod({
        models: context.models,
        accountId: 'account-one',
        olingId: oling._id
      })
    )
  );

  assert.equal(first.labSlot, 6);
  assert.equal(second.error.code, 'oling_lab_roster_full');
  const roster = await getOlingRoster({
    PlayerOling: context.models.PlayerOling,
    accountId: 'account-one'
  });
  assert.equal(roster.activeCount, 6);
});

test('slot duplicate errors retry the storage transaction', async () => {
  let attempts = 0;
  const connection = {
    async transaction(operation) {
      attempts += 1;
      if (attempts === 1) {
        const error = new Error(ACTIVE_LAB_SLOT_INDEX_NAME);
        error.code = 11000;
        error.keyPattern = { 'residency.labSlot': 1 };
        throw error;
      }
      return operation({ transaction: true });
    }
  };
  const models = {
    Account: { db: connection },
    OlingState: { db: connection },
    PlayerOling: { db: connection }
  };

  const result = await runStorageTransaction(models, async () => 'retried');

  assert.equal(result, 'retried');
  assert.equal(attempts, 2);
});

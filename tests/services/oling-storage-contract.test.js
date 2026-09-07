const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const PlayerOling = require('../../models/olings/player-oling-schema');
const OlingState = require('../../models/olings/oling-state-schema');
const {
  accountOlingsSchema
} = require('../../models/accounts/account-schema/olings');
const {
  OLING_LAB_ACTIVE_LIMIT,
  OLING_POD_RELEASE_OUTCOMES,
  OLING_RESIDENCY_STATES
} = require('../../models/olings/oling-storage-contract');
const {
  createOlingPodDefinition,
  getOlingPodDefinition,
  serializeOlingPodDefinition
} = require('../../server/services/olings/pod-catalog');
const {
  getOrCreateOlingState
} = require('../../server/services/olings/account-state');
const {
  ensureAccountOlingDocument
} = require('../../server/routes/api-olings/lab-state/inventory');
const {
  serializeOlingResidency,
  serializePlayerOling
} = require('../../server/services/olings/definitions/serializers');

function createPlayerOling(values = {}) {
  return new PlayerOling({
    ownerId: new mongoose.Types.ObjectId(),
    eggKey: 'base-egg',
    collection: 'base',
    build: {
      body: 'body',
      eyes: 'eyes',
      mouth: 'mouth',
      flight: 'flight'
    },
    buildRarities: {
      body: 'common',
      eyes: 'common',
      mouth: 'common',
      flight: 'common'
    },
    ...values
  });
}

test('Oling storage contract exposes the six-slot roster and supported states', () => {
  assert.equal(OLING_LAB_ACTIVE_LIMIT, 6);
  assert.deepEqual(OLING_RESIDENCY_STATES, ['active', 'stored']);
  assert.deepEqual(OLING_POD_RELEASE_OUTCOMES, [
    'destroy',
    'return-to-inventory'
  ]);
});

test('Oling Pod catalog supports one-use and reusable lifecycle configuration', () => {
  const oneUsePod = getOlingPodDefinition('OLING_POD');
  assert.equal(oneUsePod.name, 'Disposable Oling Pod');
  assert.equal(oneUsePod.lifecycle.onRelease, 'destroy');
  assert.equal(oneUsePod.lifecycle.uses, 1);
  assert.equal(
    oneUsePod.assets.empty,
    '/images/olings/lab/items/oling-pods/disposable/artwork.svg'
  );
  assert.equal(oneUsePod.assets.occupied, null);
  assert.deepEqual(oneUsePod.assets.layers, {
    back: '/images/olings/lab/items/oling-pods/disposable/layers/back.svg',
    front: '/images/olings/lab/items/oling-pods/disposable/layers/front.svg',
    base: '/images/olings/lab/items/oling-pods/disposable/layers/base.svg'
  });

  const reusablePod = createOlingPodDefinition({
    key: 'reusable_oling_pod',
    revision: 1,
    name: 'Reusable Oling Pod',
    lifecycle: { onRelease: 'return-to-inventory' }
  });
  assert.equal(reusablePod.lifecycle.onRelease, 'return-to-inventory');
  assert.deepEqual(serializeOlingPodDefinition(reusablePod).lifecycle, {
    onRelease: 'return-to-inventory',
    uses: null
  });
  assert.deepEqual(serializeOlingPodDefinition(reusablePod).assets.layers, {
    back: null,
    front: null,
    base: null
  });

  assert.throws(
    () =>
      createOlingPodDefinition({
        key: 'invalid_pod',
        revision: 1,
        lifecycle: { onRelease: 'explode' }
      }),
    /unsupported release outcome/
  );
});

test('Oling inventories expose empty pod quantities in both canonical schemas', () => {
  assert.ok(accountOlingsSchema.path('pods'));
  assert.ok(OlingState.schema.path('inventory.pods'));
});

test('legacy Player Olings default to active residency without requiring a slot', async () => {
  const oling = createPlayerOling();
  await oling.validate();

  assert.equal(oling.residency.state, 'active');
  assert.equal(oling.residency.labSlot, null);
  assert.equal(oling.residency.pod, null);
  assert.deepEqual(serializeOlingResidency(undefined), {
    state: 'active',
    labSlot: null,
    pod: null
  });
});

test('stored residency snapshots the pod lifecycle and is serialized', async () => {
  const storedAt = new Date('2026-09-01T12:00:00.000Z');
  const oling = createPlayerOling({
    residency: {
      state: 'stored',
      labSlot: null,
      pod: {
        key: 'oling_pod',
        definitionRevision: 1,
        releaseOutcome: 'destroy',
        storedAt
      }
    }
  });
  await oling.validate();

  const serialized = serializePlayerOling(oling);
  assert.deepEqual(serialized.residency, {
    state: 'stored',
    labSlot: null,
    pod: {
      key: 'oling_pod',
      definitionRevision: 1,
      releaseOutcome: 'destroy',
      storedAt,
      containerPlacedId: null
    }
  });
});

test('stored residency rejects missing pods and active lab slots', async () => {
  await assert.rejects(
    createPlayerOling({
      residency: { state: 'stored', labSlot: 1, pod: null }
    }).validate(),
    (error) =>
      Boolean(
        error.errors['residency.labSlot'] && error.errors['residency.pod']
      )
  );
});

test('account Oling synchronization preserves pods and active adventures', () => {
  const activeAdventure = { runId: 'run-one', olingId: 'oling-one' };
  const account = {
    olings: {
      eggs: [],
      consumables: [],
      furniture: [],
      pods: [{ key: 'oling_pod', quantity: 2 }],
      wallDecorations: [],
      olings: [],
      hatchHistory: [],
      adventures: { active: activeAdventure, history: [] },
      lab: { placedItems: [] }
    },
    set(path, value) {
      this[path] = value;
    }
  };

  ensureAccountOlingDocument(account, {
    inventory: { pods: [{ key: 'different-pod', quantity: 1 }] },
    lab: { placedItems: [] }
  });

  assert.deepEqual(account.olings.pods, [{ key: 'oling_pod', quantity: 2 }]);
  assert.equal(account.olings.adventures.active, activeAdventure);
});

test('OlingState fallback hydration restores pods without erasing adventures', async () => {
  class FakeAccount {
    constructor() {
      this._id = 'account-one';
      this.gameData = {};
      this.olings = {
        eggs: [],
        consumables: [],
        furniture: [],
        wallDecorations: [],
        olings: [],
        hatchHistory: [],
        adventures: {
          active: { runId: 'active-run', olingId: 'oling-one' },
          history: []
        },
        lab: { placedItems: [] }
      };
    }

    static async updateOne() {}

    set(path, value) {
      this[path] = value;
    }
  }

  const storedPod = { key: 'oling_pod', quantity: 2 };
  const OlingStateModel = {
    findOne() {
      return {
        async lean() {
          return {
            inventory: { pods: [storedPod] },
            lab: { placedItems: [] }
          };
        }
      };
    }
  };
  const account = new FakeAccount();

  const state = await getOrCreateOlingState(OlingStateModel, account);

  assert.deepEqual(state.inventory.pods, [storedPod]);
  assert.deepEqual(account.olings.pods, [storedPod]);
  assert.equal(account.olings.adventures.active.runId, 'active-run');
});

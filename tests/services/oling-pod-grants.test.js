const assert = require('node:assert/strict');
const test = require('node:test');

const {
  grantOlingInventory
} = require('../../server/services/opals/inventory');

function setPath(target, path, value) {
  const segments = path.split('.');
  let cursor = target;
  segments.slice(0, -1).forEach((segment) => {
    cursor[segment] ||= {};
    cursor = cursor[segment];
  });
  cursor[segments.at(-1)] = value;
}

function createAccount(pods = []) {
  return {
    _id: 'account-1',
    olings: {
      pods,
      eggs: [],
      consumables: [],
      furniture: [],
      wallDecorations: [],
      olings: [],
      hatchHistory: [],
      lab: {}
    },
    gameData: {},
    set(path, value) {
      setPath(this, path, value);
    },
    async save() {
      return this;
    }
  };
}

test('Oling Pod grants stack as repeatable inventory quantities', async () => {
  const now = new Date('2026-09-01T12:00:00.000Z');
  const account = createAccount([
    { key: 'oling_pod', rarity: 'common', quantity: 2 }
  ]);

  const result = await grantOlingInventory({
    account,
    accountId: account._id,
    podGrants: [
      {
        key: 'oling_pod',
        quantity: 3,
        metadata: { rarity: 'common', releaseOutcome: 'destroy' }
      }
    ],
    now
  });

  assert.equal(result.account.olings.pods.length, 1);
  assert.equal(result.account.olings.pods[0].quantity, 5);
  assert.equal(result.account.olings.pods[0].lastUpdatedAt, now);
  assert.equal(result.olingState.inventory.pods[0].quantity, 5);
});

test('new pod grants preserve unrelated Oling inventory', async () => {
  const account = createAccount();
  account.olings.eggs = [{ key: 'base-egg', quantity: 2 }];
  account.olings.consumables = [{ key: 'o-juice', quantity: 1 }];

  await grantOlingInventory({
    account,
    accountId: account._id,
    podGrants: [{ key: 'oling_pod', quantity: 1, metadata: {} }],
    now: new Date()
  });

  assert.deepEqual(
    account.olings.eggs.map(({ key, quantity }) => ({ key, quantity })),
    [{ key: 'base-egg', quantity: 2 }]
  );
  assert.deepEqual(
    account.olings.consumables.map(({ key, quantity }) => ({ key, quantity })),
    [{ key: 'o-juice', quantity: 1 }]
  );
  assert.equal(account.olings.pods[0].quantity, 1);
});

test('pod grants persist the mirrored OlingState inventory', async () => {
  const account = createAccount([
    { key: 'oling_pod', rarity: 'common', quantity: 2 }
  ]);
  let update = null;
  const savedState = { ownerId: account._id, inventory: {} };
  const OlingState = {
    findOne() {
      return { lean: async () => null };
    },
    async findOneAndUpdate(filter, mutation, options) {
      update = { filter, mutation, options };
      savedState.inventory = mutation.$set.inventory;
      return savedState;
    }
  };

  const result = await grantOlingInventory({
    OlingState,
    account,
    accountId: account._id,
    podGrants: [{ key: 'oling_pod', quantity: 4, metadata: {} }],
    now: new Date('2026-09-01T12:00:00.000Z')
  });

  assert.deepEqual(update.filter, { ownerId: 'account-1' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.mutation.$set.inventory.pods[0].quantity, 6);
  assert.equal(result.olingState.inventory.pods[0].quantity, 6);
});

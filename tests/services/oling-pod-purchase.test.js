const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createOlingPodProduct
} = require('../../scripts/seed-oling-pod-product');
const {
  spendOpalsForProduct
} = require('../../server/services/opals/purchases');

function setPath(target, path, value) {
  const segments = path.split('.');
  let cursor = target;
  segments.slice(0, -1).forEach((segment) => {
    cursor[segment] ||= {};
    cursor = cursor[segment];
  });
  cursor[segments.at(-1)] = value;
}

function createAccount() {
  return {
    _id: 'account-1',
    gameData: {
      opals: { balance: 500, lifetimeSpent: 0 },
      inGamePurchasesAndUnlocks: [],
      opalTransactions: []
    },
    olings: {
      pods: [],
      eggs: [],
      consumables: [],
      furniture: [],
      wallDecorations: [],
      olings: [],
      hatchHistory: [],
      lab: {}
    },
    set(path, value) {
      setPath(this, path, value);
    },
    async save() {
      return this;
    }
  };
}

test('repeat Opal purchases add Oling Pods without creating unique unlocks', async () => {
  const account = createAccount();
  const product = {
    ...createOlingPodProduct(),
    _id: { toString: () => 'product-1' }
  };
  const Account = {
    async findOneAndUpdate(filter) {
      const price = product.digitalEntitlement.opalPrice.amount;
      if (account.gameData.opals.balance < price) return null;
      assert.equal(filter.$and, undefined);
      account.gameData.opals.balance -= price;
      account.gameData.opals.lifetimeSpent += price;
      return account;
    }
  };

  const first = await spendOpalsForProduct({
    Account,
    accountId: account._id,
    product
  });
  const second = await spendOpalsForProduct({
    Account,
    accountId: account._id,
    product
  });

  assert.equal(first.error, undefined);
  assert.equal(second.error, undefined);
  assert.equal(account.gameData.opals.balance, 350);
  assert.equal(account.olings.pods[0].quantity, 2);
  assert.deepEqual(account.gameData.inGamePurchasesAndUnlocks, []);
  assert.equal(second.purchase.grants[0].type, 'oling_pod');
});

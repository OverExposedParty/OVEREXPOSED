const assert = require('node:assert/strict');
const test = require('node:test');

const {
  unlockAchievementByKey
} = require('../../server/services/achievements/unlocking');
const {
  finalizeQueuedAchievementClaims
} = require('../../server/services/achievements/claims');
const {
  runAchievementAccountTransaction
} = require('../../server/services/achievements/account-transactions');

function clone(value) {
  return value ? structuredClone(value) : value;
}

function createClaimModel() {
  const claims = new Map();

  function matches(claim, query) {
    if (!claim) return false;
    return Object.entries(query).every(([key, expected]) => {
      if (expected && typeof expected === 'object' && '$lte' in expected) {
        return (
          new Date(claim[key]).getTime() <= new Date(expected.$lte).getTime()
        );
      }
      return claim[key] === expected;
    });
  }

  return {
    claims,
    async create(claim) {
      const nextClaim = Array.isArray(claim) ? claim[0] : claim;
      if (claims.has(nextClaim.claimKey)) {
        const error = new Error('duplicate claim');
        error.code = 11000;
        throw error;
      }
      claims.set(nextClaim.claimKey, clone(nextClaim));
      return Array.isArray(claim) ? [clone(nextClaim)] : clone(nextClaim);
    },
    findOne(query) {
      const result = {
        async lean() {
          return clone(claims.get(query.claimKey) || null);
        }
      };
      result.session = () => result;
      return result;
    },
    findOneAndUpdate(query, update) {
      return {
        async lean() {
          const claim = claims.get(query.claimKey);
          if (!matches(claim, query)) return null;
          Object.assign(claim, clone(update.$set || {}));
          return clone(claim);
        }
      };
    },
    async updateOne(query, update) {
      const claim = claims.get(query.claimKey);
      if (!matches(claim, query)) return { modifiedCount: 0 };
      Object.assign(claim, clone(update.$set || {}));
      return { modifiedCount: 1 };
    }
  };
}

function getPathValue(value, path) {
  return String(path)
    .split('.')
    .reduce((current, key) => current?.[key], value);
}

function setPathValue(value, path, nextValue) {
  const keys = String(path).split('.');
  const finalKey = keys.pop();
  const target = keys.reduce((current, key) => {
    current[key] ||= {};
    return current[key];
  }, value);
  target[finalKey] = nextValue;
}

function createTransactionalAccountStore(id) {
  let stored = {
    _id: id,
    __v: 0,
    gameData: {
      level: 1,
      xp: 0,
      opals: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
      opalTransactions: [],
      achievements: [],
      inGamePurchasesAndUnlocks: []
    },
    olings: { eggs: [], consumables: [], furniture: [] }
  };
  let transactionQueue = Promise.resolve();

  const connection = {
    readyState: 1,
    $achievementRewardTransactions: true,
    transaction(operation) {
      const result = transactionQueue.then(() => operation({}));
      transactionQueue = result.catch(() => {});
      return result;
    }
  };
  function AccountModel() {}
  AccountModel.db = connection;
  AccountModel.findById = () => ({
    session: async () => createDocument(stored)
  });

  function createDocument(snapshot) {
    const document = clone(snapshot);
    const modified = new Set();
    Object.defineProperties(document, {
      $__: { value: {} },
      constructor: { value: AccountModel }
    });
    document.isNew = false;
    document.get = (path) => getPathValue(document, path);
    document.set = (path, value) => {
      setPathValue(document, path, clone(value));
      modified.add(path);
    };
    document.markModified = (path) => modified.add(path);
    document.unmarkModified = (path) => modified.delete(path);
    document.isModified = () => modified.size > 0;
    document.directModifiedPaths = () => [...modified];
    document.modifiedPaths = () => [...modified];
    document.toObject = () =>
      clone({
        _id: document._id,
        __v: document.__v,
        gameData: document.gameData,
        olings: document.olings
      });
    document.save = async () => {
      document.__v += 1;
      stored = clone({
        _id: document._id,
        __v: document.__v,
        gameData: document.gameData,
        olings: document.olings
      });
      modified.clear();
      return document;
    };
    return document;
  }

  return {
    connection,
    createSnapshot: () => createDocument(stored),
    getStored: () => clone(stored)
  };
}

function createAchievementModel(achievement) {
  return {
    findOne() {
      return { lean: async () => achievement };
    }
  };
}

function createAccount(id, save = async () => {}) {
  return {
    _id: id,
    gameData: {
      level: 1,
      xp: 0,
      opals: { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0 },
      opalTransactions: [],
      achievements: [],
      inGamePurchasesAndUnlocks: []
    },
    markedPaths: [],
    markModified(path) {
      this.markedPaths.push(path);
    },
    save
  };
}

const achievement = {
  key: 'claim-test',
  name: 'Claim Test',
  enabled: true,
  status: 'published',
  rewards: [{ type: 'opals', amount: 35 }]
};

test('concurrent achievement unlocks grant one account snapshot only once', async () => {
  const AchievementRewardClaim = createClaimModel();
  let releaseSave;
  let reportSaveStarted;
  const saveStarted = new Promise((resolve) => {
    reportSaveStarted = resolve;
  });
  const saveBlocked = new Promise((resolve) => {
    releaseSave = resolve;
  });
  const firstAccount = createAccount('account-one', async () => {
    reportSaveStarted();
    await saveBlocked;
  });
  const secondAccount = createAccount('account-one');
  const Achievement = createAchievementModel(achievement);

  const firstUnlock = unlockAchievementByKey({
    Achievement,
    AchievementRewardClaim,
    account: firstAccount,
    key: achievement.key
  });
  await saveStarted;
  const secondUnlock = await unlockAchievementByKey({
    Achievement,
    AchievementRewardClaim,
    account: secondAccount,
    key: achievement.key
  });
  releaseSave();
  await firstUnlock;

  assert.equal(secondUnlock, null);
  assert.equal(firstAccount.gameData.opals.balance, 35);
  assert.equal(firstAccount.gameData.opalTransactions.length, 1);
  assert.equal(secondAccount.gameData.opals.balance, 0);
  assert.equal(secondAccount.gameData.opalTransactions.length, 0);
  assert.equal(
    AchievementRewardClaim.claims.get('account-one:claim-test').status,
    'applied'
  );
});

test('different achievement rewards serialize against the latest account state', async () => {
  const store = createTransactionalAccountStore('account-transaction');
  const AchievementRewardClaim = createClaimModel();
  AchievementRewardClaim.db = store.connection;
  const firstAchievement = {
    ...achievement,
    key: 'transaction-first',
    rewards: [{ type: 'opals', amount: 35 }]
  };
  const secondAchievement = {
    ...achievement,
    key: 'transaction-second',
    rewards: [{ type: 'opals', amount: 45 }]
  };

  const [firstResult, secondResult] = await Promise.all([
    unlockAchievementByKey({
      Achievement: createAchievementModel(firstAchievement),
      AchievementRewardClaim,
      account: store.createSnapshot(),
      key: firstAchievement.key,
      save: false
    }),
    unlockAchievementByKey({
      Achievement: createAchievementModel(secondAchievement),
      AchievementRewardClaim,
      account: store.createSnapshot(),
      key: secondAchievement.key,
      save: false
    })
  ]);

  const stored = store.getStored();
  assert.equal(firstResult, firstAchievement);
  assert.equal(secondResult, secondAchievement);
  assert.equal(stored.gameData.opals.balance, 80);
  assert.equal(stored.gameData.opals.lifetimeEarned, 80);
  assert.equal(stored.gameData.opalTransactions.length, 2);
  assert.deepEqual(stored.gameData.achievements.map(({ key }) => key).sort(), [
    'transaction-first',
    'transaction-second'
  ]);
  assert.equal(
    AchievementRewardClaim.claims.get('account-transaction:transaction-first')
      .status,
    'applied'
  );
  assert.equal(
    AchievementRewardClaim.claims.get('account-transaction:transaction-second')
      .status,
    'applied'
  );
});

test('eligible account changes commit with their achievement reward', async () => {
  const store = createTransactionalAccountStore('account-pending-state');
  const AchievementRewardClaim = createClaimModel();
  AchievementRewardClaim.db = store.connection;
  const account = store.createSnapshot();
  account.gameData.achievementStats ||= {};
  account.gameData.achievementStats.gamesPlayed = 5;
  account.markModified('gameData.achievementStats');

  const result = await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    AchievementRewardClaim,
    account,
    key: achievement.key,
    save: false
  });

  const stored = store.getStored();
  assert.equal(result, achievement);
  assert.equal(stored.gameData.achievementStats.gamesPlayed, 5);
  assert.equal(stored.gameData.opals.balance, 35);
  assert.equal(stored.gameData.achievements[0].key, achievement.key);
  assert.equal(account.isModified(), false);
});

test('transactions do not swallow unrelated account duplicate errors', async () => {
  const store = createTransactionalAccountStore('account-duplicate');
  const AchievementRewardClaim = createClaimModel();
  AchievementRewardClaim.db = store.connection;
  const duplicateError = new Error('duplicate username');
  duplicateError.code = 11000;

  await assert.rejects(
    runAchievementAccountTransaction({
      account: store.createSnapshot(),
      Claim: AchievementRewardClaim,
      operation: async () => {
        throw duplicateError;
      }
    }),
    (error) => error === duplicateError
  );
});

test('an interrupted account save leaves a recoverable pending claim', async () => {
  const AchievementRewardClaim = createClaimModel();
  const Achievement = createAchievementModel(achievement);
  const interruptedAccount = createAccount('account-two', async () => {
    throw new Error('interrupted save');
  });

  await assert.rejects(
    unlockAchievementByKey({
      Achievement,
      AchievementRewardClaim,
      account: interruptedAccount,
      key: achievement.key
    }),
    /interrupted save/
  );
  assert.equal(
    AchievementRewardClaim.claims.get('account-two:claim-test').status,
    'pending'
  );

  const recoveredAccount = createAccount('account-two');
  const recovered = await unlockAchievementByKey({
    Achievement,
    AchievementRewardClaim,
    account: recoveredAccount,
    key: achievement.key
  });

  assert.equal(recovered, achievement);
  assert.equal(recoveredAccount.gameData.opals.balance, 35);
  assert.equal(recoveredAccount.gameData.achievements.length, 1);
  assert.equal(
    AchievementRewardClaim.claims.get('account-two:claim-test').status,
    'applied'
  );
});

test('a pending claim reconciles after the account unlock was already saved', async () => {
  const AchievementRewardClaim = createClaimModel();
  const claimKey = 'account-three:claim-test';
  AchievementRewardClaim.claims.set(claimKey, {
    claimKey,
    accountId: 'account-three',
    achievementKey: achievement.key,
    status: 'pending',
    grantToken: 'old-token',
    leaseExpiresAt: new Date(Date.now() + 60_000),
    rewardResults: []
  });
  const account = createAccount('account-three');
  account.gameData.achievements.push({
    type: 'achievement',
    key: achievement.key,
    rewardResults: [{ type: 'opals', amount: 35, granted: true }]
  });

  const result = await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    AchievementRewardClaim,
    account,
    key: achievement.key
  });

  assert.equal(result, null);
  assert.equal(account.gameData.opals.balance, 0);
  assert.equal(AchievementRewardClaim.claims.get(claimKey).status, 'applied');
});

test('deferred achievement saves queue claim finalization for the account hook', async () => {
  const AchievementRewardClaim = createClaimModel();
  const account = createAccount('account-four');

  await unlockAchievementByKey({
    Achievement: createAchievementModel(achievement),
    AchievementRewardClaim,
    account,
    key: achievement.key,
    save: false
  });

  const claimKey = 'account-four:claim-test';
  assert.equal(AchievementRewardClaim.claims.get(claimKey).status, 'pending');
  await finalizeQueuedAchievementClaims({ account, AchievementRewardClaim });
  assert.equal(AchievementRewardClaim.claims.get(claimKey).status, 'applied');
});

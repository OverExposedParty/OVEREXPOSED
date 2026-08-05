const assert = require('node:assert/strict');
const test = require('node:test');

const {
  MATCH_REWARD_CLAIM_INDEX_OPTIONS,
  migratePartyGameRewardClaimIndex
} = require('../../scripts/lib/party-game-reward-claim-index');

function createCollection(indexes) {
  let currentIndexes = structuredClone(indexes);
  const calls = [];

  return {
    calls,
    async indexes() {
      return structuredClone(currentIndexes);
    },
    async createIndex(key, options) {
      calls.push(['createIndex', key, options]);
      currentIndexes.push({ v: 2, key, ...options });
      return options.name;
    },
    async dropIndex(name) {
      calls.push(['dropIndex', name]);
      currentIndexes = currentIndexes.filter((index) => index.name !== name);
    }
  };
}

test('reward claim migration installs match scope before removing party scope', async () => {
  const collection = createCollection([
    { v: 2, key: { _id: 1 }, name: '_id_' },
    {
      v: 2,
      key: { partyId: 1, playerId: 1 },
      name: 'partyId_1_playerId_1',
      unique: true
    }
  ]);

  const result = await migratePartyGameRewardClaimIndex(collection);

  assert.deepEqual(result, {
    changed: true,
    name: 'gameId_1_playerId_1'
  });
  assert.deepEqual(collection.calls, [
    [
      'createIndex',
      { gameId: 1, playerId: 1 },
      MATCH_REWARD_CLAIM_INDEX_OPTIONS
    ],
    ['dropIndex', 'partyId_1_playerId_1']
  ]);
});

test('reward claim migration is idempotent', async () => {
  const collection = createCollection([
    {
      v: 2,
      key: { gameId: 1, playerId: 1 },
      ...MATCH_REWARD_CLAIM_INDEX_OPTIONS
    }
  ]);

  assert.deepEqual(await migratePartyGameRewardClaimIndex(collection), {
    changed: false,
    name: 'gameId_1_playerId_1'
  });
  assert.deepEqual(collection.calls, []);
});

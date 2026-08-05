const { isDeepStrictEqual } = require('node:util');

const LEGACY_REWARD_CLAIM_INDEX_NAME = 'partyId_1_playerId_1';
const MATCH_REWARD_CLAIM_INDEX_NAME = 'gameId_1_playerId_1';
const MATCH_REWARD_CLAIM_INDEX_KEY = { gameId: 1, playerId: 1 };
const MATCH_REWARD_CLAIM_INDEX_OPTIONS = {
  name: MATCH_REWARD_CLAIM_INDEX_NAME,
  unique: true,
  partialFilterExpression: { gameId: { $type: 'string' } }
};

function hasIndexKey(index, expectedKey) {
  return isDeepStrictEqual(index?.key, expectedKey);
}

function isExpectedMatchRewardClaimIndex(index) {
  return (
    index?.name === MATCH_REWARD_CLAIM_INDEX_NAME &&
    hasIndexKey(index, MATCH_REWARD_CLAIM_INDEX_KEY) &&
    index.unique === true &&
    isDeepStrictEqual(
      index.partialFilterExpression,
      MATCH_REWARD_CLAIM_INDEX_OPTIONS.partialFilterExpression
    )
  );
}

async function migratePartyGameRewardClaimIndex(collection) {
  const indexes = await collection.indexes();
  const legacyIndex = indexes.find(
    (index) => index.name === LEGACY_REWARD_CLAIM_INDEX_NAME
  );
  const matchIndex = indexes.find(
    (index) => index.name === MATCH_REWARD_CLAIM_INDEX_NAME
  );

  if (legacyIndex && !hasIndexKey(legacyIndex, { partyId: 1, playerId: 1 })) {
    throw new Error(
      `Refusing to remove "${LEGACY_REWARD_CLAIM_INDEX_NAME}" because it has unexpected fields.`
    );
  }

  if (matchIndex && !isExpectedMatchRewardClaimIndex(matchIndex)) {
    throw new Error(
      `Refusing to replace "${MATCH_REWARD_CLAIM_INDEX_NAME}" because its definition is unexpected.`
    );
  }

  if (!matchIndex) {
    await collection.createIndex(
      MATCH_REWARD_CLAIM_INDEX_KEY,
      MATCH_REWARD_CLAIM_INDEX_OPTIONS
    );
  }

  if (legacyIndex) {
    await collection.dropIndex(LEGACY_REWARD_CLAIM_INDEX_NAME);
  }

  return {
    changed: !matchIndex || Boolean(legacyIndex),
    name: MATCH_REWARD_CLAIM_INDEX_NAME
  };
}

module.exports = {
  LEGACY_REWARD_CLAIM_INDEX_NAME,
  MATCH_REWARD_CLAIM_INDEX_KEY,
  MATCH_REWARD_CLAIM_INDEX_NAME,
  MATCH_REWARD_CLAIM_INDEX_OPTIONS,
  isExpectedMatchRewardClaimIndex,
  migratePartyGameRewardClaimIndex
};

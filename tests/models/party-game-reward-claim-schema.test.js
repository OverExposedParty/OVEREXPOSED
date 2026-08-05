const assert = require('node:assert/strict');
const test = require('node:test');

const PartyGameRewardClaim = require('../../models/party-games/party-game-reward-claim-schema');

test('party game reward claims preserve versioned reward audit fields', () => {
  const { schema } = PartyGameRewardClaim;

  assert.equal(schema.path('rewardVersion').defaultValue, 1);
  assert.equal(schema.path('status').defaultValue, 'pending');
  assert.deepEqual(schema.path('status').enumValues, ['pending', 'applied']);
  assert.equal(schema.path('opalAmount').defaultValue, 0);
  assert.equal(schema.path('xpAmount').defaultValue, 0);
  assert.equal(schema.path('levelBefore').defaultValue, null);
  assert.equal(schema.path('levelAfter').defaultValue, null);
  assert.equal(schema.path('appliedAt').defaultValue, null);

  const indexes = schema.indexes().map(([fields, options]) => ({
    fields,
    unique: options.unique === true
  }));
  assert.ok(
    indexes.some(({ fields, unique }) => fields.claimKey === 1 && unique)
  );
  assert.ok(
    indexes.some(
      ({ fields, unique }) =>
        fields.gameId === 1 && fields.playerId === 1 && unique
    )
  );
  assert.ok(schema.path('gameId'));
});

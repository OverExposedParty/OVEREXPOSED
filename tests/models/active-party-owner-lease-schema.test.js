const assert = require('node:assert/strict');
const test = require('node:test');

const ActivePartyOwnerLease = require('../../models/party-games/active-party-owner-lease-schema');

test('active party owner leases keep owner identifiers private', () => {
  const { schema } = ActivePartyOwnerLease;

  assert.equal(ActivePartyOwnerLease.modelName, 'ActivePartyOwnerLease');
  assert.equal(
    ActivePartyOwnerLease.collection.name,
    'active-party-owner-leases'
  );
  assert.equal(schema.path('partyId').isRequired, true);
  assert.equal(schema.path('partyOwnerIdHash').isRequired, true);
  assert.equal(schema.path('partyOwnerIdHash').options.select, false);
  assert.equal(schema.path('accountId').options.select, false);
  assert.equal(schema.path('accountId').defaultValue, undefined);
  assert.equal(schema.path('leaseToken').isRequired, true);
  assert.equal(schema.path('leaseToken').options.select, false);
  assert.deepEqual(schema.path('status').enumValues, ['pending', 'active']);
});

test('active party owner lease indexes enforce both owners and expire pending records', () => {
  const indexes = ActivePartyOwnerLease.schema.indexes();
  const findIndex = (field) => indexes.find(([fields]) => fields[field] === 1);

  const [, partyIdOptions] = findIndex('partyId');
  const [, browserOptions] = findIndex('partyOwnerIdHash');
  const [, accountOptions] = findIndex('accountId');
  const [, expiryOptions] = findIndex('expiresAt');

  assert.equal(partyIdOptions.unique, true);
  assert.equal(browserOptions.unique, true);
  assert.equal(accountOptions.unique, true);
  assert.deepEqual(accountOptions.partialFilterExpression, {
    accountId: { $type: 'objectId' }
  });
  assert.equal(expiryOptions.expireAfterSeconds, 0);
});

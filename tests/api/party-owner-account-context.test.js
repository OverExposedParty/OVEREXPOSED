const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createAccountContext
} = require('../../server/routes/api-route-context/accounts');

function getCookieValue(cookieHeader, name) {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function createUpgradeRecorder() {
  const updates = [];
  const leaseLinks = [];
  const waitingRoomSchema = {
    async updateMany(filter, update, options) {
      updates.push({ filter, update, options });
      return { modifiedCount: 0 };
    }
  };
  const context = createAccountContext({
    crypto,
    defaultOeIcon: 'default-icon',
    getCookieValue,
    getPartyGameRoomSources: () => [],
    waitingRoomSchema,
    partyOwnerLeases: {
      async attachAccountToPartyOwnerLease(input) {
        leaseLinks.push(input);
        return { attached: true };
      }
    }
  });

  return { context, updates, leaseLinks };
}

for (const cookieName of ['oe_party_owner', 'oe_party_guest']) {
  test(`account linking recognises the ${cookieName} identity`, async () => {
    const token =
      cookieName === 'oe_party_owner' ? 'a'.repeat(64) : 'b'.repeat(64);
    const expectedHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    const { context, updates, leaseLinks } = createUpgradeRecorder();

    await context.upgradeGuestPartyIdentityForAccount(
      {
        headers: { cookie: `${cookieName}=${token}` },
        id: 'request-one'
      },
      {
        _id: 'account-one',
        username: 'account-name',
        profile: { oeIcon: 'account-icon' }
      }
    );

    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].filter, {
      'players.identity.guestIdHash': expectedHash
    });
    assert.equal(
      updates[0].update.$set['players.$[player].identity.partyOwnerIdHash'],
      expectedHash
    );
    assert.equal(
      updates[0].options.arrayFilters[0]['player.identity.guestIdHash'],
      expectedHash
    );
    assert.deepEqual(leaseLinks, [
      {
        partyOwnerIdHash: expectedHash,
        accountId: 'account-one'
      }
    ]);
  });
}

test('account linking leaves guest party records unchanged on a lease conflict', async () => {
  const token = 'c'.repeat(64);
  const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
  const updates = [];
  const context = createAccountContext({
    crypto,
    defaultOeIcon: 'default-icon',
    getCookieValue,
    getPartyGameRoomSources: () => [],
    waitingRoomSchema: {
      async updateMany(...args) {
        updates.push(args);
        return { modifiedCount: 1 };
      }
    },
    partyOwnerLeases: {
      async attachAccountToPartyOwnerLease() {
        return {
          attached: false,
          conflict: true,
          partyId: 'OLD-123',
          gamemode: 'truth-or-dare'
        };
      }
    }
  });

  const result = await context.upgradeGuestPartyIdentityForAccount(
    {
      headers: { cookie: `oe_party_owner=${token}` },
      id: 'request-conflict'
    },
    { _id: 'account-one', profile: {} }
  );

  assert.deepEqual(result, {
    upgraded: false,
    conflict: true,
    partyId: 'OLD-123',
    activePartyConflict: {
      code: 'party_owner_active_party_exists',
      partyCode: 'OLD-123',
      lobbyPath: '/OLD-123',
      gamemode: 'truth-or-dare'
    }
  });
  assert.equal(updates.length, 0);
  assert.equal(expectedHash.length, 64);
});

test('account linking does not expose malformed lease identifiers', async () => {
  const context = createAccountContext({
    crypto,
    defaultOeIcon: 'default-icon',
    getCookieValue,
    getPartyGameRoomSources: () => [],
    waitingRoomSchema: {},
    partyOwnerLeases: {
      async attachAccountToPartyOwnerLease() {
        return {
          conflict: true,
          partyId: '../../private?accountId=account-one'
        };
      }
    }
  });

  const result = await context.upgradeGuestPartyIdentityForAccount(
    {
      headers: { cookie: `oe_party_owner=${'d'.repeat(64)}` },
      id: 'request-malformed-conflict'
    },
    { _id: 'account-one', profile: {} }
  );

  assert.deepEqual(result, {
    upgraded: false,
    conflict: true,
    partyId: null,
    activePartyConflict: null
  });
});

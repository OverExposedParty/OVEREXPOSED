const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createPartyPlayerTools
} = require('../../server/game-engine/party-runtime/route-handlers/player-tools');
const {
  createPartySnapshotTools
} = require('../../server/game-engine/party-runtime/snapshot-tools');
const {
  PARTY_OWNER_COOKIE,
  PARTY_OWNER_COOKIE_MAX_AGE_MS
} = require('../../server/services/party-owner-identity');

function createResponseRecorder() {
  const cookies = [];
  return {
    cookies,
    response: {
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      }
    }
  };
}

function createPlayerTools({ account = null, cryptoProvider = crypto } = {}) {
  return createPartyPlayerTools({
    Account: {},
    cloneSerializable: (value) => structuredClone(value),
    crypto: cryptoProvider,
    getPartyPlayerId: (player) => player?.identity?.computerId,
    getCurrentAccount: async () => account
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

test('signed-in party principals receive a persistent browser owner token', async () => {
  const generatedToken = 'ab'.repeat(32);
  const cryptoProvider = {
    createHash: crypto.createHash,
    randomBytes(size) {
      assert.equal(size, 32);
      return Buffer.from(generatedToken, 'hex');
    }
  };
  const tools = createPlayerTools({
    account: { _id: 'account-one' },
    cryptoProvider
  });
  const { cookies, response } = createResponseRecorder();

  const principal = await tools.getPartyRequestPrincipal(
    { headers: {} },
    response
  );

  assert.deepEqual(principal, {
    type: 'account',
    accountId: 'account-one',
    partyOwnerIdHash: hashToken(generatedToken)
  });
  assert.deepEqual(cookies, [
    {
      name: PARTY_OWNER_COOKIE,
      value: generatedToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: PARTY_OWNER_COOKIE_MAX_AGE_MS
      }
    }
  ]);
});

test('account and guest principals reuse the same party owner identity', async () => {
  const ownerToken = '1'.repeat(64);
  const expectedHash = hashToken(ownerToken);
  const accountTools = createPlayerTools({
    account: { _id: 'account-one' }
  });
  const guestTools = createPlayerTools();
  const request = {
    headers: { cookie: `${PARTY_OWNER_COOKIE}=${ownerToken}` }
  };

  const accountPrincipal = await accountTools.getPartyRequestPrincipal(
    { ...request },
    createResponseRecorder().response
  );
  const { cookies, response } = createResponseRecorder();
  const guestPrincipal = await guestTools.getPartyRequestPrincipal(
    { ...request },
    response
  );

  assert.equal(accountPrincipal.partyOwnerIdHash, expectedHash);
  assert.deepEqual(guestPrincipal, {
    type: 'guest',
    guestIdHash: expectedHash,
    partyOwnerIdHash: expectedHash
  });
  assert.deepEqual(cookies, []);
});

test('legacy guest tokens migrate without changing the stored identity hash', async () => {
  const legacyToken = '2'.repeat(64);
  const expectedHash = hashToken(legacyToken);
  const tools = createPlayerTools();
  const request = {
    headers: { cookie: `oe_party_guest=${legacyToken}` }
  };
  const { cookies, response } = createResponseRecorder();

  const principal = await tools.getPartyRequestPrincipal(request, response);

  assert.equal(principal.guestIdHash, expectedHash);
  assert.equal(principal.partyOwnerIdHash, expectedHash);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, PARTY_OWNER_COOKIE);
  assert.equal(cookies[0].value, legacyToken);
  assert.deepEqual(tools.getPartyGuestPrincipalFromRequest(request), {
    type: 'guest',
    guestIdHash: expectedHash,
    partyOwnerIdHash: expectedHash
  });
});

test('the canonical owner token takes precedence over a different legacy token', async () => {
  const ownerToken = '3'.repeat(64);
  const legacyToken = '4'.repeat(64);
  const tools = createPlayerTools();
  const { cookies, response } = createResponseRecorder();

  const principal = await tools.getPartyRequestPrincipal(
    {
      headers: {
        cookie: `${PARTY_OWNER_COOKIE}=${ownerToken}; oe_party_guest=${legacyToken}`
      }
    },
    response
  );

  assert.equal(principal.guestIdHash, hashToken(ownerToken));
  assert.deepEqual(cookies, []);
});

test('player bindings store the private owner hash for accounts and guests', () => {
  const tools = createPlayerTools();
  const accountHash = 'account-owner-hash';
  const guestHash = 'guest-owner-hash';
  const accountPlayer = tools.bindPlayerToPrincipal(
    { identity: { computerId: 'account-device' } },
    {
      type: 'account',
      accountId: 'account-one',
      partyOwnerIdHash: accountHash
    }
  );
  const guestPlayer = tools.bindPlayerToPrincipal(
    { identity: { computerId: 'guest-device' } },
    {
      type: 'guest',
      guestIdHash: guestHash,
      partyOwnerIdHash: guestHash
    }
  );

  assert.equal(accountPlayer.identity.accountId, 'account-one');
  assert.equal(accountPlayer.identity.guestIdHash, undefined);
  assert.equal(accountPlayer.identity.partyOwnerIdHash, accountHash);
  assert.equal(guestPlayer.identity.accountId, null);
  assert.equal(guestPlayer.identity.guestIdHash, guestHash);
  assert.equal(guestPlayer.identity.partyOwnerIdHash, guestHash);
});

test('the persistent owner identity keeps the same browser in control after logout', () => {
  const tools = createPlayerTools();
  const accountPlayer = {
    identity: {
      computerId: 'host-device',
      accountId: 'account-one',
      partyOwnerIdHash: 'same-browser-owner-hash'
    }
  };

  assert.equal(
    tools.playerMatchesPrincipal(accountPlayer, {
      type: 'guest',
      guestIdHash: 'same-browser-owner-hash',
      partyOwnerIdHash: 'same-browser-owner-hash'
    }),
    true
  );
  assert.equal(
    tools.playerMatchesPrincipal(accountPlayer, {
      type: 'guest',
      guestIdHash: 'different-browser-owner-hash',
      partyOwnerIdHash: 'different-browser-owner-hash'
    }),
    false
  );
});

test('a same-browser guest rejoin converts the player binding to guest', () => {
  const tools = createPlayerTools();
  const players = tools.upsertPartyPlayer(
    [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one',
          guestIdHash: null,
          partyOwnerIdHash: 'same-browser-owner-hash',
          username: 'Account Name'
        }
      }
    ],
    {
      identity: {
        computerId: 'host-device',
        accountId: null,
        guestIdHash: 'same-browser-owner-hash',
        partyOwnerIdHash: 'same-browser-owner-hash',
        username: 'OE12345678'
      }
    }
  );

  assert.equal(players[0].identity.accountId, null);
  assert.equal(players[0].identity.guestIdHash, 'same-browser-owner-hash');
  assert.equal(players[0].identity.username, 'OE12345678');
});

test('server-owned identity hashes survive client player updates', () => {
  const tools = createPlayerTools();
  const preserved = tools.preservePlayerBindings(
    [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one',
          guestIdHash: null,
          partyOwnerIdHash: 'stored-owner-hash',
          username: 'Before'
        }
      }
    ],
    [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'spoofed-account',
          guestIdHash: 'spoofed-guest-hash',
          partyOwnerIdHash: 'spoofed-owner-hash',
          username: 'After'
        }
      }
    ]
  );

  assert.equal(preserved[0].identity.username, 'After');
  assert.equal(preserved[0].identity.accountId, 'account-one');
  assert.equal(preserved[0].identity.guestIdHash, null);
  assert.equal(preserved[0].identity.partyOwnerIdHash, 'stored-owner-hash');

  const sanitized = tools.withoutGuestHashes({ players: preserved });
  assert.equal('guestIdHash' in sanitized.players[0].identity, false);
  assert.equal('partyOwnerIdHash' in sanitized.players[0].identity, false);
});

test('generic player patches cannot overwrite server identity bindings', () => {
  const tools = createPlayerTools();
  const patch = tools.buildPlayerPatchFromBody({
    touchLastPing: false,
    player: {
      identity: {
        computerId: 'changed-device',
        accountId: 'changed-account',
        guestIdHash: 'changed-guest-hash',
        partyOwnerIdHash: 'changed-owner-hash',
        accountLinkedAt: new Date(),
        accountLinkSource: 'client',
        username: 'Allowed Name'
      },
      state: {
        role: 'mafioso',
        roleKey: 'mafioso',
        isReady: true
      }
    }
  });

  assert.equal(patch['players.$.identity.username'], 'Allowed Name');
  assert.equal('players.$.identity.computerId' in patch, false);
  assert.equal('players.$.identity.accountId' in patch, false);
  assert.equal('players.$.identity.guestIdHash' in patch, false);
  assert.equal('players.$.identity.partyOwnerIdHash' in patch, false);
  assert.equal('players.$.identity.accountLinkedAt' in patch, false);
  assert.equal('players.$.identity.accountLinkSource' in patch, false);
  assert.equal('players.$.state.role' in patch, false);
  assert.equal('players.$.state.roleKey' in patch, false);
  assert.equal(patch['players.$.state.isReady'], true);
});

test('secure join updates backfill but do not replace an owner binding', () => {
  const tools = createPlayerTools();
  const backfilled = tools.upsertPartyPlayer(
    [
      {
        identity: {
          computerId: 'host-device',
          accountId: 'account-one'
        }
      }
    ],
    {
      identity: {
        computerId: 'host-device',
        accountId: 'account-one',
        partyOwnerIdHash: 'first-owner-hash'
      }
    }
  );
  const preserved = tools.upsertPartyPlayer(backfilled, {
    identity: {
      computerId: 'host-device',
      accountId: 'account-one',
      partyOwnerIdHash: 'different-device-hash'
    }
  });

  assert.equal(backfilled[0].identity.partyOwnerIdHash, 'first-owner-hash');
  assert.equal(preserved[0].identity.partyOwnerIdHash, 'first-owner-hash');
});

test('action snapshot merges cannot spoof private player bindings', () => {
  const { mergePlayerState } = createPartySnapshotTools({
    cloneSerializable: (value) => structuredClone(value)
  });
  const merged = mergePlayerState(
    {
      identity: {
        computerId: 'host-device',
        accountId: 'account-one',
        guestIdHash: null,
        partyOwnerIdHash: 'stored-owner-hash',
        username: 'Before'
      },
      state: { role: 'retired-role-value', roleKey: 'civilian' }
    },
    {
      identity: {
        computerId: 'spoofed-device',
        accountId: 'spoofed-account',
        guestIdHash: 'spoofed-guest-hash',
        partyOwnerIdHash: 'spoofed-owner-hash',
        username: 'After'
      },
      state: {
        role: 'mafioso',
        roleKey: 'mafioso'
      }
    }
  );
  const newPlayer = mergePlayerState(
    { identity: { computerId: 'new-device' } },
    {
      identity: {
        accountId: 'spoofed-account',
        guestIdHash: 'spoofed-guest-hash',
        partyOwnerIdHash: 'spoofed-owner-hash'
      }
    }
  );

  assert.equal(merged.identity.computerId, 'host-device');
  assert.equal(merged.identity.accountId, 'account-one');
  assert.equal(merged.identity.guestIdHash, null);
  assert.equal(merged.identity.partyOwnerIdHash, 'stored-owner-hash');
  assert.equal(merged.identity.username, 'After');
  assert.equal(merged.state.roleKey, 'civilian');
  assert.equal('role' in merged.state, false);
  assert.equal('accountId' in newPlayer.identity, false);
  assert.equal('guestIdHash' in newPlayer.identity, false);
  assert.equal('partyOwnerIdHash' in newPlayer.identity, false);
  assert.equal('role' in newPlayer.state, false);
  assert.equal('roleKey' in newPlayer.state, false);
});

test('party joins cannot seed a server-owned Mafia role key', () => {
  const tools = createPlayerTools();
  const player = tools.buildJoinPlayerFromBody(
    {
      computerId: 'new-device',
      state: {
        role: 'mafioso',
        roleKey: 'mafioso',
        isReady: true
      }
    },
    {
      type: 'guest',
      guestIdHash: 'guest-hash',
      partyOwnerIdHash: 'guest-hash'
    }
  );

  assert.equal('role' in player.state, false);
  assert.equal('roleKey' in player.state, false);
  assert.equal(player.state.isReady, true);
});

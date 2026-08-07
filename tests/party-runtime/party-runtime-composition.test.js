const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPartyRuntime
} = require('../../server/game-engine/party-runtime');

test('party runtime preserves its public handler contract', () => {
  const io = {};
  const runtime = createPartyRuntime({
    app: {},
    io,
    models: {
      Account: {},
      Achievement: {},
      partyGameChatLogSchema: {},
      partyGameEventSchema: {},
      partyGameRewardClaimSchema: {}
    },
    logger: {
      debugLog() {},
      debugWarn() {}
    }
  });

  assert.deepEqual(Object.keys(runtime).sort(), [
    'createAuthTransitionHandlers',
    'createContinuePlayerAsGuestHandler',
    'createDeleteHandler',
    'createDeleteQueryHandler',
    'createDisconnectUserHandler',
    'createJoinUserHandler',
    'createLinkPlayerAccountHandler',
    'createPartyActionHandler',
    'createPartyErrorHandler',
    'createPartyGetHandler',
    'createPatchPlayerHandler',
    'createRemoveUserHandler',
    'createSwitchGameHandler',
    'createUpsertPartyHandler',
    'disconnectSocketPartyMemberships',
    'io',
    'reservePartyCodeForRequest'
  ]);
  assert.equal(runtime.io, io);

  for (const [name, value] of Object.entries(runtime)) {
    if (name !== 'io') assert.equal(typeof value, 'function', name);
  }
});

test('party runtime reservation resolves a guest principal after composition', async () => {
  const shells = [];
  const acquisitions = [];
  const cookies = [];
  const runtime = createPartyRuntime({
    app: {},
    io: {},
    models: {
      Account: {},
      Achievement: {},
      partyGameChatLogSchema: {},
      partyGameEventSchema: {},
      partyGameRewardClaimSchema: {},
      waitingRoomSchema: {
        async create(shell) {
          shells.push(shell);
        },
        async deleteOne() {
          assert.fail('a successful reservation must keep its shell');
        }
      }
    },
    logger: {
      debugLog() {},
      debugWarn() {}
    },
    partyOwnerLeases: {
      async acquireActivePartyOwnerLease(input) {
        acquisitions.push(input);
      }
    }
  });

  const partyCode = await runtime.reservePartyCodeForRequest(
    { headers: { cookie: '' } },
    {
      cookie(name, value, options) {
        cookies.push({ name, options, value });
      }
    }
  );

  assert.match(partyCode, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  assert.deepEqual(shells, [{ partyId: partyCode }]);
  assert.equal(acquisitions.length, 1);
  assert.equal(acquisitions[0].partyId, partyCode);
  assert.equal(acquisitions[0].principal.type, 'guest');
  assert.equal(
    acquisitions[0].principal.guestIdHash,
    acquisitions[0].principal.partyOwnerIdHash
  );
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'oe_party_owner');
});

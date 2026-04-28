const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertDisconnectPlayerBody,
  assertJoinPlayerBody,
  assertPartyActionBody,
  assertPartyUpdateBody,
  assertPatchPlayerBody,
  assertRemovePlayerBody,
  parseBeaconBody
} = require('../server/validation/party-requests');

test('assertPartyActionBody accepts a valid generic party action payload', () => {
  assert.doesNotThrow(() => {
    assertPartyActionBody({
      partyId: 'ABC-123',
      action: 'start-game',
      actorId: 'device-1',
      payload: {
        timer: 1234,
        setInstruction: 'DISPLAY_READY'
      }
    });
  });
});

test('assertPartyActionBody rejects malformed party ids', () => {
  assert.throws(
    () =>
      assertPartyActionBody({
        partyId: 'bad-id',
        action: 'START_GAME',
        payload: {}
      }),
    /XXX-XXX/
  );
});

test('assertPartyUpdateBody rejects non-object state updates', () => {
  assert.throws(
    () =>
      assertPartyUpdateBody(
        {
          partyId: 'ABC-123',
          state: ['not', 'an', 'object']
        },
        ['config', 'state', 'players']
      ),
    /state must be an object/
  );
});

test('assertJoinPlayerBody accepts the legacy join envelope', () => {
  assert.doesNotThrow(() => {
    assertJoinPlayerBody({
      partyId: 'ABC-123',
      newComputerId: 'device-1',
      newUsername: 'Alex',
      newUserIcon: '/images/avatar.png',
      newUserSocketId: 'socket-1',
      newUserReady: false,
      newUserConfirmation: true,
      newScore: 2
    });
  });
});

test('assertPatchPlayerBody rejects non-object patch sections', () => {
  assert.throws(
    () =>
      assertPatchPlayerBody({
        partyId: 'ABC-123',
        computerId: 'device-1',
        playerPatch: 'not-an-object'
      }),
    /playerPatch must be an object/
  );
});

test('parseBeaconBody parses valid beacon JSON and preserves fields', () => {
  const parsed = parseBeaconBody(
    JSON.stringify({
      partyId: 'ABC-123',
      computerId: 'device-1'
    })
  );

  assert.deepEqual(parsed, {
    partyId: 'ABC-123',
    computerId: 'device-1'
  });
});

test('assertRemovePlayerBody requires actor identity for removals', () => {
  assert.throws(
    () =>
      assertRemovePlayerBody({
        partyId: 'ABC-123',
        computerIdToRemove: 'device-2'
      }),
    /actorComputerId is required/
  );
});

test('assertDisconnectPlayerBody accepts partyCode fallback payloads', () => {
  assert.doesNotThrow(() => {
    assertDisconnectPlayerBody({
      partyCode: 'ABC-123',
      computerId: 'device-1',
      socketId: 'socket-1'
    });
  });
});

test('assertPartyActionBody rejects unknown action names', () => {
  assert.throws(
    () =>
      assertPartyActionBody({
        partyId: 'ABC-123',
        action: 'totally-unknown-action',
        payload: {}
      }),
    /Unknown party action/
  );
});

test('assertPartyActionBody rejects malformed mafia shuffledRoles payloads', () => {
  assert.throws(
    () =>
      assertPartyActionBody({
        partyId: 'ABC-123',
        action: 'mafia-start-game',
        actorId: 'host-1',
        payload: {
          shuffledRoles: ['mafioso', 42]
        }
      }),
    /array of strings/
  );
});

test('assertPartyActionBody requires punishmentType for punishment selection actions', () => {
  assert.throws(
    () =>
      assertPartyActionBody({
        partyId: 'ABC-123',
        action: 'paranoia-select-punishment',
        actorId: 'player-1',
        payload: {}
      }),
    /punishmentType is required/
  );
});

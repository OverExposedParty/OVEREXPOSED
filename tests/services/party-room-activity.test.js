const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PARTY_ROOM_INACTIVITY_MS,
  getPartyRoomActiveSince,
  getPartyRoomLastActivity,
  isPartyRoomActive,
  isPartyRoomExpired
} = require('../../server/services/party-room-activity');

test('party room activity uses one twenty-minute inactivity window', () => {
  assert.equal(PARTY_ROOM_INACTIVITY_MS, 20 * 60 * 1000);
  const now = new Date('2026-07-19T12:00:00.000Z');
  assert.equal(
    getPartyRoomActiveSince(now).toISOString(),
    '2026-07-19T11:40:00.000Z'
  );

  const activeRoom = {
    state: { lastPinged: new Date('2026-07-19T11:40:01.000Z') }
  };
  const expiredRoom = {
    state: { lastPinged: new Date('2026-07-19T11:40:00.000Z') }
  };

  assert.equal(isPartyRoomActive(activeRoom, now), true);
  assert.equal(isPartyRoomExpired(activeRoom, now), false);
  assert.equal(isPartyRoomActive(expiredRoom, now), false);
  assert.equal(isPartyRoomExpired(expiredRoom, now), true);
});

test('the newest supported room activity timestamp wins', () => {
  const room = {
    state: { lastPinged: new Date('2026-07-19T11:00:00.000Z') },
    lastPinged: new Date('2026-07-19T11:30:00.000Z'),
    session: { createdAt: new Date('2026-07-19T11:15:00.000Z') }
  };

  assert.equal(
    getPartyRoomLastActivity(room),
    new Date('2026-07-19T11:30:00.000Z').getTime()
  );
});

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createPublicSessionId,
  getActiveSerializedSessions,
  getRequestDevice
} = require('../../server/services/account-session-tools');

test('account session tools create opaque public IDs and parse common devices', () => {
  const sessionId = createPublicSessionId(crypto);
  const device = getRequestDevice({
    get(name) {
      if (name !== 'user-agent') return null;
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
    }
  });

  assert.match(sessionId, /^[A-Za-z0-9_-]{22}$/);
  assert.deepEqual(device, {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
    browser: 'Chrome 126',
    os: 'Windows',
    deviceType: 'Desktop'
  });
});

test('account session serialization exposes presentation data without secrets', () => {
  const now = new Date('2026-07-31T12:00:00.000Z');
  const sessions = getActiveSerializedSessions(
    {
      security: {
        sessions: [
          {
            sessionId: 'other-session-id-1234',
            tokenHash: 'other-token-hash',
            ipAddress: '192.0.2.10',
            device: {
              browser: 'Firefox 128',
              os: 'Linux',
              deviceType: 'Desktop'
            },
            createdAt: '2026-07-29T12:00:00.000Z',
            lastUsedAt: '2026-07-31T11:00:00.000Z',
            expiresAt: '2026-08-29T12:00:00.000Z'
          },
          {
            sessionId: 'current-session-id-1',
            tokenHash: 'current-token-hash',
            device: {
              browser: 'Safari 18',
              os: 'iOS 18',
              deviceType: 'Mobile'
            },
            createdAt: '2026-07-30T12:00:00.000Z',
            lastUsedAt: '2026-07-31T10:00:00.000Z',
            expiresAt: '2026-08-30T12:00:00.000Z'
          },
          {
            sessionId: 'expired-session-id-1',
            tokenHash: 'expired-token-hash',
            expiresAt: '2026-07-30T12:00:00.000Z'
          }
        ]
      }
    },
    'current-token-hash',
    now
  );

  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].current, true);
  assert.equal(sessions[1].current, false);
  assert.equal(sessions[1].device.browser, 'Firefox 128');
  assert.equal('tokenHash' in sessions[1], false);
  assert.equal('ipAddress' in sessions[1], false);
});

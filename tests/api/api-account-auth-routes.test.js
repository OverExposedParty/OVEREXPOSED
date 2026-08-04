const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  registerAccountAuthRoutes
} = require('../../server/routes/api-account-auth');
const {
  createAccountAuthRouteSupport
} = require('../../server/routes/api-account-auth/route-support');
const {
  registerAccountLibraryRoutes
} = require('../../server/routes/api-account-auth/library-routes');

test('registerAccountAuthRoutes preserves the account endpoint contract', () => {
  const registrations = [];
  const app = {};

  ['get', 'post', 'patch', 'delete'].forEach((method) => {
    app[method] = (path) => registrations.push([method, path]);
  });

  registerAccountAuthRoutes({ app });

  assert.deepEqual(registrations, [
    ['post', '/api/accounts'],
    ['get', '/api/accounts/verify-email'],
    ['post', '/api/accounts/verify-email/complete'],
    ['post', '/api/accounts/verify-email/request'],
    ['post', '/api/accounts/email-change/request'],
    ['post', '/api/accounts/email-change/complete'],
    ['post', '/api/accounts/password-reset/request'],
    ['post', '/api/accounts/password-reset/complete'],
    ['post', '/api/accounts/login'],
    ['get', '/api/accounts/me'],
    ['post', '/api/accounts/activity'],
    ['get', '/api/accounts/sessions'],
    ['delete', '/api/accounts/sessions/:sessionId'],
    ['post', '/api/accounts/sessions/logout-others'],
    ['patch', '/api/accounts/me/username'],
    ['patch', '/api/accounts/me/site-preferences'],
    ['post', '/api/accounts/me/achievement-events'],
    ['get', '/api/accounts/notifications'],
    ['patch', '/api/accounts/notifications'],
    ['get', '/api/accounts/friends/invite-session'],
    ['get', '/api/accounts/friends/active-party-lobby'],
    ['get', '/api/accounts/party-notifications'],
    ['patch', '/api/accounts/party-notifications'],
    ['post', '/api/accounts/friends/:accountId/invite'],
    ['get', '/api/accounts/friends/notifications'],
    ['patch', '/api/accounts/friends/notifications'],
    ['patch', '/api/accounts/friends/notifications/:accountId'],
    ['get', '/api/accounts/friends/search'],
    ['patch', '/api/accounts/friends/:accountId'],
    ['get', '/api/accounts/public/:accountId'],
    ['get', '/api/accounts/me/wallet'],
    ['get', '/api/accounts/me/notifications'],
    ['patch', '/api/accounts/me/notifications'],
    ['patch', '/api/accounts/me/customisation-preferences'],
    ['patch', '/api/accounts/me/privacy-settings'],
    ['patch', '/api/accounts/me/marketing-consent'],
    ['post', '/api/accounts/me/data-export-requests'],
    ['post', '/api/accounts/me/deletion-requests'],
    ['get', '/api/oe-library'],
    ['post', '/api/accounts/logout'],
    ['patch', '/api/accounts/me/oe-icon'],
    ['get', '/api/auth/:provider/start'],
    ['get', '/api/auth/:provider/callback'],
    ['post', '/api/auth/:provider/callback']
  ]);
});

test('guest invite session hashing prefers the party owner cookie', () => {
  const ownerToken = 'a'.repeat(64);
  const legacyToken = 'b'.repeat(64);
  const expectedHash = crypto
    .createHash('sha256')
    .update(ownerToken)
    .digest('hex');
  const support = createAccountAuthRouteSupport({
    crypto,
    getCookieValue(cookieHeader, name) {
      return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    }
  });

  assert.equal(
    support.getPartyGuestHashFromRequest({
      headers: {
        cookie: `oe_party_owner=${ownerToken}; oe_party_guest=${legacyToken}`
      }
    }),
    expectedHash
  );
});

test('guest invite session hashing supports the legacy guest cookie', () => {
  const guestToken = 'c'.repeat(64);
  const expectedHash = crypto
    .createHash('sha256')
    .update(guestToken)
    .digest('hex');
  const support = createAccountAuthRouteSupport({
    crypto,
    getCookieValue(cookieHeader, name) {
      return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    }
  });

  assert.equal(
    support.getPartyGuestHashFromRequest({
      headers: {
        cookie: `oe_party_guest=${guestToken}`
      }
    }),
    expectedHash
  );
});

test('waiting party hosts receive a direct settings return path', () => {
  const support = createAccountAuthRouteSupport({
    crypto,
    defaultOeIcon: 'default-icon',
    getCookieValue() {
      return '';
    }
  });
  const host = {
    identity: {
      computerId: 'host-device',
      accountId: 'account-one',
      username: 'Host'
    }
  };

  const session = support.createPartyGameInviteSession({
    name: 'party-game-truth-or-dare',
    room: {
      partyId: 'ABC-123',
      config: { gamemode: 'truth-or-dare' },
      players: [host],
      state: {
        hostComputerId: 'host-device',
        isPlaying: false,
        phase: 'lobby'
      }
    },
    viewer: host
  });

  assert.equal(session.lobbyPath, '/ABC-123');
  assert.equal(session.returnPath, '/truth-or-dare/settings?partyCode=ABC-123');
});

test('waiting party participants retain the shared waiting-room return path', () => {
  const support = createAccountAuthRouteSupport({
    crypto,
    defaultOeIcon: 'default-icon',
    getCookieValue() {
      return '';
    }
  });
  const host = { identity: { computerId: 'host-device' } };
  const participant = { identity: { computerId: 'player-device' } };

  const session = support.createPartyGameInviteSession({
    name: 'party-game-truth-or-dare',
    room: {
      partyId: 'ABC-123',
      config: { gamemode: 'truth-or-dare' },
      players: [host, participant],
      state: {
        hostComputerId: 'host-device',
        isPlaying: false,
        phase: 'lobby'
      }
    },
    viewer: participant
  });

  assert.equal(session.lobbyPath, '/ABC-123');
  assert.equal(session.returnPath, '/ABC-123');
});

test('logout preserves the persistent party owner cookie', async () => {
  const handlers = new Map();
  const app = {
    get(path, handler) {
      handlers.set(`get:${path}`, handler);
    },
    post(path, handler) {
      handlers.set(`post:${path}`, handler);
    },
    patch(path, handler) {
      handlers.set(`patch:${path}`, handler);
    }
  };
  const clearedCookies = [];

  registerAccountLibraryRoutes({
    app,
    Account: {
      async updateOne() {}
    },
    getCookieValue(cookieHeader, name) {
      return cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    },
    hashSessionToken: (token) => `hashed:${token}`
  });

  await handlers.get('post:/api/accounts/logout')(
    {
      headers: {
        cookie: `oe_session=session-token; oe_party_owner=${'d'.repeat(64)}`
      },
      secure: false
    },
    {
      clearCookie(name, options) {
        clearedCookies.push({ name, options });
      },
      apiSuccess() {}
    }
  );

  assert.deepEqual(clearedCookies, [
    {
      name: 'oe_session',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false
      }
    }
  ]);
});

test('account auth route support exposes the composed helper contract', () => {
  const support = createAccountAuthRouteSupport({
    crypto,
    getCookieValue() {
      return '';
    }
  });

  assert.deepEqual(Object.keys(support), [
    'escapeAccountRegex',
    'isProfileCompletionReady',
    'recordProfileCompletionAchievement',
    'getFriendRelationships',
    'findFriendRelationship',
    'getAcceptedFriendCount',
    'removeFriendRelationship',
    'setFriendRelationship',
    'populateFriendRelationships',
    'clearSessionInvite',
    'getPartyNotifications',
    'decorateInviteSession',
    'getPartyGuestHashFromRequest',
    'createPartyGameInviteSession',
    'getPartyGameInviteSessionByIdentity',
    'getAccountInviteSession',
    'getGuestInviteSession',
    'validateStoredInviteSession',
    'hasPublicProfileAccess',
    'getPublicProfileRelationship',
    'serializePublicAccountProfile',
    'handleOAuthCallback'
  ]);
});

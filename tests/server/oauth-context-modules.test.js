const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  createOAuthContext
} = require('../../server/routes/api-route-context/oauth');
const {
  createOAuthSessionTools
} = require('../../server/routes/api-route-context/oauth/sessions');

test('OAuth context composes its focused modules without changing its helper contract', () => {
  const oauth = createOAuthContext({
    crypto,
    fs: {},
    path: {},
    bcrypt: {},
    Account: {},
    Achievement: {},
    unlockAchievementByKey: async () => {},
    formatReportLabel: (value) => value,
    accountSaltRounds: 12,
    maxStoredAccountSessions: 10,
    clearExpiredAccountSessions: async () => {},
    createSessionToken: () => 'session-token',
    hashSessionToken: (value) => value,
    upgradeGuestPartyIdentityForAccount: async () => {}
  });

  assert.deepEqual(Object.keys(oauth).sort(), [
    'buildLoginRedirect',
    'buildSocialUsername',
    'createAppleClientSecret',
    'createOAuthState',
    'createPkcePair',
    'createSocialAccount',
    'decodeJwtPayload',
    'establishAccountSession',
    'fetchOAuthProfile',
    'fetchOAuthToken',
    'findOrCreateSocialAccount',
    'getAppleDisplayName',
    'getApplePrivateKey',
    'getOAuthCallbackUrl',
    'getOAuthMode',
    'getOAuthProviderConfig',
    'getRequestBaseUrl',
    'getSafeReturnToPath',
    'getSafeSplashScreenPath',
    'getSignupContext',
    'getSignupSourceFromPath',
    'getSupportedOAuthProvider',
    'linkOAuthProviderToAccount',
    'parseAppleUserPayload',
    'parseOAuthCookie',
    'parseOAuthState',
    'reserveSocialUsername',
    'serializeOAuthCookie'
  ]);

  const request = {
    protocol: 'https',
    get(name) {
      return name === 'host' ? 'overexposed.example' : null;
    }
  };
  const { stateId, payload } = oauth.createOAuthState({
    provider: 'google',
    mode: 'signup',
    returnTo: '/party-games',
    splashScreen: '/images/splash-screens/party-games.png',
    legalConsentAccepted: true
  });
  const parsedState = oauth.parseOAuthState(payload);

  assert.equal(
    oauth.getOAuthCallbackUrl(request, 'google'),
    'https://overexposed.example/api/auth/google/callback'
  );
  assert.equal(parsedState.stateId, stateId);
  assert.equal(parsedState.returnTo, '/party-games');
  assert.equal(parsedState.legalConsentAccepted, true);
  assert.equal(
    oauth.buildSocialUsername(
      { email: 'Social.User@Example.com', providerUserId: '123' },
      'google'
    ),
    'social.user'
  );
});

test('account sessions remain successful while returning an active-party advisory', async () => {
  const cookies = [];
  const updates = [];
  const activePartyConflict = {
    code: 'party_owner_active_party_exists',
    partyCode: 'OLD-123',
    lobbyPath: '/OLD-123'
  };
  const { establishAccountSession } = createOAuthSessionTools({
    crypto,
    Account: {
      async updateOne(filter, update, options) {
        updates.push({ filter, update, options });
      }
    },
    maxStoredAccountSessions: 10,
    clearExpiredAccountSessions: async () => {},
    createSessionToken: () => 'session-token',
    hashSessionToken: (value) => `hashed:${value}`,
    upgradeGuestPartyIdentityForAccount: async () => ({
      upgraded: false,
      conflict: true,
      activePartyConflict
    })
  });
  const account = {
    _id: 'account-one',
    profile: {},
    security: { sessions: [], loginHistory: [] }
  };

  const result = await establishAccountSession(
    {
      id: 'request-one',
      ip: '127.0.0.1',
      secure: false,
      get(name) {
        return name === 'user-agent' ? 'oauth-session-test' : null;
      }
    },
    {
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      }
    },
    account
  );

  assert.equal(updates.length, 1);
  assert.equal(cookies.length, 1);
  assert.equal(cookies[0].name, 'oe_session');
  assert.equal(cookies[0].value, 'session-token');
  assert.deepEqual(result, { activePartyConflict });
});

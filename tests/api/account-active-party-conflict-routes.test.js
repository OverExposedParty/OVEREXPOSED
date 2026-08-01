const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountRegistrationRoutes
} = require('../../server/routes/api-account-auth/registration-routes');
const {
  registerAccountSessionsRoutes
} = require('../../server/routes/api-account-auth/sessions-routes');
const {
  createOAuthCallbackSupport
} = require('../../server/routes/api-account-auth/oauth-callback-support');

const activePartyConflict = {
  code: 'party_owner_active_party_exists',
  partyCode: 'OLD-123',
  lobbyPath: '/OLD-123',
  gamemode: 'truth-or-dare'
};

function createRouteRecorder() {
  const handlers = new Map();
  const app = {};
  ['get', 'post', 'patch'].forEach((method) => {
    app[method] = (route, handler) => {
      handlers.set(`${method}:${route}`, handler);
    };
  });
  return { app, handlers };
}

test('email login returns an active-party advisory without failing authentication', async () => {
  const { app, handlers } = createRouteRecorder();
  const successes = [];
  const account = {
    _id: 'account-one',
    profile: { oeIcon: 'account-icon' }
  };
  let sessionEstablished = false;

  registerAccountSessionsRoutes({
    app,
    normalizeLoginInput: (body) => body,
    validateLoginInput: () => ({}),
    assertAuthThrottle: () => true,
    Account: {
      findOne() {
        return { select: async () => account };
      }
    },
    getAccountLockoutSeconds: () => 0,
    bcrypt: { compare: async () => true },
    getRequestedOeIcon: () => null,
    establishAccountSession: async () => {
      sessionEstablished = true;
      return { activePartyConflict };
    },
    serializeAccount: () => ({ id: 'account-one' })
  });

  await handlers.get('post:/api/accounts/login')(
    {
      body: { identifier: 'account@example.com', password: 'password' },
      id: 'login-request'
    },
    {
      apiSuccess(payload) {
        successes.push(payload);
      },
      apiError(payload) {
        assert.fail(`Unexpected login error: ${JSON.stringify(payload)}`);
      }
    }
  );

  assert.equal(sessionEstablished, true);
  assert.deepEqual(successes, [
    {
      message: 'Signed in successfully',
      account: { id: 'account-one' },
      activePartyConflict
    }
  ]);
});

test('account registration returns an active-party advisory with its 201 success', async () => {
  const { app, handlers } = createRouteRecorder();
  const successes = [];
  const account = {
    _id: 'account-one',
    email: 'account@example.com',
    profile: {}
  };

  registerAccountRegistrationRoutes({
    app,
    normalizeAccountInput: (body) => body,
    validateAccountInput: () => ({}),
    getSignupContext: () => null,
    assertAuthThrottle: () => true,
    bcrypt: { hash: async () => 'password-hash' },
    accountSaltRounds: 12,
    createEmailVerificationToken: () => 'verification-token',
    Account: { create: async () => account },
    normalizeOeIcon: () => null,
    hashEmailVerificationToken: () => 'verification-hash',
    createSignupLegalConsent: () => ({}),
    unlockAchievementByKey: async () => {},
    Achievement: {},
    upgradeGuestPartyIdentityForAccount: async () => ({
      upgraded: false,
      conflict: true,
      activePartyConflict
    }),
    sendVerificationEmail: async () => ({ skipped: false }),
    serializeAccount: () => ({ id: 'account-one' })
  });

  await handlers.get('post:/api/accounts')(
    {
      body: {
        username: 'account',
        email: 'account@example.com',
        password: 'password',
        confirmPassword: 'password'
      },
      id: 'registration-request',
      ip: '127.0.0.1'
    },
    {
      apiSuccess(payload, status) {
        successes.push({ payload, status });
      },
      apiError(payload) {
        assert.fail(
          `Unexpected registration error: ${JSON.stringify(payload)}`
        );
      }
    }
  );

  assert.deepEqual(successes, [
    {
      status: 201,
      payload: {
        message: 'Account created successfully. Check your email to verify it.',
        verificationEmailSent: true,
        account: { id: 'account-one' },
        activePartyConflict
      }
    }
  ]);
});

test('OAuth conflicts pass through sign-in with the intended panel destination', async () => {
  const redirectInputs = [];
  const redirects = [];
  const clearedCookies = [];
  const account = { _id: 'account-one' };
  const { handleOAuthCallback } = createOAuthCallbackSupport({
    getCookieValue(_header, name) {
      return name === 'oe_oauth_state' ? 'state-one' : 'oauth-context';
    },
    getSupportedOAuthProvider: () => 'google',
    parseOAuthState: () => ({
      provider: 'google',
      stateId: 'state-one',
      mode: 'sign-in',
      returnTo: '',
      splashScreen: '/images/splash-screens/party-games.png'
    }),
    parseOAuthCookie: () => ({ stateId: 'state-one', codeVerifier: null }),
    buildLoginRedirect(params) {
      redirectInputs.push(params);
      return '/sign-in?activePartyCode=OLD-123';
    },
    getSafeReturnToPath: (value) => value || '',
    getSafeSplashScreenPath: (value) => value,
    getOAuthProviderConfig: () => ({}),
    fetchOAuthToken: async () => ({}),
    fetchOAuthProfile: async () => ({ providerUserId: 'provider-user' }),
    getSignupContext: () => null,
    createSignupLegalConsent: () => null,
    getCurrentAccount: async () => null,
    linkOAuthProviderToAccount: async () => account,
    findOrCreateSocialAccount: async () => account,
    establishAccountSession: async () => ({ activePartyConflict }),
    serializeAccount: () => ({ canAccessOePanel: true })
  });

  await handleOAuthCallback(
    {
      method: 'GET',
      params: { provider: 'google' },
      query: { code: 'oauth-code', state: 'encoded-state' },
      headers: { cookie: 'oauth-cookies' },
      id: 'oauth-request'
    },
    {
      clearCookie(name) {
        clearedCookies.push(name);
      },
      redirect(location) {
        redirects.push(location);
      }
    }
  );

  assert.deepEqual(clearedCookies, ['oe_oauth_state', 'oe_oauth_context']);
  assert.deepEqual(redirectInputs, [
    {
      auth: 'success',
      provider: 'google',
      activePartyCode: 'OLD-123',
      activePartyGamemode: 'truth-or-dare',
      returnTo: '/oe-panel',
      splashScreen: '/images/splash-screens/party-games.png'
    }
  ]);
  assert.deepEqual(redirects, ['/sign-in?activePartyCode=OLD-123']);
});

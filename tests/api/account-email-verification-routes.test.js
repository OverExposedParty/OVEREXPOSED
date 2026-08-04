const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountRegistrationRoutes
} = require('../../server/routes/api-account-auth/registration-routes');

function createVerificationRouteContext(overrides = {}) {
  const handlers = new Map();
  const app = {
    get(path, handler) {
      handlers.set(`GET ${path}`, handler);
    },
    post(path, handler) {
      handlers.set(`POST ${path}`, handler);
    }
  };

  registerAccountRegistrationRoutes({
    app,
    hashEmailVerificationToken: (token) => `hashed:${token}`,
    ...overrides
  });

  return handlers;
}

test('legacy verification links open the confirmation page without consuming the token', async () => {
  const handlers = createVerificationRouteContext();
  let redirectUrl;

  await handlers.get('GET /api/accounts/verify-email')(
    {
      query: {
        token: 'verification token',
        emailTrackingId: 'tracking-id'
      }
    },
    {
      redirect(url) {
        redirectUrl = url;
      }
    }
  );

  assert.equal(
    redirectUrl,
    '/verify-email?token=verification+token&emailTrackingId=tracking-id'
  );
});

test('invalid verification submissions do not establish a session', async () => {
  let sessionEstablished = false;
  const handlers = createVerificationRouteContext({
    Account: {
      async findOneAndUpdate() {
        return null;
      }
    },
    establishAccountSession: async () => {
      sessionEstablished = true;
    }
  });
  let routeError;

  await handlers.get('POST /api/accounts/verify-email/complete')(
    {
      body: { token: 'expired-token' },
      id: 'invalid-verification'
    },
    {
      apiError(payload) {
        routeError = payload;
      }
    }
  );

  assert.equal(sessionEstablished, false);
  assert.equal(routeError.status, 400);
  assert.equal(routeError.code, 'invalid_email_verification_token');
  assert.equal(
    routeError.message,
    'This email confirmation link is invalid or has expired'
  );
});

test('valid verification activates the account and establishes a session', async () => {
  const account = {
    _id: 'account-one',
    profile: { accountStatus: 'active', emailVerified: true }
  };
  let accountQuery;
  let accountUpdate;
  let sessionAccount;
  let conversionInput;
  const achievementCalls = [];
  const handlers = createVerificationRouteContext({
    Account: {
      async findOneAndUpdate(query, update) {
        accountQuery = query;
        accountUpdate = update;
        return account;
      }
    },
    establishAccountSession: async (_req, _res, value) => {
      sessionAccount = value;
      return {};
    },
    recordEmailConversion: async (input) => {
      conversionInput = input;
    },
    EmailDelivery: { modelName: 'EmailDelivery' },
    recordProfileCompletionAchievement: async (_account, source) => {
      achievementCalls.push(source);
    },
    unlockAchievementByKey: async (input) => {
      achievementCalls.push(input.key);
    },
    Achievement: { modelName: 'Achievement' },
    serializeAccount: () => ({ id: 'account-one', emailVerified: true })
  });
  let successPayload;

  await handlers.get('POST /api/accounts/verify-email/complete')(
    {
      body: {
        token: 'valid-token',
        emailTrackingId: 'tracking-id'
      },
      id: 'valid-verification'
    },
    {
      apiSuccess(payload) {
        successPayload = payload;
      },
      apiError(payload) {
        assert.fail(
          `Unexpected verification error: ${JSON.stringify(payload)}`
        );
      }
    }
  );

  assert.equal(
    accountQuery['security.emailVerification.tokenHash'],
    'hashed:valid-token'
  );
  assert.equal(accountUpdate.$set['profile.emailVerified'], true);
  assert.equal(accountUpdate.$set['profile.accountStatus'], 'active');
  assert.equal(
    accountUpdate.$unset['security.emailVerification.tokenHash'],
    ''
  );
  assert.equal(sessionAccount, account);
  assert.deepEqual(conversionInput, {
    EmailDelivery: { modelName: 'EmailDelivery' },
    trackingId: 'tracking-id'
  });
  assert.deepEqual(achievementCalls, ['email-verified', 'verified']);
  assert.deepEqual(successPayload, {
    message: 'Email confirmed. You are signed in.',
    signedIn: true,
    account: { id: 'account-one', emailVerified: true }
  });
});

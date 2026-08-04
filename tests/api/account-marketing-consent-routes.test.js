const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerAccountControlsRoutes
} = require('../../server/routes/api-account-auth/controls-routes');

test('account marketing preference synchronizes consent and suppression state', async () => {
  const handlers = new Map();
  const app = {
    get(path, handler) {
      handlers.set(`GET ${path}`, handler);
    },
    post(path, handler) {
      handlers.set(`POST ${path}`, handler);
    },
    patch(path, handler) {
      handlers.set(`PATCH ${path}`, handler);
    }
  };
  const account = {
    _id: '507f1f77bcf86cd799439011',
    email: 'player@example.com',
    profile: {
      notificationPreferences: { marketingEmail: true }
    },
    legalConsent: {
      marketingConsentStatus: 'accepted',
      consentHistory: []
    },
    async save() {}
  };
  const createdSuppressions = [];
  const removedSuppressions = [];
  const EmailSuppression = {
    findOne() {
      return { lean: async () => null };
    },
    async create(value) {
      createdSuppressions.push(value);
    },
    async updateMany(filter, update) {
      removedSuppressions.push({ filter, update });
    }
  };
  registerAccountControlsRoutes({
    app,
    getCurrentAccount: async () => account,
    serializeAccount: (value) => ({
      marketingEmail: value.profile.notificationPreferences.marketingEmail,
      status: value.legalConsent.marketingConsentStatus
    }),
    EmailSuppression
  });
  const handler = handlers.get('PATCH /api/accounts/me/marketing-consent');

  const withdrawn = createApiResponseRecorder();
  await handler(createRequest(false), withdrawn.response);
  assert.equal(account.profile.notificationPreferences.marketingEmail, false);
  assert.equal(account.legalConsent.marketingConsentStatus, 'withdrawn');
  assert.equal(createdSuppressions.length, 1);
  assert.equal(createdSuppressions[0].reason, 'unsubscribed');
  assert.equal(withdrawn.payload.account.marketingEmail, false);

  const accepted = createApiResponseRecorder();
  await handler(createRequest(true), accepted.response);
  assert.equal(account.profile.notificationPreferences.marketingEmail, true);
  assert.equal(account.legalConsent.marketingConsentStatus, 'accepted');
  assert.equal(removedSuppressions.length, 1);
  assert.equal(removedSuppressions[0].filter.reason, 'unsubscribed');
  assert.equal(accepted.payload.account.marketingEmail, true);
});

function createRequest(accepted) {
  return {
    id: 'marketing-consent-test',
    body: { accepted },
    ip: '127.0.0.1',
    get: () => 'account-marketing-test'
  };
}

function createApiResponseRecorder() {
  const recorder = {
    payload: null,
    response: {
      apiSuccess(payload) {
        recorder.payload = payload;
      },
      apiError(payload) {
        throw new Error(payload.message);
      }
    }
  };
  return recorder;
}

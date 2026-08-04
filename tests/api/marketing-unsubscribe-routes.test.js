const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerMarketingUnsubscribeRoutes
} = require('../../server/routes/marketing-unsubscribe');
const {
  createMarketingUnsubscribeToken
} = require('../../server/services/marketing-consent');

test('unsubscribe requires confirmation and withdraws marketing consent', async () => {
  const previousSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  process.env.EMAIL_UNSUBSCRIBE_SECRET = 'route-test-secret';

  try {
    const handlers = new Map();
    const app = {
      get(path, handler) {
        handlers.set(`GET ${path}`, handler);
      },
      post(path, handler) {
        handlers.set(`POST ${path}`, handler);
      }
    };
    let saved = false;
    let suppression = null;
    const account = {
      _id: '507f1f77bcf86cd799439011',
      email: 'player@example.com',
      profile: { notificationPreferences: { marketingEmail: true } },
      legalConsent: {
        marketingConsentStatus: 'accepted',
        consentHistory: []
      },
      async save() {
        saved = true;
      }
    };
    const Account = {
      findOne() {
        return {
          select() {
            return Promise.resolve(account);
          }
        };
      }
    };
    const EmailSuppression = {
      findOne() {
        return { lean: async () => null };
      },
      async create(value) {
        suppression = value;
      }
    };
    registerMarketingUnsubscribeRoutes({ app, Account, EmailSuppression });

    const token = createMarketingUnsubscribeToken(account);
    const confirmation = createResponseRecorder();
    handlers.get('GET /unsubscribe')(
      { query: { token } },
      confirmation.response
    );
    assert.equal(confirmation.statusCode, 200);
    assert.match(confirmation.body, /method="post"/);

    const completion = createResponseRecorder();
    await handlers.get('POST /unsubscribe')(
      {
        id: 'unsubscribe-test',
        body: { token },
        ip: '127.0.0.1',
        get: () => 'unsubscribe-route-test'
      },
      completion.response
    );

    assert.equal(completion.statusCode, 200);
    assert.equal(saved, true);
    assert.equal(account.profile.notificationPreferences.marketingEmail, false);
    assert.equal(account.legalConsent.marketingConsentStatus, 'withdrawn');
    assert.equal(suppression.reason, 'unsubscribed');
    assert.match(completion.body, /YOU’RE UNSUBSCRIBED/);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    } else {
      process.env.EMAIL_UNSUBSCRIBE_SECRET = previousSecret;
    }
  }
});

function createResponseRecorder() {
  const recorder = {
    statusCode: null,
    body: '',
    response: {
      status(statusCode) {
        recorder.statusCode = statusCode;
        return this;
      },
      type() {
        return this;
      },
      send(body) {
        recorder.body = body;
        return this;
      }
    }
  };
  return recorder;
}

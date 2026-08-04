const assert = require('node:assert/strict');
const test = require('node:test');

const {
  registerProductAnalyticsRoutes
} = require('../../server/routes/api-product-analytics');

function createResponse() {
  return {
    result: null,
    apiSuccess(payload) {
      this.result = { type: 'success', payload };
      return this.result;
    },
    apiError(payload) {
      this.result = { type: 'error', payload };
      return this.result;
    }
  };
}

test('analytics ingestion stores consented events against the current account', async () => {
  let handler;
  let operations;
  registerProductAnalyticsRoutes({
    app: {
      post(path, nextHandler) {
        assert.equal(path, '/api/analytics/events');
        handler = nextHandler;
      }
    },
    assertAuthThrottle() {
      return true;
    },
    async getCurrentAccount() {
      return { _id: 'account-analytics-1' };
    },
    AnalyticsEvent: {
      async bulkWrite(nextOperations) {
        operations = nextOperations;
        return { upsertedCount: 1 };
      }
    }
  });
  const response = createResponse();

  await handler(
    {
      id: 'request-analytics-1',
      body: {
        consent: true,
        events: [
          {
            eventId: 'event_route_1234',
            eventName: 'notification.dismissed',
            anonymousId: 'anonymous-id',
            sessionId: 'session-id',
            properties: {
              notificationKey: 'create_account_prompt',
              reason: 'dismiss_button'
            }
          }
        ]
      }
    },
    response
  );

  assert.equal(response.result.type, 'success');
  assert.equal(response.result.payload.accepted, 1);
  assert.equal(
    operations[0].updateOne.update.$setOnInsert.accountId,
    'account-analytics-1'
  );
});

test('analytics ingestion ignores a batch without explicit consent', async () => {
  let handler;
  let accountLookups = 0;
  registerProductAnalyticsRoutes({
    app: {
      post(path, nextHandler) {
        handler = nextHandler;
      }
    },
    assertAuthThrottle() {
      return true;
    },
    async getCurrentAccount() {
      accountLookups += 1;
      return null;
    }
  });
  const response = createResponse();

  await handler({ body: { events: [] } }, response);

  assert.equal(response.result.payload.accepted, 0);
  assert.equal(accountLookups, 0);
});

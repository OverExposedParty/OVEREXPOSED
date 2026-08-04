const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getProductAnalyticsSummary,
  normalizeAnalyticsBatch,
  normalizeAnalyticsEvent,
  storeAnalyticsEvents
} = require('../../server/services/product-analytics');

test('product analytics normalizes allowlisted fields and hashes identifiers', () => {
  const receivedAt = new Date('2026-08-04T12:00:00.000Z');
  const event = normalizeAnalyticsEvent(
    {
      eventId: 'event_auth_12345',
      eventName: 'auth.completed',
      occurredAt: '2026-08-04T11:59:00.000Z',
      anonymousId: 'anonymous-browser-id',
      sessionId: 'browser-session-id',
      context: {
        pagePath: '/sign-in?token=must-not-be-stored',
        playMode: 'website',
        ignored: 'value'
      },
      properties: {
        flow: 'signup',
        provider: 'google',
        entryPoint: 'account_notification',
        outcome: 'success',
        email: 'person@example.com'
      }
    },
    { accountId: 'account-1', receivedAt }
  );

  assert.equal(event.eventName, 'auth.completed');
  assert.equal(event.accountId, 'account-1');
  assert.equal(event.context.pagePath, '/sign-in');
  assert.equal(event.context.ignored, undefined);
  assert.equal(event.properties.email, undefined);
  assert.equal(event.properties.entryPoint, 'account_notification');
  assert.equal(event.anonymousIdHash.length, 64);
  assert.equal(event.sessionIdHash.length, 64);
  assert.notEqual(event.anonymousIdHash, 'anonymous-browser-id');
  assert.equal(event.expiresAt.toISOString(), '2026-12-02T12:00:00.000Z');
});

test('product analytics rejects unknown events and caps batches', () => {
  assert.equal(
    normalizeAnalyticsEvent({
      eventId: 'event_unknown_1',
      eventName: 'account.password_entered'
    }),
    null
  );

  const events = Array.from({ length: 45 }, (_, index) => ({
    eventId: `event_batch_${String(index).padStart(3, '0')}`,
    eventName: 'notification.impression',
    properties: { notificationKey: 'account_prompt' }
  }));
  assert.equal(normalizeAnalyticsBatch(events).length, 40);
});

test('product analytics storage uses idempotent event upserts', async () => {
  let operations;
  const accepted = await storeAnalyticsEvents(
    {
      async bulkWrite(nextOperations, options) {
        operations = nextOperations;
        assert.deepEqual(options, { ordered: false });
        return { upsertedCount: 1 };
      }
    },
    [{ eventId: 'event_store_123', eventName: 'game.started' }]
  );

  assert.equal(accepted, 1);
  assert.equal(operations[0].updateOne.filter.eventId, 'event_store_123');
  assert.equal(operations[0].updateOne.upsert, true);
  assert.equal(
    operations[0].updateOne.update.$setOnInsert.eventName,
    'game.started'
  );
});

test('product analytics summary formats funnel and game engagement tables', async () => {
  const AnalyticsEvent = {
    aggregate(pipeline) {
      const serialized = JSON.stringify(pipeline);
      if (serialized.includes('notification.impression')) {
        return Promise.resolve([
          {
            _id: 'create_account_prompt',
            impressions: 20,
            dismissals: 5,
            actionClicks: 8,
            conversions: 4,
            autoExpired: 2,
            sessions: ['session-1', 'session-2', null]
          }
        ]);
      }
      if (serialized.includes('auth.attempted')) {
        return Promise.resolve([
          {
            _id: {
              flow: 'signup',
              entryPoint: 'account_notification',
              provider: 'email'
            },
            attempts: 8,
            completed: 4,
            failed: 2
          }
        ]);
      }
      if (
        serialized.includes('selectedPacks') &&
        serialized.includes('$unwind')
      ) {
        return Promise.resolve([
          {
            _id: { gameMode: 'truth-or-dare', packKey: 'classic' },
            starts: 6
          }
        ]);
      }
      if (serialized.includes('$objectToArray')) {
        return Promise.resolve([
          {
            _id: {
              gameMode: 'truth-or-dare',
              ruleKey: 'timer',
              value: '30'
            },
            starts: 5
          }
        ]);
      }
      if (serialized.includes('game.question_shown')) {
        return Promise.resolve([
          {
            _id: {
              gameMode: 'truth-or-dare',
              packKey: 'classic',
              questionId: 'classic:1'
            },
            views: 10,
            advances: 8,
            abandons: 2,
            averageDisplayedMs: 65000,
            averageActiveMs: 45000
          }
        ]);
      }
      return Promise.resolve([{ _id: 'truth-or-dare', starts: 10 }]);
    }
  };

  const summary = await getProductAnalyticsSummary(AnalyticsEvent, {
    since: new Date('2026-07-05T00:00:00.000Z')
  });

  assert.equal(summary.notifications[0].uniqueSessions, 2);
  assert.equal(summary.notifications[0].dismissRate, '25%');
  assert.equal(summary.notifications[0].conversionRate, '20%');
  assert.equal(summary.auth[0].completionRate, '50%');
  assert.equal(summary.packs[0].selectionRate, '60%');
  assert.equal(summary.rules[0].usageRate, '50%');
  assert.equal(summary.questions[0].averageDisplayed, '1m 5s');
  assert.equal(summary.questions[0].abandonRate, '20%');
});

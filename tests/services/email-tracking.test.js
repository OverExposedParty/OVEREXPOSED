const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  applyResendWebhookEvent,
  getEmailPerformance,
  verifyResendWebhookSignature
} = require('../../server/services/email-tracking');

test('Resend webhook signatures require the raw signed payload', () => {
  const secretBytes = Buffer.from('email-webhook-secret');
  const secret = `whsec_${secretBytes.toString('base64')}`;
  const eventId = 'webhook-event-1';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = '{"type":"email.delivered"}';
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(`${eventId}.${timestamp}.${payload}`)
    .digest('base64');
  const headers = {
    'svix-id': eventId,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`
  };

  assert.equal(
    verifyResendWebhookSignature({ payload, headers, secret }),
    true
  );
  assert.equal(
    verifyResendWebhookSignature({
      payload: `${payload} `,
      headers,
      secret
    }),
    false
  );
});

test('Resend delivery events update a tracked message idempotently', async () => {
  let query;
  let update;
  const EmailDelivery = {
    async updateOne(nextQuery, nextUpdate) {
      query = nextQuery;
      update = nextUpdate;
      return { matchedCount: 1, modifiedCount: 1 };
    }
  };

  const result = await applyResendWebhookEvent({
    EmailDelivery,
    eventId: 'event-delivered-1',
    event: {
      type: 'email.delivered',
      created_at: '2026-08-03T10:00:00.000Z',
      data: {
        email_id: 'provider-email-1',
        tags: { tracking_id: 'tracking-1' }
      }
    }
  });

  assert.equal(result.matched, true);
  assert.equal(query.trackingId, 'tracking-1');
  assert.deepEqual(query.providerEventIds, { $ne: 'event-delivered-1' });
  assert.equal(update.$set.status, 'delivered');
  assert.equal(update.$set.providerMessageId, 'provider-email-1');
  assert.equal(
    update.$set.deliveredAt.toISOString(),
    '2026-08-03T10:00:00.000Z'
  );
  assert.deepEqual(update.$addToSet, {
    providerEventIds: 'event-delivered-1'
  });
});

test('email performance calculates rates, trends, and failed sends', async () => {
  const deliveries = [
    {
      _id: 'delivery-1',
      recipient: 'one@example.com',
      createdAt: new Date('2026-08-03T09:00:00.000Z'),
      sentAt: new Date('2026-08-03T09:00:00.000Z'),
      deliveredAt: new Date('2026-08-03T09:01:00.000Z'),
      firstClickedAt: new Date('2026-08-03T09:02:00.000Z'),
      convertedAt: new Date('2026-08-03T09:03:00.000Z')
    },
    {
      _id: 'delivery-2',
      recipient: 'two@example.com',
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      sentAt: new Date('2026-08-03T10:00:00.000Z'),
      deliveredAt: new Date('2026-08-03T10:01:00.000Z')
    },
    {
      _id: 'delivery-3',
      recipient: 'failed@example.com',
      createdAt: new Date('2026-08-03T11:00:00.000Z'),
      sentAt: null,
      failedAt: new Date('2026-08-03T11:00:01.000Z'),
      failureReason: 'Provider rejected the request'
    }
  ];
  let query;
  const EmailDelivery = {
    find(nextQuery) {
      query = nextQuery;
      return {
        sort() {
          return this;
        },
        async lean() {
          return deliveries;
        }
      };
    }
  };

  const performance = await getEmailPerformance({
    EmailDelivery,
    now: new Date('2026-08-03T23:00:00.000Z')
  });

  assert.equal(query.isTest, false);
  assert.equal(performance.stats.sent.value, '2');
  assert.equal(performance.stats.deliveryRate.value, '100.0%');
  assert.equal(performance.stats.uniqueClickRate.value, '50.0%');
  assert.equal(performance.stats.conversionRate.value, '50.0%');
  assert.equal(performance.trends.series.sent.at(-1), 2);
  assert.equal(performance.failures[0].email, 'failed@example.com');
  assert.equal(performance.failures[0].status, 'Failed');
});

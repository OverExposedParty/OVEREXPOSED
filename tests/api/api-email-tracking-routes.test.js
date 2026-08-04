const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  registerEmailTrackingRoutes
} = require('../../server/routes/api-email-tracking');

test('Resend webhook verifies and applies provider delivery events', async () => {
  const previousSecret = process.env.RESEND_WEBHOOK_SECRET;
  const secretBytes = Buffer.from('route-webhook-secret');
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${secretBytes.toString('base64')}`;
  const handlers = new Map();
  const updates = [];
  registerEmailTrackingRoutes({
    app: {
      post(path, handler) {
        handlers.set(path, handler);
      }
    },
    EmailDelivery: {
      async updateOne(query, update) {
        updates.push({ query, update });
        return { matchedCount: 1, modifiedCount: 1 };
      }
    }
  });

  const eventId = 'webhook-route-event';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({
    type: 'email.delivered',
    created_at: '2026-08-03T12:00:00.000Z',
    data: {
      email_id: 'provider-message-1',
      tags: { tracking_id: 'tracking-1' }
    }
  });
  const signature = crypto
    .createHmac('sha256', secretBytes)
    .update(`${eventId}.${timestamp}.${rawBody}`)
    .digest('base64');
  let result;

  try {
    await handlers.get('/api/webhooks/resend')(
      {
        id: 'request-1',
        rawBody,
        headers: {
          'svix-id': eventId,
          'svix-timestamp': timestamp,
          'svix-signature': `v1,${signature}`
        }
      },
      {
        apiSuccess(payload) {
          result = payload;
        }
      }
    );
  } finally {
    if (previousSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = previousSecret;
  }

  assert.equal(updates.length, 1);
  assert.equal(updates[0].query.trackingId, 'tracking-1');
  assert.equal(updates[0].update.$set.status, 'delivered');
  assert.equal(result.data.matched, true);
});

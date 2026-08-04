const assert = require('node:assert/strict');
const test = require('node:test');

const EmailDelivery = require('../../models/emails/email-delivery-schema');

test('email deliveries use the dedicated tracking collection', () => {
  assert.equal(EmailDelivery.collection.name, 'email-deliveries');
  assert.deepEqual(EmailDelivery.TYPES, ['automation', 'campaign', 'test']);
  assert.ok(EmailDelivery.STATUSES.includes('delivered'));
  assert.ok(EmailDelivery.STATUSES.includes('bounced'));
});

test('email delivery schema normalizes recipients and protects tracking ids', () => {
  const delivery = new EmailDelivery({
    trackingId: 'tracking-1',
    recipient: ' MEMBER@Example.COM ',
    subject: 'Welcome'
  });

  assert.equal(delivery.recipient, 'member@example.com');
  assert.equal(delivery.validateSync(), undefined);

  const [, trackingIndex] = EmailDelivery.schema
    .indexes()
    .find(([fields]) => fields.trackingId === 1);
  assert.equal(trackingIndex.unique, true);
});

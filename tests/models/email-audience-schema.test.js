const assert = require('node:assert/strict');
const test = require('node:test');

const EmailAudience = require('../../models/emails/email-audience-schema');
const EmailSuppression = require('../../models/emails/email-suppression-schema');

test('email audiences use the email collection and supported audience modes', () => {
  assert.equal(EmailAudience.collection.name, 'email-audiences');
  assert.deepEqual(EmailAudience.TYPES, ['dynamic', 'static', 'manual']);
  assert.deepEqual(EmailAudience.STATUSES, ['active', 'inactive']);
  assert.deepEqual(EmailAudience.MATCH_MODES, ['all', 'any']);
});

test('email audience schema accepts validated filter conditions', () => {
  const audience = new EmailAudience({
    name: 'Verified Players',
    type: 'dynamic',
    conditions: [
      { field: 'emailVerified', operator: 'is', value: true },
      {
        field: 'accountStatus',
        operator: 'is',
        value: 'active'
      }
    ]
  });

  assert.equal(audience.validateSync(), undefined);
  assert.equal(audience.requireMarketingConsent, true);
});

test('email suppressions normalize addresses and enforce active uniqueness', () => {
  const suppression = new EmailSuppression({
    email: ' TEST@Example.COM ',
    reason: 'manual'
  });
  const [, options] = EmailSuppression.schema
    .indexes()
    .find(([fields]) => fields.email === 1);

  assert.equal(suppression.email, 'test@example.com');
  assert.equal(suppression.validateSync(), undefined);
  assert.equal(options.unique, true);
  assert.equal(options.name, 'email_suppression_active_email_unique');
});

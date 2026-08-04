const assert = require('node:assert/strict');
const test = require('node:test');

const EmailAutomation = require('../../models/emails/email-automation-schema');

test('email automations use the dedicated collection and supported triggers', () => {
  assert.equal(EmailAutomation.collection.name, 'email-automations');
  assert.deepEqual(EmailAutomation.TRIGGERS, [
    'email-verification',
    'password-reset-request',
    'email-address-change'
  ]);
  assert.deepEqual(EmailAutomation.STATUSES, ['active', 'inactive']);
});

test('email automation schema normalizes template keys', () => {
  const automation = new EmailAutomation({
    name: 'Password Reset',
    trigger: 'password-reset-request',
    templateKey: ' PASSWORD-RESET ',
    status: 'active'
  });

  assert.equal(automation.templateKey, 'password-reset');
  assert.equal(automation.validateSync(), undefined);
});

test('email automation triggers are unique for active records', () => {
  const [, options] = EmailAutomation.schema
    .indexes()
    .find(([fields]) => fields.trigger === 1);

  assert.equal(options.unique, true);
  assert.equal(options.name, 'email_automation_trigger_unique');
});

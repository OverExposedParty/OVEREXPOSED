const assert = require('node:assert/strict');
const test = require('node:test');

const EmailTemplate = require('../../models/emails/email-template-schema');

function createTemplate(overrides = {}) {
  return new EmailTemplate({
    name: 'Verification Email',
    subject: 'Confirm your email',
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: { text: 'EMAIL CONFIRMATION' }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: { text: 'OVEREXPOSED' }
      }
    ],
    ...overrides
  });
}

test('email templates use the dedicated email-templates collection', () => {
  assert.equal(EmailTemplate.collection.name, 'email-templates');
  assert.deepEqual(EmailTemplate.STATUSES, ['draft', 'published', 'archived']);
  assert.deepEqual(EmailTemplate.CATEGORIES, [
    'transactional',
    'marketing',
    'account-security',
    'onboarding',
    'party-social',
    'rewards-progress',
    'shop-orders',
    'product-updates',
    'events',
    're-engagement'
  ]);
  assert.deepEqual(EmailTemplate.AUTOMATION_TRIGGERS, [
    'email-verification',
    'password-reset-request',
    'email-address-change'
  ]);
  assert.ok(EmailTemplate.SECTION_TYPES.includes('socialLinks'));
});

test('email template schema accepts ordered unique section instances', () => {
  const template = createTemplate({
    key: 'verify-email',
    automationTriggers: ['email-verification']
  });

  assert.equal(template.validateSync(), undefined);
  assert.equal(template.version, undefined);
  assert.equal(template.publishedVersion, undefined);
  assert.equal(template.status, 'draft');
  assert.equal(template.theme.secondaryColour, '#427bb9');
  assert.deepEqual(template.automationTriggers, ['email-verification']);
});

test('email template schema rejects duplicate section IDs', () => {
  const template = createTemplate({
    sections: [
      { id: 'content', type: 'content', settings: {} },
      { id: 'content', type: 'footer', settings: {} }
    ]
  });

  assert.ok(template.validateSync()?.errors.sections);
});

test('email template keys have a unique partial index', () => {
  const [, options] = EmailTemplate.schema
    .indexes()
    .find(([fields]) => fields.key === 1);

  assert.equal(options.unique, true);
  assert.equal(options.name, 'email_template_key_unique');
  assert.deepEqual(options.partialFilterExpression, {
    key: { $type: 'string' }
  });
});

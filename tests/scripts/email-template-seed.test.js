const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createEmailAddressChangeTemplateSeed,
  createPasswordResetTemplateSeed,
  createVerificationTemplateSeed,
  seedEmailAddressChangeAutomation,
  seedEmailAddressChangeTemplate,
  seedPasswordResetAutomation,
  seedPasswordResetTemplate,
  seedVerificationAutomation,
  seedVerificationTemplate
} = require('../../scripts/lib/email-template-seed');

test('verification template seed compiles its editor source', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  const template = createVerificationTemplateSeed(now, 'https://example.com');

  assert.equal(template.key, 'verify-email');
  assert.equal(template.category, 'account-security');
  assert.deepEqual(template.automationTriggers, ['email-verification']);
  assert.equal(template.status, 'published');
  assert.equal(template.version, undefined);
  assert.equal(template.publishedVersion, undefined);
  assert.match(template.publishedSnapshot.html, /<!doctype html>/i);
  assert.match(template.publishedSnapshot.html, /\{\{VERIFY_URL\}\}/);
  assert.match(template.publishedSnapshot.html, /\{\{CONFIRM_IMAGE_URL\}\}/);
  assert.equal(template.sections.at(-1).type, 'footer');
  assert.equal(
    template.sections[0].settings.fontFamily,
    'OverExposed, Arial, sans-serif'
  );
  assert.equal(
    template.sections[0].settings.subheadingFontFamily,
    'LemonMilk, Arial, sans-serif'
  );
});

test('verification template import publishes the current stored editor source', async () => {
  let update;
  const existingTemplate = createVerificationTemplateSeed(
    new Date('2026-07-01T12:00:00.000Z'),
    'https://example.com'
  );
  existingTemplate.status = 'draft';
  existingTemplate.sections[0].settings.text = 'CURRENT EMAIL CONFIRMATION';
  const collection = {
    async findOne() {
      return existingTemplate;
    },
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { modifiedCount: 1 };
    }
  };

  const result = await seedVerificationTemplate(
    collection,
    new Date('2026-08-01T12:00:00.000Z'),
    { siteUrl: 'https://example.com' }
  );

  assert.equal(result.metadataUpdated, true);
  assert.deepEqual(update.filter, { key: 'verify-email' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$setOnInsert.key, 'verify-email');
  assert.equal(Object.hasOwn(update.operation.$setOnInsert, 'category'), false);
  assert.equal(update.operation.$set.category, 'account-security');
  assert.deepEqual(update.operation.$set.automationTriggers, [
    'email-verification'
  ]);
  assert.equal(update.operation.$set.status, 'published');
  assert.match(
    update.operation.$set.publishedSnapshot.html,
    /CURRENT EMAIL CONFIRMATION/
  );
  assert.match(
    update.operation.$set.publishedSnapshot.html,
    /\{\{VERIFY_URL\}\}/
  );
});

test('verification automation seed requires the published template', async () => {
  let update;
  const collection = {
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { upsertedCount: 1 };
    }
  };

  const result = await seedVerificationAutomation(
    collection,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.created, true);
  assert.deepEqual(update.filter, { trigger: 'email-verification' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$set.templateKey, 'verify-email');
  assert.equal(update.operation.$set.status, 'active');
  assert.equal(update.operation.$set.systemManaged, true);
});

test('email address change template seed publishes an automation-ready template', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  const template = createEmailAddressChangeTemplateSeed(now);

  assert.equal(template.key, 'email-address-change');
  assert.equal(template.category, 'account-security');
  assert.deepEqual(template.automationTriggers, ['email-address-change']);
  assert.equal(template.status, 'published');
  assert.match(template.publishedSnapshot.html, /\{\{CHANGE_EMAIL_URL\}\}/);
  assert.match(template.publishedSnapshot.text, /\{\{CHANGE_EMAIL_URL\}\}/);
  assert.equal(template.sections.at(-1).type, 'footer');
});

test('email address change template import is safe to rerun', async () => {
  let update;
  const collection = {
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { modifiedCount: 1 };
    }
  };

  const result = await seedEmailAddressChangeTemplate(
    collection,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.metadataUpdated, true);
  assert.deepEqual(update.filter, { key: 'email-address-change' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$setOnInsert.key, 'email-address-change');
  assert.equal(Object.hasOwn(update.operation.$setOnInsert, 'category'), false);
  assert.equal(update.operation.$set.category, 'account-security');
  assert.deepEqual(update.operation.$set.automationTriggers, [
    'email-address-change'
  ]);
  assert.equal(update.operation.$set.status, 'published');
  assert.match(update.operation.$set.publishedSnapshot.html, /CHANGE EMAIL/);
});

test('email address change automation seed points at the published template', async () => {
  let update;
  const collection = {
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { upsertedCount: 1 };
    }
  };

  const result = await seedEmailAddressChangeAutomation(
    collection,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.created, true);
  assert.deepEqual(update.filter, { trigger: 'email-address-change' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$setOnInsert.trigger, 'email-address-change');
  assert.equal(update.operation.$set.templateKey, 'email-address-change');
  assert.equal(update.operation.$set.status, 'active');
  assert.equal(update.operation.$set.systemManaged, true);
});

test('password reset template seed publishes an automation-ready template', () => {
  const now = new Date('2026-08-01T12:00:00.000Z');
  const template = createPasswordResetTemplateSeed(now);

  assert.equal(template.key, 'password-reset');
  assert.equal(template.category, 'account-security');
  assert.deepEqual(template.automationTriggers, ['password-reset-request']);
  assert.equal(template.status, 'published');
  assert.match(template.publishedSnapshot.html, /\{\{RESET_URL\}\}/);
  assert.match(template.publishedSnapshot.html, /\{\{RESET_IMAGE_URL\}\}/);
  assert.match(template.publishedSnapshot.text, /\{\{RESET_URL\}\}/);
  assert.match(template.publishedSnapshot.text, /expires in 1 hour/);
  assert.equal(template.sections.at(-1).type, 'footer');
});

test('password reset template import is safe to rerun', async () => {
  let update;
  const collection = {
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { modifiedCount: 1 };
    }
  };

  const result = await seedPasswordResetTemplate(
    collection,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.metadataUpdated, true);
  assert.deepEqual(update.filter, { key: 'password-reset' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$setOnInsert.key, 'password-reset');
  assert.equal(Object.hasOwn(update.operation.$setOnInsert, 'category'), false);
  assert.equal(update.operation.$set.category, 'account-security');
  assert.deepEqual(update.operation.$set.automationTriggers, [
    'password-reset-request'
  ]);
  assert.equal(update.operation.$set.status, 'published');
  assert.match(update.operation.$set.publishedSnapshot.html, /RESET PASSWORD/);
});

test('password reset automation seed points at the published template', async () => {
  let update;
  const collection = {
    async updateOne(filter, operation, options) {
      update = { filter, operation, options };
      return { upsertedCount: 1 };
    }
  };

  const result = await seedPasswordResetAutomation(
    collection,
    new Date('2026-08-01T12:00:00.000Z')
  );

  assert.equal(result.created, true);
  assert.deepEqual(update.filter, { trigger: 'password-reset-request' });
  assert.equal(update.options.upsert, true);
  assert.equal(update.operation.$setOnInsert.trigger, 'password-reset-request');
  assert.equal(update.operation.$set.templateKey, 'password-reset');
  assert.equal(update.operation.$set.status, 'active');
  assert.equal(update.operation.$set.systemManaged, true);
});

require('dotenv').config();

const mongoose = require('mongoose');

const {
  seedEmailAddressChangeAutomation,
  seedEmailAddressChangeTemplate,
  seedPasswordResetAutomation,
  seedPasswordResetTemplate,
  seedVerificationAutomation,
  seedVerificationTemplate
} = require('./lib/email-template-seed');

function getDatabaseUri(baseUri, dbName) {
  const parsedUri = new URL(baseUri);
  parsedUri.pathname = `/${dbName}`;
  return parsedUri.toString();
}

async function main() {
  const baseUri = process.env.MONGO_URI_OVEREXPOSURE;
  if (!process.env.MONGO_URI_EMAILS && !baseUri) {
    throw new Error('MONGO_URI_EMAILS or MONGO_URI_OVEREXPOSURE is required.');
  }

  const emailUri =
    process.env.MONGO_URI_EMAILS ||
    getDatabaseUri(baseUri, process.env.MONGO_DB_EMAILS || 'emails');
  const connection = await mongoose.createConnection(emailUri).asPromise();

  try {
    const collection = connection.collection('email-templates');
    const automationCollection = connection.collection('email-automations');
    const verificationResult = await seedVerificationTemplate(
      collection,
      new Date(),
      { siteUrl: process.env.PUBLIC_SITE_URL || process.env.SITE_URL }
    );
    const verificationAutomationResult =
      await seedVerificationAutomation(automationCollection);
    const emailChangeTemplateResult =
      await seedEmailAddressChangeTemplate(collection);
    const emailChangeAutomationResult =
      await seedEmailAddressChangeAutomation(automationCollection);
    const passwordResetTemplateResult =
      await seedPasswordResetTemplate(collection);
    const passwordResetAutomationResult =
      await seedPasswordResetAutomation(automationCollection);
    const storedTemplate = await collection.findOne(
      { key: 'verify-email' },
      {
        projection: {
          _id: 1,
          key: 1,
          category: 1,
          status: 1
        }
      }
    );
    if (!storedTemplate) {
      throw new Error('The verify-email record could not be read back.');
    }
    const storedVerificationAutomation = await automationCollection.findOne(
      { trigger: 'email-verification' },
      {
        projection: {
          _id: 1,
          trigger: 1,
          status: 1,
          templateKey: 1
        }
      }
    );
    if (!storedVerificationAutomation) {
      throw new Error(
        'The email-verification automation could not be read back.'
      );
    }
    const storedEmailChangeTemplate = await collection.findOne(
      { key: 'email-address-change' },
      {
        projection: {
          _id: 1,
          key: 1,
          category: 1,
          status: 1
        }
      }
    );
    if (!storedEmailChangeTemplate) {
      throw new Error(
        'The email-address-change record could not be read back.'
      );
    }
    const storedEmailChangeAutomation = await automationCollection.findOne(
      { trigger: 'email-address-change' },
      {
        projection: {
          _id: 1,
          trigger: 1,
          status: 1,
          templateKey: 1
        }
      }
    );
    if (!storedEmailChangeAutomation) {
      throw new Error(
        'The email-address-change automation could not be read back.'
      );
    }
    const storedPasswordResetTemplate = await collection.findOne(
      { key: 'password-reset' },
      {
        projection: {
          _id: 1,
          key: 1,
          category: 1,
          status: 1
        }
      }
    );
    if (!storedPasswordResetTemplate) {
      throw new Error('The password-reset record could not be read back.');
    }
    const storedPasswordResetAutomation = await automationCollection.findOne(
      { trigger: 'password-reset-request' },
      {
        projection: {
          _id: 1,
          trigger: 1,
          status: 1,
          templateKey: 1
        }
      }
    );
    if (!storedPasswordResetAutomation) {
      throw new Error(
        'The password-reset-request automation could not be read back.'
      );
    }
    console.log(
      verificationResult.created
        ? 'Imported the verification email into emails.email-templates.'
        : verificationResult.metadataUpdated
          ? 'Published the current verify-email template.'
          : 'The verify-email template metadata is already current.'
    );
    console.log(
      `Verified verify-email (${storedTemplate.category}, ${storedTemplate.status}).`
    );
    console.log(
      verificationAutomationResult.created
        ? 'Created the email verification automation.'
        : verificationAutomationResult.metadataUpdated
          ? 'Updated the email verification automation.'
          : 'The email verification automation is already current.'
    );
    console.log(
      `Verified email-verification automation (${storedVerificationAutomation.templateKey}, ${storedVerificationAutomation.status}).`
    );
    console.log(
      emailChangeTemplateResult.created
        ? 'Imported the email address change template into emails.email-templates.'
        : emailChangeTemplateResult.metadataUpdated
          ? 'Updated the email-address-change template.'
          : 'The email-address-change template is already current.'
    );
    console.log(
      `Verified email-address-change (${storedEmailChangeTemplate.category}, ${storedEmailChangeTemplate.status}).`
    );
    console.log(
      emailChangeAutomationResult.created
        ? 'Created the email address change automation.'
        : emailChangeAutomationResult.metadataUpdated
          ? 'Updated the email address change automation.'
          : 'The email address change automation is already current.'
    );
    console.log(
      `Verified email-address-change automation (${storedEmailChangeAutomation.templateKey}, ${storedEmailChangeAutomation.status}).`
    );
    console.log(
      passwordResetTemplateResult.created
        ? 'Imported the password reset template into emails.email-templates.'
        : passwordResetTemplateResult.metadataUpdated
          ? 'Updated the password-reset template.'
          : 'The password-reset template is already current.'
    );
    console.log(
      `Verified password-reset (${storedPasswordResetTemplate.category}, ${storedPasswordResetTemplate.status}).`
    );
    console.log(
      passwordResetAutomationResult.created
        ? 'Created the password reset automation.'
        : passwordResetAutomationResult.metadataUpdated
          ? 'Updated the password reset automation.'
          : 'The password reset automation is already current.'
    );
    console.log(
      `Verified password-reset-request automation (${storedPasswordResetAutomation.templateKey}, ${storedPasswordResetAutomation.status}).`
    );
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to seed email templates:', error);
  process.exitCode = 1;
});

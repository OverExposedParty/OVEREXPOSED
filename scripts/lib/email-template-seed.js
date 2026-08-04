const {
  compileEmailTemplate,
  normalizeEmailTemplateInput
} = require('../../server/services/email-templates');

function createEmailAddressChangeTemplateSeed(now = new Date()) {
  const normalized = normalizeEmailTemplateInput({
    key: 'email-address-change',
    name: 'Email Address Change',
    category: 'account-security',
    automationTriggers: ['email-address-change'],
    subject: 'Change your OVEREXPOSED email address',
    preheader:
      'Use this secure link to confirm your OVEREXPOSED email address change.',
    theme: {
      emailBackground: '#202020',
      contentBackground: '#2b2b2b',
      accentColour: '#66ccff',
      secondaryColour: '#427bb9',
      contentWidth: 560,
      borderRadius: 0
    },
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: {
          text: 'CHANGE EMAIL',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 28,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading:
            'You requested to change the email address on your OVEREXPOSED account.',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif'
        }
      },
      {
        id: 'hero',
        type: 'hero',
        settings: {
          src: '/images/emails/heroes/mascot/default.png',
          alt: 'Change your email address',
          link: '',
          visible: true
        }
      },
      {
        id: 'primaryAction',
        type: 'primaryAction',
        settings: {
          label: 'Change email address',
          href: '{{CHANGE_EMAIL_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#2b2b2b',
          alignment: 'center'
        }
      },
      {
        id: 'content',
        type: 'content',
        settings: {
          text: 'If the button does not work, paste this link into your browser:\n{{CHANGE_EMAIL_URL}}',
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          colour: '#427bb9',
          alignment: 'center'
        }
      },
      {
        id: 'divider',
        type: 'divider',
        settings: {
          colour: '#3a3a3a'
        }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'If you did not request this email change, you can ignore this email.',
          privacyLabel: 'Privacy Policy',
          privacyHref: '{{PRIVACY_URL}}',
          unsubscribeLabel: '',
          unsubscribeHref: '',
          fontSize: 12,
          colour: '#427bb9'
        }
      }
    ]
  });
  const compiled = compileEmailTemplate(normalized, {
    variables: {
      CHANGE_EMAIL_URL: '{{CHANGE_EMAIL_URL}}',
      ACTION_URL: '{{CHANGE_EMAIL_URL}}',
      PRIVACY_URL: '{{PRIVACY_URL}}',
      UNSUBSCRIBE_URL: '{{PRIVACY_URL}}'
    }
  });

  return {
    ...normalized,
    status: 'published',
    publishedSnapshot: {
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      compiledAt: now
    },
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      archivedAt: null
    }
  };
}

function createPasswordResetTemplateSeed(now = new Date()) {
  const normalized = normalizeEmailTemplateInput({
    key: 'password-reset',
    name: 'Password Reset',
    category: 'account-security',
    automationTriggers: ['password-reset-request'],
    subject: 'Reset your OVEREXPOSED password',
    preheader:
      'Use this secure link to choose a new password for your OVEREXPOSED account.',
    theme: {
      emailBackground: '#202020',
      contentBackground: '#2b2b2b',
      accentColour: '#66ccff',
      secondaryColour: '#427bb9',
      contentWidth: 560,
      borderRadius: 0
    },
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: {
          text: 'RESET PASSWORD',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 28,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading: 'Choose a new password for your OVEREXPOSED account.',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif'
        }
      },
      {
        id: 'hero',
        type: 'hero',
        settings: {
          src: '{{RESET_IMAGE_URL}}',
          alt: 'Reset your OVEREXPOSED password',
          link: '',
          visible: true
        }
      },
      {
        id: 'primaryAction',
        type: 'primaryAction',
        settings: {
          label: 'Reset password',
          href: '{{RESET_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#2b2b2b',
          alignment: 'center'
        }
      },
      {
        id: 'content',
        type: 'content',
        settings: {
          text: 'This secure link expires in 1 hour.\n\nIf the button does not work, paste this link into your browser:\n{{RESET_URL}}',
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          colour: '#427bb9',
          alignment: 'center'
        }
      },
      {
        id: 'divider',
        type: 'divider',
        settings: {
          colour: '#3a3a3a'
        }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'If you did not request a password reset, you can ignore this email.',
          privacyLabel: 'Privacy Policy',
          privacyHref: '{{PRIVACY_URL}}',
          unsubscribeLabel: '',
          unsubscribeHref: '',
          fontSize: 12,
          colour: '#427bb9'
        }
      }
    ]
  });
  const compiled = compileEmailTemplate(normalized, {
    variables: {
      RESET_URL: '{{RESET_URL}}',
      ACTION_URL: '{{RESET_URL}}',
      PRIVACY_URL: '{{PRIVACY_URL}}',
      UNSUBSCRIBE_URL: '{{PRIVACY_URL}}',
      RESET_IMAGE_URL: '{{RESET_IMAGE_URL}}'
    }
  });

  return {
    ...normalized,
    status: 'published',
    publishedSnapshot: {
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      compiledAt: now
    },
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      archivedAt: null
    }
  };
}

function createVerificationTemplateSeed(now = new Date(), siteUrl) {
  const normalized = normalizeEmailTemplateInput({
    key: 'verify-email',
    name: 'Email Confirmation',
    category: 'account-security',
    automationTriggers: ['email-verification'],
    subject: 'Confirm your OVEREXPOSED email',
    preheader:
      'Confirm your email to finish setting up your OVEREXPOSED account.',
    theme: {
      emailBackground: '#202020',
      contentBackground: '#2b2b2b',
      accentColour: '#66ccff',
      contentWidth: 560,
      borderRadius: 0
    },
    sections: [
      {
        id: 'heading',
        type: 'heading',
        settings: {
          text: 'EMAIL CONFIRMATION',
          fontFamily: 'OverExposed, Arial, sans-serif',
          fontSize: 28,
          colour: '#66ccff',
          alignment: 'center',
          showSubheading: true,
          subheading:
            'Welcome to OVEREXPOSED. Confirm your email to finish setting up your account.',
          subheadingFontFamily: 'LemonMilk, Arial, sans-serif'
        }
      },
      {
        id: 'hero',
        type: 'hero',
        settings: {
          src: '{{CONFIRM_IMAGE_URL}}',
          alt: 'Confirm your email',
          link: '',
          visible: true,
          borderRadius: 0
        }
      },
      {
        id: 'primaryAction',
        type: 'primaryAction',
        settings: {
          label: 'Confirm email',
          href: '{{VERIFY_URL}}',
          backgroundColour: '#66ccff',
          textColour: '#2b2b2b',
          borderRadius: 0,
          alignment: 'center'
        }
      },
      {
        id: 'content',
        type: 'content',
        settings: {
          text: 'If the button does not work, paste this link into your browser:\n{{VERIFY_URL}}',
          fontFamily: 'Arial, sans-serif',
          fontSize: 13,
          colour: '#427bb9',
          alignment: 'center'
        }
      },
      {
        id: 'divider',
        type: 'divider',
        settings: {
          colour: '#3a3a3a',
          thickness: 4,
          width: 100
        }
      },
      {
        id: 'footer',
        type: 'footer',
        settings: {
          text: 'If you did not create an OVEREXPOSED account, you can ignore this email.\nYou can manage or delete your account from your account settings after logging in.',
          privacyLabel: 'Privacy Policy',
          privacyHref: '{{PRIVACY_URL}}',
          unsubscribeLabel: '',
          unsubscribeHref: '',
          fontSize: 12,
          colour: '#427bb9'
        }
      }
    ]
  });
  const compiled = compileEmailTemplate(normalized, {
    siteUrl,
    variables: {
      VERIFY_URL: '{{VERIFY_URL}}',
      ACTION_URL: '{{VERIFY_URL}}',
      PRIVACY_URL: '{{PRIVACY_URL}}',
      UNSUBSCRIBE_URL: '{{PRIVACY_URL}}',
      CONFIRM_IMAGE_URL: '{{CONFIRM_IMAGE_URL}}'
    }
  });

  return {
    ...normalized,
    status: 'published',
    publishedSnapshot: {
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      compiledAt: now
    },
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      archivedAt: null
    }
  };
}

async function seedVerificationTemplate(
  collection,
  now = new Date(),
  { siteUrl } = {}
) {
  const template = createVerificationTemplateSeed(now, siteUrl);
  const existingTemplate = collection.findOne
    ? await collection.findOne({ key: template.key })
    : null;
  const publishSource = existingTemplate
    ? normalizeEmailTemplateInput({
        ...existingTemplate,
        category: template.category,
        automationTriggers: template.automationTriggers
      })
    : template;
  const compiled = compileEmailTemplate(publishSource, {
    siteUrl,
    variables: {
      VERIFY_URL: '{{VERIFY_URL}}',
      ACTION_URL: '{{VERIFY_URL}}',
      PRIVACY_URL: '{{PRIVACY_URL}}',
      UNSUBSCRIBE_URL: '{{PRIVACY_URL}}',
      CONFIRM_IMAGE_URL: '{{CONFIRM_IMAGE_URL}}'
    }
  });
  const publishedSnapshot = {
    subject: compiled.subject,
    html: compiled.html,
    text: compiled.text,
    compiledAt: now
  };
  const { category, automationTriggers, status, system } = template;
  const insertTemplate = { ...template };
  delete insertTemplate.category;
  delete insertTemplate.automationTriggers;
  delete insertTemplate.status;
  delete insertTemplate.publishedSnapshot;
  delete insertTemplate.system;
  const result = await collection.updateOne(
    { key: template.key },
    {
      $setOnInsert: {
        ...insertTemplate,
        'system.createdBy': system.createdBy,
        'system.createdAt': system.createdAt
      },
      $set: {
        category,
        automationTriggers,
        status,
        publishedSnapshot,
        'system.updatedBy': system.updatedBy,
        'system.updatedAt': now,
        'system.publishedAt': now,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    template: {
      ...publishSource,
      category,
      automationTriggers,
      status,
      publishedSnapshot
    }
  };
}

async function seedEmailAddressChangeTemplate(collection, now) {
  const template = createEmailAddressChangeTemplateSeed(now);
  const {
    category,
    automationTriggers,
    status,
    publishedSnapshot,
    system,
    ...insertTemplate
  } = template;
  const result = await collection.updateOne(
    { key: template.key },
    {
      $setOnInsert: {
        ...insertTemplate,
        'system.createdBy': system.createdBy,
        'system.updatedBy': system.updatedBy,
        'system.createdAt': system.createdAt
      },
      $set: {
        category,
        automationTriggers,
        status,
        publishedSnapshot,
        'system.publishedAt': template.system.publishedAt,
        'system.updatedAt': template.system.updatedAt,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    template
  };
}

async function seedPasswordResetTemplate(collection, now) {
  const template = createPasswordResetTemplateSeed(now);
  const {
    category,
    automationTriggers,
    status,
    publishedSnapshot,
    system,
    ...insertTemplate
  } = template;
  const result = await collection.updateOne(
    { key: template.key },
    {
      $setOnInsert: {
        ...insertTemplate,
        'system.createdBy': system.createdBy,
        'system.updatedBy': system.updatedBy,
        'system.createdAt': system.createdAt
      },
      $set: {
        category,
        automationTriggers,
        status,
        publishedSnapshot,
        'system.publishedAt': template.system.publishedAt,
        'system.updatedAt': template.system.updatedAt,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    template
  };
}

async function seedEmailAddressChangeAutomation(collection, now = new Date()) {
  const automation = {
    name: 'Email Address Change',
    trigger: 'email-address-change',
    templateKey: 'email-address-change',
    status: 'active',
    systemManaged: true,
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    }
  };
  const result = await collection.updateOne(
    { trigger: automation.trigger },
    {
      $setOnInsert: {
        trigger: automation.trigger,
        'system.createdBy': automation.system.createdBy,
        'system.updatedBy': automation.system.updatedBy,
        'system.createdAt': automation.system.createdAt
      },
      $set: {
        name: automation.name,
        templateKey: automation.templateKey,
        status: automation.status,
        systemManaged: true,
        'system.updatedAt': now,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    automation
  };
}

async function seedVerificationAutomation(collection, now = new Date()) {
  const automation = {
    name: 'Verify Email',
    trigger: 'email-verification',
    templateKey: 'verify-email',
    status: 'active',
    systemManaged: true,
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    }
  };
  const result = await collection.updateOne(
    { trigger: automation.trigger },
    {
      $setOnInsert: {
        trigger: automation.trigger,
        'system.createdBy': automation.system.createdBy,
        'system.createdAt': automation.system.createdAt
      },
      $set: {
        name: automation.name,
        templateKey: automation.templateKey,
        status: automation.status,
        systemManaged: true,
        'system.updatedBy': automation.system.updatedBy,
        'system.updatedAt': now,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    automation
  };
}

async function seedPasswordResetAutomation(collection, now = new Date()) {
  const automation = {
    name: 'Password Reset',
    trigger: 'password-reset-request',
    templateKey: 'password-reset',
    status: 'active',
    systemManaged: true,
    system: {
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    }
  };
  const result = await collection.updateOne(
    { trigger: automation.trigger },
    {
      $setOnInsert: {
        trigger: automation.trigger,
        'system.createdBy': automation.system.createdBy,
        'system.updatedBy': automation.system.updatedBy,
        'system.createdAt': automation.system.createdAt
      },
      $set: {
        name: automation.name,
        templateKey: automation.templateKey,
        status: automation.status,
        systemManaged: true,
        'system.updatedAt': now,
        'system.archivedAt': null
      }
    },
    { upsert: true }
  );

  return {
    created: Boolean(result.upsertedCount),
    metadataUpdated: Boolean(result.modifiedCount),
    automation
  };
}

module.exports = {
  createEmailAddressChangeTemplateSeed,
  createPasswordResetTemplateSeed,
  createVerificationTemplateSeed,
  seedEmailAddressChangeAutomation,
  seedEmailAddressChangeTemplate,
  seedPasswordResetAutomation,
  seedPasswordResetTemplate,
  seedVerificationAutomation,
  seedVerificationTemplate
};

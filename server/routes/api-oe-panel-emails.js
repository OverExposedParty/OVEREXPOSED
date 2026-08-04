const {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput,
  serializeEmailTemplate
} = require('../services/email-templates');
const { getPublicSiteUrl, sendEmail } = require('../services/email');
const { listEmailImages } = require('../services/email-image-library');
const { getEmailPerformance } = require('../services/email-tracking');
const {
  registerOePanelEmailAudienceRoutes
} = require('./api-oe-panel-email-audiences');

const TEST_SEND_COOLDOWN_MS = 30 * 1000;
const TEST_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_AUTOMATION_TRIGGER_LABELS = {
  'email-verification': 'Account registration and resend verification',
  'password-reset-request': 'Password reset request',
  'email-address-change': 'Email address change request'
};
const testSendCooldowns = new Map();

function formatEmailCategoryLabel(category) {
  return String(category || 'transactional')
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function normalizeEmailAutomationInput(body = {}) {
  return {
    name: String(body.name || '').trim(),
    trigger: String(body.trigger || '')
      .trim()
      .toLowerCase(),
    templateKey: String(body.templateKey || '')
      .trim()
      .toLowerCase(),
    status: String(body.status || 'active')
      .trim()
      .toLowerCase()
  };
}

function getEmailAutomationInputError(
  input,
  EmailAutomation,
  { allowVerification = false } = {}
) {
  if (!input.name || input.name.length > 160) {
    return {
      status: 400,
      code: 'email_automation_name_invalid',
      message: 'Enter an automation name of 160 characters or fewer'
    };
  }
  if (
    !EmailAutomation.TRIGGERS.includes(input.trigger) ||
    (!allowVerification && input.trigger === 'email-verification')
  ) {
    return {
      status: 400,
      code: 'email_automation_trigger_invalid',
      message: 'Choose an available automation trigger'
    };
  }
  if (!EmailAutomation.STATUSES.includes(input.status)) {
    return {
      status: 400,
      code: 'email_automation_status_invalid',
      message: 'Choose a valid automation status'
    };
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.templateKey)) {
    return {
      status: 400,
      code: 'email_automation_template_key_invalid',
      message: 'Choose a valid email template'
    };
  }
  return null;
}

function getCompatibleAutomationTemplateQuery(templateKey, trigger) {
  return {
    key: templateKey,
    status: 'published',
    'publishedSnapshot.html': { $type: 'string', $ne: '' },
    'system.archivedAt': null,
    automationTriggers: trigger
  };
}

function normalizeTestEmailRecipient(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isValidTestEmailRecipient(value) {
  return value.length <= 254 && TEST_EMAIL_PATTERN.test(value);
}

async function saveTestEmailRecipient(account, recipient) {
  if (account?.developmentBypass) return;
  if (typeof account?.set === 'function') {
    account.set('admin.emailTemplateTestRecipient', recipient);
  } else {
    account.admin ||= {};
    account.admin.emailTemplateTestRecipient = recipient;
  }
  if (typeof account?.save === 'function') {
    await account.save({ validateModifiedOnly: true });
  }
}

function serializeEmailAutomation(automation, template = null) {
  const source = automation?.toObject
    ? automation.toObject()
    : automation || {};
  const trigger = source.trigger || '';
  const templateKey = source.templateKey || '';
  return {
    id: source._id ? String(source._id) : `system-${trigger}`,
    name: source.name || 'Untitled Automation',
    trigger,
    triggerLabel: EMAIL_AUTOMATION_TRIGGER_LABELS[trigger] || trigger,
    templateKey,
    templateId: template?._id ? String(template._id) : '',
    templateName: template?.name || (templateKey ? templateKey : 'Missing'),
    templateStatus: template?.status || 'missing',
    status: source.status || 'inactive',
    systemManaged: Boolean(source.systemManaged),
    updatedAt: source.system?.updatedAt || template?.system?.updatedAt || null
  };
}

async function loadActiveEmailAutomations(EmailAutomation) {
  if (!EmailAutomation?.find) return [];
  return EmailAutomation.find({
    status: 'active',
    'system.archivedAt': null
  })
    .select('_id name trigger templateKey systemManaged')
    .lean();
}

function buildEmailTemplateUsage(activeAutomations = []) {
  const usageByTemplateKey = new Map();
  const addUsage = (templateKey, automation) => {
    if (!templateKey) return;
    const usage = usageByTemplateKey.get(templateKey) || [];
    usage.push({
      automationId: automation._id
        ? String(automation._id)
        : `system-${automation.trigger}`,
      name: automation.name || 'Untitled Automation',
      trigger: automation.trigger,
      triggerLabel:
        EMAIL_AUTOMATION_TRIGGER_LABELS[automation.trigger] ||
        automation.trigger,
      systemManaged: Boolean(automation.systemManaged)
    });
    usageByTemplateKey.set(templateKey, usage);
  };

  activeAutomations.forEach((automation) => {
    addUsage(automation.templateKey, automation);
  });
  return usageByTemplateKey;
}

function getAccountId(account) {
  return account?.developmentBypass ? null : account?._id || null;
}

function getTemplateUpdate(normalized, account) {
  const set = {
    name: normalized.name,
    category: normalized.category,
    automationTriggers: normalized.automationTriggers,
    subject: normalized.subject,
    preheader: normalized.preheader,
    theme: normalized.theme,
    sections: normalized.sections,
    'system.updatedBy': getAccountId(account),
    'system.updatedAt': new Date()
  };
  const update = { $set: set };
  if (normalized.key) set.key = normalized.key;
  else update.$unset = { key: '' };
  return update;
}

async function writeTemplateAdminLog(context, account, data) {
  if (!context.AdminLog || !context.createAdminLog) return;
  await context.createAdminLog(context.AdminLog, account, {
    area: 'Emails',
    severity: data.severity || 'medium',
    action: data.action,
    target: {
      type: data.targetType || 'email_template',
      id: String(data.template?._id || ''),
      label: data.template?.name || String(data.template?._id || '')
    },
    previousValue: data.previousValue || '-',
    newValue: data.newValue || '-',
    metadata: {
      collection: data.collection || 'email-templates',
      ...(data.metadata || {})
    }
  });
}

function respondWithRouteError(req, res, error, fallbackCode, fallbackMessage) {
  if (error instanceof EmailTemplateValidationError) {
    res.apiError({
      status: error.status,
      code: error.code,
      message: error.message
    });
    return;
  }
  if (error?.code === 11000) {
    res.apiError({
      status: 409,
      code: 'email_template_key_conflict',
      message: 'That email template key is already in use'
    });
    return;
  }
  if (error?.name === 'CastError') {
    res.apiError({
      status: 404,
      code: 'email_template_not_found',
      message: 'Email template not found'
    });
    return;
  }
  console.error(`[REQ ${req.id}] ${fallbackMessage}:`, error);
  res.apiError({
    status: 500,
    code: fallbackCode,
    message: fallbackMessage
  });
}

async function requireEmailPermission(context, req, res, permission) {
  const account = await context.requireOePanelAccount(req, res);
  if (!account) return null;
  if (!context.requireOePanelPermission(account, res, permission)) return null;
  return account;
}

function registerOePanelEmailRoutes(context) {
  const { app, EmailAutomation, EmailTemplate, EmailDelivery } = context;

  registerOePanelEmailAudienceRoutes(context);

  app.get('/api/oe-panel/emails/performance', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const performance = await (
        context.getEmailPerformance || getEmailPerformance
      )({ EmailDelivery });
      res.apiSuccess({ data: performance });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_performance_fetch_failed',
        'Failed to fetch email performance'
      );
    }
  });

  app.get('/api/oe-panel/emails/images', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const images = await (context.listEmailImages || listEmailImages)();
      res.apiSuccess({ data: { images } });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_images_fetch_failed',
        'Failed to fetch email images'
      );
    }
  });

  app.get('/api/oe-panel/emails/preferences', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      res.apiSuccess({
        data: {
          testEmailRecipient: account.admin?.emailTemplateTestRecipient || ''
        }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_preferences_fetch_failed',
        'Failed to fetch email preferences'
      );
    }
  });

  app.get('/api/oe-panel/emails/automations', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const [automationDocuments, templateDocuments] = await Promise.all([
        EmailAutomation?.find
          ? EmailAutomation.find({ 'system.archivedAt': null })
              .sort({ 'system.updatedAt': -1 })
              .lean()
          : [],
        EmailTemplate.find({ 'system.archivedAt': null })
          .select('_id key name status system.updatedAt')
          .lean()
      ]);
      const templatesByKey = new Map(
        templateDocuments
          .filter((template) => template.key)
          .map((template) => [template.key, template])
      );
      const automations = automationDocuments.map((automation) =>
        serializeEmailAutomation(
          automation,
          templatesByKey.get(automation.templateKey)
        )
      );
      res.apiSuccess({ data: { automations } });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_automations_fetch_failed',
        'Failed to fetch email automations'
      );
    }
  });

  app.get(
    '/api/oe-panel/emails/automation-template-options',
    async (req, res) => {
      try {
        const account = await requireEmailPermission(
          context,
          req,
          res,
          'emails.manage'
        );
        if (!account) return;
        const trigger = String(req.query?.trigger || '')
          .trim()
          .toLowerCase();
        const validTriggers =
          EmailTemplate.AUTOMATION_TRIGGERS || EmailAutomation.TRIGGERS;
        if (!validTriggers.includes(trigger)) {
          return res.apiError({
            status: 400,
            code: 'email_automation_trigger_invalid',
            message: 'Choose a valid automation trigger'
          });
        }
        const templates = await EmailTemplate.find({
          ...getCompatibleAutomationTemplateQuery({ $type: 'string' }, trigger)
        })
          .select('_id key name category')
          .sort({ name: 1 })
          .limit(100)
          .lean();
        res.apiSuccess({
          data: {
            options: templates.map((template) => ({
              label: `${template.name} (${formatEmailCategoryLabel(template.category)})`,
              value: template.key,
              templateId: String(template._id),
              category: template.category || 'transactional'
            }))
          }
        });
      } catch (error) {
        respondWithRouteError(
          req,
          res,
          error,
          'email_automation_template_options_fetch_failed',
          'Failed to fetch compatible email templates'
        );
      }
    }
  );

  app.post('/api/oe-panel/emails/automations', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const input = normalizeEmailAutomationInput(req.body);
      const validationError = getEmailAutomationInputError(
        input,
        EmailAutomation
      );
      if (validationError) return res.apiError(validationError);
      const { name, trigger, templateKey, status } = input;
      const template = await EmailTemplate.findOne(
        getCompatibleAutomationTemplateQuery(templateKey, trigger)
      ).lean();
      if (!template) {
        return res.apiError({
          status: 400,
          code: 'email_automation_template_incompatible',
          message: 'Choose a published template available for this trigger'
        });
      }
      const automation = await EmailAutomation.create({
        name,
        trigger,
        templateKey,
        status,
        systemManaged: false,
        system: {
          createdBy: getAccountId(account),
          updatedBy: getAccountId(account),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      await writeTemplateAdminLog(context, account, {
        action: 'Created email automation',
        template: { _id: automation._id, name: automation.name },
        targetType: 'email_automation',
        collection: 'email-automations',
        newValue: { trigger, templateKey, status }
      });
      res.apiSuccess(
        {
          data: {
            automation: serializeEmailAutomation(automation, template)
          }
        },
        201
      );
    } catch (error) {
      if (error?.code === 11000) {
        return res.apiError({
          status: 409,
          code: 'email_automation_trigger_conflict',
          message: 'That trigger already has an automation'
        });
      }
      respondWithRouteError(
        req,
        res,
        error,
        'email_automation_create_failed',
        'Failed to create email automation'
      );
    }
  });

  app.patch('/api/oe-panel/emails/automations/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const automationId = String(req.params.id || '').trim();
      const isBuiltInVerification =
        automationId === 'system-email-verification';
      const input = normalizeEmailAutomationInput(req.body);
      const automationQuery = isBuiltInVerification
        ? { trigger: 'email-verification', 'system.archivedAt': null }
        : { _id: automationId, 'system.archivedAt': null };
      const current = EmailAutomation.findOne
        ? await EmailAutomation.findOne(automationQuery).lean()
        : null;
      if (!current && !isBuiltInVerification) {
        return res.apiError({
          status: 404,
          code: 'email_automation_not_found',
          message: 'Email automation not found'
        });
      }
      const isManagedVerification = Boolean(
        current?.systemManaged && current.trigger === 'email-verification'
      );
      const validationError = getEmailAutomationInputError(
        input,
        EmailAutomation,
        {
          allowVerification: isBuiltInVerification || isManagedVerification
        }
      );
      if (validationError) return res.apiError(validationError);
      if (
        (isBuiltInVerification || isManagedVerification) &&
        input.trigger !== 'email-verification'
      ) {
        return res.apiError({
          status: 400,
          code: 'email_automation_system_trigger_locked',
          message: 'The Verify Email trigger cannot be changed'
        });
      }
      if (current?.systemManaged && input.trigger !== current.trigger) {
        return res.apiError({
          status: 400,
          code: 'email_automation_system_trigger_locked',
          message: 'System-managed automation triggers cannot be changed'
        });
      }

      const template = await EmailTemplate.findOne(
        getCompatibleAutomationTemplateQuery(input.templateKey, input.trigger)
      ).lean();
      if (!template) {
        return res.apiError({
          status: 400,
          code: 'email_automation_template_incompatible',
          message: 'Choose a published template available for this trigger'
        });
      }

      const now = new Date();
      const update = {
        $set: {
          name: input.name,
          trigger: input.trigger,
          templateKey: input.templateKey,
          status: input.status,
          systemManaged: Boolean(
            current?.systemManaged || isBuiltInVerification
          ),
          'system.updatedBy': getAccountId(account),
          'system.updatedAt': now,
          'system.archivedAt': null
        }
      };
      if (isBuiltInVerification && !current) {
        update.$setOnInsert = {
          'system.createdBy': getAccountId(account),
          'system.createdAt': now
        };
      }
      const automation = await EmailAutomation.findOneAndUpdate(
        automationQuery,
        update,
        {
          new: true,
          runValidators: true,
          upsert: isBuiltInVerification && !current
        }
      );
      if (!automation) {
        return res.apiError({
          status: 404,
          code: 'email_automation_not_found',
          message: 'Email automation not found'
        });
      }

      await writeTemplateAdminLog(context, account, {
        action: 'Edited email automation',
        template: { _id: automation._id, name: automation.name },
        targetType: 'email_automation',
        collection: 'email-automations',
        previousValue: current
          ? {
              name: current.name,
              trigger: current.trigger,
              templateKey: current.templateKey,
              status: current.status
            }
          : 'Built-in verification automation',
        newValue: input
      });
      res.apiSuccess({
        data: {
          automation: serializeEmailAutomation(automation, template)
        }
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.apiError({
          status: 409,
          code: 'email_automation_trigger_conflict',
          message: 'That trigger already has an automation'
        });
      }
      respondWithRouteError(
        req,
        res,
        error,
        'email_automation_update_failed',
        'Failed to update email automation'
      );
    }
  });

  app.delete('/api/oe-panel/emails/automations/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const automationId = String(req.params.id || '').trim();
      if (automationId === 'system-email-verification') {
        return res.apiError({
          status: 400,
          code: 'email_automation_system_delete_forbidden',
          message: 'The system Verify Email automation cannot be deleted'
        });
      }

      const current = await EmailAutomation.findOne({
        _id: automationId,
        'system.archivedAt': null
      }).lean();
      if (!current) {
        return res.apiError({
          status: 404,
          code: 'email_automation_not_found',
          message: 'Email automation not found'
        });
      }
      if (current.systemManaged) {
        return res.apiError({
          status: 400,
          code: 'email_automation_system_delete_forbidden',
          message: 'System-managed automations cannot be deleted'
        });
      }

      const now = new Date();
      const automation = await EmailAutomation.findOneAndUpdate(
        { _id: automationId, 'system.archivedAt': null },
        {
          $set: {
            status: 'inactive',
            'system.archivedAt': now,
            'system.updatedAt': now,
            'system.updatedBy': getAccountId(account)
          }
        },
        { new: true }
      );
      if (!automation) {
        return res.apiError({
          status: 404,
          code: 'email_automation_not_found',
          message: 'Email automation not found'
        });
      }

      await writeTemplateAdminLog(context, account, {
        action: 'Deleted email automation',
        template: { _id: automation._id, name: automation.name },
        targetType: 'email_automation',
        collection: 'email-automations',
        severity: 'high',
        previousValue: {
          trigger: current.trigger,
          templateKey: current.templateKey,
          status: current.status
        },
        newValue: { status: 'inactive', archivedAt: now }
      });
      res.apiSuccess({
        data: { deleted: true, id: String(automation._id) }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_automation_delete_failed',
        'Failed to delete email automation'
      );
    }
  });

  app.get('/api/oe-panel/emails/templates', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const query = { 'system.archivedAt': null };
      const status = String(req.query?.status || '')
        .trim()
        .toLowerCase();
      if (EmailTemplate.STATUSES.includes(status) && status !== 'archived') {
        query.status = status;
      }
      const [templates, activeAutomations] = await Promise.all([
        EmailTemplate.find(query)
          .sort({ 'system.updatedAt': -1 })
          .limit(250)
          .lean(),
        loadActiveEmailAutomations(EmailAutomation)
      ]);
      const usageByTemplateKey = buildEmailTemplateUsage(activeAutomations);
      res.apiSuccess({
        data: {
          templates: templates.map((template) => ({
            ...serializeEmailTemplate(template, { includeContent: false }),
            activeUses: usageByTemplateKey.get(template.key) || []
          }))
        }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_templates_fetch_failed',
        'Failed to fetch email templates'
      );
    }
  });

  app.post('/api/oe-panel/emails/templates', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const normalized = normalizeEmailTemplateInput(req.body);
      const template = await EmailTemplate.create({
        ...normalized,
        status: 'draft',
        system: {
          createdBy: getAccountId(account),
          updatedBy: getAccountId(account),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      await writeTemplateAdminLog(context, account, {
        action: 'Created email template',
        template,
        newValue: { name: template.name, status: template.status }
      });
      res.apiSuccess(
        { data: { template: serializeEmailTemplate(template) } },
        201
      );
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_create_failed',
        'Failed to create email template'
      );
    }
  });

  app.get('/api/oe-panel/emails/templates/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const template = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      res.apiSuccess({
        data: { template: serializeEmailTemplate(template) }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_fetch_failed',
        'Failed to fetch email template'
      );
    }
  });

  app.patch('/api/oe-panel/emails/templates/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const normalized = normalizeEmailTemplateInput(req.body);
      const current = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!current) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const template = await EmailTemplate.findOneAndUpdate(
        { _id: req.params.id, 'system.archivedAt': null },
        getTemplateUpdate(normalized, account),
        { new: true, runValidators: true }
      );
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      await writeTemplateAdminLog(context, account, {
        action: 'Edited email template',
        template,
        previousValue: { name: current.name, status: current.status },
        newValue: { name: template.name, status: template.status }
      });
      res.apiSuccess({
        data: { template: serializeEmailTemplate(template) }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_update_failed',
        'Failed to update email template'
      );
    }
  });

  app.post('/api/oe-panel/emails/templates/:id/duplicate', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const source = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!source) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const template = await EmailTemplate.create({
        name: `${source.name} Copy`.slice(0, 160),
        category: source.category,
        automationTriggers: source.automationTriggers || [],
        status: 'draft',
        subject: source.subject,
        preheader: source.preheader,
        theme: source.theme,
        sections: source.sections,
        system: {
          createdBy: getAccountId(account),
          updatedBy: getAccountId(account),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      await writeTemplateAdminLog(context, account, {
        action: 'Duplicated email template',
        template,
        newValue: { duplicatedFrom: String(source._id) }
      });
      res.apiSuccess(
        { data: { template: serializeEmailTemplate(template) } },
        201
      );
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_duplicate_failed',
        'Failed to duplicate email template'
      );
    }
  });

  app.post('/api/oe-panel/emails/templates/:id/publish', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.publish'
      );
      if (!account) return;
      const template = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      });
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const compiled = compileEmailTemplate(template.toObject(), {
        siteUrl: getPublicSiteUrl(req)
      });
      template.status = 'published';
      template.publishedSnapshot = {
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        compiledAt: new Date()
      };
      template.system.updatedBy = getAccountId(account);
      template.system.publishedAt = new Date();
      await template.save();
      await writeTemplateAdminLog(context, account, {
        action: 'Published email template',
        template,
        severity: 'high',
        newValue: {
          status: template.status,
          publishedAt: template.system.publishedAt
        }
      });
      res.apiSuccess({
        data: { template: serializeEmailTemplate(template) }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_publish_failed',
        'Failed to publish email template'
      );
    }
  });

  app.post('/api/oe-panel/emails/templates/:id/preview', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const template = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const compiled = compileEmailTemplate(template, {
        siteUrl: getPublicSiteUrl(req),
        variables: {
          ACTION_URL: `${getPublicSiteUrl(req)}/`,
          VERIFY_URL: `${getPublicSiteUrl(req)}/verify-email?token=preview`,
          UNSUBSCRIBE_URL: `${getPublicSiteUrl(req)}/terms-and-privacy`
        }
      });
      res.apiSuccess({
        data: {
          preview: {
            subject: compiled.subject,
            html: compiled.html,
            text: compiled.text
          }
        }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_preview_failed',
        'Failed to preview email template'
      );
    }
  });

  app.post('/api/oe-panel/emails/templates/:id/test-send', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.send-test'
      );
      if (!account) return;
      const recipient = normalizeTestEmailRecipient(req.body?.recipient);
      if (!isValidTestEmailRecipient(recipient)) {
        return res.apiError({
          status: 400,
          code: 'email_template_test_recipient_invalid',
          message: 'Enter a valid test email address'
        });
      }
      const cooldownKey = String(account._id || recipient);
      const lastSentAt = Number(testSendCooldowns.get(cooldownKey) || 0);
      if (Date.now() - lastSentAt < TEST_SEND_COOLDOWN_MS) {
        return res.apiError({
          status: 429,
          code: 'email_template_test_rate_limited',
          message: 'Wait 30 seconds before sending another test email'
        });
      }
      const template = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const siteUrl = getPublicSiteUrl(req);
      const compiled = compileEmailTemplate(template, {
        siteUrl,
        variables: {
          ACTION_URL: siteUrl,
          VERIFY_URL: `${siteUrl}/verify-email?token=test-email`,
          UNSUBSCRIBE_URL: `${siteUrl}/terms-and-privacy`
        }
      });
      const result = await (context.sendEmail || sendEmail)({
        to: recipient,
        subject: `[TEST] ${compiled.subject}`,
        html: compiled.html,
        text: compiled.text,
        EmailDelivery,
        tracking: {
          type: 'test',
          templateKey: template.key,
          isTest: true
        }
      });
      await saveTestEmailRecipient(account, recipient);
      testSendCooldowns.set(cooldownKey, Date.now());
      await writeTemplateAdminLog(context, account, {
        action: 'Sent email template test',
        template,
        newValue: { recipient, skipped: Boolean(result?.skipped) }
      });
      res.apiSuccess({
        data: { recipient, skipped: Boolean(result?.skipped) }
      });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_test_send_failed',
        'Failed to send test email'
      );
    }
  });

  app.delete('/api/oe-panel/emails/templates/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(
        context,
        req,
        res,
        'emails.manage'
      );
      if (!account) return;
      const current = await EmailTemplate.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!current) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      const usageByTemplateKey = buildEmailTemplateUsage(
        await loadActiveEmailAutomations(EmailAutomation)
      );
      const activeUses = usageByTemplateKey.get(current.key) || [];
      if (activeUses.length) {
        const usageLabels = activeUses.map(
          (usage) => `${usage.name} (${usage.triggerLabel})`
        );
        return res.apiError({
          status: 409,
          code: 'email_template_in_use',
          message: `This template is in use by ${usageLabels.join(', ')}`,
          details: { activeUses }
        });
      }
      const template = await EmailTemplate.findOneAndUpdate(
        { _id: req.params.id, 'system.archivedAt': null },
        {
          $set: {
            status: 'archived',
            'system.archivedAt': new Date(),
            'system.updatedAt': new Date(),
            'system.updatedBy': getAccountId(account)
          }
        },
        { new: true }
      );
      if (!template) {
        return res.apiError({
          status: 404,
          code: 'email_template_not_found',
          message: 'Email template not found'
        });
      }
      await writeTemplateAdminLog(context, account, {
        action: 'Deleted email template',
        template,
        severity: 'high',
        newValue: { status: 'archived' }
      });
      res.apiSuccess({ data: { deleted: true, id: String(template._id) } });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_delete_failed',
        'Failed to delete email template'
      );
    }
  });
}

module.exports = { registerOePanelEmailRoutes };

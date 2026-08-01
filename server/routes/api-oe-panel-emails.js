const {
  EmailTemplateValidationError,
  compileEmailTemplate,
  normalizeEmailTemplateInput,
  serializeEmailTemplate
} = require('../services/email-templates');
const { getPublicSiteUrl, sendEmail } = require('../services/email');

const TEST_SEND_COOLDOWN_MS = 30 * 1000;
const testSendCooldowns = new Map();

function getAccountId(account) {
  return account?.developmentBypass ? null : account?._id || null;
}

function getTemplateUpdate(normalized, account) {
  const set = {
    name: normalized.name,
    category: normalized.category,
    subject: normalized.subject,
    preheader: normalized.preheader,
    theme: normalized.theme,
    sections: normalized.sections,
    status: 'draft',
    'system.updatedBy': getAccountId(account),
    'system.updatedAt': new Date()
  };
  const update = { $set: set, $inc: { version: 1 } };
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
      type: 'email_template',
      id: String(data.template?._id || ''),
      label: data.template?.name || String(data.template?._id || '')
    },
    previousValue: data.previousValue || '-',
    newValue: data.newValue || '-',
    metadata: {
      collection: 'email-templates',
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
  const { app, EmailTemplate } = context;

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
      const templates = await EmailTemplate.find(query)
        .sort({ 'system.updatedAt': -1 })
        .limit(250)
        .lean();
      res.apiSuccess({
        data: {
          templates: templates.map((template) =>
            serializeEmailTemplate(template, { includeContent: false })
          )
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
        version: 1,
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
      const expectedVersion = Number(req.body.version);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return res.apiError({
          status: 400,
          code: 'email_template_version_required',
          message: 'A valid template version is required'
        });
      }
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
      if (Number(current.version) !== expectedVersion) {
        return res.apiError({
          status: 409,
          code: 'email_template_version_conflict',
          message:
            'This template was changed elsewhere. Reload it before saving.',
          details: { currentVersion: current.version }
        });
      }
      const template = await EmailTemplate.findOneAndUpdate(
        { _id: req.params.id, version: expectedVersion },
        getTemplateUpdate(normalized, account),
        { new: true, runValidators: true }
      );
      if (!template) {
        return res.apiError({
          status: 409,
          code: 'email_template_version_conflict',
          message:
            'This template was changed elsewhere. Reload it before saving.'
        });
      }
      await writeTemplateAdminLog(context, account, {
        action: 'Edited email template',
        template,
        previousValue: { version: current.version, status: current.status },
        newValue: { version: template.version, status: template.status }
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
        status: 'draft',
        subject: source.subject,
        preheader: source.preheader,
        theme: source.theme,
        sections: source.sections,
        version: 1,
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
      const expectedVersion = Number(req.body?.version);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
        return res.apiError({
          status: 400,
          code: 'email_template_version_required',
          message: 'A valid template version is required'
        });
      }
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
      if (Number(template.version) !== expectedVersion) {
        return res.apiError({
          status: 409,
          code: 'email_template_version_conflict',
          message:
            'This template was changed elsewhere. Reload it before publishing.',
          details: { currentVersion: template.version }
        });
      }
      const compiled = compileEmailTemplate(template.toObject(), {
        siteUrl: getPublicSiteUrl(req)
      });
      template.status = 'published';
      template.publishedVersion = template.version;
      template.publishedSnapshot = {
        version: template.version,
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
        newValue: { publishedVersion: template.publishedVersion }
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
          VERIFY_URL: `${getPublicSiteUrl(req)}/api/accounts/verify-email?token=preview`,
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
      const recipient = String(account.email || '')
        .trim()
        .toLowerCase();
      if (!recipient) {
        return res.apiError({
          status: 400,
          code: 'email_template_test_recipient_missing',
          message: 'Your administrator account does not have an email address'
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
          VERIFY_URL: `${siteUrl}/api/accounts/verify-email?token=test-email`,
          UNSUBSCRIBE_URL: `${siteUrl}/terms-and-privacy`
        }
      });
      const result = await sendEmail({
        to: recipient,
        subject: `[TEST] ${compiled.subject}`,
        html: compiled.html,
        text: compiled.text
      });
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
        action: 'Archived email template',
        template,
        severity: 'high',
        newValue: { status: 'archived' }
      });
      res.apiSuccess({ data: { archived: true, id: String(template._id) } });
    } catch (error) {
      respondWithRouteError(
        req,
        res,
        error,
        'email_template_archive_failed',
        'Failed to archive email template'
      );
    }
  });
}

module.exports = { registerOePanelEmailRoutes };

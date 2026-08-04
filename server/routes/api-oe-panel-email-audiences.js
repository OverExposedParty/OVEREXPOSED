const {
  EmailAudienceValidationError,
  normalizeEmailAudienceInput,
  resolveAudienceRecipients,
  resolveManualAudienceAccounts
} = require('../services/email-audiences');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAccountId(account) {
  return account?.developmentBypass ? null : account?._id || null;
}

async function requireEmailPermission(context, req, res) {
  const account = await context.requireOePanelAccount(req, res);
  if (!account) return null;
  if (!context.requireOePanelPermission(account, res, 'emails.manage')) {
    return null;
  }
  return account;
}

function respondWithAudienceError(req, res, error, fallbackCode, message) {
  if (error instanceof EmailAudienceValidationError) {
    return res.apiError({
      status: error.status,
      code: error.code,
      message: error.message
    });
  }
  if (error?.code === 11000) {
    return res.apiError({
      status: 409,
      code: 'email_audience_conflict',
      message: 'That audience or suppression already exists'
    });
  }
  if (error?.name === 'CastError') {
    return res.apiError({
      status: 404,
      code: 'email_audience_not_found',
      message: 'Email audience not found'
    });
  }
  console.error(`[REQ ${req.id}] ${message}:`, error);
  return res.apiError({ status: 500, code: fallbackCode, message });
}

function toPlainObject(document) {
  return document?.toObject ? document.toObject() : document || {};
}

function serializeAudience(document, resolution = null) {
  const audience = toPlainObject(document);
  return {
    id: audience._id ? String(audience._id) : '',
    name: audience.name || 'Untitled Audience',
    description: audience.description || '',
    type: audience.type || 'dynamic',
    status: audience.status || 'inactive',
    match: audience.match || 'all',
    requireMarketingConsent: audience.requireMarketingConsent !== false,
    conditions: Array.from(audience.conditions || []).map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value
    })),
    recipientCount:
      resolution?.eligibleCount ?? Number(audience.estimatedRecipients || 0),
    matchedCount: resolution?.matchedCount,
    suppressedCount: resolution?.suppressedCount,
    preview: resolution?.preview || [],
    updatedAt: audience.system?.updatedAt || null,
    createdAt: audience.system?.createdAt || null
  };
}

function serializeSuppression(document) {
  const suppression = toPlainObject(document);
  return {
    id: suppression._id ? String(suppression._id) : '',
    email: suppression.email || '',
    reason: suppression.reason || 'manual',
    source: suppression.source || 'admin',
    note: suppression.note || '',
    createdAt: suppression.createdAt || null
  };
}

async function writeAudienceAdminLog(context, account, data) {
  if (!context.AdminLog || !context.createAdminLog) return;
  await context.createAdminLog(context.AdminLog, account, {
    area: 'Emails',
    severity: data.severity || 'medium',
    action: data.action,
    target: {
      type: data.targetType,
      id: String(data.target?._id || ''),
      label: data.target?.name || data.target?.email || '-'
    },
    previousValue: data.previousValue || '-',
    newValue: data.newValue || '-',
    metadata: { collection: data.collection }
  });
}

async function prepareAudienceInput(context, input) {
  const { Account, EmailSuppression } = context;
  let recipientIds = [];
  let missingIdentifiers = [];

  if (input.type === 'manual') {
    const manual = await resolveManualAudienceAccounts(
      Account,
      input.manualIdentifiers
    );
    recipientIds = manual.recipientIds;
    missingIdentifiers = manual.missingIdentifiers;
    if (missingIdentifiers.length) {
      throw new EmailAudienceValidationError(
        `Accounts not found: ${missingIdentifiers.slice(0, 5).join(', ')}`,
        'email_audience_manual_accounts_not_found'
      );
    }
  }

  if (input.type === 'static') {
    const materialized = await resolveAudienceRecipients({
      Account,
      EmailSuppression,
      audience: { ...input, type: 'dynamic' },
      includeRecipientIds: true
    });
    recipientIds = materialized.recipientIds;
  }

  const prepared = { ...input, recipientIds };
  delete prepared.manualIdentifiers;
  const resolution = await resolveAudienceRecipients({
    Account,
    EmailSuppression,
    audience: prepared
  });
  return { prepared, resolution };
}

function getAudienceSet(prepared, resolution, account, now, isNew) {
  const set = {
    name: prepared.name,
    description: prepared.description,
    type: prepared.type,
    status: prepared.status,
    match: prepared.match,
    requireMarketingConsent: prepared.requireMarketingConsent,
    conditions: prepared.conditions,
    recipientIds: prepared.recipientIds,
    estimatedRecipients: resolution.eligibleCount,
    lastEvaluatedAt: now,
    'system.updatedBy': getAccountId(account),
    'system.updatedAt': now,
    'system.archivedAt': null
  };
  if (isNew) {
    set['system.createdBy'] = getAccountId(account);
    set['system.createdAt'] = now;
  }
  return set;
}

function registerOePanelEmailAudienceRoutes(context) {
  const { app, Account, EmailAudience, EmailSuppression } = context;

  app.get('/api/oe-panel/emails/audiences', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const audiences = EmailAudience?.find
        ? await EmailAudience.find({ 'system.archivedAt': null })
            .sort({ 'system.updatedAt': -1 })
            .lean()
        : [];
      res.apiSuccess({
        data: { audiences: audiences.map((item) => serializeAudience(item)) }
      });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audiences_fetch_failed',
        'Failed to fetch email audiences'
      );
    }
  });

  app.get('/api/oe-panel/emails/audiences/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const audience = await EmailAudience.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!audience) {
        return res.apiError({
          status: 404,
          code: 'email_audience_not_found',
          message: 'Email audience not found'
        });
      }
      const resolution = await resolveAudienceRecipients({
        Account,
        EmailSuppression,
        audience
      });
      let manualIdentifiers = [];
      if (audience.type === 'manual' && audience.recipientIds?.length) {
        const recipients = await Account.find({
          _id: { $in: audience.recipientIds }
        })
          .select('username email')
          .limit(1000)
          .lean();
        manualIdentifiers = recipients.map(
          (recipient) => recipient.email || recipient.username
        );
      }
      res.apiSuccess({
        data: {
          audience: {
            ...serializeAudience(audience, resolution),
            manualIdentifiers
          }
        }
      });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_fetch_failed',
        'Failed to fetch email audience'
      );
    }
  });

  app.post('/api/oe-panel/emails/audiences/preview', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const input = normalizeEmailAudienceInput({
        ...req.body,
        name: req.body?.name || 'Audience preview'
      });
      const { resolution } = await prepareAudienceInput(context, input);
      res.apiSuccess({ data: resolution });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_preview_failed',
        'Failed to preview email audience'
      );
    }
  });

  app.post('/api/oe-panel/emails/audiences', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const input = normalizeEmailAudienceInput(req.body);
      const { prepared, resolution } = await prepareAudienceInput(
        context,
        input
      );
      const now = new Date();
      const audience = await EmailAudience.create(
        getAudienceSet(prepared, resolution, account, now, true)
      );
      await writeAudienceAdminLog(context, account, {
        action: 'Created email audience',
        targetType: 'email_audience',
        target: audience,
        collection: 'email-audiences',
        newValue: {
          type: prepared.type,
          status: prepared.status,
          recipients: resolution.eligibleCount
        }
      });
      res.apiSuccess(
        { data: { audience: serializeAudience(audience, resolution) } },
        201
      );
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_create_failed',
        'Failed to create email audience'
      );
    }
  });

  app.patch('/api/oe-panel/emails/audiences/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const current = await EmailAudience.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!current) {
        return res.apiError({
          status: 404,
          code: 'email_audience_not_found',
          message: 'Email audience not found'
        });
      }
      const input = normalizeEmailAudienceInput(req.body);
      const { prepared, resolution } = await prepareAudienceInput(
        context,
        input
      );
      const audience = await EmailAudience.findOneAndUpdate(
        { _id: current._id, 'system.archivedAt': null },
        {
          $set: getAudienceSet(prepared, resolution, account, new Date(), false)
        },
        { new: true, runValidators: true }
      );
      await writeAudienceAdminLog(context, account, {
        action: 'Edited email audience',
        targetType: 'email_audience',
        target: audience,
        collection: 'email-audiences',
        previousValue: {
          type: current.type,
          status: current.status,
          recipients: current.estimatedRecipients
        },
        newValue: {
          type: prepared.type,
          status: prepared.status,
          recipients: resolution.eligibleCount
        }
      });
      res.apiSuccess({
        data: { audience: serializeAudience(audience, resolution) }
      });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_update_failed',
        'Failed to update email audience'
      );
    }
  });

  app.post('/api/oe-panel/emails/audiences/:id/duplicate', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const current = await EmailAudience.findOne({
        _id: req.params.id,
        'system.archivedAt': null
      }).lean();
      if (!current) {
        return res.apiError({
          status: 404,
          code: 'email_audience_not_found',
          message: 'Email audience not found'
        });
      }
      const now = new Date();
      const duplicate = await EmailAudience.create({
        name: `${current.name} Copy`.slice(0, 160),
        description: current.description || '',
        type: current.type,
        status: 'inactive',
        match: current.match,
        requireMarketingConsent: current.requireMarketingConsent !== false,
        conditions: current.conditions || [],
        recipientIds: current.recipientIds || [],
        estimatedRecipients: current.estimatedRecipients || 0,
        lastEvaluatedAt: current.lastEvaluatedAt || null,
        system: {
          createdBy: getAccountId(account),
          updatedBy: getAccountId(account),
          createdAt: now,
          updatedAt: now,
          archivedAt: null
        }
      });
      await writeAudienceAdminLog(context, account, {
        action: 'Duplicated email audience',
        targetType: 'email_audience',
        target: duplicate,
        collection: 'email-audiences',
        previousValue: { sourceAudienceId: String(current._id) },
        newValue: { status: 'inactive' }
      });
      res.apiSuccess({ data: { audience: serializeAudience(duplicate) } }, 201);
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_duplicate_failed',
        'Failed to duplicate email audience'
      );
    }
  });

  app.delete('/api/oe-panel/emails/audiences/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const audience = await EmailAudience.findOneAndUpdate(
        { _id: req.params.id, 'system.archivedAt': null },
        {
          $set: {
            status: 'inactive',
            'system.archivedAt': new Date(),
            'system.updatedAt': new Date(),
            'system.updatedBy': getAccountId(account)
          }
        },
        { new: true }
      );
      if (!audience) {
        return res.apiError({
          status: 404,
          code: 'email_audience_not_found',
          message: 'Email audience not found'
        });
      }
      await writeAudienceAdminLog(context, account, {
        action: 'Archived email audience',
        targetType: 'email_audience',
        target: audience,
        collection: 'email-audiences',
        newValue: 'Archived'
      });
      res.apiSuccess({ data: { deleted: true, id: String(audience._id) } });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_audience_delete_failed',
        'Failed to delete email audience'
      );
    }
  });

  app.get('/api/oe-panel/emails/suppressions', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const suppressions = EmailSuppression?.find
        ? await EmailSuppression.find({ removedAt: null })
            .sort({ createdAt: -1 })
            .lean()
        : [];
      res.apiSuccess({
        data: {
          suppressions: suppressions.map((item) => serializeSuppression(item))
        }
      });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_suppressions_fetch_failed',
        'Failed to fetch email suppressions'
      );
    }
  });

  app.post('/api/oe-panel/emails/suppressions', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const email = String(req.body?.email || '')
        .trim()
        .toLowerCase();
      const reason = String(req.body?.reason || 'manual')
        .trim()
        .toLowerCase();
      const note = String(req.body?.note || '').trim();
      if (!EMAIL_PATTERN.test(email) || email.length > 254) {
        throw new EmailAudienceValidationError(
          'Enter a valid email address',
          'email_suppression_email_invalid'
        );
      }
      if (!EmailSuppression.REASONS.includes(reason)) {
        throw new EmailAudienceValidationError(
          'Choose a valid suppression reason',
          'email_suppression_reason_invalid'
        );
      }
      if (note.length > 500) {
        throw new EmailAudienceValidationError(
          'Enter a suppression note of 500 characters or fewer',
          'email_suppression_note_invalid'
        );
      }
      const suppression = await EmailSuppression.create({
        email,
        reason,
        source: 'admin',
        note,
        createdBy: getAccountId(account),
        createdAt: new Date()
      });
      await writeAudienceAdminLog(context, account, {
        action: 'Added email suppression',
        targetType: 'email_suppression',
        target: suppression,
        collection: 'email-suppressions',
        newValue: { reason }
      });
      res.apiSuccess(
        {
          data: { suppression: serializeSuppression(suppression) }
        },
        201
      );
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_suppression_create_failed',
        'Failed to add email suppression'
      );
    }
  });

  app.delete('/api/oe-panel/emails/suppressions/:id', async (req, res) => {
    try {
      const account = await requireEmailPermission(context, req, res);
      if (!account) return;
      const suppression = await EmailSuppression.findOneAndUpdate(
        { _id: req.params.id, removedAt: null },
        {
          $set: {
            removedAt: new Date(),
            removedBy: getAccountId(account)
          }
        },
        { new: true }
      );
      if (!suppression) {
        return res.apiError({
          status: 404,
          code: 'email_suppression_not_found',
          message: 'Email suppression not found'
        });
      }
      await writeAudienceAdminLog(context, account, {
        action: 'Removed email suppression',
        targetType: 'email_suppression',
        target: suppression,
        collection: 'email-suppressions',
        newValue: 'Removed'
      });
      res.apiSuccess({ data: { deleted: true, id: String(suppression._id) } });
    } catch (error) {
      respondWithAudienceError(
        req,
        res,
        error,
        'email_suppression_delete_failed',
        'Failed to remove email suppression'
      );
    }
  });
}

module.exports = {
  registerOePanelEmailAudienceRoutes,
  serializeAudience,
  serializeSuppression
};

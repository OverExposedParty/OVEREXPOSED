const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUDIENCE_TYPES = new Set(['dynamic', 'static', 'manual']);
const AUDIENCE_STATUSES = new Set(['active', 'inactive']);
const AUDIENCE_MATCH_MODES = new Set(['all', 'any']);
const ACCOUNT_STATUSES = new Set(['active', 'pending_verification']);
const BOOLEAN_FIELDS = new Set([
  'emailVerified',
  'hasPurchased',
  'hasPlayedGame'
]);
const DATE_FIELDS = new Set(['createdAt', 'lastActiveAt']);
const TEXT_FIELDS = new Set([
  'accountStatus',
  'country',
  'preferredLanguage',
  'adminRole'
]);

class EmailAudienceValidationError extends Error {
  constructor(message, code = 'email_audience_invalid', status = 400) {
    super(message);
    this.name = 'EmailAudienceValidationError';
    this.code = code;
    this.status = status;
  }
}

function normalizeBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new EmailAudienceValidationError(
    'Choose a valid true or false condition value',
    'email_audience_condition_value_invalid'
  );
}

function normalizeCondition(condition = {}) {
  const field = String(condition.field || '').trim();
  const operator = String(condition.operator || '').trim();
  if (
    !BOOLEAN_FIELDS.has(field) &&
    !DATE_FIELDS.has(field) &&
    !TEXT_FIELDS.has(field)
  ) {
    throw new EmailAudienceValidationError(
      'Choose a supported audience condition',
      'email_audience_condition_field_invalid'
    );
  }

  if (BOOLEAN_FIELDS.has(field)) {
    if (operator !== 'is') {
      throw new EmailAudienceValidationError(
        'Boolean audience conditions only support the is operator',
        'email_audience_condition_operator_invalid'
      );
    }
    return { field, operator, value: normalizeBoolean(condition.value) };
  }

  if (DATE_FIELDS.has(field)) {
    if (!['before', 'after'].includes(operator)) {
      throw new EmailAudienceValidationError(
        'Date audience conditions require before or after',
        'email_audience_condition_operator_invalid'
      );
    }
    const value = new Date(condition.value);
    if (Number.isNaN(value.getTime())) {
      throw new EmailAudienceValidationError(
        'Enter a valid date for the audience condition',
        'email_audience_condition_value_invalid'
      );
    }
    return { field, operator, value };
  }

  if (!['is', 'is-not'].includes(operator)) {
    throw new EmailAudienceValidationError(
      'Text audience conditions require is or is not',
      'email_audience_condition_operator_invalid'
    );
  }

  let value = String(condition.value || '').trim();
  if (!value || value.length > 100) {
    throw new EmailAudienceValidationError(
      'Enter a condition value of 100 characters or fewer',
      'email_audience_condition_value_invalid'
    );
  }
  if (field === 'accountStatus') {
    value = value.toLowerCase();
    if (!ACCOUNT_STATUSES.has(value)) {
      throw new EmailAudienceValidationError(
        'Choose an eligible account status',
        'email_audience_condition_value_invalid'
      );
    }
  }
  if (field === 'country') value = value.toUpperCase();
  if (field === 'preferredLanguage' || field === 'adminRole') {
    value = value.toLowerCase();
  }
  return { field, operator, value };
}

function normalizeManualIdentifiers(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);
  const identifiers = Array.from(
    new Set(
      source
        .map((item) =>
          String(item || '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    )
  );
  if (identifiers.length > 1000) {
    throw new EmailAudienceValidationError(
      'Manual audiences can contain no more than 1000 entered accounts',
      'email_audience_manual_limit_exceeded'
    );
  }
  return identifiers;
}

function normalizeEmailAudienceInput(body = {}) {
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const type = String(body.type || 'dynamic')
    .trim()
    .toLowerCase();
  const status = String(body.status || 'active')
    .trim()
    .toLowerCase();
  const match = String(body.match || 'all')
    .trim()
    .toLowerCase();
  const requireMarketingConsent =
    body.requireMarketingConsent === undefined
      ? true
      : normalizeBoolean(body.requireMarketingConsent);
  const rawConditions = Array.isArray(body.conditions) ? body.conditions : [];

  if (!name || name.length > 160) {
    throw new EmailAudienceValidationError(
      'Enter an audience name of 160 characters or fewer',
      'email_audience_name_invalid'
    );
  }
  if (description.length > 500) {
    throw new EmailAudienceValidationError(
      'Enter an audience description of 500 characters or fewer',
      'email_audience_description_invalid'
    );
  }
  if (!AUDIENCE_TYPES.has(type)) {
    throw new EmailAudienceValidationError(
      'Choose a valid audience type',
      'email_audience_type_invalid'
    );
  }
  if (!AUDIENCE_STATUSES.has(status)) {
    throw new EmailAudienceValidationError(
      'Choose a valid audience status',
      'email_audience_status_invalid'
    );
  }
  if (!AUDIENCE_MATCH_MODES.has(match)) {
    throw new EmailAudienceValidationError(
      'Choose whether all or any conditions should match',
      'email_audience_match_invalid'
    );
  }
  if (rawConditions.length > 20) {
    throw new EmailAudienceValidationError(
      'An audience can contain no more than 20 conditions',
      'email_audience_condition_limit_exceeded'
    );
  }

  const conditions = rawConditions.map(normalizeCondition);
  const manualIdentifiers = normalizeManualIdentifiers(body.manualIdentifiers);
  if (type === 'manual' && manualIdentifiers.length === 0) {
    throw new EmailAudienceValidationError(
      'Enter at least one username or email address',
      'email_audience_manual_recipients_required'
    );
  }

  return {
    name,
    description,
    type,
    status,
    match,
    requireMarketingConsent,
    conditions: type === 'manual' ? [] : conditions,
    manualIdentifiers
  };
}

function createComparison(path, operator, value) {
  return { [path]: { [operator === 'is' ? '$eq' : '$ne']: value } };
}

function buildConditionQuery(condition) {
  const { field, operator, value } = normalizeCondition(condition);
  if (field === 'emailVerified') {
    return { 'profile.emailVerified': value };
  }
  if (field === 'accountStatus') {
    return createComparison('profile.accountStatus', operator, value);
  }
  if (field === 'createdAt') {
    return { createdAt: { [operator === 'after' ? '$gte' : '$lt']: value } };
  }
  if (field === 'lastActiveAt') {
    const recentOperator = operator === 'after' ? '$gte' : '$lt';
    const activityClauses = [
      { 'analytics.lastSeenAt': { [recentOperator]: value } },
      { 'profile.lastLoginAt': { [recentOperator]: value } }
    ];
    return operator === 'after'
      ? { $or: activityClauses }
      : {
          $nor: [
            { 'analytics.lastSeenAt': { $gte: value } },
            { 'profile.lastLoginAt': { $gte: value } }
          ]
        };
  }
  if (field === 'country') {
    return createComparison('profile.country', operator, value);
  }
  if (field === 'preferredLanguage') {
    return createComparison('profile.preferredLanguage', operator, value);
  }
  if (field === 'adminRole') {
    return createComparison('admin.roles', operator, value);
  }
  const arrayPath =
    field === 'hasPurchased' ? 'shop.orderHistory.0' : 'matchHistory.0';
  return { [arrayPath]: { $exists: value } };
}

function buildAudienceAccountQuery(audience = {}) {
  const clauses = [
    { email: { $type: 'string', $ne: '' } },
    {
      'profile.accountStatus': {
        $nin: ['suspended', 'banned', 'deleted']
      }
    }
  ];
  if (audience.requireMarketingConsent !== false) {
    clauses.push(
      { 'profile.emailVerified': true },
      { 'legalConsent.marketingConsentStatus': 'accepted' },
      { 'profile.notificationPreferences.marketingEmail': true }
    );
  }

  const type = String(audience.type || 'dynamic');
  if (type === 'manual' || type === 'static') {
    clauses.push({ _id: { $in: Array.from(audience.recipientIds || []) } });
  } else {
    const conditionQueries = Array.from(audience.conditions || []).map(
      buildConditionQuery
    );
    if (conditionQueries.length) {
      clauses.push(
        audience.match === 'any'
          ? { $or: conditionQueries }
          : { $and: conditionQueries }
      );
    }
  }
  return { $and: clauses };
}

async function loadSuppressedEmails(EmailSuppression) {
  if (!EmailSuppression?.find) return [];
  const records = await EmailSuppression.find({ removedAt: null })
    .select('email')
    .lean();
  return records.map((record) => String(record.email || '').toLowerCase());
}

async function resolveAudienceRecipients({
  Account,
  EmailSuppression,
  audience,
  previewLimit = 8,
  includeRecipientIds = false
}) {
  const query = buildAudienceAccountQuery(audience);
  const suppressedEmails = await loadSuppressedEmails(EmailSuppression);
  const suppressedClause = suppressedEmails.length
    ? { email: { $in: suppressedEmails } }
    : null;
  const eligibleClause = suppressedEmails.length
    ? { email: { $nin: suppressedEmails } }
    : null;
  const eligibleQuery = eligibleClause
    ? { $and: [query, eligibleClause] }
    : query;

  const [matchedCount, suppressedCount, preview, recipientDocuments] =
    await Promise.all([
      Account.countDocuments(query),
      suppressedClause
        ? Account.countDocuments({ $and: [query, suppressedClause] })
        : 0,
      Account.find(eligibleQuery)
        .select('_id username email profile.displayName')
        .sort({ createdAt: -1 })
        .limit(Math.min(Math.max(Number(previewLimit) || 8, 1), 25))
        .lean(),
      includeRecipientIds
        ? Account.find(eligibleQuery).select('_id').limit(100000).lean()
        : []
    ]);

  return {
    matchedCount,
    suppressedCount,
    eligibleCount: Math.max(0, matchedCount - suppressedCount),
    preview: preview.map((account) => ({
      accountId: String(account._id),
      username: account.username || '-',
      displayName: account.profile?.displayName || '',
      email: account.email || '-'
    })),
    recipientIds: recipientDocuments.map((account) => account._id)
  };
}

async function resolveManualAudienceAccounts(Account, identifiers) {
  const normalized = normalizeManualIdentifiers(identifiers);
  const emails = normalized.filter((value) => EMAIL_PATTERN.test(value));
  const usernames = normalized.filter((value) => !EMAIL_PATTERN.test(value));
  const accounts = normalized.length
    ? await Account.find({
        $or: [
          ...(emails.length ? [{ email: { $in: emails } }] : []),
          ...(usernames.length ? [{ username: { $in: usernames } }] : [])
        ]
      })
        .select('_id username email')
        .limit(1000)
        .lean()
    : [];
  const foundIdentifiers = new Set();
  accounts.forEach((account) => {
    foundIdentifiers.add(String(account.username || '').toLowerCase());
    foundIdentifiers.add(String(account.email || '').toLowerCase());
  });
  return {
    recipientIds: accounts.map((account) => account._id),
    missingIdentifiers: normalized.filter(
      (identifier) => !foundIdentifiers.has(identifier)
    )
  };
}

module.exports = {
  EmailAudienceValidationError,
  buildAudienceAccountQuery,
  buildConditionQuery,
  normalizeEmailAudienceInput,
  normalizeManualIdentifiers,
  resolveAudienceRecipients,
  resolveManualAudienceAccounts
};

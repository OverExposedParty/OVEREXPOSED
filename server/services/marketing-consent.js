const crypto = require('crypto');

const MARKETING_CONSENT_VERSION =
  process.env.MARKETING_CONSENT_VERSION || '2026-08-03';

function isMarketingEmailOptIn(value) {
  return value === true;
}

function createMarketingConsentRecord(
  req,
  { status, source, recordedAt = new Date() }
) {
  return {
    type: 'marketing_email',
    version: MARKETING_CONSENT_VERSION,
    status,
    recordedAt,
    acceptedAt: status === 'accepted' ? recordedAt : null,
    withdrawnAt: status === 'withdrawn' ? recordedAt : null,
    source,
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null
  };
}

function applyMarketingConsent(
  account,
  { accepted, req = null, source = 'account_settings', status = null }
) {
  const recordedAt = new Date();
  const nextStatus = status || (accepted ? 'accepted' : 'withdrawn');

  account.profile ||= {};
  account.profile.notificationPreferences ||= {};
  account.profile.notificationPreferences.marketingEmail = accepted === true;
  account.legalConsent ||= {};
  account.legalConsent.marketingConsentStatus = nextStatus;
  account.legalConsent.marketingConsentTimestamp = recordedAt;
  account.legalConsent.consentHistory ||= [];
  account.legalConsent.consentHistory.push(
    createMarketingConsentRecord(req, {
      status: nextStatus,
      source,
      recordedAt
    })
  );

  return recordedAt;
}

function getMarketingUnsubscribeSecret() {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET || process.env.COOKIE_SECRET || ''
  );
}

function createMarketingUnsubscribeToken(account, secret = null) {
  const signingSecret = secret || getMarketingUnsubscribeSecret();
  const accountId = String(account?._id || account?.id || '');
  const email = String(account?.email || '')
    .trim()
    .toLowerCase();
  if (!signingSecret || !accountId || !email) return '';

  const payload = Buffer.from(
    JSON.stringify({ version: 1, accountId, email }),
    'utf8'
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function parseMarketingUnsubscribeToken(token, secret = null) {
  const signingSecret = secret || getMarketingUnsubscribeSecret();
  const [payload, signature, extra] = String(token || '').split('.');
  if (!signingSecret || !payload || !signature || extra !== undefined) {
    return null;
  }

  const expected = crypto
    .createHmac('sha256', signingSecret)
    .update(payload)
    .digest();
  let candidate;
  try {
    candidate = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (
    candidate.length !== expected.length ||
    !crypto.timingSafeEqual(candidate, expected)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    );
    if (
      parsed?.version !== 1 ||
      typeof parsed.accountId !== 'string' ||
      !/^[a-f0-9]{24}$/i.test(parsed.accountId) ||
      typeof parsed.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email)
    ) {
      return null;
    }
    return {
      accountId: parsed.accountId,
      email: parsed.email.toLowerCase()
    };
  } catch {
    return null;
  }
}

function createMarketingUnsubscribeUrl({ siteUrl, account, secret = null }) {
  const token = createMarketingUnsubscribeToken(account, secret);
  if (!token) return '';
  return `${String(siteUrl || '').replace(/\/+$/, '')}/unsubscribe?token=${encodeURIComponent(token)}`;
}

module.exports = {
  MARKETING_CONSENT_VERSION,
  applyMarketingConsent,
  createMarketingConsentRecord,
  createMarketingUnsubscribeToken,
  createMarketingUnsubscribeUrl,
  getMarketingUnsubscribeSecret,
  isMarketingEmailOptIn,
  parseMarketingUnsubscribeToken
};

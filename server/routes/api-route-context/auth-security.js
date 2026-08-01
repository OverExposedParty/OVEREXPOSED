const { createOeIconAccessTools } = require('./auth-security-oe-icon-access');

function createAuthSecurityContext(context) {
  const { crypto, canUseOeItem, Account, OeCustomisation } = context;

  const accountSaltRounds = 12;

  const defaultOeIcon = '0000:0100:0200:0300';

  const authThrottleStores = new Map();

  const authThrottleProfiles = {
    signup: { limit: 6, windowMs: 15 * 60 * 1000 },
    login: { limit: 12, windowMs: 15 * 60 * 1000 },
    passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
    emailVerification: { limit: 4, windowMs: 15 * 60 * 1000 },
    emailChange: { limit: 4, windowMs: 15 * 60 * 1000 }
  };

  const loginLockoutMaxAttempts = 5;

  const loginLockoutDurationMs = 15 * 60 * 1000;

  const maxStoredAccountSessions = 10;

  const legalTermsVersion = process.env.LEGAL_TERMS_VERSION || '2026-08-01';

  const legalPrivacyPolicyVersion =
    process.env.LEGAL_PRIVACY_POLICY_VERSION || '2026-08-01';

  const oeIconPattern =
    /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;
  const oeIconAccessTools = createOeIconAccessTools({
    canUseOeItem,
    OeCustomisation,
    defaultOeIcon,
    oeIconPattern
  });

  function getRequestThrottleIdentity(req, extraKey = '') {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim();
    const ip = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
    return `${ip}:${String(extraKey || '')
      .trim()
      .toLowerCase()}`;
  }

  function getAuthThrottleStore(name) {
    if (!authThrottleStores.has(name)) {
      authThrottleStores.set(name, new Map());
    }

    return authThrottleStores.get(name);
  }

  function checkAuthThrottle(name, identity) {
    const profile = authThrottleProfiles[name];
    if (!profile) return { allowed: true };

    const store = getAuthThrottleStore(name);
    const now = Date.now();
    const record = store.get(identity);

    if (!record || record.expiresAt <= now) {
      store.set(identity, {
        count: 1,
        expiresAt: now + profile.windowMs
      });
      return { allowed: true };
    }

    record.count += 1;
    store.set(identity, record);

    if (record.count <= profile.limit) {
      return { allowed: true };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((record.expiresAt - now) / 1000)
    );

    return {
      allowed: false,
      retryAfterSeconds,
      message: 'Too many attempts. Try again later.'
    };
  }

  function sendAuthThrottleError(res, result) {
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }

    return res.apiError({
      status: 429,
      code: 'rate_limited',
      message: result.message || 'Too many attempts. Try again later.'
    });
  }

  function assertAuthThrottle(req, res, name, extraKey = '') {
    const result = checkAuthThrottle(
      name,
      getRequestThrottleIdentity(req, extraKey)
    );

    if (result.allowed) return true;

    sendAuthThrottleError(res, result);
    return false;
  }

  function getAccountLockoutSeconds(account) {
    const lockoutExpiresAt = account?.security?.lockoutExpiresAt;
    const expiresAtMs = lockoutExpiresAt
      ? new Date(lockoutExpiresAt).getTime()
      : 0;
    const remainingMs = expiresAtMs - Date.now();

    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }

  function isAccountEmailVerified(account) {
    return Boolean(account?.profile?.emailVerified);
  }

  function requireVerifiedAccount(res, account, action = 'use this feature') {
    if (isAccountEmailVerified(account)) return true;

    res.apiError({
      status: 403,
      code: 'email_verification_required',
      message: `Verify your email to ${action}.`
    });
    return false;
  }

  async function recordFailedLogin(account, req) {
    if (!account) return;

    const failedLoginAttempts =
      (Number(account.security?.failedLoginAttempts) || 0) + 1;
    const lockoutExpiresAt =
      failedLoginAttempts >= loginLockoutMaxAttempts
        ? new Date(Date.now() + loginLockoutDurationMs)
        : null;

    account.security = {
      ...(account.security?.toObject?.() || account.security || {}),
      failedLoginAttempts,
      lockoutExpiresAt
    };

    await Account.updateOne(
      { _id: account._id },
      {
        $set: {
          'security.failedLoginAttempts': failedLoginAttempts,
          'security.lockoutExpiresAt': lockoutExpiresAt
        },
        $push: {
          'security.loginHistory': {
            ipAddress: req.ip,
            device: { userAgent: req.get('user-agent') || null },
            successful: false
          }
        }
      },
      { runValidators: false }
    );
  }

  async function clearExpiredAccountSessions(accountId) {
    if (!accountId) return;

    await Account.updateOne(
      { _id: accountId },
      {
        $pull: {
          'security.sessions': {
            $or: [
              { expiresAt: { $lte: new Date() } },
              { revokedAt: { $ne: null } }
            ]
          }
        }
      },
      { runValidators: false }
    );
  }

  function normalizeAccountInput({
    username,
    email,
    confirmPassword,
    password,
    terms,
    termsAccepted,
    privacyPolicyAccepted
  } = {}) {
    const hasAcceptedTerms =
      terms === true || terms === 'on' || terms === 'true';
    const hasExplicitTermsAcceptance =
      termsAccepted === true || termsAccepted === 'true';
    const hasAcceptedPrivacy =
      privacyPolicyAccepted === true || privacyPolicyAccepted === 'true';

    return {
      username:
        typeof username === 'string' ? username.trim().toLowerCase() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      password: typeof password === 'string' ? password : '',
      confirmPassword:
        typeof confirmPassword === 'string' ? confirmPassword : '',
      termsAccepted: hasAcceptedTerms || hasExplicitTermsAcceptance,
      privacyPolicyAccepted: hasAcceptedTerms || hasAcceptedPrivacy
    };
  }

  function createSignupLegalConsent(req) {
    const acceptedAt = new Date();
    const userAgent = req.get('user-agent') || null;

    return {
      termsAcceptedVersion: legalTermsVersion,
      privacyPolicyAcceptedVersion: legalPrivacyPolicyVersion,
      consentHistory: [
        {
          type: 'terms',
          version: legalTermsVersion,
          status: 'accepted',
          acceptedAt,
          ipAddress: req.ip,
          userAgent
        },
        {
          type: 'privacy_policy',
          version: legalPrivacyPolicyVersion,
          status: 'accepted',
          acceptedAt,
          ipAddress: req.ip,
          userAgent
        }
      ]
    };
  }

  function normalizeLoginInput({ identifier, email, username, password } = {}) {
    const rawIdentifier = identifier || email || username;

    return {
      identifier:
        typeof rawIdentifier === 'string'
          ? rawIdentifier.trim().toLowerCase()
          : '',
      password: typeof password === 'string' ? password : ''
    };
  }

  function normalizePrivacySettings(input = {}) {
    const allowedProfileVisibility = new Set(['public', 'friends', 'private']);
    const nextSettings = {};

    if (Object.prototype.hasOwnProperty.call(input, 'profileVisibility')) {
      const profileVisibility = String(input.profileVisibility || '')
        .trim()
        .toLowerCase();
      if (allowedProfileVisibility.has(profileVisibility)) {
        nextSettings.profileVisibility = profileVisibility;
      }
    }

    ['showGameStats', 'showOnlineStatus', 'allowFriendRequests'].forEach(
      (key) => {
        if (!Object.prototype.hasOwnProperty.call(input, key)) return;
        nextSettings[key] = input[key] === true || input[key] === 'true';
      }
    );

    return nextSettings;
  }

  function validateLoginInput({ identifier, password }) {
    const errors = {};

    if (!identifier) {
      errors.identifier = 'Email or username is required';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    return errors;
  }

  function normalizePasswordResetRequestInput({ identifier, email } = {}) {
    const rawIdentifier = identifier || email;

    return {
      identifier:
        typeof rawIdentifier === 'string'
          ? rawIdentifier.trim().toLowerCase()
          : ''
    };
  }

  function validatePasswordResetRequestInput({ identifier }) {
    const errors = {};

    if (!identifier) {
      errors.identifier = 'Email or username is required';
    }

    return errors;
  }

  function normalizePasswordResetInput({
    token,
    password,
    confirmPassword
  } = {}) {
    return {
      token: typeof token === 'string' ? token.trim() : '',
      password: typeof password === 'string' ? password : '',
      confirmPassword:
        typeof confirmPassword === 'string' ? confirmPassword : ''
    };
  }

  function validatePasswordResetInput({ token, password, confirmPassword }) {
    const errors = {};

    if (!token) {
      errors.token = 'Password reset link is invalid';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8 || password.length > 128) {
      errors.password = 'Password must be 8-128 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Confirm password is required';
    } else if (password && password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  }

  function normalizeEmailChangeInput({
    token,
    email,
    confirmEmail,
    password
  } = {}) {
    return {
      token: typeof token === 'string' ? token.trim() : '',
      email: typeof email === 'string' ? email.trim().toLowerCase() : '',
      confirmEmail:
        typeof confirmEmail === 'string'
          ? confirmEmail.trim().toLowerCase()
          : '',
      password: typeof password === 'string' ? password : ''
    };
  }

  function validateEmailChangeInput({ token, email, confirmEmail, password }) {
    const errors = {};

    if (!token) {
      errors.token = 'Email change link is invalid';
    }

    if (!email) {
      errors.email = 'New email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Email must be valid';
    }

    if (!confirmEmail) {
      errors.confirmEmail = 'Confirm email is required';
    } else if (email && email !== confirmEmail) {
      errors.confirmEmail = 'Email addresses do not match';
    }

    if (!password) {
      errors.password = 'Current password is required';
    }

    return errors;
  }

  function createSessionToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function createEmailVerificationToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function hashEmailVerificationToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function createEmailChangeToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function hashEmailChangeToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  function createPasswordResetToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function hashPasswordResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  return {
    accountSaltRounds,
    defaultOeIcon,
    authThrottleStores,
    authThrottleProfiles,
    loginLockoutMaxAttempts,
    loginLockoutDurationMs,
    maxStoredAccountSessions,
    legalTermsVersion,
    legalPrivacyPolicyVersion,
    oeIconPattern,
    getRequestThrottleIdentity,
    getAuthThrottleStore,
    checkAuthThrottle,
    sendAuthThrottleError,
    assertAuthThrottle,
    getAccountLockoutSeconds,
    isAccountEmailVerified,
    requireVerifiedAccount,
    recordFailedLogin,
    clearExpiredAccountSessions,
    normalizeAccountInput,
    createSignupLegalConsent,
    normalizeLoginInput,
    normalizePrivacySettings,
    normalizeOeIcon: oeIconAccessTools.normalizeOeIcon,
    isDefaultOeIcon: oeIconAccessTools.isDefaultOeIcon,
    getRequestedOeIcon: oeIconAccessTools.getRequestedOeIcon,
    parseOeIconParts: oeIconAccessTools.parseOeIconParts,
    normalizeCustomisationPreferences:
      oeIconAccessTools.normalizeCustomisationPreferences,
    validateAccountOeIconAccess: oeIconAccessTools.validateAccountOeIconAccess,
    validateLoginInput,
    normalizePasswordResetRequestInput,
    validatePasswordResetRequestInput,
    normalizePasswordResetInput,
    validatePasswordResetInput,
    normalizeEmailChangeInput,
    validateEmailChangeInput,
    createSessionToken,
    hashSessionToken,
    createEmailVerificationToken,
    hashEmailVerificationToken,
    createEmailChangeToken,
    hashEmailChangeToken,
    createPasswordResetToken,
    hashPasswordResetToken
  };
}

module.exports = {
  createAuthSecurityContext
};

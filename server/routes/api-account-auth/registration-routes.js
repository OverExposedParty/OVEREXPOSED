const { applyMarketingConsent } = require('../../services/marketing-consent');

function registerAccountRegistrationRoutes(context) {
  const {
    app,
    normalizeAccountInput,
    validateAccountInput,
    getSignupContext,
    assertAuthThrottle,
    bcrypt,
    accountSaltRounds,
    createEmailVerificationToken,
    Account,
    normalizeOeIcon,
    hashEmailVerificationToken,
    createSignupLegalConsent,
    unlockAchievementByKey,
    Achievement,
    upgradeGuestPartyIdentityForAccount,
    sendVerificationEmail,
    EmailAutomation,
    EmailTemplate,
    EmailDelivery,
    recordEmailConversion,
    serializeAccount,
    establishAccountSession,
    recordProfileCompletionAchievement,
    getCurrentAccount,
    requireVerifiedAccount,
    createEmailChangeToken,
    hashEmailChangeToken,
    sendEmailChangeEmail,
    normalizeEmailChangeInput,
    validateEmailChangeInput
  } = context;

  app.post('/api/accounts', async (req, res) => {
    const accountInput = normalizeAccountInput(req.body);
    const validationErrors = validateAccountInput(accountInput);
    const signupContext = getSignupContext(req, req.body?.signupReferrerPath);

    if (Object.keys(validationErrors).length) {
      return res.apiError({
        status: 400,
        code: 'account_validation_failed',
        message: 'Account details are invalid',
        details: validationErrors
      });
    }

    if (!assertAuthThrottle(req, res, 'signup', accountInput.email)) return;

    try {
      const passwordHash = await bcrypt.hash(
        accountInput.password,
        accountSaltRounds
      );
      const emailVerificationToken = createEmailVerificationToken();
      const emailVerificationExpiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24
      );
      const account = await Account.create({
        username: accountInput.username,
        email: accountInput.email,
        passwordHash,
        profile: {
          oeIcon: normalizeOeIcon(req.body?.oeIcon) || null,
          emailVerified: false,
          emailVerifiedAt: null,
          accountStatus: 'pending_verification',
          notificationPreferences: {
            marketingEmail: accountInput.marketingEmailOptIn
          }
        },
        security: {
          emailVerification: {
            tokenHash: hashEmailVerificationToken(emailVerificationToken),
            requestedAt: new Date(),
            expiresAt: emailVerificationExpiresAt,
            ipAddress: req.ip
          }
        },
        legalConsent: createSignupLegalConsent(
          req,
          accountInput.marketingEmailOptIn
        ),
        analytics: signupContext ? { signupContext } : undefined
      });

      await unlockAchievementByKey({
        Achievement,
        account,
        key: 'welcome-to-the-party',
        source: 'account-created'
      });

      let activePartyConflict = null;
      try {
        const upgradeResult = await upgradeGuestPartyIdentityForAccount(
          req,
          account
        );
        activePartyConflict = upgradeResult?.activePartyConflict || null;
      } catch (err) {
        console.error(
          `[REQ ${req.id}] Failed to upgrade guest party identity after signup:`,
          err
        );
      }

      let verificationEmailSent = true;
      try {
        const emailResult = await sendVerificationEmail({
          req,
          to: account.email,
          verifyToken: emailVerificationToken,
          EmailAutomation,
          EmailTemplate,
          EmailDelivery
        });
        verificationEmailSent = !emailResult?.skipped;
      } catch (emailError) {
        verificationEmailSent = false;
        console.error(
          `[REQ ${req.id}] Failed to send verification email:`,
          emailError
        );
      }

      res.apiSuccess(
        {
          message: verificationEmailSent
            ? 'Account created successfully. Check your email to verify it.'
            : 'Account created successfully, but the verification email could not be sent.',
          verificationEmailSent,
          account: serializeAccount(account),
          ...(activePartyConflict ? { activePartyConflict } : {})
        },
        201
      );
    } catch (err) {
      if (err?.code === 11000) {
        const duplicateField = Object.keys(err.keyPattern || {})[0];
        const duplicateDetails = duplicateField
          ? { [duplicateField]: `${duplicateField} is already registered` }
          : undefined;

        return res.apiError({
          status: 409,
          code: 'account_already_exists',
          message: 'Account already exists',
          details: duplicateDetails
        });
      }

      console.error(`[REQ ${req.id}] Failed to create account:`, err);
      res.apiError({
        status: 500,
        code: 'account_create_failed',
        message: 'Failed to create account'
      });
    }
  });

  app.get('/api/accounts/verify-email', async (req, res) => {
    const params = new URLSearchParams();
    if (typeof req.query.token === 'string' && req.query.token) {
      params.set('token', req.query.token);
    }
    if (
      typeof req.query.emailTrackingId === 'string' &&
      req.query.emailTrackingId
    ) {
      params.set('emailTrackingId', req.query.emailTrackingId);
    }
    const query = params.toString();
    res.redirect(`/verify-email${query ? `?${query}` : ''}`);
  });

  app.post('/api/accounts/verify-email/complete', async (req, res) => {
    const token =
      typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const tokenHash = token ? hashEmailVerificationToken(token) : '';

    if (!tokenHash) {
      return res.apiError({
        status: 400,
        code: 'invalid_email_verification_token',
        message: 'This email confirmation link is invalid or has expired'
      });
    }

    try {
      const now = new Date();
      const account = await Account.findOneAndUpdate(
        {
          'security.emailVerification.tokenHash': tokenHash,
          'security.emailVerification.expiresAt': { $gt: now },
          'security.emailVerification.completedAt': null
        },
        {
          $set: {
            'profile.emailVerified': true,
            'profile.emailVerifiedAt': now,
            'profile.accountStatus': 'active',
            'security.emailVerification.completedAt': now
          },
          $unset: {
            'security.emailVerification.tokenHash': '',
            'security.emailVerification.expiresAt': ''
          }
        },
        { new: true, runValidators: false }
      );

      if (!account) {
        return res.apiError({
          status: 400,
          code: 'invalid_email_verification_token',
          message: 'This email confirmation link is invalid or has expired'
        });
      }

      let signedIn = true;
      let activePartyConflict = null;
      try {
        const sessionResult =
          (await establishAccountSession(req, res, account)) || {};
        activePartyConflict = sessionResult.activePartyConflict || null;
      } catch (sessionError) {
        signedIn = false;
        console.error(
          `[REQ ${req.id}] Email verified but automatic sign in failed:`,
          sessionError
        );
      }

      await recordEmailConversion?.({
        EmailDelivery,
        trackingId:
          typeof req.body?.emailTrackingId === 'string'
            ? req.body.emailTrackingId
            : ''
      });

      try {
        await recordProfileCompletionAchievement(account, 'email-verified');
        await unlockAchievementByKey({
          Achievement,
          account,
          key: 'verified',
          source: 'email-verified'
        });
      } catch (achievementError) {
        console.error(
          `[REQ ${req.id}] Email verified but achievement processing failed:`,
          achievementError
        );
      }

      res.apiSuccess({
        message: signedIn
          ? 'Email confirmed. You are signed in.'
          : 'Email confirmed, but automatic sign in failed. Please sign in.',
        signedIn,
        account: serializeAccount(account),
        ...(activePartyConflict ? { activePartyConflict } : {})
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to verify account email:`, err);
      res.apiError({
        status: 500,
        code: 'email_verification_failed',
        message: 'Email confirmation failed. Try again later.'
      });
    }
  });

  app.post('/api/accounts/verify-email/request', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to request a verification email'
      });
    }

    if (account.profile?.emailVerified) {
      return res.apiSuccess({
        message: 'Email is already verified',
        account: serializeAccount(account)
      });
    }

    if (!assertAuthThrottle(req, res, 'emailVerification', account._id)) return;

    try {
      const emailVerificationToken = createEmailVerificationToken();
      const emailVerificationExpiresAt = new Date(
        Date.now() + 1000 * 60 * 60 * 24
      );

      account.security.emailVerification = {
        tokenHash: hashEmailVerificationToken(emailVerificationToken),
        requestedAt: new Date(),
        expiresAt: emailVerificationExpiresAt,
        completedAt: null,
        ipAddress: req.ip
      };
      await account.save();

      const emailResult = await sendVerificationEmail({
        req,
        to: account.email,
        verifyToken: emailVerificationToken,
        EmailAutomation,
        EmailTemplate,
        EmailDelivery
      });

      res.apiSuccess({
        message: emailResult?.skipped
          ? 'Verification email could not be sent because email delivery is not configured.'
          : 'Verification email sent.',
        verificationEmailSent: !emailResult?.skipped,
        account: serializeAccount(account)
      });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to request verification email:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'verification_email_request_failed',
        message: 'Failed to send verification email'
      });
    }
  });

  app.post('/api/accounts/email-change/request', async (req, res) => {
    const account = await getCurrentAccount(req);

    if (!account) {
      return res.apiError({
        status: 401,
        code: 'account_required',
        message: 'Sign in to request an email change'
      });
    }

    if (!requireVerifiedAccount(res, account, 'change your email')) return;

    if (!assertAuthThrottle(req, res, 'emailChange', account._id)) return;

    try {
      const emailChangeToken = createEmailChangeToken();
      account.security.emailChangeRequest = {
        tokenHash: hashEmailChangeToken(emailChangeToken),
        requestedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        completedAt: null,
        ipAddress: req.ip
      };
      await account.save();

      const emailResult = await sendEmailChangeEmail({
        req,
        to: account.email,
        changeToken: emailChangeToken,
        EmailAutomation,
        EmailTemplate,
        EmailDelivery
      });

      res.apiSuccess({
        message: emailResult?.skipped
          ? 'Email change link could not be sent because email delivery is not configured.'
          : 'Email change link sent to your current email.',
        emailChangeEmailSent: !emailResult?.skipped
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to request email change:`, err);
      res.apiError({
        status: 500,
        code: 'email_change_request_failed',
        message: 'Failed to send email change link'
      });
    }
  });

  app.post('/api/accounts/email-change/complete', async (req, res) => {
    const emailChangeInput = normalizeEmailChangeInput(req.body);
    const validationErrors = validateEmailChangeInput(emailChangeInput);

    if (Object.keys(validationErrors).length) {
      return res.apiError({
        status: 400,
        code: 'email_change_validation_failed',
        message: 'Email change details are invalid',
        details: validationErrors
      });
    }

    try {
      const now = new Date();
      const tokenHash = hashEmailChangeToken(emailChangeInput.token);
      const account = await Account.findOne({
        'security.emailChangeRequest.tokenHash': tokenHash,
        'security.emailChangeRequest.expiresAt': { $gt: now },
        'security.emailChangeRequest.completedAt': null
      }).select('+passwordHash +security +profile.emailHistory');

      if (!account) {
        return res.apiError({
          status: 400,
          code: 'invalid_email_change_token',
          message: 'Email change link is invalid or expired'
        });
      }

      const passwordMatches = await bcrypt.compare(
        emailChangeInput.password,
        account.passwordHash
      );
      if (!passwordMatches) {
        return res.apiError({
          status: 401,
          code: 'invalid_email_change_password',
          message: 'Current password is incorrect'
        });
      }

      const duplicateAccount = await Account.exists({
        _id: { $ne: account._id },
        email: emailChangeInput.email
      });
      if (duplicateAccount) {
        return res.apiError({
          status: 409,
          code: 'email_already_registered',
          message: 'Email is already registered',
          details: { email: 'Email is already registered' }
        });
      }

      const previousEmail = account.email;
      const emailVerificationToken = createEmailVerificationToken();
      if (
        account.legalConsent?.marketingConsentStatus === 'accepted' ||
        account.profile?.notificationPreferences?.marketingEmail === true
      ) {
        applyMarketingConsent(account, {
          accepted: false,
          req,
          source: 'email_change'
        });
      }
      account.email = emailChangeInput.email;
      account.profile.emailVerified = false;
      account.profile.emailVerifiedAt = null;
      account.profile.accountStatus = 'pending_verification';
      account.security.emailVerification = {
        tokenHash: hashEmailVerificationToken(emailVerificationToken),
        requestedAt: now,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        completedAt: null,
        ipAddress: req.ip
      };
      account.profile.emailHistory.push({
        value: previousEmail,
        changedAt: now,
        changedBy: account._id
      });
      account.security.emailChangeHistory.push({
        value: previousEmail,
        changedAt: now,
        changedBy: account._id
      });
      account.security.emailChangeRequest.completedAt = now;
      account.security.emailChangeRequest.tokenHash = null;
      await account.save();

      await recordEmailConversion?.({
        EmailDelivery,
        trackingId: String(req.body?.emailTrackingId || '')
      });

      await sendVerificationEmail({
        req,
        to: account.email,
        verifyToken: emailVerificationToken,
        EmailAutomation,
        EmailTemplate,
        EmailDelivery
      }).catch((emailError) => {
        console.error(
          `[REQ ${req.id}] Failed to send new email verification:`,
          emailError
        );
      });

      res.apiSuccess({
        message: 'Email address updated. Please verify your new email.',
        account: serializeAccount(account)
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.apiError({
          status: 409,
          code: 'email_already_registered',
          message: 'Email is already registered',
          details: { email: 'Email is already registered' }
        });
      }

      console.error(`[REQ ${req.id}] Failed to change email:`, err);
      res.apiError({
        status: 500,
        code: 'email_change_failed',
        message: 'Failed to change email'
      });
    }
  });
}

module.exports = { registerAccountRegistrationRoutes };

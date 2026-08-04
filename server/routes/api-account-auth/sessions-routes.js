function registerAccountSessionsRoutes(context) {
  const {
    app,
    normalizePasswordResetRequestInput,
    validatePasswordResetRequestInput,
    assertAuthThrottle,
    Account,
    createPasswordResetToken,
    hashPasswordResetToken,
    sendPasswordResetEmail,
    EmailAutomation,
    EmailTemplate,
    EmailDelivery,
    recordEmailConversion,
    isProduction,
    normalizePasswordResetInput,
    validatePasswordResetInput,
    bcrypt,
    accountSaltRounds,
    normalizeLoginInput,
    validateLoginInput,
    getAccountLockoutSeconds,
    recordFailedLogin,
    getRequestedOeIcon,
    isDefaultOeIcon,
    establishAccountSession,
    serializeAccount,
    getCurrentAccount,
    getCookieValue,
    hashSessionToken
  } = context;

  app.post('/api/accounts/password-reset/request', async (req, res) => {
    const resetInput = normalizePasswordResetRequestInput(req.body);
    const validationErrors = validatePasswordResetRequestInput(resetInput);

    if (Object.keys(validationErrors).length) {
      return res.apiError({
        status: 400,
        code: 'password_reset_request_validation_failed',
        message: 'Password reset details are invalid',
        details: validationErrors
      });
    }

    if (!assertAuthThrottle(req, res, 'passwordReset', resetInput.identifier)) {
      return;
    }

    const identifierQuery = resetInput.identifier.includes('@')
      ? { email: resetInput.identifier.toLowerCase() }
      : { username: resetInput.identifier };

    try {
      const account = await Account.findOne(identifierQuery).select('email');
      let resetEmailDelivery = process.env.RESEND_API_KEY
        ? 'not_attempted'
        : 'email_service_not_configured';

      if (account?.email) {
        const resetToken = createPasswordResetToken();
        const resetRequest = {
          tokenHash: hashPasswordResetToken(resetToken),
          requestedAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          ipAddress: req.ip
        };

        await Account.updateOne(
          { _id: account._id },
          {
            $push: {
              'security.passwordResetRequests': {
                $each: [resetRequest],
                $slice: -5
              }
            }
          },
          { runValidators: false }
        );

        try {
          const emailResult = await sendPasswordResetEmail({
            req,
            to: account.email,
            resetToken,
            EmailAutomation,
            EmailTemplate,
            EmailDelivery
          });
          resetEmailDelivery = emailResult?.skipped ? 'skipped' : 'sent';
        } catch (emailError) {
          resetEmailDelivery = 'failed';
          console.error(
            `[REQ ${req.id}] Failed to send password reset email:`,
            emailError
          );
        }
      }

      const responsePayload = {
        message:
          'If an account matches those details, a password reset link has been sent.'
      };

      if (!isProduction) {
        responsePayload.resetEmailDelivery = resetEmailDelivery;
        if (resetEmailDelivery === 'email_service_not_configured') {
          responsePayload.message =
            'Password reset email was not sent because RESEND_API_KEY is not configured.';
        } else if (resetEmailDelivery === 'failed') {
          responsePayload.message =
            'Password reset email could not be sent. Check the server log for provider details.';
        }
      }

      res.apiSuccess({
        ...responsePayload
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to request password reset:`, err);
      res.apiError({
        status: 500,
        code: 'password_reset_request_failed',
        message: 'Failed to request password reset'
      });
    }
  });

  app.post('/api/accounts/password-reset/complete', async (req, res) => {
    const resetInput = normalizePasswordResetInput(req.body);
    const validationErrors = validatePasswordResetInput(resetInput);

    if (Object.keys(validationErrors).length) {
      return res.apiError({
        status: 400,
        code: 'password_reset_validation_failed',
        message: 'Password reset details are invalid',
        details: validationErrors
      });
    }

    try {
      const tokenHash = hashPasswordResetToken(resetInput.token);
      const passwordHash = await bcrypt.hash(
        resetInput.password,
        accountSaltRounds
      );
      const now = new Date();
      const result = await Account.updateOne(
        {
          'security.passwordResetRequests': {
            $elemMatch: {
              tokenHash,
              expiresAt: { $gt: now },
              completedAt: null
            }
          }
        },
        {
          $set: {
            passwordHash,
            'security.passwordChangedAt': now,
            'security.failedLoginAttempts': 0,
            'security.lockoutExpiresAt': null,
            'security.sessions': [],
            'security.passwordResetRequests.$.tokenHash': null,
            'security.passwordResetRequests.$.completedAt': now
          }
        },
        { runValidators: false }
      );

      if (!result.modifiedCount) {
        return res.apiError({
          status: 400,
          code: 'invalid_password_reset_token',
          message: 'Password reset link is invalid or expired'
        });
      }

      await recordEmailConversion?.({
        EmailDelivery,
        trackingId: String(req.body?.emailTrackingId || '')
      });

      res.clearCookie('oe_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure
      });
      res.apiSuccess({
        message: 'Password updated. You can sign in with your new password.'
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to reset password:`, err);
      res.apiError({
        status: 500,
        code: 'password_reset_failed',
        message: 'Failed to reset password'
      });
    }
  });

  app.post('/api/accounts/login', async (req, res) => {
    const loginInput = normalizeLoginInput(req.body);
    const validationErrors = validateLoginInput(loginInput);

    if (Object.keys(validationErrors).length) {
      return res.apiError({
        status: 400,
        code: 'login_validation_failed',
        message: 'Sign in details are invalid',
        details: validationErrors
      });
    }

    if (!assertAuthThrottle(req, res, 'login', loginInput.identifier)) return;

    const identifierQuery = loginInput.identifier.includes('@')
      ? { email: loginInput.identifier.toLowerCase() }
      : { username: loginInput.identifier };

    try {
      const account = await Account.findOne(identifierQuery).select(
        '+passwordHash +security'
      );

      const lockoutSeconds = getAccountLockoutSeconds(account);
      if (lockoutSeconds > 0) {
        res.setHeader('Retry-After', String(lockoutSeconds));
        return res.apiError({
          status: 423,
          code: 'account_temporarily_locked',
          message: 'Too many failed sign in attempts. Try again later.'
        });
      }

      const passwordMatches =
        account &&
        (await bcrypt.compare(loginInput.password, account.passwordHash));

      if (!account || !passwordMatches) {
        await recordFailedLogin(account, req);
        return res.apiError({
          status: 401,
          code: 'invalid_login',
          message: 'Email, username, or password is incorrect'
        });
      }

      const requestedOeIcon = getRequestedOeIcon(req);
      if (requestedOeIcon && isDefaultOeIcon(account.profile?.oeIcon)) {
        account.profile.oeIcon = requestedOeIcon;
        account.profile.lastProfileUpdatedAt = new Date();
        await account.save();
      }

      const sessionResult =
        (await establishAccountSession(req, res, account)) || {};
      const { activePartyConflict = null } = sessionResult;

      res.apiSuccess({
        message: 'Signed in successfully',
        account: serializeAccount(account),
        ...(activePartyConflict ? { activePartyConflict } : {})
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to sign in:`, err);
      res.apiError({
        status: 500,
        code: 'login_failed',
        message: 'Failed to sign in'
      });
    }
  });

  app.get('/api/accounts/me', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (account) {
        const lastSeenAt = new Date();
        await Account.updateOne(
          { _id: account._id },
          { $set: { 'analytics.lastSeenAt': lastSeenAt } }
        );
        await account.populate({
          path: 'gameData.friendsAndBlockedUsers.accountId',
          select:
            'username profile.oeIcon profile.lastLoginAt analytics.lastSeenAt'
        });
      }

      res.apiSuccess({
        account: account ? serializeAccount(account) : null
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch current account:`, err);
      res.apiError({
        status: 500,
        code: 'account_fetch_failed',
        message: 'Failed to fetch account'
      });
    }
  });

  app.post('/api/accounts/activity', async (req, res) => {
    try {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.apiError({
          status: 401,
          code: 'account_required',
          message: 'Sign in to record account activity'
        });
      }

      const lastSeenAt = new Date();
      const sessionToken = getCookieValue(req.headers.cookie, 'oe_session');
      const tokenHash = sessionToken ? hashSessionToken(sessionToken) : null;
      const set = { 'analytics.lastSeenAt': lastSeenAt };
      const updateOptions = {};

      if (tokenHash) {
        set['security.sessions.$[session].lastUsedAt'] = lastSeenAt;
        updateOptions.arrayFilters = [{ 'session.tokenHash': tokenHash }];
      }

      await Account.updateOne(
        { _id: account._id },
        { $set: set },
        updateOptions
      );

      res.apiSuccess({ lastSeenAt });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to record account activity:`, err);
      res.apiError({
        status: 500,
        code: 'account_activity_failed',
        message: 'Failed to record account activity'
      });
    }
  });
}

module.exports = { registerAccountSessionsRoutes };

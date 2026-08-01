const {
  createPublicSessionId,
  getRequestDevice
} = require('../../../services/account-session-tools');

function createOAuthSessionTools({
  Account,
  crypto,
  maxStoredAccountSessions,
  clearExpiredAccountSessions,
  createSessionToken,
  hashSessionToken,
  upgradeGuestPartyIdentityForAccount
}) {
  async function establishAccountSession(req, res, account) {
    const sessionToken = createSessionToken();
    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const loginAt = new Date();
    const sessionId = createPublicSessionId(crypto);
    const device = getRequestDevice(req);

    await clearExpiredAccountSessions(account._id);

    await Account.updateOne(
      { _id: account._id },
      {
        $set: {
          'profile.lastLoginAt': loginAt,
          'security.failedLoginAttempts': 0,
          'security.lockoutExpiresAt': null
        },
        $push: {
          'security.sessions': {
            $each: [
              {
                sessionId,
                tokenHash: hashSessionToken(sessionToken),
                ipAddress: req.ip,
                device,
                createdAt: loginAt,
                lastUsedAt: loginAt,
                expiresAt: sessionExpiresAt
              }
            ],
            $slice: -maxStoredAccountSessions
          },
          'security.loginHistory': {
            ipAddress: req.ip,
            device,
            successful: true
          }
        }
      },
      { runValidators: false }
    );

    account.profile = {
      ...(account.profile?.toObject?.() || account.profile || {}),
      lastLoginAt: loginAt
    };
    account.security = {
      ...(account.security?.toObject?.() || account.security || {}),
      failedLoginAttempts: 0,
      lockoutExpiresAt: null
    };

    if (Array.isArray(account.security.sessions)) {
      account.security.sessions.push({
        sessionId,
        tokenHash: hashSessionToken(sessionToken),
        ipAddress: req.ip,
        device,
        createdAt: loginAt,
        lastUsedAt: loginAt,
        expiresAt: sessionExpiresAt
      });
    }

    if (Array.isArray(account.security.loginHistory)) {
      account.security.loginHistory.push({
        ipAddress: req.ip,
        device,
        successful: true
      });
    }

    res.cookie('oe_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      expires: sessionExpiresAt
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
        `[REQ ${req.id}] Failed to upgrade guest party identity:`,
        err
      );
    }

    return activePartyConflict ? { activePartyConflict } : {};
  }

  return { establishAccountSession };
}

module.exports = { createOAuthSessionTools };

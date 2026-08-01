const {
  getActiveSerializedSessions
} = require('../../services/account-session-tools');

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function registerAccountDeviceSessionsRoutes(context) {
  const { app, Account, getCookieValue, getCurrentAccount, hashSessionToken } =
    context;

  function getCurrentTokenHash(req) {
    const sessionToken = getCookieValue(req.headers.cookie, 'oe_session');
    return sessionToken ? hashSessionToken(sessionToken) : '';
  }

  async function requireAccount(req, res, action) {
    const account = await getCurrentAccount(req);
    if (account) return account;

    res.apiError({
      status: 401,
      code: 'account_required',
      message: `Sign in to ${action}`
    });
    return null;
  }

  app.get('/api/accounts/sessions', async (req, res) => {
    try {
      const account = await requireAccount(req, res, 'view your sessions');
      if (!account) return;

      res.apiSuccess({
        sessions: getActiveSerializedSessions(account, getCurrentTokenHash(req))
      });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to fetch account sessions:`, err);
      res.apiError({
        status: 500,
        code: 'account_sessions_fetch_failed',
        message: 'Failed to fetch account sessions'
      });
    }
  });

  app.delete('/api/accounts/sessions/:sessionId', async (req, res) => {
    const sessionId = String(req.params?.sessionId || '').trim();
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return res.apiError({
        status: 400,
        code: 'invalid_session_id',
        message: 'Session is invalid'
      });
    }

    try {
      const account = await requireAccount(req, res, 'manage your sessions');
      if (!account) return;

      const currentTokenHash = getCurrentTokenHash(req);
      const target = (account.security?.sessions || []).find(
        (session) => session?.sessionId === sessionId
      );

      if (target?.tokenHash === currentTokenHash) {
        return res.apiError({
          status: 409,
          code: 'current_session_requires_logout',
          message: 'Use the normal sign out action for this device'
        });
      }

      await Account.updateOne(
        { _id: account._id },
        {
          $pull: {
            'security.sessions': {
              sessionId,
              tokenHash: { $ne: currentTokenHash }
            }
          }
        },
        { runValidators: false }
      );

      res.apiSuccess({ message: 'Device signed out' });
    } catch (err) {
      console.error(`[REQ ${req.id}] Failed to revoke account session:`, err);
      res.apiError({
        status: 500,
        code: 'account_session_revoke_failed',
        message: 'Failed to sign out that device'
      });
    }
  });

  app.post('/api/accounts/sessions/logout-others', async (req, res) => {
    try {
      const account = await requireAccount(req, res, 'manage your sessions');
      if (!account) return;

      const currentTokenHash = getCurrentTokenHash(req);
      await Account.updateOne(
        { _id: account._id },
        {
          $pull: {
            'security.sessions': { tokenHash: { $ne: currentTokenHash } }
          }
        },
        { runValidators: false }
      );

      res.apiSuccess({ message: 'Other devices signed out' });
    } catch (err) {
      console.error(
        `[REQ ${req.id}] Failed to revoke other account sessions:`,
        err
      );
      res.apiError({
        status: 500,
        code: 'account_sessions_revoke_failed',
        message: 'Failed to sign out other devices'
      });
    }
  });
}

module.exports = { registerAccountDeviceSessionsRoutes };

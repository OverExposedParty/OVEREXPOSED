function createOAuthCallbackSupport(context) {
  const {
    getCookieValue,
    getSupportedOAuthProvider,
    parseOAuthState,
    parseOAuthCookie,
    buildLoginRedirect,
    getSafeReturnToPath,
    getSafeSplashScreenPath,
    getOAuthProviderConfig,
    fetchOAuthToken,
    fetchOAuthProfile,
    getSignupContext,
    createSignupLegalConsent,
    getCurrentAccount,
    linkOAuthProviderToAccount,
    findOrCreateSocialAccount,
    establishAccountSession,
    serializeAccount
  } = context;

  async function handleOAuthCallback(req, res) {
    const provider = getSupportedOAuthProvider(req.params.provider);
    const authBody = req.method === 'POST' ? req.body || {} : req.query || {};
    const state = typeof authBody.state === 'string' ? authBody.state : '';
    const code = typeof authBody.code === 'string' ? authBody.code : '';
    const parsedState = parseOAuthState(state);
    const expectedStateId = getCookieValue(
      req.headers.cookie,
      'oe_oauth_state'
    );
    const oauthContext = parseOAuthCookie(
      getCookieValue(req.headers.cookie, 'oe_oauth_context')
    );

    res.clearCookie('oe_oauth_state');
    res.clearCookie('oe_oauth_context');

    if (
      !provider ||
      !code ||
      !parsedState ||
      parsedState.provider !== provider ||
      parsedState.stateId !== (oauthContext.stateId || expectedStateId)
    ) {
      return res.redirect(
        buildLoginRedirect({
          auth: 'error',
          message: 'Social sign in could not be verified',
          returnTo: getSafeReturnToPath(parsedState?.returnTo),
          splashScreen: getSafeSplashScreenPath(parsedState?.splashScreen)
        })
      );
    }

    const config = getOAuthProviderConfig(req, provider);

    try {
      const tokenPayload = await fetchOAuthToken(
        config,
        code,
        oauthContext.codeVerifier
      );
      const profile = await fetchOAuthProfile(
        provider,
        config,
        tokenPayload,
        authBody
      );

      if (!profile.providerUserId) {
        throw new Error(`${provider} did not return a user id`);
      }

      const linkMode = parsedState.mode === 'link';
      const signupContext =
        parsedState.mode === 'signup'
          ? getSignupContext(req, parsedState.signupReferrerPath)
          : null;
      const legalConsent =
        parsedState.mode === 'signup' && parsedState.legalConsentAccepted
          ? createSignupLegalConsent(req)
          : null;
      const currentAccount = linkMode ? await getCurrentAccount(req) : null;
      if (linkMode && !currentAccount) {
        throw new Error('Sign in before linking a sign in method');
      }

      const account = linkMode
        ? await linkOAuthProviderToAccount(currentAccount, provider, profile)
        : await findOrCreateSocialAccount(
            provider,
            profile,
            signupContext,
            legalConsent
          );

      const sessionResult = !linkMode
        ? (await establishAccountSession(req, res, account)) || {}
        : {};
      const activePartyCode = sessionResult.activePartyConflict?.partyCode;
      const activePartyGamemode = sessionResult.activePartyConflict?.gamemode;
      const returnTo = getSafeReturnToPath(parsedState.returnTo);
      const canAccessOePanel = serializeAccount(account).canAccessOePanel;

      if (activePartyCode) {
        res.redirect(
          buildLoginRedirect({
            auth: 'success',
            provider,
            activePartyCode,
            activePartyGamemode,
            returnTo: returnTo || (canAccessOePanel ? '/oe-panel' : '/'),
            splashScreen: getSafeSplashScreenPath(parsedState.splashScreen)
          })
        );
        return;
      }

      if (returnTo) {
        res.redirect(
          buildLoginRedirect({
            auth: 'success',
            provider,
            returnTo,
            splashScreen: getSafeSplashScreenPath(parsedState.splashScreen)
          })
        );
        return;
      }

      if (canAccessOePanel) {
        res.redirect('/oe-panel');
        return;
      }

      res.redirect(
        buildLoginRedirect({
          auth: 'success',
          provider
        })
      );
    } catch (err) {
      console.error(`[REQ ${req.id}] ${provider} OAuth failed:`, err);
      res.redirect(
        buildLoginRedirect({
          auth: 'error',
          message: err.message || 'Social sign in failed',
          returnTo: getSafeReturnToPath(parsedState?.returnTo),
          splashScreen: getSafeSplashScreenPath(parsedState?.splashScreen)
        })
      );
    }
  }

  return {
    handleOAuthCallback
  };
}

module.exports = { createOAuthCallbackSupport };

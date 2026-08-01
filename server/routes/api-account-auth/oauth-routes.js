function registerAccountOauthRoutes(context) {
  const {
    app,
    getSupportedOAuthProvider,
    getOAuthMode,
    getSafeReturnToPath,
    getSafeSplashScreenPath,
    buildLoginRedirect,
    getCurrentAccount,
    getOAuthProviderConfig,
    createOAuthState,
    createPkcePair,
    serializeOAuthCookie,
    handleOAuthCallback
  } = context;

  app.get('/api/auth/:provider/start', async (req, res) => {
    const provider = getSupportedOAuthProvider(req.params.provider);
    const mode = getOAuthMode(req.query.mode);
    const returnTo = getSafeReturnToPath(req.query.returnTo);
    const splashScreen = getSafeSplashScreenPath(req.query.splashScreen);
    const legalConsentAccepted =
      req.query.legalConsentAccepted === 'true' ||
      req.query.legalConsentAccepted === true;

    if (!provider) {
      return res.redirect(
        buildLoginRedirect({
          auth: 'error',
          message:
            req.params.provider === 'whatsapp'
              ? 'WhatsApp does not provide a standard account sign in for websites. Use Apple, Discord, Snapchat, Google, or email.'
              : 'That sign in provider is not supported yet',
          returnTo,
          splashScreen
        })
      );
    }

    if (mode === 'link') {
      const account = await getCurrentAccount(req);
      if (!account) {
        return res.redirect(
          buildLoginRedirect({
            auth: 'error',
            message: 'Sign in before linking a sign in method',
            returnTo,
            splashScreen
          })
        );
      }
    }

    const config = getOAuthProviderConfig(req, provider);
    if (!config.clientId || !config.clientSecret) {
      return res.redirect(
        buildLoginRedirect({
          auth: 'error',
          message: `${provider} sign in is not configured yet`,
          returnTo,
          splashScreen
        })
      );
    }

    const { stateId, payload } = createOAuthState({
      provider,
      mode,
      returnTo,
      splashScreen,
      legalConsentAccepted
    });
    const pkcePair = config.usePkce ? createPkcePair() : null;
    const authorizeUrl = new URL(config.authorizeUrl);
    authorizeUrl.searchParams.set('client_id', config.clientId);
    authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
    authorizeUrl.searchParams.set(
      'response_type',
      config.responseType || 'code'
    );
    authorizeUrl.searchParams.set('scope', config.scope);
    authorizeUrl.searchParams.set('state', payload);

    if (config.responseMode) {
      authorizeUrl.searchParams.set('response_mode', config.responseMode);
    }

    if (pkcePair) {
      authorizeUrl.searchParams.set('code_challenge', pkcePair.challenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    }

    res.cookie('oe_oauth_state', stateId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure,
      maxAge: 1000 * 60 * 10
    });
    res.cookie(
      'oe_oauth_context',
      serializeOAuthCookie({
        stateId,
        codeVerifier: pkcePair?.verifier || null
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        maxAge: 1000 * 60 * 10
      }
    );
    res.redirect(authorizeUrl.toString());
  });

  app.get('/api/auth/:provider/callback', handleOAuthCallback);

  app.post('/api/auth/:provider/callback', handleOAuthCallback);
}

module.exports = { registerAccountOauthRoutes };

function createOAuthStateTools({ crypto, getRequestBaseUrl }) {
  const authEntryPoints = new Set([
    'direct_auth_url',
    'account_notification',
    'account_container',
    'protected_page',
    'auth_page_tab'
  ]);

  function getAuthEntryPoint(value) {
    return authEntryPoints.has(value) ? value : 'direct_auth_url';
  }

  function getOAuthMode(mode) {
    if (mode === 'signup') return 'signup';
    if (mode === 'link') return 'link';
    return 'sign-in';
  }

  function getSafeReturnToPath(returnTo) {
    if (typeof returnTo !== 'string' || !returnTo.trim()) return '';

    try {
      const returnUrl = new URL(returnTo, 'http://overexposed.local');
      if (returnUrl.origin !== 'http://overexposed.local') return '';
      if (
        returnUrl.pathname === '/login' ||
        returnUrl.pathname === '/sign-in'
      ) {
        return '';
      }

      return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
    } catch {
      return '';
    }
  }

  function getSignupSourceFromPath(referrerPath) {
    if (!referrerPath) return null;
    if (referrerPath.startsWith('/overexposure')) return 'overexposure';
    if (referrerPath.startsWith('/party-games')) return 'party_games';
    if (referrerPath.startsWith('/shop')) return 'shop';
    if (referrerPath.startsWith('/oe-panel')) return 'oe_panel';
    if (referrerPath === '/') return 'home';
    return 'website';
  }

  function getSignupContext(req, returnTo) {
    const referrerPath = getSafeReturnToPath(returnTo);
    const fallbackRefererPath = getSafeReturnToPath(req.get('referer'));
    const safeReferrerPath = referrerPath || fallbackRefererPath;

    if (!safeReferrerPath) return null;

    return {
      referrerPath: safeReferrerPath,
      referrerUrl: `${getRequestBaseUrl(req)}${safeReferrerPath}`,
      source: getSignupSourceFromPath(safeReferrerPath),
      capturedAt: new Date()
    };
  }

  function getSafeSplashScreenPath(splashScreen) {
    const fallbackPath = '/images/splash-screens/overexposed.png';
    if (typeof splashScreen !== 'string' || !splashScreen.trim()) {
      return fallbackPath;
    }

    try {
      const splashUrl = new URL(splashScreen, 'http://overexposed.local');
      if (
        splashUrl.origin !== 'http://overexposed.local' ||
        !splashUrl.pathname.startsWith('/images/splash-screens/')
      ) {
        return fallbackPath;
      }

      return splashUrl.pathname;
    } catch {
      return fallbackPath;
    }
  }

  function buildLoginRedirect(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
    });

    const query = searchParams.toString();
    return query ? `/sign-in?${query}` : '/sign-in';
  }

  function createOAuthState({
    provider,
    mode,
    returnTo,
    splashScreen,
    legalConsentAccepted = false,
    marketingEmailOptIn = false,
    authEntryPoint = 'direct_auth_url'
  }) {
    const stateId = crypto.randomBytes(18).toString('base64url');
    const safeReturnTo = getSafeReturnToPath(returnTo);
    const safeMode = getOAuthMode(mode);
    const payload = Buffer.from(
      JSON.stringify({
        stateId,
        provider,
        mode: safeMode,
        returnTo: safeReturnTo,
        signupReferrerPath: safeMode === 'signup' ? safeReturnTo : '',
        splashScreen: getSafeSplashScreenPath(splashScreen),
        legalConsentAccepted:
          safeMode === 'signup' && legalConsentAccepted === true,
        marketingEmailOptIn:
          safeMode === 'signup' && marketingEmailOptIn === true,
        authEntryPoint: getAuthEntryPoint(authEntryPoint)
      }),
      'utf8'
    ).toString('base64url');

    return { stateId, payload };
  }

  function parseOAuthState(state) {
    try {
      return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  }

  function createPkcePair() {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return { verifier, challenge };
  }

  function serializeOAuthCookie({
    stateId,
    codeVerifier = null,
    legalConsentAccepted = false,
    marketingEmailOptIn = false
  }) {
    return Buffer.from(
      JSON.stringify({
        stateId,
        codeVerifier,
        legalConsentAccepted: legalConsentAccepted === true,
        marketingEmailOptIn: marketingEmailOptIn === true
      }),
      'utf8'
    ).toString('base64url');
  }

  function parseOAuthCookie(cookieValue) {
    try {
      const parsed = JSON.parse(
        Buffer.from(cookieValue, 'base64url').toString('utf8')
      );

      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Older cookies stored only the state id as plain text.
    }

    return {
      stateId: cookieValue,
      codeVerifier: null,
      legalConsentAccepted: false,
      marketingEmailOptIn: false
    };
  }

  return {
    getOAuthMode,
    getSafeReturnToPath,
    getSignupSourceFromPath,
    getSignupContext,
    getSafeSplashScreenPath,
    buildLoginRedirect,
    createOAuthState,
    parseOAuthState,
    createPkcePair,
    serializeOAuthCookie,
    parseOAuthCookie
  };
}

module.exports = { createOAuthStateTools };

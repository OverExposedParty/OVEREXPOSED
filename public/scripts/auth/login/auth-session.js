(function () {
  const PARTY_CODE_PATH_PATTERN = /^\/([A-Z0-9]{3}-[A-Z0-9]{3})\/?$/i;
  const PARTY_GAMEMODE_STORAGE_PREFIX = 'oe-waiting-room-gamemode:';
  const PARTY_GAMEMODES = new Set([
    'truth-or-dare',
    'paranoia',
    'never-have-i-ever',
    'most-likely-to',
    'imposter',
    'would-you-rather',
    'mafia'
  ]);
  const PARTY_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;

  function createLoginAuthSession({ defaultOeIcon, setAuthStatus }) {
    const AUTH_ENTRY_POINTS = new Set([
      'direct_auth_url',
      'account_notification',
      'account_container',
      'protected_page',
      'auth_page_tab'
    ]);

    function getAuthEntryPoint() {
      const value = new URLSearchParams(window.location.search).get(
        'authEntryPoint'
      );
      return AUTH_ENTRY_POINTS.has(value) ? value : 'direct_auth_url';
    }

    function trackAuthCompletion(properties) {
      window.OEAnalytics?.track('auth.completed', properties);
      if (properties.entryPoint !== 'account_notification') return;
      window.OEAnalytics?.track('notification.conversion', {
        notificationKey: 'create_account_prompt',
        notificationType: 'account-prompt',
        flow: properties.flow,
        provider: properties.provider
      });
    }

    function getRememberedPartyResumePath(returnUrl) {
      const partyCodeMatch = returnUrl.pathname.match(PARTY_CODE_PATH_PATTERN);
      if (!partyCodeMatch) return '';

      const partyCode = partyCodeMatch[1].toUpperCase();
      let gamemode = '';
      try {
        gamemode = String(
          sessionStorage.getItem(
            `${PARTY_GAMEMODE_STORAGE_PREFIX}${partyCode}`
          ) || ''
        )
          .trim()
          .toLowerCase();
      } catch {
        return '';
      }

      if (!PARTY_GAMEMODES.has(gamemode)) return '';

      const searchParams = new URLSearchParams({ partyCode });
      return `/${gamemode}/settings?${searchParams.toString()}`;
    }

    function clearAuthResultFromUrl(searchParams) {
      searchParams.delete('auth');
      searchParams.delete('provider');
      searchParams.delete('message');
      searchParams.delete('activePartyCode');
      searchParams.delete('activePartyGamemode');
      const query = searchParams.toString();
      window.history.replaceState(
        {},
        document.title,
        query
          ? `${window.location.pathname}?${query}`
          : window.location.pathname
      );
    }

    function getReturnToPath() {
      const returnTo = new URLSearchParams(window.location.search).get(
        'returnTo'
      );
      if (!returnTo) return '';

      try {
        const returnUrl = new URL(returnTo, window.location.origin);
        if (returnUrl.origin !== window.location.origin) return '';
        if (
          returnUrl.pathname === '/login' ||
          returnUrl.pathname === '/sign-in'
        )
          return '';
        const partyResumePath = getRememberedPartyResumePath(returnUrl);
        if (partyResumePath) return partyResumePath;
        return `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
      } catch {
        return '';
      }
    }

    function getReturnSplashScreen() {
      const splashScreen = new URLSearchParams(window.location.search).get(
        'splashScreen'
      );
      return splashScreen?.startsWith('/images/splash-screens/')
        ? splashScreen
        : '/images/splash-screens/overexposed.png';
    }

    function navigateAfterAuth(path, options = {}) {
      if (typeof transitionSplashScreen === 'function') {
        transitionSplashScreen(path, getReturnSplashScreen(), options);
        return;
      }

      const beforeNavigate = options.beforeNavigate;
      if (beforeNavigate && typeof beforeNavigate.then === 'function') {
        Promise.resolve(beforeNavigate)
          .catch(() => {})
          .then(() => {
            window.location.href = path;
          });
        return;
      }

      window.location.href = path;
    }

    function showOAuthRedirectStatus() {
      const searchParams = new URLSearchParams(window.location.search);
      const emailVerified = searchParams.get('emailVerified');
      const authResult = searchParams.get('auth');
      if (emailVerified) {
        const messages = {
          success: ['Email confirmed. You can sign in now.', 'success'],
          invalid: ['Email confirmation link is invalid or expired.', 'error'],
          error: ['Email confirmation failed. Try again later.', 'error']
        };
        const [message, type] = messages[emailVerified] || [
          'Email confirmation failed.',
          'error'
        ];
        setAuthStatus(message, type);
        searchParams.delete('emailVerified');
        clearAuthResultFromUrl(searchParams);
        return;
      }
      if (authResult === 'success') {
        const provider = searchParams.get('provider');
        const activePartyCode = searchParams.get('activePartyCode');
        const activePartyGamemode = searchParams.get('activePartyGamemode');
        setAuthStatus(
          provider ? `Signed in with ${provider}.` : 'You are signed in.',
          'success'
        );
        trackAuthCompletion({
          flow: searchParams.get('flow') || 'signin',
          provider: provider || 'email',
          entryPoint: getAuthEntryPoint(),
          outcome: 'success'
        });
        clearAuthResultFromUrl(searchParams);
        if (
          activePartyCode &&
          showActivePartyConflict(
            {
              code: 'party_owner_active_party_exists',
              partyCode: activePartyCode,
              lobbyPath: `/${activePartyCode}`,
              ...(activePartyGamemode ? { gamemode: activePartyGamemode } : {})
            },
            {
              onDismiss: () => navigateAfterAuth(getReturnToPath() || '/')
            }
          )
        ) {
          return;
        }
        if (getReturnToPath()) navigateAfterAuth(getReturnToPath());
        return;
      }
      if (authResult === 'error') {
        window.OEAnalytics?.track('auth.failed', {
          flow: searchParams.get('flow') || 'signin',
          provider: searchParams.get('provider') || 'email',
          entryPoint: getAuthEntryPoint(),
          outcome: 'error',
          reason: 'oauth_error'
        });
        setAuthStatus(
          searchParams.get('message') || 'Social sign in failed.',
          'error'
        );
        clearAuthResultFromUrl(searchParams);
      }
    }

    function getFormData(form) {
      return Object.fromEntries(new FormData(form).entries());
    }

    function getLocalOeIcon() {
      const stored = localStorage.getItem('user-customisation');
      if (!stored) return defaultOeIcon;

      try {
        const customisation = JSON.parse(stored);
        return [
          customisation.colourSlotId,
          customisation.headSlotId,
          customisation.eyesSlotId,
          customisation.mouthSlotId
        ].join(':');
      } catch {
        return defaultOeIcon;
      }
    }

    function applyAccountOeIcon(account) {
      const oeIcon = account?.oeIcon;
      if (!oeIcon || oeIcon === defaultOeIcon) return;

      const [colourSlotId, headSlotId, eyesSlotId, mouthSlotId] =
        oeIcon.split(':');
      localStorage.setItem(
        'user-customisation',
        JSON.stringify({ colourSlotId, headSlotId, eyesSlotId, mouthSlotId })
      );
    }

    function getApiErrorMessage(payload, fallback) {
      const details = payload?.error?.details;
      if (details && typeof details === 'object') {
        const firstDetail = Object.values(details).find(Boolean);
        if (firstDetail) return firstDetail;
      }
      return payload?.error?.message || fallback;
    }

    async function postJson(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        const message = getApiErrorMessage(payload, 'Request failed');
        const requestId = payload?.requestId
          ? ` Request ID: ${payload.requestId}`
          : '';
        const error = new Error(`${message} (${response.status}).${requestId}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    function storeAccount(account) {
      if (!account) return;
      if (!localStorage.getItem('oe-account')) {
        const guestCustomisation = localStorage.getItem('user-customisation');
        if (guestCustomisation) {
          localStorage.setItem(
            'oe-guest-customisation',
            guestCustomisation
          );
        }
      }
      localStorage.removeItem('oe-guest');
      localStorage.setItem('oe-account', JSON.stringify(account));
      applyAccountOeIcon(account);
    }

    function redirectAfterLogin(account, options = {}) {
      const returnToPath = getReturnToPath();
      if (returnToPath) {
        navigateAfterAuth(returnToPath, options);
        return;
      }
      navigateAfterAuth(
        account?.canAccessOePanel ? '/oe-panel' : '/',
        options
      );
    }

    function getCurrentPartyLinkTarget() {
      const returnPath = getReturnToPath();
      if (!returnPath) return null;

      try {
        const returnUrl = new URL(returnPath, window.location.origin);
        const pathParts = returnUrl.pathname.split('/').filter(Boolean);
        let gamemode = '';
        let partyCode = '';

        if (pathParts.length === 2 && pathParts[1] === 'settings') {
          gamemode = pathParts[0];
          partyCode = String(returnUrl.searchParams.get('partyCode') || '')
            .trim()
            .toUpperCase();
        } else if (pathParts.length === 2) {
          gamemode = pathParts[0];
          partyCode = String(pathParts[1] || '')
            .trim()
            .toUpperCase();
        }

        const computerId = String(
          window.localStorage?.getItem('device-id') || ''
        ).trim();
        if (
          !PARTY_GAMEMODES.has(gamemode) ||
          !PARTY_CODE_PATTERN.test(partyCode) ||
          !computerId
        ) {
          return null;
        }

        return {
          apiRoute: `party-game-${gamemode}`,
          computerId,
          partyCode
        };
      } catch {
        return null;
      }
    }

    async function replaceActivePartyAndAttachAccount(
      conflictDialog,
      oldParty,
      target
    ) {
      await conflictDialog.endOwnedParty(oldParty);

      const response = await fetch(
        `/api/${target.apiRoute}/link-player-account?partyCode=${encodeURIComponent(target.partyCode)}`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partyId: target.partyCode,
            computerId: target.computerId
          })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        const error = new Error(
          payload?.error?.message ||
            'The account could not be attached to the current party.'
        );
        error.code = payload?.error?.code || 'party_account_link_failed';
        error.status = response.status;
        error.previousPartyExited = true;
        throw error;
      }
      return payload;
    }

    function showActivePartyConflict(
      conflict,
      {
        account = null,
        navigationOptions = {},
        onDismiss = null
      } = {}
    ) {
      const conflictDialog = window.ActivePartyConflictDialog;
      if (typeof conflictDialog?.openFromError !== 'function') return false;
      const currentPartyTarget = getCurrentPartyLinkTarget();

      return conflictDialog.openFromError(conflict, {
        source: 'account-link',
        onContinue:
          currentPartyTarget &&
          typeof conflictDialog.endOwnedParty === 'function'
            ? (party) =>
                replaceActivePartyAndAttachAccount(
                  conflictDialog,
                  party,
                  currentPartyTarget
                )
            : null,
        onDismiss:
          typeof onDismiss === 'function'
            ? onDismiss
            : () => redirectAfterLogin(account, navigationOptions)
      });
    }

    function continueAsGuest() {
      localStorage.removeItem('oe-account');
      localStorage.setItem('oe-guest', 'true');
      window.getOrCreateOeGuestUsername?.();
      setAuthStatus('Continuing as guest...', 'success');
      navigateAfterAuth(getReturnToPath() || '/');
    }

    return {
      continueAsGuest,
      getAuthEntryPoint,
      getFormData,
      getLocalOeIcon,
      getReturnSplashScreen,
      getReturnToPath,
      postJson,
      redirectAfterLogin,
      showActivePartyConflict,
      showOAuthRedirectStatus,
      storeAccount
    };
  }

  window.createLoginAuthSession = createLoginAuthSession;
})();

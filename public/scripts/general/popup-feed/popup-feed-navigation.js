(function () {
  const DEFAULT_SPLASH_SCREEN = '/images/splash-screens/overexposed.png';
  const PARTY_GAME_KEYS = new Set([
    'imposter',
    'mafia',
    'most-likely-to',
    'never-have-i-ever',
    'paranoia',
    'truth-or-dare',
    'would-you-rather'
  ]);

  function getPopupFeedDestination(path) {
    try {
      const url = new URL(String(path || ''), window.location.origin);
      if (
        url.origin !== window.location.origin ||
        !url.pathname.startsWith('/')
      ) {
        return null;
      }

      return {
        path: `${url.pathname}${url.search}${url.hash}`,
        pathname: url.pathname
      };
    } catch {
      return null;
    }
  }

  function getPopupFeedSplashScreen(path) {
    const destination = getPopupFeedDestination(path);
    if (!destination) return '';

    const segments = destination.pathname.split('/').filter(Boolean);
    const gameKey = segments[0] || '';
    if (!PARTY_GAME_KEYS.has(gameKey)) return DEFAULT_SPLASH_SCREEN;

    const isSettingsPage = segments[1] === 'settings';
    return `/images/splash-screens/${gameKey}${isSettingsPage ? '-settings' : ''}.png`;
  }

  function navigateFromPopupFeed(path, options = {}) {
    const destination = getPopupFeedDestination(path);
    if (!destination) return false;

    const splashScreen =
      String(options.splashScreen || '').trim() ||
      getPopupFeedSplashScreen(destination.path) ||
      DEFAULT_SPLASH_SCREEN;

    if (typeof window.transitionSplashScreen === 'function') {
      window.transitionSplashScreen(destination.path, splashScreen);
    } else {
      window.location.assign(destination.path);
    }
    return true;
  }

  window.getPopupFeedSplashScreen = getPopupFeedSplashScreen;
  window.navigateFromPopupFeed = navigateFromPopupFeed;
})();

(function () {
  const HOMEPAGE_SPLASH_SCREEN = '/images/splash-screens/overexposed.png';
  let navigationStarted = false;

  function shouldUseNativeNavigation(event, link) {
    return (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === '_blank' ||
      link.hasAttribute('download')
    );
  }

  function startProtectedPageNavigation(event) {
    const link = event.currentTarget;
    if (shouldUseNativeNavigation(event, link)) return;

    event.preventDefault();
    if (navigationStarted) return;

    const destination = link.getAttribute('href');
    if (!destination) return;

    navigationStarted = true;
    document
      .querySelectorAll('.protected-page-action[href]')
      .forEach((action) => action.setAttribute('aria-disabled', 'true'));

    if (typeof window.transitionSplashScreen !== 'function') {
      window.location.href = destination;
      return;
    }

    window.transitionSplashScreen(destination, HOMEPAGE_SPLASH_SCREEN);
  }

  function initProtectedPageActions() {
    document
      .querySelectorAll('.protected-page-action[href]')
      .forEach((link) =>
        link.addEventListener('click', startProtectedPageNavigation)
      );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProtectedPageActions, {
      once: true
    });
  } else {
    initProtectedPageActions();
  }
})();

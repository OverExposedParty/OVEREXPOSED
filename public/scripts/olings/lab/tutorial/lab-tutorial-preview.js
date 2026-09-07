(function () {
  const TUTORIAL_PATH = '/olings/lab/tutorial';
  const isActive =
    window.location.pathname.replace(/\/+$/, '') === TUTORIAL_PATH;

  function installMutationGuard() {
    if (!isActive || typeof window.fetch !== 'function') return;
    const nativeFetch = window.fetch.bind(window);

    window.fetch = (input, init = {}) => {
      const method = String(
        init.method || input?.method || 'GET'
      ).toUpperCase();
      const source = typeof input === 'string' ? input : input?.url;
      const url = new URL(source, window.location.origin);

      if (method !== 'GET' && url.pathname.startsWith('/api/olings')) {
        return Promise.reject(
          new Error('Progression actions are disabled in tutorial preview.')
        );
      }

      return nativeFetch(input, init);
    };
  }

  installMutationGuard();

  window.OlingLabTutorialPreview = {
    isActive,
    tutorialOptions: isActive
      ? {
          enabled: true,
          label: 'Tutorial preview',
          copy: 'Changes will not be saved',
          exitHref: '/olings/lab',
          exitLabel: 'Exit preview'
        }
      : null
  };
})();

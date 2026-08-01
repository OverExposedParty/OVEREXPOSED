(function () {
  const APPLICATION_ID = 'find-the-oe-game';
  const MODULE_SCRIPTS = [
    '/scripts/other/applications/find-the-oe/shared.js',
    '/scripts/other/applications/find-the-oe/round-layout.js',
    '/scripts/other/applications/find-the-oe/game.js'
  ];
  let modulesPromise = null;

  function loadScript(src) {
    if (window.Error404SplashScripts?.loadScript) {
      return window.Error404SplashScripts.loadScript(src);
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"], script[src^="${src}?"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.dataset.loaded = 'false';
      script.src = typeof versionAssetUrl === 'function'
        ? versionAssetUrl(src, { cacheBustKey: 'ERROR_404' })
        : src;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function loadModules() {
    if (typeof window.Error404FindTheOeModules?.createFindTheOeGame === 'function') {
      return Promise.resolve(window.Error404FindTheOeModules);
    }

    if (!modulesPromise) {
      modulesPromise = MODULE_SCRIPTS
        .reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve())
        .then(() => {
          const modules = window.Error404FindTheOeModules;
          if (typeof modules?.createFindTheOeGame !== 'function') {
            throw new Error('Find The OE modules are not available');
          }

          return modules;
        })
        .catch((error) => {
          modulesPromise = null;
          throw error;
        });
    }

    return modulesPromise;
  }

  function init(context = {}) {
    if (!context.mount) return null;

    return loadModules().then((modules) => modules.createFindTheOeGame(context));
  }

  window.Error404Applications = window.Error404Applications || {};
  window.Error404Applications[APPLICATION_ID] = { init };
})();

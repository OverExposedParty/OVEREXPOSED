(function () {
  const modulePaths = [
    '/scripts/html-templates/core-template/bootstrap.js',
    '/scripts/general/debug/debug-service.js',
    '/scripts/html-templates/core-template/registry.js',
    '/scripts/html-templates/core-template/assets.js',
    '/scripts/html-templates/core-template/loader.js',
    '/scripts/html-templates/core-template/lifecycle.js',
    '/scripts/html-templates/core-template/observer.js'
  ];
  const currentScriptSrc =
    document.currentScript?.getAttribute('src') || document.currentScript?.src;
  let moduleVersion = '';

  try {
    const currentScriptUrl = new URL(currentScriptSrc, window.location.origin);
    window.__OECoreTemplateInitialAssetVersion =
      currentScriptUrl.searchParams.get('v');
    moduleVersion = window.__OECoreTemplateInitialAssetVersion
      ? '?v=' + encodeURIComponent(window.__OECoreTemplateInitialAssetVersion)
      : '';
  } catch {
    window.__OECoreTemplateInitialAssetVersion = null;
  }

  function loadModule(pathname) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = pathname + moduleVersion;
      script.async = false;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error('Failed to load core template module: ' + pathname));
      (document.head || document.documentElement).appendChild(script);
    });
  }

  window.OECoreTemplateReady = modulePaths
    .reduce(
      (loading, pathname) => loading.then(() => loadModule(pathname)),
      Promise.resolve()
    )
    .catch((error) => {
      console.error('[OE core template] failed to initialise', error);
      throw error;
    });
})();

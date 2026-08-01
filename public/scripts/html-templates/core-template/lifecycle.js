const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (typeof input === 'string') {
    return nativeFetch(versionAssetUrl(input), init);
  }

  if (input instanceof Request) {
    try {
      const versionedUrl = versionAssetUrl(input.url);
      if (versionedUrl === input.url) {
        return nativeFetch(input, init);
      }

      const clonedRequest = new Request(versionedUrl, input);
      return nativeFetch(clonedRequest, init);
    } catch {
      return nativeFetch(input, init);
    }
  }

  return nativeFetch(input, init);
};

function waitForFunction(name, callback) {
  const interval = setInterval(() => {
    if (typeof window[name] === 'function') {
      clearInterval(interval);
      callback();
    }
  }, 50); // check every 50ms
}

function waitForGlobals(names, { timeout = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();

    function tick() {
      const ok = names.every((n) => typeof window[n] === 'function');
      if (ok) return resolve();

      if (performance.now() - start > timeout) {
        const error = new Error(`Timed out waiting for: ${names.join(', ')}`);
        reportOEDebug('error', 'loader.ready', 'Global wait timed out.', {
          names,
          timeout,
          elapsedMs: Math.round(performance.now() - start),
          taskStates: window.OEReady?.debugState?.()
        });
        return reject(error);
      }
      requestAnimationFrame(tick);
    }

    tick();
  });
}

function waitForEvent(eventName, { timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`Timed out waiting for ${eventName}`);
      reportOEDebug('error', 'loader.ready', 'Event wait timed out.', {
        eventName,
        timeout,
        taskStates: window.OEReady?.debugState?.()
      });
      reject(error);
    }, timeout);

    document.addEventListener(
      eventName,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

function setActiveContainers(...activeContainers) {
  if (activeContainers.length === 0) {
    gameContainers.forEach((container) => {
      if (!container || !container.classList) return;
      hideContainer(container);
    });
    return;
  }

  const uniqueActiveContainers = new Set(
    activeContainers.filter((container) => container && container.classList)
  );

  gameContainers.forEach((container) => {
    if (!container || !container.classList) return;
    if (uniqueActiveContainers.has(container)) {
      const wasVisible = container.classList.contains('is-visible');
      showContainer(container);
      if (
        !wasVisible &&
        container.dataset?.containerOpenSound &&
        typeof playContainerTransitionSound === 'function'
      ) {
        playContainerTransitionSound(container, 'open');
      }
    } else {
      hideContainer(container);
    }
  });
}

function findScriptElByBaseSrc(baseSrc) {
  const base = stripQuery(baseSrc);

  let el = document.querySelector(`script[src="${baseSrc}"]`);
  if (el) return el;

  const selector = `script[src^="${base}?"]`;
  el = document.querySelector(selector);
  if (el) return el;

  return (
    [...document.scripts].find(
      (s) => stripQuery(s.getAttribute('src')) === base
    ) || null
  );
}

async function SetScriptLoaded(script) {
  const baseScript = stripQuery(script);

  const el = findScriptElByBaseSrc(script);
  if (el) el.setAttribute('data-loaded', 'true');

  if (isPhasedScriptsConfig(window.pageScripts)) {
    const phasedSplashEntries = getPhasedSplashScriptEntries(
      window.pageScripts
    );
    if (!oePhasedSplashProgress) {
      updateSplashScriptProgress(0, phasedSplashEntries.length);
    }
    return;
  }

  const trackedScripts = Object.entries(window.pageScripts)
    .filter(([src, cfg]) => cfg.addDataLoaded === true)
    .map(([src]) => stripQuery(src)); // ensure base paths

  const core = '/scripts/html-templates/core-template/core-template.js';
  if (!trackedScripts.includes(core)) trackedScripts.push(core);

  const total = trackedScripts.length;

  const loaded = trackedScripts.filter((src) => {
    const s =
      document.querySelector(`script[src="${src}"]`) ||
      document.querySelector(`script[src^="${src}?"]`) ||
      [...document.scripts].find(
        (x) => stripQuery(x.getAttribute('src')) === src
      );

    return s?.dataset.loaded === 'true';
  }).length;

  const splashScreenStatus = splashScreenContainer?.querySelector('p');
  if (window.allowTransition && splashScreenStatus) {
    splashScreenStatus.textContent = `(${loaded}/${total})`;
  }

  reportOEDebug('debug', 'loader.scripts', 'Script progress updated.', {
    script: baseScript,
    loaded,
    total
  });

  if (loaded === total && !pageLoaded) {
    if (isPhasedScriptsConfig(window.pageScripts)) {
      return;
    }
    markPageLoaded();
  }
}

async function waitForPageSpecificReadyTasks() {
  if (!window.pageRequiresOnlineReady) return;

  if (!window.OEReady?.waitFor) {
    throw new Error(
      'Online page requested an online ready gate, but OEReady is unavailable.'
    );
  }

  await window.OEReady.waitFor(['online-game-page-ready'], {
    timeoutMs: 30000
  });
}

async function markPageLoaded() {
  if (pageLoaded || pageLoadMarkingStarted) return;
  pageLoadMarkingStarted = true;
  reportOEDebug(
    'debug',
    'loader.lifecycle',
    'Page scripts ready; dismissing splash screen.'
  );
  debugLoaderState('markPageLoaded before initSplashScreen');

  try {
    await waitForPageSpecificReadyTasks();
  } catch (error) {
    pageLoadMarkingStarted = false;
    showPageLoadError(error);
    return;
  }

  pageLoaded = true;

  if (window.oePreventSplashRemoval) {
    reportOEDebug(
      'warn',
      'loader.lifecycle',
      'Splash removal prevented for debugging.',
      {
        oePreventSplashRemoval: window.oePreventSplashRemoval,
        allowTransition: window.allowTransition,
        splashExists: Boolean(splashScreenContainer),
        staticSplashExists: Boolean(staticSplashScreenContainer),
        pageLoaded
      }
    );
    return;
  }

  if (typeof initSplashScreen === 'function') {
    initSplashScreen();
    window.setTimeout(() => {
      debugLoaderState('500ms after initSplashScreen');
    }, 500);
    window.setTimeout(() => {
      debugLoaderState('1500ms after initSplashScreen');
    }, 1500);
    return;
  }

  splashScreenContainer?.remove();
  staticSplashScreenContainer?.remove();
  debugLoaderState('markPageLoaded fallback removed splash');
}

function showPageLoadError(error) {
  const readyState = document.readyState;
  reportOEDebug('error', 'loader.lifecycle', 'Page scripts failed to load.', {
    error,
    taskStates: window.OEReady?.debugState?.(),
    phaseStatus: oeLoaderPhaseStatus,
    pageScripts: window.pageScripts,
    readyState,
    splash: {
      exists: Boolean(splashScreenContainer),
      staticExists: Boolean(staticSplashScreenContainer)
    },
    scripts: [...document.scripts].map((script) => ({
      src: script.src,
      datasetLoaded: script.dataset?.loaded,
      async: script.async,
      defer: script.defer
    })),
    errorHandlers: {
      onerror: window.onerror ? 'registered' : 'none',
      onunhandledrejection: window.onunhandledrejection ? 'registered' : 'none'
    }
  });
  debugLoaderState('page load error', {
    error: error?.message || String(error),
    stack: error?.stack || null,
    readyState
  });

  const splashScreenStatus = splashScreenContainer?.querySelector('p');
  if (splashScreenStatus) {
    splashScreenStatus.textContent = 'Unable to load page. Check console.';
  }
}

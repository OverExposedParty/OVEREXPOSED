function stripQuery(url) {
  return (url || '').split('?')[0];
}

function findStylesheetElByBaseHref(baseHref) {
  const base = stripQuery(baseHref);

  let el = document.querySelector(`link[rel="stylesheet"][href="${baseHref}"]`);
  if (el) return el;

  const selector = `link[rel="stylesheet"][href^="${base}?"]`;
  el = document.querySelector(selector);
  if (el) return el;

  return (
    [...document.querySelectorAll('link[rel="stylesheet"]')].find(
      (l) => stripQuery(l.getAttribute('href')) === base
    ) || null
  );
}

function LoadStylesheet(href, { cacheBustKey = null } = {}) {
  if (findStylesheetElByBaseHref(href)) return null;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = versionAssetUrl(href, { cacheBustKey });

  (pageStylesheetPlaceholder || document.head).appendChild(link);
  return link;
}

cssFilesHeader.forEach((href) => {
  LoadStylesheet(href, { cacheBustKey: 'OTHER' });
});

function LoadScript(
  src,
  { addDataLoaded = false, cacheBustKey = null } = {},
  core = false
) {
  window.loadedScriptPromises = window.loadedScriptPromises || new Map();
  const scriptKey = stripQuery(src);

  reportOEDebug('debug', 'loader.scripts', 'Script load started.', {
    src,
    scriptKey,
    addDataLoaded,
    cacheBustKey,
    core
  });

  if (window.loadedScriptPromises.has(scriptKey)) {
    reportOEDebug(
      'debug',
      'loader.scripts',
      'Existing script promise reused.',
      { scriptKey }
    );
    return window.loadedScriptPromises.get(scriptKey);
  }

  const existingScript = [...document.querySelectorAll('script[src]')].find(
    (script) => stripQuery(script.getAttribute('src')) === scriptKey
  );

  if (existingScript) {
    reportOEDebug(
      'debug',
      'loader.scripts',
      'Existing script element reused.',
      { scriptKey }
    );
    return Promise.resolve(existingScript);
  }

  const scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = versionAssetUrl(src, { cacheBustKey });

    if (addDataLoaded === true) {
      script.dataset.loaded = 'false';
    }

    script.onload = () => {
      reportOEDebug('debug', 'loader.scripts', 'Script loaded.', {
        src,
        scriptKey
      });
      if (addDataLoaded === true && typeof SetScriptLoaded === 'function') {
        SetScriptLoaded(src);
      }
      resolve(script);
    };
    script.onerror = (event) => {
      reportOEDebug('error', 'loader.scripts', 'Script failed to load.', {
        src,
        scriptKey,
        event,
        currentPhase: oeLoaderPhaseStatus.length
          ? oeLoaderPhaseStatus[oeLoaderPhaseStatus.length - 1]
          : null,
        pageScripts: window.pageScripts
      });
      window.loadedScriptPromises.delete(scriptKey);
      reject(new Error(`Failed to load script: ${src}`));
    };

    if (core === true) {
      pageScriptsPlaceholder
        .querySelector('#core-scripts-placeholder')
        .appendChild(script);
    } else {
      pageScriptsPlaceholder
        .querySelector('#additional-scripts-placeholder')
        .appendChild(script);
    }
  }).then((script) => script);

  window.loadedScriptPromises.set(scriptKey, scriptPromise);
  return scriptPromise;
}

function normalizeZIndex(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupScriptsByZIndex(scriptsObj) {
  const groups = new Map();
  const scripts = Object.entries(scriptsObj || {});

  for (const [order, [src, config = {}]] of scripts.entries()) {
    // Backward compatibility:
    // - explicit zIndex => layer behavior
    // - no zIndex => preserve old serial order
    const hasExplicitZIndex = Object.prototype.hasOwnProperty.call(
      config,
      'zIndex'
    );
    const zIndex = hasExplicitZIndex
      ? normalizeZIndex(config.zIndex)
      : Number(order);
    if (!groups.has(zIndex)) groups.set(zIndex, []);
    groups.get(zIndex).push([src, config]);
  }

  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function normaliseScriptEntry(entry) {
  if (typeof entry === 'string') {
    return [entry, {}];
  }

  if (Array.isArray(entry)) {
    return entry;
  }

  if (entry && typeof entry === 'object' && entry.src) {
    const { src, ...config } = entry;
    return [src, config];
  }

  throw new Error('Invalid script entry in pageScripts phase.');
}

function isPhasedScriptsConfig(scriptsObj) {
  return OE_SCRIPT_PHASES.some((phase) => Array.isArray(scriptsObj?.[phase]));
}

function getPhasedSplashScriptEntries(scriptsObj) {
  return OE_SCRIPT_PHASES.filter((phase) => phase !== 'afterReady')
    .flatMap((phase) => scriptsObj?.[phase] || [])
    .map((entry) => normaliseScriptEntry(entry));
}

function updateSplashScriptProgress(loaded, total) {
  const splashScreenStatus = splashScreenContainer?.querySelector('p');
  if (!window.allowTransition || !splashScreenStatus || total <= 0) return;
  splashScreenStatus.textContent = `(${loaded}/${total})`;
}

function getElementDebugState(element) {
  if (!element) return null;
  const styles = getComputedStyle(element);
  return {
    exists: true,
    id: element.id || null,
    className: element.className || '',
    isConnected: element.isConnected,
    display: styles.display,
    position: styles.position,
    top: styles.top,
    left: styles.left,
    transform: styles.transform,
    opacity: styles.opacity,
    zIndex: styles.zIndex,
    childCount: element.childElementCount
  };
}

function debugLoaderState(label, extra = {}) {
  const diagnostics = {
    label,
    timeMs: Math.round(performance.now()),
    currentScript: document.currentScript?.src || null,
    coreScript:
      [...document.scripts]
        .map((script) => script.src)
        .find((src) =>
          src.includes('/scripts/html-templates/core-template/core-template.js')
        ) || null,
    versions: {
      websiteCache: WEBSITE_CACHE_VERSION,
      website: WEBSITE_VERSION,
      gameSettings: GAME_SETTINGS_VERSION,
      manual: MANUAL_SCRIPT_VERSIONS
    },
    usesPhasedLoader: window.OEUsesPhasedLoader,
    pageLoaded,
    phases: oeLoaderPhaseStatus,
    readyTasks: window.OEReady?.debugState?.() || {},
    splash: getElementDebugState(splashScreenContainer),
    staticSplash: getElementDebugState(staticSplashScreenContainer),
    bodyClasses: document.body?.className || '',
    ...extra
  };

  reportOEDebug('debug', 'loader.diagnostics', label, diagnostics);
}

async function loadScriptsByZIndex(scriptsObj, core = false) {
  const groups = groupScriptsByZIndex(scriptsObj);

  for (const [zIndex, scripts] of groups) {
    reportOEDebug('debug', 'loader.scripts', 'Script layer loading.', {
      zIndex,
      count: scripts.length
    });
    await Promise.all(
      scripts.map(async ([src, config]) => {
        reportOEDebug('debug', 'loader.scripts', 'Script loading.', {
          zIndex,
          src,
          config
        });
        return LoadScript(src, config, core);
      })
    );
  }
}

async function loadScriptsByPhase(scriptsObj, core = false) {
  for (const phase of OE_SCRIPT_PHASES) {
    const scripts = scriptsObj?.[phase];
    if (!Array.isArray(scripts) || scripts.length === 0) continue;

    reportOEDebug('debug', 'loader.lifecycle', 'Script phase started.', {
      phase,
      scriptCount: scripts.length
    });
    oeLoaderPhaseStatus.push({
      phase,
      status: 'started',
      timeMs: Math.round(performance.now()),
      scripts: scripts.map((entry) => normaliseScriptEntry(entry)[0])
    });
    for (const entry of scripts) {
      const [src, config] = normaliseScriptEntry(entry);
      reportOEDebug('debug', 'loader.scripts', 'Phase script loading.', {
        phase,
        src
      });
      await LoadScript(src, config, core);
      if (oePhasedSplashProgress && phase !== 'afterReady') {
        oePhasedSplashProgress.loaded += 1;
        updateSplashScriptProgress(
          oePhasedSplashProgress.loaded,
          oePhasedSplashProgress.total
        );
      }
      if (config.readyTask) {
        reportOEDebug('debug', 'loader.ready', 'Waiting for ready task.', {
          phase,
          readyTask: config.readyTask
        });
        await window.OEReady.waitFor([config.readyTask]);
        reportOEDebug('debug', 'loader.ready', 'Ready task completed.', {
          phase,
          readyTask: config.readyTask
        });
      }
    }
    oeLoaderPhaseStatus.push({
      phase,
      status: 'finished',
      timeMs: Math.round(performance.now())
    });
    reportOEDebug('debug', 'loader.lifecycle', 'Script phase finished.', {
      phase
    });
  }
}

async function loadPageScripts(scriptsObj, core = false) {
  reportOEDebug('debug', 'loader.lifecycle', 'Page scripts loading.', {
    scriptsObj,
    core,
    isPhased: isPhasedScriptsConfig(scriptsObj)
  });
  if (isPhasedScriptsConfig(scriptsObj)) {
    window.OEUsesPhasedLoader = true;
    const phasedSplashEntries = getPhasedSplashScriptEntries(scriptsObj);
    oePhasedSplashProgress = {
      loaded: 0,
      total: phasedSplashEntries.length
    };
    updateSplashScriptProgress(
      oePhasedSplashProgress.loaded,
      oePhasedSplashProgress.total
    );
    const afterReadyScripts = scriptsObj.afterReady;
    const phasedScriptsWithoutAfterReady = {
      ...scriptsObj,
      afterReady: []
    };

    await loadScriptsByPhase(phasedScriptsWithoutAfterReady, core);
    debugLoaderState(
      'all phases except afterReady finished before markPageLoaded'
    );

    if (Array.isArray(afterReadyScripts) && afterReadyScripts.length > 0) {
      window.setTimeout(() => {
        reportOEDebug(
          'debug',
          'loader.lifecycle',
          'After-ready phase started.'
        );
        loadScriptsByPhase({ afterReady: afterReadyScripts }, core)
          .then(() => {
            reportOEDebug(
              'debug',
              'loader.lifecycle',
              'After-ready phase finished.'
            );
            debugLoaderState('afterReady completed', {
              readyTasks: window.OEReady?.debugState?.(),
              phaseStatus: oeLoaderPhaseStatus
            });
            window.setTimeout(() => {
              debugLoaderState('post-afterReady idle snapshot', {
                readyTasks: window.OEReady?.debugState?.(),
                phaseStatus: oeLoaderPhaseStatus
              });
            }, 1000);
          })
          .catch((error) => {
            reportOEDebug(
              'error',
              'loader.lifecycle',
              'After-ready scripts failed to load.',
              { error }
            );
          });
      }, 0);
    }

    markPageLoaded();
    return;
  }

  await loadScriptsByZIndex(scriptsObj, core);
}

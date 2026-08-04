function getInitialAssetVersion() {
  if (
    Object.prototype.hasOwnProperty.call(
      window,
      '__OECoreTemplateInitialAssetVersion'
    )
  ) {
    return window.__OECoreTemplateInitialAssetVersion;
  }
  const currentScriptSrc =
    document.currentScript?.getAttribute('src') || document.currentScript?.src;
  if (!currentScriptSrc) return null;

  try {
    const url = new URL(currentScriptSrc, window.location.origin);
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function isOnlineDebugEnabled() {
  try {
    const storedFilter = window.localStorage.getItem('oe-debug-filter');
    if (storedFilter !== null) {
      return storedFilter !== 'off';
    }
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.localStorage.getItem('oe-debug') === 'true'
    );
  } catch {
    return false;
  }
}

window.OE_DEBUG = isOnlineDebugEnabled();

function reportOEDebug(level, category, message, data) {
  try {
    const logger = window.OEDebug?.[level];
    if (typeof logger === 'function') {
      return logger.call(window.OEDebug, category, message, data);
    }

    const fallback =
      level === 'debug'
        ? console.debug || console.log
        : console[level] || console.log;
    const prefix = `[OE:${category}] ${message}`;
    if (data === undefined) {
      fallback.call(console, prefix);
    } else {
      fallback.call(console, prefix, data);
    }
  } catch {
    // Diagnostics must never interrupt bootstrap.
  }
  return null;
}

window.reportOEDebug = reportOEDebug;

function reportBootstrapLegacyDebug(level, args) {
  const values = Array.from(args);
  const firstValue = values.shift();
  const message =
    typeof firstValue === 'string' ? firstValue : 'Legacy debug output.';
  const data =
    typeof firstValue === 'string'
      ? values
      : [firstValue, ...values];
  reportOEDebug(
    level,
    'legacy',
    message,
    data.length === 0 ? undefined : data.length === 1 ? data[0] : data
  );
}

window.debugLog = (...args) => {
  if (window.OE_DEBUG) {
    reportBootstrapLegacyDebug('debug', args);
  }
};

window.debugWarn = (...args) => {
  if (window.OE_DEBUG) {
    reportBootstrapLegacyDebug('warn', args);
  }
};

// Update these values manually when you want to force browsers to fetch new script files.
// Leave a value empty to fall back to the version already on the core-template.js URL.
const MANUAL_SCRIPT_VERSIONS = Object.freeze({
  WEBSITE_CACHE_VERSION: '2026-08-04-01',
  WEBSITE_VERSION: '2026-08-04-01',
  GAME_SETTINGS_VERSION: '2026-08-04-01'
});

function resolveScriptVersion(manualVersion) {
  return manualVersion || getInitialAssetVersion() || null;
}

const WEBSITE_CACHE_VERSION = resolveScriptVersion(
  MANUAL_SCRIPT_VERSIONS.WEBSITE_CACHE_VERSION
);
const WEBSITE_VERSION =
  resolveScriptVersion(MANUAL_SCRIPT_VERSIONS.WEBSITE_VERSION) ||
  WEBSITE_CACHE_VERSION;
const GAME_SETTINGS_VERSION =
  resolveScriptVersion(MANUAL_SCRIPT_VERSIONS.GAME_SETTINGS_VERSION) ||
  WEBSITE_CACHE_VERSION;
window.WEBSITE_CACHE_VERSION = WEBSITE_CACHE_VERSION;
window.MANUAL_SCRIPT_VERSIONS = MANUAL_SCRIPT_VERSIONS;

const SCRIPT_VERSIONS = {
  HOMEPAGE: '2026-08-04-01',

  PARTY_GAMES_SETTINGS: GAME_SETTINGS_VERSION,

  OLING_LAB: '2026-08-04-01',
  OLING_FLIGHT_MOTION: '2026-08-04-01',
  OLING_BATTLE: '2026-08-04-01',

  PARTY_GAMES_OFFLINE_GENERAL: WEBSITE_VERSION,
  PARTY_GAMES_OFFLINE_IMPOSTER: WEBSITE_VERSION,

  PARTY_GAMES_ONLINE_TRUTH_OR_DARE: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_PARANOIA: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_NEVER_HAVE_I_EVER: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_MOST_LIKELY_TO: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_WOULD_YOU_RATHER: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_IMPOSTER: WEBSITE_VERSION,
  PARTY_GAMES_ONLINE_MAFIA: WEBSITE_VERSION,

  PARTY_GAMES_WAITING_ROOM: GAME_SETTINGS_VERSION,

  OVEREXPOSURE: WEBSITE_VERSION,
  AUTH: WEBSITE_VERSION,
  OTHER: WEBSITE_VERSION,
  ERROR_404: WEBSITE_VERSION
};
window.SCRIPT_VERSIONS = SCRIPT_VERSIONS;
window.OEUsesPhasedLoader = false;

window.addEventListener('error', (event) => {
  reportOEDebug('error', 'runtime.errors', 'Global browser error.', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  reportOEDebug('error', 'runtime.errors', 'Unhandled promise rejection.', {
    reason: event.reason,
    promise: event.promise
  });
});
window.oePreventSplashRemoval = false;
window.enableSplashPreservation = () => {
  window.oePreventSplashRemoval = true;
  reportOEDebug('warn', 'loader.lifecycle', 'Splash preservation enabled.');
};

const splashScreenContainer = document.getElementById(
  'splash-screen-container'
);
const staticSplashScreenContainer = document.getElementById(
  'splash-screen-container-static'
);
window.allowTransition = window.allowTransition !== false;

const headerPlaceholder = document.getElementById('header-placeholder');

let pageScriptsPlaceholder;
let pageStylesheetPlaceholder;

let pageLoaded = false;
let pageLoadMarkingStarted = false;
let gameContainers = [];
const oeLoaderPhaseStatus = [];
let oePhasedSplashProgress = null;

const OE_SCRIPT_PHASES = [
  'beforeTemplate',
  'templates',
  'data',
  'features',
  'afterReady'
];

window.OEReady = (() => {
  const tasks = new Map();
  const taskStates = new Map();

  function promiseWithTimeout(promise, timeoutMs, name) {
    if (typeof timeoutMs !== 'number' || timeoutMs <= 0) {
      return promise;
    }

    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        const error = new Error(
          `OEReady task timed out after ${timeoutMs}ms: ${name}`
        );
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([
      promise.finally(() => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      }),
      timeoutPromise
    ]);
  }

  return {
    register(name, task) {
      if (!name) {
        throw new Error('OEReady task name is required.');
      }
      taskStates.set(name, {
        status: 'pending',
        registeredAt: Math.round(performance.now())
      });
      const timeoutId = window.setTimeout(() => {
        const state = taskStates.get(name);
        if (state?.status === 'pending') {
          reportOEDebug('warn', 'loader.ready', 'Task still pending.', {
            name,
            elapsedMs: 5000,
            registeredAt: state.registeredAt,
            status: state.status,
            readyTasks: Array.from(tasks.keys()),
            taskStates: Object.fromEntries(taskStates.entries())
          });
        }
      }, 5000);

      const promise = (
        typeof task === 'function'
          ? Promise.resolve().then(task)
          : Promise.resolve(task)
      )
        .then((value) => {
          const state = taskStates.get(name);
          if (state?.timeoutId) {
            window.clearTimeout(state.timeoutId);
          }
          taskStates.set(name, {
            ...state,
            status: 'resolved',
            resolvedAt: Math.round(performance.now())
          });
          return value;
        })
        .catch((error) => {
          const state = taskStates.get(name);
          if (state?.timeoutId) {
            window.clearTimeout(state.timeoutId);
          }
          taskStates.set(name, {
            ...state,
            status: 'rejected',
            rejectedAt: Math.round(performance.now()),
            error: error?.message || String(error)
          });
          reportOEDebug('error', 'loader.ready', 'Task rejected.', {
            name,
            error
          });
          throw error;
        });
      tasks.set(name, promise);
      return promise;
    },

    async waitFor(names = null, { timeoutMs = 15000 } = {}) {
      const selectedNames = Array.isArray(names) ? names : [...tasks.keys()];
      await Promise.all(
        selectedNames.map((name) => {
          if (!tasks.has(name)) {
            throw new Error(`OEReady task was not registered: ${name}`);
          }
          return promiseWithTimeout(tasks.get(name), timeoutMs, name);
        })
      );
    },

    debugState() {
      return Object.fromEntries(taskStates.entries());
    }
  };
})();

const WEBSITE_VERSION = "07032026"; //07/03/2026
const GAME_SETTINGS_VERSION = "07032026"; //07/03/2026

const SCRIPT_VERSIONS = {
  HOMEPAGE: WEBSITE_VERSION,

  PARTY_GAMES_SETTINGS: GAME_SETTINGS_VERSION,

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
  OTHER: WEBSITE_VERSION,
  ERROR_404: WEBSITE_VERSION,
};


const splashScreenContainer = document.getElementById("splash-screen-container");
const staticSplashScreenContainer = document.getElementById("splash-screen-container-static");

const headerPlaceholder = document.getElementById('header-placeholder');

let pageScriptsPlaceholder;
let pageStylesheetPlaceholder;

let pageLoaded = false;
let gameContainers = [];

const cssFilesHeader = [
  '/css/general/settings.css',
  '/css/general/help-container.css',
  '/css/general/warning-message-style.css',
  '/css/general/rotate-device.css'
];

const coreScripts = {
  '/scripts/general/dom-and-const.js': { zIndex: 0 },
  '/scripts/general/utils.js': { zIndex: 0 },
  '/scripts/general/cookies.js': { zIndex: 1 },

  '/scripts/general/sound.js': { zIndex: 1 },
  '/scripts/general/settings-and-links.js': { zIndex: 1 },
  '/scripts/general/overlay-and-toggle.js': { zIndex: 1 },
  '/scripts/general/header-init.js': { zIndex: 2 },
  '/scripts/general/observers.js': { zIndex: 1 },
  '/scripts/general/help-container.js': { zIndex: 1000 },
  '/scripts/general/google-analytics.js': { zIndex: 2 },
  '/scripts/general/rotate-device.js': { zIndex: 2 },

  '/scripts/general/template-ready.js': { zIndex: 2 }
};

function getVersionForAsset(cacheBustKey = null) {
  if (cacheBustKey !== null) {
    return SCRIPT_VERSIONS[cacheBustKey] ?? null;
  }

  const currentScriptSrc = document.currentScript?.getAttribute('src') || document.currentScript?.src;
  if (!currentScriptSrc) return null;

  try {
    const url = new URL(currentScriptSrc, window.location.origin);
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function findStylesheetElByBaseHref(baseHref) {
  const base = stripQuery(baseHref);

  let el = document.querySelector(`link[rel="stylesheet"][href="${baseHref}"]`);
  if (el) return el;

  const selector = `link[rel="stylesheet"][href^="${base}?"]`;
  el = document.querySelector(selector);
  if (el) return el;

  return [...document.querySelectorAll('link[rel="stylesheet"]')]
    .find(l => stripQuery(l.getAttribute("href")) === base) || null;
}

function LoadStylesheet(href, { cacheBustKey = null } = {}) {
  if (findStylesheetElByBaseHref(href)) return null;

  const link = document.createElement('link');
  link.rel = 'stylesheet';

  const version = getVersionForAsset(cacheBustKey);
  if (version) {
    const separator = href.includes('?') ? '&' : '?';
    link.href = `${href}${separator}v=${version}`;
  } else {
    link.href = href;
  }

  (pageStylesheetPlaceholder || document.head).appendChild(link);
  return link;
}

cssFilesHeader.forEach(href => {
  LoadStylesheet(href, { cacheBustKey: "OTHER" });
});

function LoadScript(
  src,
  { addDataLoaded = false, cacheBustKey = null } = {},
  core = false
) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    // cache busting
    if (cacheBustKey !== null) {
      const separator = src.includes('?') ? '&' : '?';
      script.src = `${src}${separator}v=${SCRIPT_VERSIONS[cacheBustKey]}`;
    } else {
      script.src = src;
    }

    if (addDataLoaded === true) {
      script.dataset.loaded = 'false';
    }

    script.onload = resolve;
    script.onerror = reject;

    if (core === true) {
      pageScriptsPlaceholder
        .querySelector('#core-scripts-placeholder')
        .appendChild(script);
    } else {
      pageScriptsPlaceholder
        .querySelector('#additional-scripts-placeholder')
        .appendChild(script);
    }
  });
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
    const hasExplicitZIndex = Object.prototype.hasOwnProperty.call(config, "zIndex");
    const zIndex = hasExplicitZIndex ? normalizeZIndex(config.zIndex) : Number(order);
    if (!groups.has(zIndex)) groups.set(zIndex, []);
    groups.get(zIndex).push([src, config]);
  }

  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

async function loadScriptsByZIndex(scriptsObj, core = false) {
  const groups = groupScriptsByZIndex(scriptsObj);

  for (const [zIndex, scripts] of groups) {
    console.log(`Loading script layer zIndex=${zIndex} (${scripts.length} script(s))`);
    await Promise.all(
      scripts.map(([src, config]) => LoadScript(src, config, core))
    );
  }
}



function waitForFunction(name, callback) {
  const interval = setInterval(() => {
    if (typeof window[name] === "function") {
      clearInterval(interval);
      callback();
    }
  }, 50); // check every 50ms
}

function waitForGlobals(names, { timeout = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();

    function tick() {
      const ok = names.every((n) => typeof window[n] === "function");
      if (ok) return resolve();

      if (performance.now() - start > timeout) {
        return reject(new Error(`Timed out waiting for: ${names.join(", ")}`));
      }
      requestAnimationFrame(tick);
    }

    tick();
  });
}

function waitForEvent(eventName, { timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}`)),
      timeout
    );

    document.addEventListener(eventName, () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}


function setActiveContainers(...activeContainers) {
  if (activeContainers.length === 0) {
    gameContainers.forEach(container => {
      if (!container || !container.classList) return;
      container.classList.remove('active');
    });
    return;
  }

  const uniqueActiveContainers = new Set(activeContainers.filter(container => container && container.classList));

  gameContainers.forEach(container => {
    if (!container || !container.classList) return;
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

function stripQuery(u) {
  return (u || "").split("?")[0];
}

function findScriptElByBaseSrc(baseSrc) {
  const base = stripQuery(baseSrc);

  let el = document.querySelector(`script[src="${baseSrc}"]`);
  if (el) return el;

  const selector = `script[src^="${base}?"]`;
  el = document.querySelector(selector);
  if (el) return el;

  return [...document.scripts].find(s => stripQuery(s.getAttribute("src")) === base) || null;
}

async function SetScriptLoaded(script) {
  const baseScript = stripQuery(script);

  const el = findScriptElByBaseSrc(script);
  if (el) el.setAttribute("data-loaded", "true");

  const trackedScripts = Object.entries(window.pageScripts)
    .filter(([src, cfg]) => cfg.addDataLoaded === true)
    .map(([src]) => stripQuery(src)); // ensure base paths

  const core = "/scripts/html-templates/core-template.js";
  if (!trackedScripts.includes(core)) trackedScripts.push(core);

  const total = trackedScripts.length;

  const loaded = trackedScripts.filter(src => {
    const s =
      document.querySelector(`script[src="${src}"]`) ||
      document.querySelector(`script[src^="${src}?"]`) ||
      [...document.scripts].find(x => stripQuery(x.getAttribute("src")) === src);

    return s?.dataset.loaded === "true";
  }).length;

  splashScreenContainer.querySelector("p").textContent = `(${loaded}/${total})`;

  console.log(baseScript);
  console.log(`(${loaded}/${total}) scripts loaded`);

  if (loaded === total && !pageLoaded) {
    pageLoaded = true;
    initSplashScreen();
  }
}

class LocalStorageObserver {
  constructor() {
    this.listeners = [];
    this.originalSetItem = localStorage.setItem;
    this.originalGetItem = localStorage.getItem;

    localStorage.setItem = (key, value) => {
      const oldValue = this.originalGetItem.call(localStorage, key);
      this.originalSetItem.call(localStorage, key, value);
      this.notifyListeners(key, oldValue, value);
    };
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(key, oldValue, newValue) {
    this.listeners.forEach((listener) => {
      listener(key, oldValue, newValue);
    });
  }
}

fetch('/html-templates/header.html')
  .then(response => response.text())
  .then(data => {
    headerPlaceholder.innerHTML = data;
    pageScriptsPlaceholder = document.getElementById('page-scripts-placeholder');
    pageStylesheetPlaceholder = document.getElementById('page-stylesheet-placeholder');
  })
  .then(() => loadScriptsByZIndex(coreScripts, true))
  .then(() => loadScriptsByZIndex(window.pageScripts, false))
  .catch(error => console.error('Error loading header:', error));

const splashScreenContainer = document.getElementById("splash-screen-container");
const staticSplashScreenContainer = document.getElementById("splash-screen-container-static");
const headerPlaceholder = document.getElementById('header-placeholder');

let pageLoaded = false;
let gameContainers = [];

const cssFilesHeader = [
  '/css/general/settings.css',
  '/css/general/help-container.css',
  '/css/general/warning-message-style.css',
  '/css/general/rotate-device.css'
];

const coreScripts = {
  '/scripts/general/sound.js': {},
  '/scripts/general/dom-and-const.js': {},
  '/scripts/general/settings-and-links.js': {},
  '/scripts/general/overlay-and-toggle.js': {},
  '/scripts/general/header-init.js': {},
  '/scripts/general/observers.js': {},
  '/scripts/general/utils.js': {},
  '/scripts/general/cookies.js': {},
  '/scripts/general/help-container.js': {},
  '/scripts/general/google-analytics.js': {},
  '/scripts/general/rotate-device.js': {},
  '/scripts/general/template-ready.js': {}
};


cssFilesHeader.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

function LoadScript(src, { addDataLoaded = false } = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;

    if (addDataLoaded === true) {
      script.dataset.loaded = 'false';
    }

    script.onload = resolve;
    script.onerror = reject;

    document.head.appendChild(script);
  });
}


async function loadScriptsInOrder(scriptsObj) {
  for (const [src, config] of Object.entries(scriptsObj)) {
    await LoadScript(src, config);
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
    gameContainers.forEach(container => container.classList.remove('active'));
    return;
  }

  const uniqueActiveContainers = new Set(activeContainers);

  gameContainers.forEach(container => {
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}

async function SetScriptLoaded(script) {
  const el = document.querySelector(`script[src="${script}"]`);
  if (el) el.setAttribute("data-loaded", "true");

  // Scripts that should contribute to the loading counter
  const trackedScripts = Object.entries(window.pageScripts)
    .filter(([src, cfg]) => cfg.addDataLoaded === true)
    .map(([src]) => src);

  // Add core template explicitly if not already counted
  if (!trackedScripts.includes("/scripts/html-templates/core-template.js")) {
    trackedScripts.push("/scripts/html-templates/core-template.js");
  }

  const total = trackedScripts.length;

  const loaded = trackedScripts.filter(src => {
    const s = document.querySelector(`script[src="${src}"]`);
    return s?.dataset.loaded === "true";
  }).length;

  splashScreenContainer.querySelector("p").textContent = `(${loaded}/${total})`;

  console.log(script);
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
  })
  .then(() => loadScriptsInOrder(coreScripts))
  .then(() => loadScriptsInOrder(window.pageScripts))
  .catch(error => console.error('Error loading header:', error));
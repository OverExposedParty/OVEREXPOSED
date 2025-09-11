const cssFilesHeader = [
  '/css/general/settings.css',
  '/css/general/help-container.css',
  '/css/general/warning-message-style.css',
  '/css/general/rotate-device.css'
];

cssFilesHeader.forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
});

function LoadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function waitForFunction(name, callback) {
  const interval = setInterval(() => {
    if (typeof window[name] === "function") {
      clearInterval(interval);
      callback();
    }
  }, 50); // check every 50ms
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
    const placeholder = document.getElementById('header-placeholder');
    placeholder.innerHTML = data;

    const soundScript = document.createElement('script');
    soundScript.src = '/scripts/general/sound.js';
    soundScript.onload = () => {
      const headerScript = document.createElement('script');
      headerScript.src = '/scripts/general/header.js';
      document.body.appendChild(headerScript);

      const helpContainerScript = document.createElement('script');
      helpContainerScript.src = '/scripts/general/help-container.js';
      helpContainerScript.id = 'help-script';
      document.body.appendChild(helpContainerScript);

      const googleAnalyticsScript = document.createElement('script');
      googleAnalyticsScript.src = '/scripts/html-templates/general/google-analytics.js';
      document.body.appendChild(googleAnalyticsScript);
    };

    const rotateDeviceScript = document.createElement('script');
    rotateDeviceScript.src = '/scripts/general/rotate-device.js';
    rotateDeviceScript.id = 'help-script';
    document.body.appendChild(rotateDeviceScript);

    document.body.appendChild(soundScript);
  })
  .catch(error => console.error('Error loading header:', error));
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
  .then((response) => response.text())
  .then((data) => {
    appendTrustedHtml(headerPlaceholder, data, { replace: true });
    pageScriptsPlaceholder = document.getElementById(
      'page-scripts-placeholder'
    );
    pageStylesheetPlaceholder = document.getElementById(
      'page-stylesheet-placeholder'
    );
  })
  .then(() => loadScriptsByZIndex(coreScripts, true))
  .then(() => loadPageScripts(window.pageScripts, false))
  .then(() => {
    debugLoaderState('loadPageScripts top-level promise resolved', {
      readyTasks: window.OEReady?.debugState?.(),
      phaseStatus: oeLoaderPhaseStatus
    });
    reportOEDebug(
      'debug',
      'loader.lifecycle',
      'Top-level page-script promise resolved.'
    );
    window.setTimeout(() => {
      debugLoaderState('post-loadPageScripts idle check', {
        pageLoaded,
        readyTasks: window.OEReady?.debugState?.(),
        phaseStatus: oeLoaderPhaseStatus
      });
    }, 100);
  })
  .catch((error) => {
    showPageLoadError(error);
    throw error;
  });

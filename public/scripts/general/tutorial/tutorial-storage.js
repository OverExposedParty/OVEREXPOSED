(function () {
  function getKey(id, customKey) {
    if (customKey) return String(customKey);
    const safeId = String(id || 'site')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-');
    return `oe-${safeId}-tutorial-version`;
  }

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function create(options = {}) {
    const key = getKey(options.id, options.key);
    const version = String(options.version || '1');

    return {
      key,
      version,
      hasCompleted: () => read(key) === version,
      markCompleted: () => write(key, version),
      clear: () => remove(key)
    };
  }

  window.OETutorialStorage = { create, getKey };
})();

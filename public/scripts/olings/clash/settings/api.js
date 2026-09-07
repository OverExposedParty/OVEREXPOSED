(function (globalScope) {
  function getStoredAccount() {
    if (typeof globalScope.getStoredSettingsAccount === 'function') {
      return globalScope.getStoredSettingsAccount();
    }
    try {
      return JSON.parse(globalScope.localStorage.getItem('oe-account')) || null;
    } catch {
      return null;
    }
  }

  function getMatchCodeFromPath(pathname = globalScope.location.pathname) {
    const match = pathname.match(
      /^\/olings\/clash\/([a-z0-9]{3}-[a-z0-9]{3})\/?$/i
    );
    return match ? match[1].toUpperCase() : null;
  }

  async function requestJson(url, options = {}) {
    const response = await globalScope.fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const payload = (await response.json?.().catch(() => ({}))) || {};
    if (!response.ok || payload.success === false) {
      const error = new Error(
        payload.error?.message || 'That Oling Clash request failed.'
      );
      error.code = payload.error?.code || 'oling_clash_request_failed';
      error.status = response.status;
      error.details = payload.error?.details || null;
      throw error;
    }
    return payload;
  }

  globalScope.OlingClashLobbyApi = Object.freeze({
    getMatchCodeFromPath,
    getStoredAccount,
    requestJson
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalScope.OlingClashLobbyApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);

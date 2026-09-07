(() => {
  const RETRYABLE_PARTY_STATUSES = new Set([408, 425, 429, 502, 503, 504]);

  function delayPartyRequest(delayMs) {
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  function createPartyApiError(response, payload = {}, fallbackMessage = '') {
    const serverError =
      payload?.error && typeof payload.error === 'object' ? payload.error : {};
    const message =
      (typeof payload?.error === 'string' && payload.error) ||
      serverError.message ||
      payload?.message ||
      fallbackMessage ||
      `Party request failed with status ${response?.status || 0}`;
    const error = new Error(message);
    error.status = Number(response?.status) || 0;
    error.code = serverError.code || 'party_request_failed';
    error.details = serverError.details;
    error.requestId = payload?.requestId || null;
    error.payload = payload;
    return error;
  }

  function normalisePartyNetworkError(error) {
    if (Number.isInteger(error?.status)) return error;

    const networkError =
      error instanceof Error ? error : new Error(String(error));
    networkError.status = 0;
    networkError.code = networkError.code || 'party_network_unavailable';
    networkError.isTransient = true;
    return networkError;
  }

  function isRetryablePartyRequestError(error) {
    const status = Number(error?.status) || 0;
    return (
      error?.isTransient === true ||
      status === 0 ||
      RETRYABLE_PARTY_STATUSES.has(status) ||
      status >= 500
    );
  }

  function setOnlinePartyConnectionState(state, detail = {}) {
    window.document?.body?.classList?.toggle(
      'online-party-reconnecting',
      state === 'reconnecting' || state === 'offline'
    );

    if (typeof window.CustomEvent === 'function') {
      window.dispatchEvent?.(
        new CustomEvent('oe-party-connection-state', {
          detail: { state, ...detail }
        })
      );
    }
  }

  async function waitForOnlineConnection({ timeoutMs = 4000 } = {}) {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      return true;
    }

    setOnlinePartyConnectionState('offline');
    return new Promise((resolve) => {
      let settled = false;
      const finish = (online) => {
        if (settled) return;
        settled = true;
        window.removeEventListener?.('online', handleOnline);
        window.clearTimeout(timeoutId);
        resolve(online);
      };
      const handleOnline = () => finish(true);
      const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
      window.addEventListener?.('online', handleOnline, { once: true });
    });
  }

  async function requestPartyJson(
    url,
    options = {},
    {
      retries = 0,
      retryDelayMs = 250,
      allowMutationRetry = false,
      fallbackMessage = ''
    } = {}
  ) {
    const method = String(options.method || 'GET').toUpperCase();
    const canRetryMethod =
      method === 'GET' || method === 'HEAD' || allowMutationRetry;
    const maxRetries = canRetryMethod ? Math.max(0, Number(retries) || 0) : 0;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await waitForOnlineConnection();
        const response = await fetch(url, options);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw createPartyApiError(response, payload, fallbackMessage);
        }

        setOnlinePartyConnectionState('connected', { url, method });
        return { response, data: payload };
      } catch (caughtError) {
        const error = normalisePartyNetworkError(caughtError);
        lastError = error;
        if (attempt >= maxRetries || !isRetryablePartyRequestError(error)) {
          if (isRetryablePartyRequestError(error)) {
            setOnlinePartyConnectionState('offline', {
              url,
              method,
              error
            });
          }
          throw error;
        }

        setOnlinePartyConnectionState('reconnecting', {
          url,
          method,
          attempt: attempt + 1
        });
        await delayPartyRequest(retryDelayMs * 2 ** attempt);
      }
    }

    throw lastError;
  }

  window.PartyApiRequest = {
    createPartyApiError,
    delayPartyRequest,
    isRetryablePartyRequestError,
    requestPartyJson,
    setOnlinePartyConnectionState,
    waitForOnlineConnection
  };
})();

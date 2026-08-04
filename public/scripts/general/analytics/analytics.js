(function () {
  const STORAGE_KEY = 'oe-product-analytics-id';
  const SESSION_KEY = 'oe-product-analytics-session-id';
  const ENDPOINT = '/api/analytics/events';
  const MAX_BATCH_SIZE = 20;
  const FLUSH_INTERVAL_MS = 10000;
  const queue = [];
  let flushTimer = null;
  let requestRunning = false;

  function hasConsent() {
    try {
      return localStorage.getItem('cookie-consent') === 'true';
    } catch {
      return false;
    }
  }

  function createId() {
    if (typeof window.crypto?.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function getOrCreateStorageId(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = createId();
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return createId();
    }
  }

  function getAnonymousId() {
    return getOrCreateStorageId(localStorage, STORAGE_KEY);
  }

  function getSessionId() {
    return getOrCreateStorageId(sessionStorage, SESSION_KEY);
  }

  function getPageContext(context = {}) {
    const gameMode =
      context.gameMode ||
      (typeof window.gamemode === 'string' ? window.gamemode : null) ||
      (typeof window.partyGameMode === 'string'
        ? window.partyGameMode
        : null);
    const playMode =
      context.playMode ||
      (gameMode
        ? typeof window.partyCode === 'string' && window.partyCode
          ? 'online'
          : 'offline'
        : 'website');

    return {
      pagePath: window.location.pathname,
      ...(gameMode ? { gameMode } : {}),
      playMode,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      ...context
    };
  }

  function scheduleFlush() {
    if (flushTimer !== null || !queue.length) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_INTERVAL_MS);
  }

  function track(eventName, properties = {}, context = {}) {
    if (!hasConsent() || typeof eventName !== 'string') return null;
    const event = {
      eventId: createId(),
      eventName,
      occurredAt: new Date().toISOString(),
      anonymousId: getAnonymousId(),
      sessionId: getSessionId(),
      context: getPageContext(context),
      properties
    };
    queue.push(event);
    if (queue.length >= MAX_BATCH_SIZE) {
      flush();
    } else {
      scheduleFlush();
    }
    return event.eventId;
  }

  function restoreBatch(batch) {
    queue.unshift(...batch);
    scheduleFlush();
  }

  async function flush(options = {}) {
    if (!hasConsent() || requestRunning || !queue.length) return false;
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    const body = JSON.stringify({ consent: true, events: batch });

    if (options.beacon && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: 'application/json' })
      );
      if (!sent) restoreBatch(batch);
      return sent;
    }

    requestRunning = true;
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: Boolean(options.keepalive)
      });
      if (!response.ok) throw new Error('Analytics request failed');
      if (queue.length) scheduleFlush();
      return true;
    } catch {
      restoreBatch(batch);
      return false;
    } finally {
      requestRunning = false;
    }
  }

  function clearIdentifiers() {
    queue.length = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }

  window.addEventListener('oe-cookie-consent-decision', (event) => {
    if (String(event.detail?.consent) === 'true') {
      scheduleFlush();
      return;
    }
    clearIdentifiers();
  });
  window.addEventListener('pagehide', () => {
    flush({ beacon: true });
  });

  window.OEAnalytics = {
    flush,
    hasConsent,
    track
  };
})();

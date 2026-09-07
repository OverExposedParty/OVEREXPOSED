(function (globalScope) {
  const warningThresholdMs = 5000;

  function normalizeDeadline(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function normalizeDuration(value, fallback) {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue) && parsedValue > 0) return parsedValue;
    return Math.max(1, fallback);
  }

  function createOlingClashTimer(options = {}) {
    const now = typeof options.now === 'function' ? options.now : Date.now;
    const schedule =
      typeof options.setInterval === 'function'
        ? options.setInterval
        : globalScope.setInterval.bind(globalScope);
    const cancel =
      typeof options.clearInterval === 'function'
        ? options.clearInterval
        : globalScope.clearInterval.bind(globalScope);
    let activeContainer = null;
    let deadlineMs = null;
    let durationMs = null;
    let intervalId = null;
    let hasDispatchedExpiry = false;

    function clearScheduledUpdate() {
      if (intervalId === null) return;
      cancel(intervalId);
      intervalId = null;
    }

    function dispatchExpiry(container) {
      if (hasDispatchedExpiry) return;
      hasDispatchedExpiry = true;
      const EventConstructor =
        container.ownerDocument?.defaultView?.CustomEvent ||
        globalScope.CustomEvent;
      if (typeof EventConstructor !== 'function') return;
      container.dispatchEvent(
        new EventConstructor('oling-clash:timer-expired', { bubbles: true })
      );
    }

    function renderTimer(container = activeContainer) {
      if (!container || deadlineMs === null || durationMs === null) return null;

      const remainingMs = Math.max(0, deadlineMs - now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
      const fill = container.querySelector('[data-clash-timer-fill]');
      const value = container.querySelector('[data-clash-timer-value]');

      container.hidden = false;
      container.classList.toggle(
        'is-warning',
        remainingMs > 0 && remainingMs <= warningThresholdMs
      );
      container.classList.toggle('is-expired', remainingMs === 0);
      container.dataset.remainingMs = String(Math.ceil(remainingMs));
      container.setAttribute(
        'aria-label',
        `${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'} remaining`
      );
      if (fill) fill.style.width = `${progress * 100}%`;
      if (value) value.textContent = String(remainingSeconds);

      if (remainingMs === 0) {
        clearScheduledUpdate();
        dispatchExpiry(container);
      }

      return { progress, remainingMs, remainingSeconds };
    }

    function start(container, { phaseEndsAt, phaseDurationMs } = {}) {
      const normalizedDeadline = normalizeDeadline(phaseEndsAt);
      if (!container || normalizedDeadline === null) {
        stop({ hide: true });
        return null;
      }

      clearScheduledUpdate();
      activeContainer = container;
      deadlineMs = normalizedDeadline;
      durationMs = normalizeDuration(
        phaseDurationMs,
        Math.max(0, deadlineMs - now())
      );
      hasDispatchedExpiry = false;
      container.dataset.phaseEndsAt = new Date(deadlineMs).toISOString();
      container.dataset.phaseDurationMs = String(durationMs);

      const state = renderTimer(container);
      if (state?.remainingMs > 0 && !globalScope.document?.hidden) {
        intervalId = schedule(() => renderTimer(container), 200);
      }
      return state;
    }

    function stop({ hide = false } = {}) {
      clearScheduledUpdate();
      if (activeContainer && hide) activeContainer.hidden = true;
      activeContainer = null;
      deadlineMs = null;
      durationMs = null;
      hasDispatchedExpiry = false;
    }

    function handleVisibility({ detail } = {}) {
      if (!activeContainer) return;
      if (detail?.hidden) {
        clearScheduledUpdate();
        return;
      }
      const state = renderTimer(activeContainer);
      if (state?.remainingMs > 0 && intervalId === null) {
        intervalId = schedule(() => renderTimer(activeContainer), 200);
      }
    }

    if (typeof globalScope.addEventListener === 'function') {
      globalScope.addEventListener('oling-clash:visibility', handleVisibility);
    }

    return {
      normalizeDeadline,
      renderTimer,
      start,
      stop,
      warningThresholdMs
    };
  }

  globalScope.createOlingClashTimer = createOlingClashTimer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashTimer;
  }
})(typeof window !== 'undefined' ? window : globalThis);

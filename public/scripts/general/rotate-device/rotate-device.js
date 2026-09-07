(function () {
  const root = document.documentElement;
  const inertState = new WeakMap();
  const guardedTargets = new Set();
  const waiters = new Set();
  let blocked = false;
  let initialized = false;
  let mediaQuery = null;
  let mediaQueryText = '';

  function getRequiredOrientation() {
    const configuredElement =
      root.hasAttribute('data-required-orientation')
        ? root
        : document.querySelector('[data-required-orientation]');
    return configuredElement?.dataset.requiredOrientation === 'landscape'
      ? 'landscape'
      : 'portrait';
  }

  function getBlockingQuery(requiredOrientation) {
    return requiredOrientation === 'landscape'
      ? '(orientation: portrait)'
      : '(max-width: 900px) and (orientation: landscape)';
  }

  function setTargetInert(target, shouldBeInert) {
    if (shouldBeInert) {
      if (!inertState.has(target)) {
        inertState.set(target, {
          hadAttribute: target.hasAttribute('inert'),
          propertyValue: Boolean(target.inert)
        });
      }
      target.inert = true;
      target.setAttribute('inert', '');
      guardedTargets.add(target);
      return;
    }

    const previous = inertState.get(target);
    if (!previous) return;
    target.inert = previous.propertyValue;
    if (previous.hadAttribute) target.setAttribute('inert', '');
    else target.removeAttribute('inert');
    inertState.delete(target);
    guardedTargets.delete(target);
  }

  function updateGuardedTargets(shouldBeInert) {
    const targets = [
      ...document.querySelectorAll('[data-orientation-guard-target]')
    ];
    if (!targets.length) {
      const main = document.querySelector('main');
      if (main) targets.push(main);
    }

    if (shouldBeInert) {
      const activeElement = document.activeElement;
      if (
        activeElement &&
        targets.some((target) => target.contains(activeElement))
      ) {
        activeElement.blur?.();
      }
      targets.forEach((target) => setTargetInert(target, true));
      return;
    }

    [...guardedTargets].forEach((target) => setTargetInert(target, false));
  }

  function updateMessage(requiredOrientation, shouldBlock) {
    const message = document.querySelector('[data-rotate-device-message]');
    if (!message) return;
    const orientationLabel =
      requiredOrientation === 'landscape' ? 'LANDSCAPE' : 'PORTRAIT';
    const title = message.querySelector('[data-rotate-device-title]');
    const copy = message.querySelector('[data-rotate-device-copy]');
    if (title) title.textContent = `ROTATE TO ${orientationLabel}`;
    if (copy) copy.textContent = 'Rotate your device to continue.';
    message.hidden = !shouldBlock;
    message.setAttribute('aria-hidden', String(!shouldBlock));
  }

  function resolveWaiters() {
    if (blocked) return;
    waiters.forEach((resolve) => resolve());
    waiters.clear();
  }

  function attachMediaQuery(queryText) {
    if (mediaQueryText === queryText && mediaQuery) return;
    if (mediaQuery) {
      mediaQuery.removeEventListener?.('change', refresh);
      mediaQuery.removeListener?.(refresh);
    }
    mediaQueryText = queryText;
    mediaQuery = window.matchMedia?.(queryText) || null;
    mediaQuery?.addEventListener?.('change', refresh);
    if (!mediaQuery?.addEventListener) mediaQuery?.addListener?.(refresh);
  }

  function refresh() {
    const requiredOrientation = getRequiredOrientation();
    const queryText = getBlockingQuery(requiredOrientation);
    attachMediaQuery(queryText);
    const nextBlocked = Boolean(mediaQuery?.matches);
    const changed = initialized && nextBlocked !== blocked;
    blocked = nextBlocked;
    initialized = true;

    root.classList.toggle('is-orientation-blocked', blocked);
    updateMessage(requiredOrientation, blocked);
    updateGuardedTargets(blocked);
    resolveWaiters();

    if (changed) {
      window.dispatchEvent(
        new CustomEvent(
          blocked ? 'oe:orientation-blocked' : 'oe:orientation-ready',
          { detail: { requiredOrientation } }
        )
      );
    }

    return !blocked;
  }

  function waitUntilAllowed() {
    if (refresh()) return Promise.resolve();
    return new Promise((resolve) => waiters.add(resolve));
  }

  window.OERotateDevice = {
    get blocked() {
      return blocked;
    },
    get requiredOrientation() {
      return getRequiredOrientation();
    },
    refresh,
    waitUntilAllowed
  };

  refresh();
  window.addEventListener('orientationchange', refresh);
  window.addEventListener('resize', refresh);
})();

(function () {
  const PANEL_SELECTOR = '.oling-lab-wall-decoration-panel';
  const EXIT_HOLD_MS = 150;
  const FALLBACK_TRANSITION_MS = 220;
  const pendingCloses = new Map();
  const panelIntents = new WeakMap();
  let transitionSequence = 0;

  function prefersReducedMotion() {
    return Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
  }

  function nextFrame() {
    if (typeof window.requestAnimationFrame !== 'function') {
      return Promise.resolve();
    }
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function waitForExitHold() {
    if (prefersReducedMotion()) return Promise.resolve();
    return new Promise((resolve) => window.setTimeout(resolve, EXIT_HOLD_MS));
  }

  function waitForTransform(panel) {
    if (!panel || prefersReducedMotion()) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        panel.removeEventListener('transitionend', onTransitionEnd);
        window.clearTimeout(timeoutId);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target === panel && event.propertyName === 'transform') {
          finish();
        }
      };
      const timeoutId = window.setTimeout(finish, FALLBACK_TRANSITION_MS);
      panel.addEventListener('transitionend', onTransitionEnd);
    });
  }

  function getPendingClose(panel) {
    return pendingCloses.get(panel)?.promise || null;
  }

  function clearFurnitureFootprintSelection() {
    const room = document.getElementById('oling-lab-room');
    if (room?.dataset) delete room.dataset.olingLabSelectedFurnitureId;
    room
      ?.querySelectorAll('.oling-lab-item.is-selected')
      .forEach((item) => item.classList.remove('is-selected'));
  }

  function close(panel, { beforeExit, afterClose } = {}) {
    if (!panel) return Promise.resolve(false);
    panelIntents.set(panel, Symbol('close'));
    const existing = getPendingClose(panel);
    if (existing) return existing;

    if (panel.hidden) {
      afterClose?.();
      return Promise.resolve(false);
    }

    clearFurnitureFootprintSelection();
    const token = ++transitionSequence;
    panel.inert = true;
    panel.classList.add('is-waiting-to-close');

    const promise = waitForExitHold().then(async () => {
      let current = pendingCloses.get(panel);
      if (!current || current.token !== token) return false;
      panel.classList.remove('is-waiting-to-close');
      beforeExit?.();
      panel.classList.remove('is-open', 'is-collapsed');
      panel.classList.add('is-transitioning-out');
      await waitForTransform(panel);
      current = pendingCloses.get(panel);
      if (!current || current.token !== token) return false;
      pendingCloses.delete(panel);
      panel.classList.remove('is-transitioning-out');
      panel.hidden = true;
      afterClose?.();
      return true;
    });
    pendingCloses.set(panel, { token, promise });
    return promise;
  }

  async function waitForExits(exceptPanel = null) {
    const exits = [...pendingCloses.entries()]
      .filter(([panel]) => panel !== exceptPanel)
      .map(([, entry]) => entry.promise);
    if (exits.length) await Promise.allSettled(exits);
  }

  async function open(panel, { afterOpen } = {}) {
    if (!panel) return false;
    const intent = Symbol('open');
    panelIntents.set(panel, intent);
    const ownExit = getPendingClose(panel);
    if (
      !ownExit &&
      !panel.hidden &&
      panel.classList.contains('is-open') &&
      !panel.classList.contains('is-collapsed')
    ) {
      panel.inert = false;
      afterOpen?.();
      return true;
    }
    if (ownExit) await ownExit;
    await waitForExits(panel);
    if (panelIntents.get(panel) !== intent) return false;

    panel.hidden = false;
    panel.inert = false;
    panel.classList.remove(
      'is-open',
      'is-collapsed',
      'is-waiting-to-close',
      'is-transitioning-out'
    );
    await nextFrame();
    if (panel.hidden || panelIntents.get(panel) !== intent) return false;
    panel.classList.add('is-open');
    afterOpen?.();
    return true;
  }

  function closeVisiblePanels({ except = null } = {}) {
    return [...document.querySelectorAll(PANEL_SELECTOR)]
      .filter((panel) => panel !== except && !panel.hidden)
      .map((panel) => close(panel));
  }

  window.OlingLabPanelTransitions = {
    close,
    closeVisiblePanels,
    getPendingClose,
    open,
    waitForExits
  };
})();

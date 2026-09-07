(function (globalScope) {
  function createRenderScheduler(options = {}) {
    const render = options.render;
    const scheduledRenders = new WeakMap();
    const requestFrame =
      typeof options.requestAnimationFrame === 'function'
        ? options.requestAnimationFrame
        : typeof globalScope.requestAnimationFrame === 'function'
          ? globalScope.requestAnimationFrame.bind(globalScope)
          : (callback) => globalScope.setTimeout(callback, 0);
    const cancelFrame =
      typeof options.cancelAnimationFrame === 'function'
        ? options.cancelAnimationFrame
        : typeof globalScope.cancelAnimationFrame === 'function'
          ? globalScope.cancelAnimationFrame.bind(globalScope)
          : (frameId) => globalScope.clearTimeout(frameId);

    function flush(root) {
      const pending = scheduledRenders.get(root);
      if (!pending) return null;
      scheduledRenders.delete(root);
      return render(root, pending.state);
    }

    function schedule(root, state) {
      if (!root || !state) return null;
      const pending = scheduledRenders.get(root);
      if (pending) {
        pending.state = state;
        return state;
      }
      const next = { frameId: null, state };
      next.frameId = requestFrame(() => flush(root));
      scheduledRenders.set(root, next);
      return state;
    }

    function cancel(root) {
      const pending = scheduledRenders.get(root);
      if (!pending) return false;
      cancelFrame(pending.frameId);
      scheduledRenders.delete(root);
      return true;
    }

    return { cancel, flush, schedule };
  }

  globalScope.createOlingClashRenderScheduler = createRenderScheduler;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createRenderScheduler;
  }
})(typeof window !== 'undefined' ? window : globalThis);

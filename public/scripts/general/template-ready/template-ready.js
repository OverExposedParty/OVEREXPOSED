// /scripts/general/ready.js
(() => {
  const states = new Map(); // key -> { ready: bool, waiters: [] }

  function ensure(key) {
    if (!states.has(key)) states.set(key, { ready: false, waiters: [] });
    return states.get(key);
  }

  const Ready = {
    /**
     * Mark a key as ready and resolve any waiters.
     */
    set(key, payload) {
      const s = ensure(key);
      if (s.ready) return; // idempotent
      s.ready = true;
      s.payload = payload;

      for (const resolve of s.waiters) resolve(payload);
      s.waiters.length = 0;

      // Optional: also dispatch an event for debugging/interop
      document.dispatchEvent(new CustomEvent(`ready:${key}`, { detail: payload }));
    },

    /**
     * Wait until a key is ready. Resolves immediately if already ready.
     */
    when(key, { timeout = 5000 } = {}) {
      const s = ensure(key);
      if (s.ready) return Promise.resolve(s.payload);

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          // remove this waiter if it times out
          const idx = s.waiters.indexOf(resolveWrapper);
          if (idx !== -1) s.waiters.splice(idx, 1);
          reject(new Error(`Timed out waiting for ready:${key}`));
        }, timeout);

        function resolveWrapper(payload) {
          clearTimeout(timer);
          resolve(payload);
        }

        s.waiters.push(resolveWrapper);
      });
    },

    /**
     * Helper for debugging.
     */
    isReady(key) {
      return ensure(key).ready;
    }
  };

  // expose globally (since you're not using ES modules)
  window.Ready = Ready;
})();

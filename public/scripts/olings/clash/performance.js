(function (globalScope) {
  const performanceApi = globalScope.performance;
  const documentRef = globalScope.document;
  if (!performanceApi || !documentRef) return;

  const metrics = {
    device: {
      deviceMemory: Number(globalScope.navigator?.deviceMemory || 0) || null,
      hardwareConcurrency:
        Number(globalScope.navigator?.hardwareConcurrency || 0) || null,
      reducedEffects: false,
      saveData: Boolean(globalScope.navigator?.connection?.saveData)
    },
    longTasks: [],
    largestContentfulPaint: null,
    resources: null,
    visibilityChanges: 0
  };
  const observers = [];
  performanceApi.mark('oling-clash:boot-start');

  const shouldReduceEffects = Boolean(
    metrics.device.saveData ||
    (metrics.device.deviceMemory && metrics.device.deviceMemory <= 2) ||
    (metrics.device.hardwareConcurrency &&
      metrics.device.hardwareConcurrency <= 2)
  );
  metrics.device.reducedEffects = shouldReduceEffects;
  documentRef.documentElement.toggleAttribute(
    'data-clash-reduced-effects',
    shouldReduceEffects
  );

  function observe(type, callback) {
    if (typeof globalScope.PerformanceObserver !== 'function') return;
    try {
      const observer = new globalScope.PerformanceObserver((list) =>
        callback(list.getEntries())
      );
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // The browser does not support this performance entry type.
    }
  }

  observe('longtask', (entries) => {
    entries.forEach((entry) => {
      metrics.longTasks.push({
        duration: Math.round(entry.duration),
        startTime: Math.round(entry.startTime)
      });
    });
    metrics.longTasks = metrics.longTasks.slice(-50);
  });
  observe('largest-contentful-paint', (entries) => {
    const entry = entries.at(-1);
    if (entry) metrics.largestContentfulPaint = Math.round(entry.startTime);
  });

  function summarizeResources() {
    const resources = performanceApi
      .getEntriesByType('resource')
      .filter(
        (entry) =>
          entry.name.includes('/olings/clash/') ||
          entry.name.includes('/api/olings/clashes')
      );
    metrics.resources = {
      count: resources.length,
      durationMs: Math.round(
        resources.reduce((total, entry) => total + entry.duration, 0)
      ),
      transferBytes: resources.reduce(
        (total, entry) => total + Number(entry.transferSize || 0),
        0
      ),
      slowest: resources
        .map((entry) => ({
          durationMs: Math.round(entry.duration),
          name: new URL(entry.name).pathname
        }))
        .sort((left, right) => right.durationMs - left.durationMs)
        .slice(0, 5)
    };
    return metrics.resources;
  }

  function snapshot() {
    const navigation = performanceApi.getEntriesByType('navigation')[0];
    summarizeResources();
    return {
      ...metrics,
      measures: performanceApi.getEntriesByType('measure').reduce(
        (result, entry) => ({
          ...result,
          [entry.name]: Math.round(entry.duration)
        }),
        {}
      ),
      navigation: navigation
        ? {
            domInteractive: Math.round(navigation.domInteractive),
            loadComplete: Math.round(navigation.loadEventEnd),
            responseStart: Math.round(navigation.responseStart)
          }
        : null
    };
  }

  function applyVisibilityState() {
    const hidden = documentRef.hidden;
    documentRef.documentElement.toggleAttribute(
      'data-clash-page-hidden',
      hidden
    );
    metrics.visibilityChanges += 1;
    globalScope.dispatchEvent(
      new globalScope.CustomEvent('oling-clash:visibility', {
        detail: { hidden }
      })
    );
  }

  documentRef.addEventListener('visibilitychange', applyVisibilityState);
  globalScope.addEventListener(
    'olings-clash:ready',
    () => {
      performanceApi.mark('oling-clash:ready');
      performanceApi.measure(
        'oling-clash:boot',
        'oling-clash:boot-start',
        'oling-clash:ready'
      );
    },
    { once: true }
  );
  globalScope.addEventListener('load', summarizeResources, { once: true });
  globalScope.addEventListener('pagehide', () => {
    observers.forEach((observer) => observer.disconnect());
  });
  applyVisibilityState();

  globalScope.OlingClashPerformance = { snapshot };
})(typeof window !== 'undefined' ? window : globalThis);

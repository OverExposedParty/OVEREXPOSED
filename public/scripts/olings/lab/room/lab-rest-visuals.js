(function () {
  function clampNumber(value, fallback, min = -Infinity, max = Infinity) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
  }

  function createRestVisualController(config = {}) {
    const options = {
      burstIncrement: Math.round(clampNumber(config.burstIncrement, 3, 1, 8)),
      burstDelayMs: clampNumber(config.burstDelayMs, 3200, 120, 10000),
      burstStepDelayMs: clampNumber(config.burstStepDelayMs, 700, 0, 2000),
      closedEyesPath:
        config.closedEyesPath || '/images/olings/states/rest/closed-eyes.svg',
      debugAnchor: Boolean(config.debugAnchor),
      driftDistancePx: clampNumber(config.driftDistancePx, 32, -300, 300),
      lifetimeMs: clampNumber(config.lifetimeMs, 1500, 300, 10000),
      maxActiveZs: Math.round(clampNumber(config.maxActiveZs, 3, 1, 30)),
      originPath:
        config.originPath ||
        '/images/olings/interaction-points/rest-z-origin.svg',
      riseDistancePx: clampNumber(config.riseDistancePx, 46, 1, 300),
      swayMaxPx: clampNumber(config.swayMaxPx, 5, 0, 20),
      swayMinPx: clampNumber(config.swayMinPx, 3, 0, 20)
    };
    options.swayMaxPx = Math.max(options.swayMinPx, options.swayMaxPx);

    const states = new WeakMap();
    let originPromise = null;

    function loadOrigin() {
      if (originPromise) return originPromise;
      originPromise = fetch(options.originPath, {
        headers: { Accept: 'image/svg+xml' }
      })
        .then((response) => {
          if (!response.ok)
            throw new Error('Rest Z origin could not be loaded.');
          return response.text();
        })
        .then((svgText) => ({
          point: window.OlingLabPlacementSvg?.parsePointPlacement(
            svgText,
            512
          ) || { x: 351.57, y: 161.63 },
          svgText
        }))
        .catch((error) => {
          console.warn(
            '[Oling rest Zs] Falling back to default origin.',
            error
          );
          return {
            point: { x: 351.57, y: 161.63 },
            svgText: ''
          };
        });
      return originPromise;
    }

    function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }

    function getState(root) {
      let state = states.get(root);
      if (state) return state;
      state = {
        activeZs: new Set(),
        burstIndex: 0,
        isActive: false,
        pendingBursts: new Set(),
        timerId: null
      };
      states.set(root, state);
      return state;
    }

    function removeZ(state, z) {
      state.activeZs.delete(z);
      z.remove();
    }

    function getPreview(root) {
      return (
        root?.querySelector('.oling-lab-oling-preview.is-roaming') ||
        root?.querySelector('.oling-lab-oling-preview') ||
        root
      );
    }

    function ensureClosedEyesLayer(root) {
      const preview = getPreview(root);
      if (!preview) return null;
      let layer = preview.querySelector(
        ':scope > .oling-lab-oling-layer.is-rest-eyes'
      );
      if (layer) return layer;

      layer = document.createElement('img');
      layer.className = 'oling-lab-oling-layer is-rest-eyes';
      layer.src = options.closedEyesPath;
      layer.alt = '';
      layer.setAttribute('aria-hidden', 'true');
      preview.appendChild(layer);
      return layer;
    }

    function getOriginLayer(root, origin) {
      const preview = getPreview(root);
      if (!preview) return null;
      let layer = preview.querySelector(
        ':scope > .oling-lab-rest-z-origin-layer'
      );
      if (layer) return layer;

      layer = document.createElement('span');
      layer.className = 'oling-lab-rest-z-origin-layer';
      layer.classList.toggle('is-debug', options.debugAnchor);
      layer.setAttribute('aria-hidden', 'true');

      if (origin.svgText) {
        const sourceSvg = new DOMParser().parseFromString(
          origin.svgText,
          'image/svg+xml'
        ).documentElement;
        if (sourceSvg?.tagName?.toLowerCase() === 'svg') {
          const anchorMap = document.importNode(sourceSvg, true);
          anchorMap.classList.add(
            'oling-lab-oling-layer',
            'is-interaction-point',
            'oling-lab-rest-z-anchor-map'
          );
          anchorMap.removeAttribute('width');
          anchorMap.removeAttribute('height');
          anchorMap.setAttribute('focusable', 'false');
          layer.appendChild(anchorMap);
        }
      }

      preview.appendChild(layer);
      return layer;
    }

    function getRenderedOrigin(layer, origin) {
      const anchorMap = layer.querySelector('.oling-lab-rest-z-anchor-map');
      const marker = anchorMap?.querySelector(
        '[data-interaction-point], circle, ellipse, rect'
      );
      const layerBounds = layer.getBoundingClientRect();
      const anchorBounds = anchorMap?.getBoundingClientRect();
      const markerBounds = marker?.getBoundingClientRect();
      if (
        markerBounds &&
        Number.isFinite(markerBounds.left) &&
        Number.isFinite(markerBounds.top) &&
        markerBounds.width > 0 &&
        markerBounds.height > 0
      ) {
        return {
          x: markerBounds.left + markerBounds.width / 2 - layerBounds.left,
          y: markerBounds.top + markerBounds.height / 2 - layerBounds.top
        };
      }

      const referenceBounds =
        anchorBounds && anchorBounds.width > 0 && anchorBounds.height > 0
          ? anchorBounds
          : layerBounds;
      return {
        x:
          referenceBounds.left -
          layerBounds.left +
          (origin.point.x / 512) * referenceBounds.width,
        y:
          referenceBounds.top -
          layerBounds.top +
          (origin.point.y / 512) * referenceBounds.height
      };
    }

    function trimActiveZs(state) {
      while (state.activeZs.size >= options.maxActiveZs) {
        const [oldest] = state.activeZs;
        if (!oldest) return;
        removeZ(state, oldest);
      }
    }

    function createZ(root, state, origin, index) {
      if (!root?.isConnected) return;
      const originLayer = getOriginLayer(root, origin);
      if (!originLayer) return;
      trimActiveZs(state);

      const z = document.createElement('span');
      z.className = 'oling-lab-rest-z';
      z.textContent = 'Z';
      z.setAttribute('aria-hidden', 'true');

      const spawn = getRenderedOrigin(originLayer, origin);
      const sequenceProgress =
        options.burstIncrement > 1 ? index / (options.burstIncrement - 1) : 0;
      const curveScale = 1 - sequenceProgress * 0.4;
      const lifetime = options.lifetimeMs * randomBetween(0.9, 1.1);
      const swayEarly =
        randomBetween(options.swayMinPx, options.swayMaxPx) *
        (Math.random() < 0.5 ? -1 : 1) *
        curveScale;
      const swayMid =
        randomBetween(options.swayMinPx, options.swayMaxPx) *
        (Math.random() < 0.5 ? -1 : 1) *
        curveScale;
      const rotationStart = randomBetween(-8, 8);
      const rotationEnd = Math.min(
        8,
        Math.max(-8, rotationStart + randomBetween(-5, 5))
      );
      const startX = spawn.x;
      const startY = spawn.y;
      const endX =
        spawn.x + options.driftDistancePx * (1 - sequenceProgress * 0.25);
      const endY =
        spawn.y - options.riseDistancePx * (1 - sequenceProgress * 0.4);
      const drift = endX - startX;
      const rise = startY - endY;
      const formatPathNumber = (value) => Number(value.toFixed(2));
      const motionPath = [
        `M ${formatPathNumber(startX)} ${formatPathNumber(startY)}`,
        `C ${formatPathNumber(startX + drift * 0.18 + swayEarly)} ${formatPathNumber(startY - rise * 0.24)}`,
        `${formatPathNumber(startX + drift * 0.52 + swayMid)} ${formatPathNumber(startY - rise * 0.6)}`,
        `${formatPathNumber(endX)} ${formatPathNumber(endY)}`
      ].join(' ');

      z.style.setProperty('--oling-rest-z-path', `path("${motionPath}")`);
      z.style.setProperty('--oling-rest-z-lifetime', `${lifetime}ms`);
      z.style.setProperty(
        '--oling-rest-z-rotation-start',
        `${rotationStart}deg`
      );
      z.style.setProperty('--oling-rest-z-rotation-end', `${rotationEnd}deg`);

      state.activeZs.add(z);
      originLayer.appendChild(z);
      window.setTimeout(() => removeZ(state, z), lifetime + 80);
    }

    function emitSequence(root) {
      if (!root) {
        stop(root);
        return;
      }
      if (!root.isConnected) return;
      const state = getState(root);
      state.burstIndex += 1;
      loadOrigin().then((origin) => {
        if (!state.isActive) return;
        for (let index = 0; index < options.burstIncrement; index += 1) {
          const timeoutId = window.setTimeout(() => {
            state.pendingBursts.delete(timeoutId);
            if (!state.isActive) return;
            createZ(root, state, origin, index);
          }, index * options.burstStepDelayMs);
          state.pendingBursts.add(timeoutId);
        }
      });
    }

    function start(root) {
      if (!root) return;
      const state = getState(root);
      state.isActive = true;
      root.classList.add('has-rest-visuals');
      if (state.timerId) {
        if (root.isConnected && state.burstIndex === 0) emitSequence(root);
        return;
      }
      emitSequence(root);
      state.timerId = window.setInterval(
        () => emitSequence(root),
        options.burstDelayMs
      );
    }

    function stop(root) {
      if (!root) return;
      root.classList.remove('has-rest-visuals');
      const state = states.get(root);
      if (!state) return;
      state.isActive = false;
      if (state.timerId) {
        window.clearInterval(state.timerId);
        state.timerId = null;
      }
      state.pendingBursts.forEach((timeoutId) =>
        window.clearTimeout(timeoutId)
      );
      state.pendingBursts.clear();
      state.activeZs.forEach((z) => z.remove());
      state.activeZs.clear();
      root
        .querySelectorAll('.oling-lab-rest-z-origin-layer')
        .forEach((layer) => layer.remove());
    }

    function sync(root, isSleeping) {
      ensureClosedEyesLayer(root);
      if (isSleeping) {
        start(root);
      } else {
        stop(root);
      }
    }

    return {
      start,
      stop,
      sync
    };
  }

  window.OlingLabRestVisuals = {
    create: createRestVisualController
  };
})();

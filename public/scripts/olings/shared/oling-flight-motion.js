(function (globalScope) {
  const rootStates = new WeakMap();
  const defaultMotionDurations = Object.freeze({
    flutter: 0.32,
    sway: 2.4
  });

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-');
  }

  function normalizeFlightSpeed(value) {
    const speed = Number(value);
    return Number.isFinite(speed) && speed > 0 ? speed : 1;
  }

  function resolveMotion(trait = {}) {
    const flightTrait = trait || {};
    const configuredMotion = normalizeKey(flightTrait.flightMotion);
    const flightType = normalizeKey(flightTrait.flightType);
    if (configuredMotion === 'figure8' && flightType === 'balloons')
      return 'sway';
    if (configuredMotion) return configuredMotion;

    if (flightType === 'wings') return 'flutter';
    if (flightType === 'balloons') return 'sway';
    return '';
  }

  function removeClassesWithPrefix(element, prefix) {
    [...element.classList]
      .filter((className) => className.startsWith(prefix))
      .forEach((className) => element.classList.remove(className));
  }

  function applyEffectiveDuration(root, state) {
    const effectiveDuration =
      state.baseDuration / (state.flightSpeed * state.speedMultiplier);
    root.style.setProperty(
      '--oling-flight-motion-duration',
      `${effectiveDuration}s`
    );
    root.dataset.flightSpeed = String(state.flightSpeed);
    root.dataset.flightSpeedMultiplier = String(state.speedMultiplier);
  }

  function configure(root, trait = {}, options = {}) {
    if (!root) return null;
    const flightTrait = trait || {};

    const flightLayer =
      options.flightLayer ||
      root.querySelector(
        '[data-oling-layer="flight"], .oling-lab-oling-layer.is-flight, .oling-battle-layer.is-flight'
      );
    if (!flightLayer) return null;

    const previousState = rootStates.get(root);
    if (
      previousState?.flightLayer &&
      previousState.flightLayer !== flightLayer
    ) {
      previousState.flightLayer.classList.remove('oling-flight-motion-layer');
      removeClassesWithPrefix(previousState.flightLayer, 'is-flight-type-');
      removeClassesWithPrefix(previousState.flightLayer, 'is-flight-motion-');
    }

    const flightType = normalizeKey(flightTrait.flightType);
    const flightMotion = resolveMotion(flightTrait);
    const flightSpeed = normalizeFlightSpeed(flightTrait.flightSpeed);
    const configuredDuration = Number(options.motionDuration);
    const baseDuration =
      Number.isFinite(configuredDuration) && configuredDuration > 0
        ? configuredDuration
        : defaultMotionDurations[flightMotion] || 1;
    const state = {
      baseDuration,
      flightLayer,
      flightMotion,
      flightSpeed,
      flightType,
      speedMultiplier: normalizeFlightSpeed(options.speedMultiplier)
    };

    root.classList.add('oling-flight-motion-root');
    flightLayer.classList.add('oling-flight-motion-layer');
    removeClassesWithPrefix(flightLayer, 'is-flight-type-');
    removeClassesWithPrefix(flightLayer, 'is-flight-motion-');
    if (flightType) flightLayer.classList.add(`is-flight-type-${flightType}`);
    if (flightMotion)
      flightLayer.classList.add(`is-flight-motion-${flightMotion}`);

    root.dataset.flightType = flightType;
    root.dataset.flightMotion = flightMotion;
    rootStates.set(root, state);
    applyEffectiveDuration(root, state);
    setPaused(root, Boolean(options.paused));

    return { ...state };
  }

  function setMotionDuration(root, durationSeconds) {
    const state = rootStates.get(root);
    const duration = Number(durationSeconds);
    if (!state || !Number.isFinite(duration) || duration <= 0) return false;

    state.baseDuration = duration;
    applyEffectiveDuration(root, state);
    return true;
  }

  function setPaused(root, isPaused) {
    if (!root) return false;
    root.classList.toggle('is-flight-motion-paused', Boolean(isPaused));
    return true;
  }

  function setSpeedMultiplier(root, speedMultiplier) {
    const state = rootStates.get(root);
    if (!state) return false;

    state.speedMultiplier = normalizeFlightSpeed(speedMultiplier);
    applyEffectiveDuration(root, state);
    return true;
  }

  const api = {
    configure,
    defaultMotionDurations,
    normalizeFlightSpeed,
    resolveMotion,
    setMotionDuration,
    setPaused,
    setSpeedMultiplier
  };

  globalScope.OlingFlightMotion = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

(function (globalScope) {
  const BACKGROUND_ROOT = '/images/olings/clash/backgrounds';
  const DEFAULT_BACKGROUND = 'the-clashroom';
  const HUD_PROPERTIES = Object.freeze({
    border: '--clash-game-border',
    focus: '--clash-game-focus',
    lockedOverlay: '--clash-game-locked-overlay',
    modalOverlay: '--clash-game-modal-overlay',
    panel: '--clash-game-panel',
    panelDeep: '--clash-game-panel-deep',
    primary: '--clash-game-ink',
    secondary: '--clash-game-secondary',
    shadow: '--clash-game-shadow',
    surface: '--clash-game-surface',
    text: '--clash-game-text',
    textMuted: '--clash-game-text-muted',
    textOnPrimary: '--clash-game-text-on-primary',
    textOnSecondary: '--clash-game-text-on-secondary',
    textSoft: '--clash-game-text-soft'
  });
  const SIGNAL_PROPERTIES = Object.freeze({
    activation: Object.freeze({
      empty: '--clash-activation-empty-colour',
      filled: '--clash-activation-filled-colour',
      primed: '--clash-activation-primed-colour'
    }),
    tag: Object.freeze({
      primary: '--clash-tag-primary-colour',
      secondary: '--clash-tag-secondary-colour'
    })
  });
  const LAYER_KEYS = Object.freeze([
    'farBackground',
    'background',
    'stage',
    'foreground'
  ]);

  function normalizeBackgroundId(value) {
    const id = String(value || '')
      .trim()
      .toLowerCase();
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : DEFAULT_BACKGROUND;
  }

  function isCssColour(value) {
    const colour = String(value || '').trim();
    return (
      /^#[0-9a-f]{3,8}$/i.test(colour) ||
      /^(?:rgb|rgba|hsl|hsla)\([\d\s.,/%+-]+\)$/i.test(colour) ||
      colour === 'transparent'
    );
  }

  function isLayerFilename(value) {
    return /^[a-z0-9][a-z0-9._-]*\.svg$/i.test(String(value || '').trim());
  }

  function getConfigPath(backgroundId) {
    const id = normalizeBackgroundId(backgroundId);
    return `${BACKGROUND_ROOT}/${id}/config.json`;
  }

  function applyHudTheme(root, hud = {}) {
    if (!root?.style || !hud || typeof hud !== 'object') return;

    Object.entries(HUD_PROPERTIES).forEach(([key, property]) => {
      const value = hud[key];
      if (isCssColour(value)) root.style.setProperty(property, value.trim());
    });
  }

  function applySignalTheme(root, signals = {}) {
    if (!root?.style || !signals || typeof signals !== 'object') return;

    Object.entries(SIGNAL_PROPERTIES).forEach(([signalKey, properties]) => {
      const signal = signals[signalKey];
      if (!signal || typeof signal !== 'object') return;

      Object.entries(properties).forEach(([key, property]) => {
        const value = signal[key];
        if (isCssColour(value)) root.style.setProperty(property, value.trim());
      });
    });
  }

  function applyPageTheme(root, hud = {}) {
    const pageRoot = root?.ownerDocument?.documentElement;
    if (!pageRoot?.style || !hud || typeof hud !== 'object') return;

    if (isCssColour(hud.primary)) {
      pageRoot.style.setProperty('--primarypagecolour', hud.primary.trim());
    }
    if (isCssColour(hud.secondary)) {
      pageRoot.style.setProperty('--secondarypagecolour', hud.secondary.trim());
    }
  }

  function applySceneLayers(root, layers = {}, backgroundId) {
    if (!root?.querySelector || !layers || typeof layers !== 'object') return;

    const basePath = `${BACKGROUND_ROOT}/${normalizeBackgroundId(backgroundId)}`;
    LAYER_KEYS.forEach((key) => {
      const filename = layers[key];
      if (!isLayerFilename(filename)) return;

      root
        .querySelector(`[data-clash-scene-layer="${key}"]`)
        ?.setAttribute('src', `${basePath}/${filename.trim()}`);
    });
  }

  function applyBackgroundConfig(root, config = {}, options = {}) {
    if (!root) return null;

    const backgroundId = normalizeBackgroundId(
      options.backgroundId || config.id || root.dataset?.clashBackground
    );
    applyHudTheme(root, config.hud);
    applySignalTheme(root, config.signals);
    applyPageTheme(root, config.hud);
    applySceneLayers(root, config.layers, backgroundId);
    root.dataset.clashBackground = backgroundId;
    root.dataset.clashBackgroundLoaded = 'true';

    return { backgroundId, config };
  }

  async function loadBackgroundTheme(options = {}) {
    const root =
      options.root ||
      globalScope.document?.querySelector?.('[data-clash-game]');
    if (!root) return null;

    const backgroundId = normalizeBackgroundId(
      options.backgroundId || root.dataset.clashBackground
    );
    const fetchImpl = options.fetchImpl || globalScope.fetch?.bind(globalScope);
    if (!fetchImpl) return null;

    const response = await fetchImpl(getConfigPath(backgroundId));
    if (!response?.ok) {
      throw new Error(`Unable to load Clash background: ${backgroundId}`);
    }

    const config = await response.json();
    return applyBackgroundConfig(root, config, { backgroundId });
  }

  const api = {
    applyBackgroundConfig,
    applyPageTheme,
    getConfigPath,
    isCssColour,
    isLayerFilename,
    loadBackgroundTheme,
    normalizeBackgroundId
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (globalScope.document) {
    globalScope.OlingClashBackgroundTheme = api;
    const root = globalScope.document.querySelector('[data-clash-game]');
    if (root) {
      globalScope.OlingClashBackgroundThemeReady = loadBackgroundTheme({
        root
      }).catch((error) => {
        root.dataset.clashBackgroundLoaded = 'fallback';
        console.warn(error);
        return null;
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);

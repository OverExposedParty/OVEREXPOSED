(function (globalScope) {
  const effectAssetRoot = '/images/olings/clash/ui/effects';
  const effectKeyAliases = Object.freeze({
    fortify: 'fortified',
    ignite: 'burn-primed',
    mark: 'marked',
    reinforce: 'reinforced',
    retaliate: 'burn-primed',
    steal: 'steal-primed',
    suppress: 'suppressed',
    ward: 'warded'
  });
  const effectIconKeys = new Set([
    'blocked',
    'bloodbound',
    'burn',
    'burn-primed',
    'fortified',
    'junk',
    'marked',
    'reinforced',
    'steal-primed',
    'suppressed',
    'warded'
  ]);

  function normalizeEffectKey(value) {
    const key = String(value || '')
      .trim()
      .toLowerCase();
    return effectKeyAliases[key] || key;
  }

  function resolveIconPath(effect = {}) {
    const explicitPath = String(effect.iconPath || '').trim();
    if (explicitPath) return explicitPath;

    const key = normalizeEffectKey(
      effect.displayStatusKey || effect.data?.displayStatusKey || effect.key
    );
    return effectIconKeys.has(key) ? `${effectAssetRoot}/${key}.svg` : null;
  }

  function createOlingClashEffectRenderer() {
    function createIcon(documentRef, effect) {
      const iconPath = resolveIconPath(effect);
      if (!documentRef || !iconPath) return null;

      const icon = documentRef.createElement('img');
      icon.className = 'olings-clash-effect__icon';
      icon.src = iconPath;
      icon.alt = '';
      icon.draggable = false;
      icon.setAttribute('aria-hidden', 'true');
      return icon;
    }

    return {
      createIcon,
      normalizeEffectKey,
      resolveIconPath
    };
  }

  globalScope.createOlingClashEffectRenderer =
    createOlingClashEffectRenderer;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createOlingClashEffectRenderer;
  }
})(typeof window !== 'undefined' ? window : globalThis);

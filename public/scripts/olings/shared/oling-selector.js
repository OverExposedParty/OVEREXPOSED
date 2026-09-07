(function () {
  function formatKey(value, fallback = '-') {
    const text = String(value || '')
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .trim();
    if (!text) return fallback;
    return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getTraitImage(trait) {
    return (
      trait?.assets?.image ||
      trait?.assets?.icon ||
      trait?.assets?.layer ||
      trait?.metadata?.image ||
      ''
    );
  }

  function getTraitHealth(trait) {
    const health = Number(trait?.body?.health || trait?.metadata?.health);
    return Number.isFinite(health) && health > 0 ? Math.round(health) : 100;
  }

  function normalizeOling(oling) {
    if (!oling) return null;

    const traits = oling.traits || {};
    const body = traits.body || {};
    const eyes = traits.eyes || {};
    const mouth = traits.mouth || {};
    const flight = traits.flight || {};
    const maxEnergy = Math.max(1, Number(oling.care?.maxEnergy) || 100);
    const energy = Math.max(
      0,
      Math.min(maxEnergy, Number(oling.care?.energy ?? maxEnergy))
    );

    return {
      id: String(oling.id || oling._id || ''),
      name: oling.name || 'Oling',
      energy: Math.round((energy / maxEnergy) * 100),
      maxHealth: getTraitHealth(body),
      type: formatKey(oling.eggKey, 'Base'),
      rarity: formatKey(
        oling.matchingSet?.rarity || oling.buildRarities?.body,
        'Base'
      ),
      matchingSet: oling.matchingSet?.name || '-',
      clashRoles: Array.isArray(oling.clashRoles)
        ? oling.clashRoles
            .map((role) => String(role || '').trim())
            .filter(Boolean)
        : [],
      layers: {
        flight: flight.name || formatKey(oling.build?.flight, '-'),
        body: body.name || formatKey(oling.build?.body, '-'),
        eyes: eyes.name || formatKey(oling.build?.eyes, '-'),
        mouth: mouth.name || formatKey(oling.build?.mouth, '-')
      },
      flightType: flight.flightType || '',
      flightMotion: flight.flightMotion || '',
      flightSpeed: flight.flightSpeed || 1,
      flight: getTraitImage(flight),
      body: getTraitImage(body),
      eyes: getTraitImage(eyes),
      mouth: getTraitImage(mouth),
      source: oling
    };
  }

  function getFallbackLayerSource(layerName) {
    return layerName === 'flight'
      ? '/images/olings/builds/flight/base/moss-wings.svg'
      : `/images/olings/builds/${layerName}/base/moss-${layerName}.svg`;
  }

  function createLayer(src, layerName, extraClass = '') {
    const image = document.createElement('img');
    image.className = ['oling-selector__layer', `is-${layerName}`, extraClass]
      .filter(Boolean)
      .join(' ');
    image.src = src || getFallbackLayerSource(layerName);
    image.alt = '';
    return image;
  }

  function renderArt(
    container,
    oling,
    { layerClass = '', configureFlight = null } = {}
  ) {
    if (!container || !oling) return;

    container.replaceChildren(
      createLayer(oling.flight, 'flight', layerClass),
      createLayer(oling.body, 'body', layerClass),
      createLayer(oling.eyes, 'eyes', layerClass),
      createLayer(oling.mouth, 'mouth', layerClass)
    );
    configureFlight?.(container, oling);
  }

  function getDetailRows(oling) {
    return [
      ['Name', oling.name || 'Oling', 'is-wide is-name'],
      ['Type', oling.type || 'Base', 'is-half'],
      ['Max Health', oling.maxHealth || '-', 'is-half'],
      ['Rarity', oling.rarity || 'Base', 'is-half'],
      ['Matching Set', oling.matchingSet || '-', 'is-half'],
      ['Body Layer', oling.layers?.body || '-', 'is-half is-layer'],
      ['Eyes Layer', oling.layers?.eyes || '-', 'is-half is-layer'],
      ['Mouth Layer', oling.layers?.mouth || '-', 'is-half is-layer'],
      ['Flight Layer', oling.layers?.flight || '-', 'is-half is-layer']
    ];
  }

  function renderStats(stats, oling) {
    if (!stats || !oling) return;

    stats.replaceChildren(
      ...getDetailRows(oling).map(([label, value, extraClass = '']) => {
        const row = document.createElement('div');
        if (extraClass) row.className = extraClass;
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        definition.textContent = String(value);
        row.append(term, definition);
        return row;
      })
    );
  }

  function updateEnergy(meter, oling) {
    if (!meter) return;
    const energy = Math.max(0, Math.min(100, Number(oling?.energy) || 0));
    meter.setAttribute('aria-valuenow', String(energy));
    const fill = meter.querySelector(
      '.oling-selector__energy-fill, .oling-battle-lobby-energy-fill'
    );
    fill?.style.setProperty('--oling-selector-energy-level', `${energy}%`);
    fill?.style.setProperty('--oling-lobby-energy-level', `${energy}%`);
    const value = meter.querySelector(
      '.oling-selector__energy-value, .oling-battle-lobby-energy-value'
    );
    if (value) value.textContent = String(energy);
  }

  window.OlingSelector = Object.freeze({
    createLayer,
    formatKey,
    getDetailRows,
    getTraitHealth,
    getTraitImage,
    normalizeOling,
    renderArt,
    renderStats,
    updateEnergy
  });

  window.SetScriptLoaded?.('/scripts/olings/shared/oling-selector.js');
})();

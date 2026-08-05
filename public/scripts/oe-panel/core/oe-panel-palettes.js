(function () {
  const paletteMaps = new Map();

  const fallbackGamemodes = {
    'truth-or-dare': ['#66CCFF', '#427BB9', 'Truth or Dare'],
    paranoia: ['#9D8AFF', '#7F71B2', 'Paranoia'],
    'never-have-i-ever': ['#FF9266', '#B96542', 'Never Have I Ever'],
    'most-likely-to': ['#FFEE66', '#B9AA42', 'Most Likely To'],
    imposter: ['#3DA7A1', '#2A6E6A', 'Imposter'],
    'would-you-rather': ['#7CFFB2', '#55B97F', 'Would You Rather'],
    mafia: ['#9B56D3', '#6D3C95', 'Mafia'],
    overexposure: ['#E88BAE', '#C3698B', 'Overexposure']
  };

  const fallbackRarities = {
    common: ['#D7D4E8', '#87839D', '#F4F2FF'],
    uncommon: ['#7CFFB2', '#55B97F', '#EFFFF6'],
    rare: ['#66CCFF', '#427BB9', '#EAF8FF'],
    epic: ['#C18AFF', '#7F5AB8', '#F7EFFF'],
    legendary: ['#FFB86B', '#C9823F', '#FFF4E4'],
    mythic: ['#FF6F91', '#C14362', '#FFF0F4'],
    secret: ['#FF6F91', '#C14362', '#FFF0F4']
  };

  function normalizeKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function getMap(type) {
    const normalizedType = normalizeKey(type);
    if (!paletteMaps.has(normalizedType)) {
      paletteMaps.set(normalizedType, new Map());
    }
    return paletteMaps.get(normalizedType);
  }

  function resolveCssColour(value) {
    const colour = String(value || '').trim();
    if (!colour || colour === '-') return '';
    const variableMatch = colour.match(/^var\((--[^),\s]+)(?:,[^)]+)?\)$/);
    if (!variableMatch) return colour;
    return '';
  }

  function normalizePalette(palette = {}) {
    const primary = resolveCssColour(
      palette.primary || palette.primaryColour || palette.colour
    );
    const secondary = resolveCssColour(
      palette.secondary || palette.secondaryColour || primary
    );
    if (!primary) return null;
    return {
      primary,
      secondary: secondary || primary,
      text: resolveCssColour(palette.text || palette.textColour) || '#F4F4F4',
      label: String(palette.label || '').trim()
    };
  }

  function register(type, key, palette) {
    const normalizedPalette = normalizePalette(palette);
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey || !normalizedPalette) return null;
    const map = getMap(type);
    map.set(normalizedKey, normalizedPalette);
    if (normalizedPalette.label) {
      map.set(normalizeKey(normalizedPalette.label), normalizedPalette);
    }
    return normalizedPalette;
  }

  Object.entries(fallbackGamemodes).forEach(([key, values]) => {
    register('gamemode', key, {
      primary: values[0],
      secondary: values[1],
      label: values[2]
    });
  });
  Object.entries(fallbackRarities).forEach(([key, values]) => {
    register('rarity', key, {
      primary: values[0],
      secondary: values[1],
      text: values[2],
      label: key
    });
  });

  function loadKeyedPalettes(type, data) {
    Object.entries(data || {}).forEach(([key, palette]) => {
      register(type, key, palette);
    });
  }

  async function loadSource(url, onLoad) {
    if (typeof window.fetch !== 'function') return;
    try {
      const response = await window.fetch(url);
      if (!response.ok) return;
      onLoad(await response.json());
    } catch (error) {
      // Built-in fallbacks keep the panel usable if a static palette is unavailable.
    }
  }

  const ready = Promise.all([
    loadSource('/json-files/party-games/gamemodes/gamemodes.json', (data) => {
      (Array.isArray(data) ? data : []).forEach((mode) => {
        register('gamemode', mode.gamemodeID, {
          primary: mode.gamemodePrimaryColour,
          secondary: mode.gamemodeSecondaryColour,
          label: mode.gamemodeName
        });
      });
    }),
    loadSource('/json-files/achievements/rarities.json', (data) => {
      loadKeyedPalettes('rarity', data);
    }),
    loadSource('/json-files/olings/rarities.json', (data) => {
      loadKeyedPalettes('rarity', data);
    }),
    loadSource('/json-files/olings/container-themes.json', (data) => {
      loadKeyedPalettes('theme', data?.themes);
    })
  ]);

  function get(type, value) {
    return getMap(type).get(normalizeKey(value)) || null;
  }

  function getDirectPalette(row = {}, config = {}) {
    return normalizePalette({
      primary:
        row[config.primaryField || 'colour'] ||
        row.primaryColour ||
        row.colours?.primary,
      secondary:
        row[config.secondaryField || 'secondaryColour'] ||
        row.secondaryColour ||
        row.colours?.secondary,
      text: row[config.textField || 'textColour'] || row.textColour
    });
  }

  function normalizeConfig(config) {
    if (typeof config === 'string') return { type: config };
    return config && typeof config === 'object' ? config : {};
  }

  function inferConfig(fieldConfig = {}, dataSource = '') {
    if (fieldConfig.palette) return normalizeConfig(fieldConfig.palette);
    const key = String(fieldConfig.key || fieldConfig.valueKey || '');
    const normalizedKey = key.toLowerCase();

    if (['gamemode', 'gamemodekey', 'gametype', 'lastgamemode'].includes(normalizedKey)) {
      return { type: 'gamemode' };
    }
    if (normalizedKey === 'rarity') return { type: 'rarity' };
    if (normalizedKey === 'rarities') return { type: 'rarity', multiple: true };
    if (normalizedKey === 'theme') return { type: 'theme' };
    if (['colour', 'color'].includes(normalizedKey)) {
      return { type: 'colour', secondaryField: 'secondaryColour' };
    }
    if (normalizedKey === 'secondarycolour') {
      return { type: 'colour', primaryField: 'secondaryColour' };
    }
    if (normalizedKey === 'selectedpacks') {
      return { type: 'pack', multiple: true, fallbackType: 'gamemode' };
    }
    if (normalizedKey === 'pack') {
      return {
        type: String(dataSource).startsWith('oeCustomisation')
          ? 'oe-pack'
          : 'pack',
        fallbackType: 'gamemode'
      };
    }

    const recordTypes = {
      partyPacks: ['title', 'pack'],
      partyRules: ['rule', 'rule'],
      partyRoles: ['role', 'role'],
      oeCustomisationPacks: ['pack', 'oe-pack']
    };
    const recordType = recordTypes[dataSource];
    if (recordType && normalizedKey === recordType[0].toLowerCase()) {
      return { type: 'record', registerAs: recordType[1] };
    }
    return null;
  }

  function resolve(config, value, row = {}, fieldConfig = {}, dataSource = '') {
    const resolvedConfig = normalizeConfig(
      config || inferConfig(fieldConfig, dataSource)
    );
    const type = normalizeKey(resolvedConfig.type);
    if (!type) return null;

    if (type === 'record') {
      return (
        getDirectPalette(row, resolvedConfig) ||
        get(resolvedConfig.registerAs, value) ||
        get('gamemode', row.gamemode || row.gameMode)
      );
    }
    if (type === 'colour') {
      return (
        normalizePalette({
          primary:
            row[resolvedConfig.primaryField || fieldConfig.key] || value,
          secondary:
            row[resolvedConfig.secondaryField || fieldConfig.key] || value
        }) || get('gamemode', row.gamemode || row.gameMode)
      );
    }

    const direct = get(type, value);
    if (direct) return direct;

    const directRowPalette = getDirectPalette(row, resolvedConfig);
    if (directRowPalette && ['pack', 'rule', 'role', 'oe-pack'].includes(type)) {
      return directRowPalette;
    }

    if (resolvedConfig.fallbackType) {
      const fallbackValue =
        row[resolvedConfig.fallbackField || 'gamemode'] || row.gameMode;
      return get(resolvedConfig.fallbackType, fallbackValue);
    }
    return null;
  }

  function decorate(element, palette) {
    if (!element || !palette) return element;
    element.classList.add('oe-panel-palette-coded');
    element.style.setProperty('--oe-panel-palette-primary', palette.primary);
    element.style.setProperty('--oe-panel-palette-secondary', palette.secondary);
    element.style.setProperty('--oe-panel-palette-text', palette.text);
    return element;
  }

  function createBadge(value, palette) {
    const badge = document.createElement('span');
    badge.className = 'oe-panel-palette-value';
    decorate(badge, palette);

    const swatch = document.createElement('span');
    swatch.className = 'oe-panel-palette-swatch';
    swatch.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'oe-panel-palette-label';
    label.textContent = value === undefined || value === null || value === '' ? '-' : value;
    badge.append(swatch, label);
    return badge;
  }

  function splitValues(value) {
    if (Array.isArray(value)) return value;
    const raw = String(value || '').trim();
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (error) {
        // Continue with the human-readable delimiter form.
      }
    }
    return raw.split(/\s*[,|/]\s*/).filter(Boolean);
  }

  function createValue({ value, row = {}, fieldConfig = {}, dataSource = '' }) {
    const config = inferConfig(fieldConfig, dataSource);
    if (!config) return null;
    if (config.map) {
      let entries = [];
      try {
        const parsed =
          value && typeof value === 'object' ? value : JSON.parse(value);
        entries = Object.entries(parsed || {});
      } catch (error) {
        return null;
      }
      if (!entries.length) return null;
      const group = document.createElement('span');
      group.className = 'oe-panel-palette-value-group';
      entries.forEach(([key, entryValue]) => {
        const palette = resolve(config, key, row, fieldConfig, dataSource);
        const label = `${key}: ${
          entryValue && typeof entryValue === 'object'
            ? JSON.stringify(entryValue)
            : entryValue
        }`;
        group.appendChild(
          palette ? createBadge(label, palette) : document.createTextNode(label)
        );
      });
      return group;
    }
    if (config.multiple) {
      const values = splitValues(value);
      if (!values.length) return null;
      const group = document.createElement('span');
      group.className = 'oe-panel-palette-value-group';
      values.forEach((item) => {
        const itemValue =
          item && typeof item === 'object'
            ? item.title || item.name || item.key || JSON.stringify(item)
            : item;
        const palette = resolve(config, itemValue, row, fieldConfig, dataSource);
        group.appendChild(palette ? createBadge(itemValue, palette) : document.createTextNode(itemValue));
      });
      return group;
    }
    const palette = resolve(config, value, row, fieldConfig, dataSource);
    return palette ? createBadge(value, palette) : null;
  }

  function indexRows(type, rows, { keyField, primaryField, secondaryField } = {}) {
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      let registered = register(type, row[keyField], {
        primary: row[primaryField || 'colour'],
        secondary: row[secondaryField || 'secondaryColour'],
        label: row[keyField]
      });
      if (!registered) {
        const fallback = get('gamemode', row.gamemode || row.gameMode);
        if (fallback) registered = register(type, row[keyField], fallback);
      }
      if (registered) {
        ['key', 'slug', 'packKey', 'ruleKey', 'roleKey'].forEach(
          (aliasField) => {
            if (!row[aliasField]) return;
            register(type, row[aliasField], {
              ...registered,
              label: ''
            });
          }
        );
      }
    });
  }

  function createColourInput(input) {
    if (!input) return input;
    const wrapper = document.createElement('span');
    wrapper.className = 'oe-panel-palette-input';
    const picker = document.createElement('input');
    picker.className = 'oe-panel-palette-input-picker';
    picker.type = 'color';
    picker.tabIndex = -1;
    picker.setAttribute('aria-label', `${input.getAttribute('aria-label') || input.name || 'Colour'} picker`);

    function syncPicker() {
      const valid = /^#[0-9a-f]{6}$/i.test(input.value.trim());
      wrapper.classList.toggle('is-empty', !valid);
      if (valid) picker.value = input.value;
    }
    picker.addEventListener('input', () => {
      input.value = picker.value.toUpperCase();
      syncPicker();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', syncPicker);
    syncPicker();
    wrapper.append(picker, input);
    return wrapper;
  }

  function decorateSelect(select, type) {
    if (!select) return;
    const update = () => {
      const palette = get(type, select.value);
      select.classList.toggle('oe-panel-palette-select', Boolean(palette));
      if (palette) decorate(select, palette);
    };
    select.addEventListener('change', update);
    select.addEventListener('input', update);
    update();
  }

  window.OE_PANEL_PALETTES = {
    ready,
    createColourInput,
    createValue,
    decorate,
    decorateSelect,
    get,
    indexRows,
    inferConfig,
    normalizeKey,
    register,
    resolve
  };
})();

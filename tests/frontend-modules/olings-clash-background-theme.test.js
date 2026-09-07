const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const backgroundTheme = require('../../public/scripts/olings/clash/background-theme');

const clashroomConfig = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '../../public/images/olings/clash/backgrounds/the-clashroom/config.json'
    ),
    'utf8'
  )
);

function createThemeDom(backgroundId = 'the-clashroom') {
  return new JSDOM(`
    <main data-clash-game data-clash-background="${backgroundId}">
      <div data-clash-scene-layer="farBackground"></div>
      <div data-clash-scene-layer="background"></div>
      <div data-clash-scene-layer="stage"></div>
      <div data-clash-scene-layer="foreground"></div>
    </main>
  `);
}

test('Clash background config applies HUD colours and scene layers', () => {
  const dom = createThemeDom();
  const root = dom.window.document.querySelector('[data-clash-game]');
  const result = backgroundTheme.applyBackgroundConfig(root, clashroomConfig);

  assert.equal(result.backgroundId, 'the-clashroom');
  assert.equal(root.dataset.clashBackgroundLoaded, 'true');
  assert.equal(
    root.style.getPropertyValue('--clash-game-ink'),
    clashroomConfig.hud.primary
  );
  assert.equal(
    root.style.getPropertyValue('--clash-game-text-soft'),
    clashroomConfig.hud.textSoft
  );
  assert.equal(
    root.style.getPropertyValue('--clash-game-text-on-secondary'),
    clashroomConfig.hud.textOnSecondary
  );
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue(
      '--primarypagecolour'
    ),
    clashroomConfig.hud.primary
  );
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue(
      '--secondarypagecolour'
    ),
    clashroomConfig.hud.secondary
  );
  assert.equal(
    root.querySelector('[data-clash-scene-layer="stage"]').getAttribute('src'),
    '/images/olings/clash/backgrounds/the-clashroom/stage.svg'
  );
  assert.equal(root.style.getPropertyValue('--clash-heart-full'), '');
  assert.equal(
    root.style.getPropertyValue('--clash-tag-primary-colour'),
    clashroomConfig.signals.tag.primary
  );
  assert.equal(
    root.style.getPropertyValue('--clash-tag-secondary-colour'),
    clashroomConfig.signals.tag.secondary
  );
  assert.equal(
    root.style.getPropertyValue('--clash-activation-filled-colour'),
    clashroomConfig.signals.activation.filled
  );
  assert.equal(
    root.style.getPropertyValue('--clash-activation-empty-colour'),
    clashroomConfig.signals.activation.empty
  );
  assert.equal(
    root.style.getPropertyValue('--clash-activation-primed-colour'),
    clashroomConfig.signals.activation.primed
  );
});

test('The Clashroom activation pips use its window-blue palette', () => {
  assert.deepEqual(clashroomConfig.signals.activation, {
    empty: '#5e879b',
    filled: '#9dd8f2',
    primed: '#ddf6ff'
  });
});

test('Clash background config ignores unsafe colours and layer filenames', () => {
  const dom = createThemeDom();
  const root = dom.window.document.querySelector('[data-clash-game]');

  backgroundTheme.applyBackgroundConfig(root, {
    hud: {
      panel: '#334455',
      primary: 'url(javascript:alert(1))'
    },
    signals: {
      activation: { empty: 'var(--unsafe-colour)' },
      tag: { primary: 'linear-gradient(red, blue)' }
    },
    layers: {
      background: '../outside.svg',
      stage: 'stage.png'
    }
  });

  assert.equal(root.style.getPropertyValue('--clash-game-panel'), '#334455');
  assert.equal(root.style.getPropertyValue('--clash-game-ink'), '');
  assert.equal(
    root.style.getPropertyValue('--clash-activation-empty-colour'),
    ''
  );
  assert.equal(root.style.getPropertyValue('--clash-tag-primary-colour'), '');
  assert.equal(
    dom.window.document.documentElement.style.getPropertyValue(
      '--primarypagecolour'
    ),
    ''
  );
  assert.equal(
    root
      .querySelector('[data-clash-scene-layer="background"]')
      .hasAttribute('src'),
    false
  );
  assert.equal(
    root.querySelector('[data-clash-scene-layer="stage"]').hasAttribute('src'),
    false
  );
});

test('Clash background loader fetches the selected arena config', async () => {
  const dom = createThemeDom('moon-arena');
  const root = dom.window.document.querySelector('[data-clash-game]');
  const requests = [];
  const config = {
    id: 'moon-arena',
    hud: { primary: '#abcdef' },
    layers: { foreground: 'foreground.svg' }
  };

  const result = await backgroundTheme.loadBackgroundTheme({
    root,
    fetchImpl: async (url) => {
      requests.push(url);
      return { json: async () => config, ok: true };
    }
  });

  assert.deepEqual(requests, [
    '/images/olings/clash/backgrounds/moon-arena/config.json'
  ]);
  assert.equal(result.backgroundId, 'moon-arena');
  assert.equal(root.style.getPropertyValue('--clash-game-ink'), '#abcdef');
  assert.equal(
    root
      .querySelector('[data-clash-scene-layer="foreground"]')
      .getAttribute('src'),
    '/images/olings/clash/backgrounds/moon-arena/foreground.svg'
  );
});

test('Clash background IDs fall back when they are not safe slugs', () => {
  assert.equal(
    backgroundTheme.normalizeBackgroundId('../the-clashroom'),
    'the-clashroom'
  );
  assert.equal(
    backgroundTheme.getConfigPath('../the-clashroom'),
    '/images/olings/clash/backgrounds/the-clashroom/config.json'
  );
});

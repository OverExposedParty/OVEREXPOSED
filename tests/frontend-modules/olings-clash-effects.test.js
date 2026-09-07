const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const createOlingClashEffectRenderer = require('../../public/scripts/olings/clash/game/renderers/effects');

test('Clash effect icons resolve canonical keys and legacy aliases', () => {
  const renderer = createOlingClashEffectRenderer();

  assert.equal(
    renderer.resolveIconPath({ key: 'suppressed' }),
    '/images/olings/clash/ui/effects/suppressed.svg'
  );
  assert.equal(
    renderer.resolveIconPath({ key: 'retaliate' }),
    '/images/olings/clash/ui/effects/burn-primed.svg'
  );
  assert.equal(
    renderer.resolveIconPath({ key: 'ward' }),
    '/images/olings/clash/ui/effects/warded.svg'
  );
  assert.equal(
    renderer.resolveIconPath({
      key: 'marked',
      data: { displayStatusKey: 'steal-primed' }
    }),
    '/images/olings/clash/ui/effects/steal-primed.svg'
  );
});

test('Clash effect icons support explicit paths and reject unknown keys', () => {
  const renderer = createOlingClashEffectRenderer();
  const documentRef = new JSDOM('<main></main>').window.document;

  const icon = renderer.createIcon(documentRef, {
    iconPath: '/images/custom-effect.svg',
    key: 'custom'
  });

  assert.equal(icon.getAttribute('src'), '/images/custom-effect.svg');
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.equal(renderer.createIcon(documentRef, { key: 'unknown' }), null);
});

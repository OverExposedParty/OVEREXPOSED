const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const scriptSource = fs.readFileSync(
  path.join(
    __dirname,
    '../../public/scripts/general/rotate-device/rotate-device.js'
  ),
  'utf8'
);

function createOrientationDom({ narrow = false, portrait = true } = {}) {
  const dom = new JSDOM(
    `
      <div data-rotate-device-message hidden aria-hidden="true">
        <strong data-rotate-device-title></strong>
        <span data-rotate-device-copy></span>
      </div>
      <main data-orientation-guard-target></main>
    `,
    { runScripts: 'outside-only', url: 'https://overexposed.app/' }
  );
  const mediaQueries = new Map();
  const state = { narrow, portrait };

  dom.window.matchMedia = (query) => {
    if (mediaQueries.has(query)) return mediaQueries.get(query);
    const listeners = new Set();
    const mediaQuery = {
      addEventListener(event, listener) {
        if (event === 'change') listeners.add(listener);
      },
      removeEventListener(event, listener) {
        if (event === 'change') listeners.delete(listener);
      },
      get matches() {
        if (query === '(orientation: portrait)') return state.portrait;
        return state.narrow && !state.portrait;
      },
      notify() {
        listeners.forEach((listener) => listener(mediaQuery));
      }
    };
    mediaQueries.set(query, mediaQuery);
    return mediaQuery;
  };

  dom.window.setOrientation = (nextState) => {
    Object.assign(state, nextState);
    mediaQueries.forEach((mediaQuery) => mediaQuery.notify());
  };
  return dom;
}

test('the default guard preserves portrait mode on narrow devices', async () => {
  const dom = createOrientationDom({ narrow: true, portrait: false });
  const { document } = dom.window;

  dom.window.eval(scriptSource);

  const message = document.querySelector('[data-rotate-device-message]');
  const target = document.querySelector('[data-orientation-guard-target]');
  assert.equal(dom.window.OERotateDevice.requiredOrientation, 'portrait');
  assert.equal(dom.window.OERotateDevice.blocked, true);
  assert.equal(message.hidden, false);
  assert.equal(message.getAttribute('aria-hidden'), 'false');
  assert.equal(
    document.querySelector('[data-rotate-device-title]').textContent,
    'ROTATE TO PORTRAIT'
  );
  assert.equal(target.hasAttribute('inert'), true);

  const ready = dom.window.OERotateDevice.waitUntilAllowed();
  dom.window.setOrientation({ portrait: true });
  await ready;

  assert.equal(dom.window.OERotateDevice.blocked, false);
  assert.equal(message.hidden, true);
  assert.equal(target.hasAttribute('inert'), false);
  dom.window.close();
});

test('a landscape page blocks every portrait viewport until it rotates', async () => {
  const dom = createOrientationDom({ narrow: false, portrait: true });
  const { document } = dom.window;
  document.documentElement.dataset.requiredOrientation = 'landscape';

  dom.window.eval(scriptSource);

  assert.equal(dom.window.OERotateDevice.requiredOrientation, 'landscape');
  assert.equal(dom.window.OERotateDevice.blocked, true);
  assert.equal(
    document.querySelector('[data-rotate-device-title]').textContent,
    'ROTATE TO LANDSCAPE'
  );

  const ready = dom.window.OERotateDevice.waitUntilAllowed();
  dom.window.setOrientation({ portrait: false });
  await ready;

  assert.equal(dom.window.OERotateDevice.blocked, false);
  assert.equal(
    document.querySelector('[data-rotate-device-message]').hidden,
    true
  );
  dom.window.close();
});

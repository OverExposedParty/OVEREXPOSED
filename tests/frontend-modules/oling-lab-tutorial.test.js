const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { JSDOM } = require('jsdom');

const scriptPaths = [
  '../../public/scripts/general/tutorial/tutorial-storage.js',
  '../../public/scripts/general/tutorial/tutorial-target.js',
  '../../public/scripts/general/tutorial/tutorial.js',
  '../../public/scripts/olings/lab/tutorial/lab-tutorial-preview.js',
  '../../public/scripts/olings/lab/tutorial/lab-tutorial.js'
];
const scripts = scriptPaths.map((scriptPath) =>
  fs.readFileSync(path.join(__dirname, scriptPath), 'utf8')
);

function createTutorialDom(pathname) {
  const dom = new JSDOM('', {
    runScripts: 'outside-only',
    url: `https://overexposed.app${pathname}`
  });
  dom.window.fetch = () => Promise.resolve({ ok: true });
  dom.window.requestAnimationFrame = (callback) => callback();
  scripts.forEach((script) => dom.window.eval(script));
  return dom;
}

test('Oling Lab config starts the shared welcome tutorial once', () => {
  const dom = createTutorialDom('/olings/lab');
  const { document } = dom.window;

  dom.window.dispatchEvent(new dom.window.CustomEvent('oling-lab:ready'));
  const root = document.querySelector('[data-oe-tutorial-id="olings-lab"]');

  assert.equal(root.hidden, false);
  assert.equal(
    root.querySelector('[data-oe-tutorial-title]').textContent,
    'Welcome to your Lab!'
  );
  root.querySelector('[data-oe-tutorial-next]').click();
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oling-lab:tutorial-pan')
  );
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oling-lab:tutorial-incubator-opened')
  );
  root.querySelector('[data-oe-tutorial-next]').click();
  root.querySelector('[data-oe-tutorial-next]').click();
  dom.window.dispatchEvent(
    new dom.window.CustomEvent('oling-lab:tutorial-edit-mode', {
      detail: { enabled: true }
    })
  );
  root.querySelector('[data-oe-tutorial-next]').click();
  root.querySelector('[data-oe-tutorial-next]').click();
  assert.equal(root.hidden, true);
  assert.equal(
    dom.window.localStorage.getItem('oe-oling-lab-tutorial-version'),
    '2'
  );
});

test('Oling Lab preview remains non-persistent with the shared UI', async () => {
  const dom = createTutorialDom('/olings/lab/tutorial');
  const { document } = dom.window;

  await assert.rejects(
    dom.window.fetch('/api/olings/hatch', { method: 'POST' }),
    /disabled in tutorial preview/
  );
  dom.window.dispatchEvent(new dom.window.CustomEvent('oling-lab:ready'));
  const root = document.querySelector('[data-oe-tutorial-id="olings-lab"]');
  dom.window.OlingLabTutorial.goTo('complete');
  root.querySelector('[data-oe-tutorial-next]').click();

  assert.equal(root.hidden, false);
  assert.equal(root.querySelector('[data-oe-tutorial-preview]').hidden, false);
  assert.equal(
    dom.window.localStorage.getItem('oe-oling-lab-tutorial-version'),
    null
  );
});

test('Oling Lab loads shared tutorial assets before its page config', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const labCss = fs.readFileSync(
    path.join(__dirname, '../../public/css/olings/lab/lab.css'),
    'utf8'
  );
  const configIndex = page.indexOf(
    "'/scripts/olings/lab/tutorial/lab-tutorial.js'"
  );

  [
    '/scripts/general/tutorial/tutorial-storage.js',
    '/scripts/general/tutorial/tutorial-target.js',
    '/scripts/general/tutorial/tutorial.js',
    '/scripts/olings/lab/tutorial/lab-tutorial-preview.js'
  ].forEach((asset) => {
    const index = page.indexOf(`'${asset}'`);
    assert.ok(index > -1, `${asset} should be configured`);
    assert.ok(
      index < configIndex,
      `${asset} should load before the Lab config`
    );
  });
  assert.match(labCss, /\/css\/general\/tutorial\/tutorial\.css/);
  assert.match(labCss, /\.\/tutorial\/lab-tutorial\.css/);
  assert.doesNotMatch(page, /oling-lab-tutorial-root/);
});

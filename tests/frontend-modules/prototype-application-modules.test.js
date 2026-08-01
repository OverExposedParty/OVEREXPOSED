const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const applicationsDirectory = path.join(
  __dirname,
  '../../public/scripts/other/applications'
);
const facadePath = path.join(applicationsDirectory, 'prototype-application.js');
const supportScripts = [
  'prototype-application/shared.js',
  'prototype-application/package-viewer.js',
  'prototype-application/three-model-viewer.js'
];

test('prototype application facade loads every support module in dependency order', () => {
  const facade = fs.readFileSync(facadePath, 'utf8');
  let previousIndex = -1;

  supportScripts.forEach((scriptPath) => {
    const index = facade.indexOf(`/scripts/other/applications/${scriptPath}`);

    assert.ok(index > previousIndex, `${scriptPath} should follow its dependencies`);
    previousIndex = index;
  });
});

test('prototype application support modules preserve the viewer factories', () => {
  const context = vm.createContext({ window: {} });

  supportScripts.forEach((scriptPath) => {
    vm.runInContext(
      fs.readFileSync(path.join(applicationsDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  const modules = context.window.Error404PrototypeApplicationModules;
  [
    'createPackageModel',
    'applyAnimationLayout',
    'initViewControls',
    'createThreeModelViewer'
  ].forEach((functionName) => {
    assert.equal(typeof modules[functionName], 'function');
  });
});

test('prototype application facade retains the Error 404 registration contract', () => {
  const context = vm.createContext({ window: {} });

  vm.runInContext(fs.readFileSync(facadePath, 'utf8'), context, {
    filename: 'prototype-application.js'
  });

  assert.equal(typeof context.window.Error404PrototypeApplication.init, 'function');
  assert.equal(
    context.window.Error404Applications['prototype-application'],
    context.window.Error404PrototypeApplication
  );
});

test('prototype application initializes the package viewer after its modules load', async () => {
  const dom = new JSDOM('<div id="mount"></div>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;

  supportScripts.forEach((scriptPath) => {
    window.eval(fs.readFileSync(path.join(applicationsDirectory, scriptPath), 'utf8'));
  });
  window.eval(fs.readFileSync(facadePath, 'utf8'));

  const mount = window.document.getElementById('mount');
  const instance = await window.Error404PrototypeApplication.init({
    mount,
    application: {
      id: 'package-viewer',
      config: {
        animations: [{ id: 'idle' }, { id: 'card' }]
      }
    }
  });

  assert.equal(instance.id, 'package-viewer');
  assert.equal(mount.dataset.applicationReady, 'true');
  assert.equal(
    mount.querySelector('.prototype-app-package-model').dataset.animation,
    'idle'
  );

  mount.querySelectorAll('.prototype-app-animation-button')[1].click();
  assert.equal(
    mount.querySelector('.prototype-app-package-model').dataset.animation,
    'card'
  );

  const form = mount.querySelector('.prototype-app-newsletter');
  form.querySelector('input').value = 'test@example.com';
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('prototype-application-newsletter')),
    ['test@example.com']
  );
  instance.destroy();
  dom.window.close();
});

test('prototype application loads its support modules through the Error 404 loader', async () => {
  const dom = new JSDOM('<div id="mount"></div>', {
    runScripts: 'outside-only',
    url: 'https://overexposed.test/'
  });
  const { window } = dom;
  const loadedScripts = [];
  const sources = new Map(
    supportScripts.map((scriptPath) => [
      `/scripts/other/applications/${scriptPath}`,
      fs.readFileSync(path.join(applicationsDirectory, scriptPath), 'utf8')
    ])
  );

  window.Error404SplashScripts = {
    loadScript(scriptPath) {
      loadedScripts.push(scriptPath);
      window.eval(sources.get(scriptPath));
      return Promise.resolve();
    }
  };
  window.eval(fs.readFileSync(facadePath, 'utf8'));

  await window.Error404PrototypeApplication.init({
    mount: window.document.getElementById('mount'),
    application: { config: {} }
  });

  assert.deepEqual(
    loadedScripts,
    supportScripts.map((scriptPath) => `/scripts/other/applications/${scriptPath}`)
  );
  dom.window.close();
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptDirectory = path.join(
  __dirname,
  '../../public/scripts/general/help-hub'
);
const registryPath = path.join(
  __dirname,
  '../../public/scripts/html-templates/core-template/registry.js'
);
const facadePath = path.join(
  __dirname,
  '../../public/scripts/general/help-hub/help-hub.js'
);
const accountAccessPath = path.join(
  __dirname,
  '../../public/scripts/general/settings-and-links/account-access.js'
);
const modules = [
  ['page-configs.js', 'createHelpHubPageConfigs'],
  ['mode-configs.js', 'createHelpHubModeConfigs'],
  ['topic-copy.js', 'createHelpHubTopicCopy'],
  ['data.js', 'createHelpHubData'],
  ['content.js', 'createHelpHubContent'],
  ['view.js', 'createHelpHubView']
];

function createRenderedHelpHub(url) {
  const dom = new JSDOM(
    `<!doctype html>
      <body>
        <section id="help-hub">
          <button id="help-hub-back-button" type="button"></button>
          <h2 id="help-hub-title"></h2>
          <div id="help-hub-grid"></div>
        </section>
      </body>`,
    {
      runScripts: 'dangerously',
      url
    }
  );
  const { window } = dom;

  window.eval(fs.readFileSync(accountAccessPath, 'utf8'));
  for (const [filename] of modules) {
    window.eval(fs.readFileSync(path.join(scriptDirectory, filename), 'utf8'));
  }
  window.eval(fs.readFileSync(facadePath, 'utf8'));

  return dom;
}

test('Help Hub modules register their composition factories', () => {
  const context = { window: {} };

  for (const [filename, factoryName] of modules) {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptDirectory, filename), 'utf8'),
      context,
      {
        filename
      }
    );
    assert.equal(typeof context.window[factoryName], 'function');
  }
});

test('Help Hub modules load before the compatibility facade', () => {
  const registry = fs.readFileSync(registryPath, 'utf8');
  const moduleIndexes = modules.map(([filename]) =>
    registry.indexOf(`'/scripts/general/help-hub/${filename}'`)
  );
  const facadeIndex = registry.indexOf(
    "'/scripts/general/help-hub/help-hub.js'"
  );

  assert.ok(moduleIndexes.every((index) => index > -1));
  assert.ok(facadeIndex > moduleIndexes.at(-1));
  assert.ok(
    moduleIndexes.every(
      (index, moduleIndex) =>
        moduleIndex === 0 || index > moduleIndexes[moduleIndex - 1]
    )
  );
});

test('Help Hub facade keeps its global render function and section navigation', () => {
  const dom = new JSDOM(
    `<!doctype html>
      <body>
        <section id="help-hub">
          <button id="help-hub-back-button" type="button"></button>
          <h2 id="help-hub-title"></h2>
          <div id="help-hub-grid"></div>
        </section>
      </body>`,
    {
      runScripts: 'dangerously',
      url: 'https://overexposed.app/'
    }
  );
  const { window } = dom;

  window.eval(fs.readFileSync(accountAccessPath, 'utf8'));
  for (const [filename] of modules) {
    window.eval(fs.readFileSync(path.join(scriptDirectory, filename), 'utf8'));
  }
  window.eval(fs.readFileSync(facadePath, 'utf8'));

  const grid = window.document.querySelector('#help-hub-grid');
  const title = window.document.querySelector('#help-hub-title');
  assert.equal(window.eval('typeof renderHelpHub'), 'function');
  assert.equal(title.textContent, 'Homepage');
  assert.equal(grid.querySelectorAll('.help-hub-tile').length, 5);
  assert.equal(grid.querySelector('[data-help-topic="Olings Lab"]'), null);
  assert.equal(grid.querySelector('[data-help-topic="Shop"]'), null);

  const regularAccount = { access: { roles: [], features: [] } };
  window.localStorage.setItem('oe-account', JSON.stringify(regularAccount));
  window.dispatchEvent(
    new window.CustomEvent('oe-account-state-changed', {
      detail: { account: regularAccount }
    })
  );
  assert.equal(grid.querySelector('[data-help-topic="Olings Lab"]'), null);
  assert.equal(grid.querySelector('[data-help-topic="Shop"]'), null);

  const betaTesterAccount = {
    access: { roles: ['beta_tester'], features: [] }
  };
  window.localStorage.setItem('oe-account', JSON.stringify(betaTesterAccount));
  window.dispatchEvent(
    new window.CustomEvent('oe-account-state-changed', {
      detail: { account: betaTesterAccount }
    })
  );
  assert.ok(grid.querySelector('[data-help-topic="Olings Lab"]'));
  assert.ok(grid.querySelector('[data-help-topic="Shop"]'));

  grid.querySelector('.help-hub-tile').click();
  assert.equal(title.textContent, 'What Is OVEREXPOSED?');
  assert.ok(grid.querySelector('.help-hub-section'));

  grid.querySelector('.help-hub-section-button').click();
  assert.ok(grid.querySelector('.help-hub-detail'));
});

test('Game Settings Help shows Mafia Roles only for Mafia settings', () => {
  const regularDom = createRenderedHelpHub(
    'https://overexposed.app/truth-or-dare/settings'
  );
  const regularGrid =
    regularDom.window.document.querySelector('#help-hub-grid');

  assert.ok(regularGrid.querySelector('[data-help-topic="Packs"]'));
  assert.equal(
    regularGrid.querySelector('[data-help-topic="Mafia Roles"]'),
    null
  );
  assert.equal(regularGrid.querySelector('[data-help-topic="Add-ons"]'), null);

  const mafiaDom = createRenderedHelpHub(
    'https://overexposed.app/mafia/settings'
  );
  const mafiaGrid = mafiaDom.window.document.querySelector('#help-hub-grid');
  const mafiaTitle = mafiaDom.window.document.querySelector('#help-hub-title');

  assert.equal(mafiaTitle.textContent, 'Mafia Settings');
  assert.ok(mafiaGrid.querySelector('[data-help-topic="Mafia Roles"]'));
  assert.equal(mafiaGrid.querySelector('[data-help-topic="Packs"]'), null);
  assert.equal(mafiaGrid.querySelector('[data-help-topic="Add-ons"]'), null);

  mafiaGrid.querySelector('[data-help-topic="Mafia Roles"]').click();
  assert.match(
    mafiaGrid.textContent,
    /role counts instead of ordinary question packs/i
  );

  regularDom.window.close();
  mafiaDom.window.close();
});

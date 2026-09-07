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
const abilityDetailsPath = path.join(
  __dirname,
  '../../public/scripts/olings/clash/ability-details.js'
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

test('Olings Clash Help exposes the shared ability library', async () => {
  const dom = createRenderedHelpHub(
    'https://overexposed.app/olings/clash/ABC-123'
  );
  const { document, window } = dom.window;
  window.fetch = async () => ({
    ok: true,
    async json() {
      return {
        abilities: [
          {
            description: 'Heal a teammate.',
            effects: [
              {
                mechanic: 'heal',
                target: { location: 'bench', side: 'ally' }
              }
            ],
            enabled: true,
            imagePath: '/abilities/mend.svg',
            isCurrent: true,
            key: 'moss-mend',
            layer: 'mouth',
            name: 'Mend',
            roleTags: ['support'],
            traitKey: 'moss-mouth',
            trigger: 'attack_win'
          }
        ]
      };
    }
  });
  window.eval(fs.readFileSync(abilityDetailsPath, 'utf8'));
  const grid = document.querySelector('#help-hub-grid');
  const title = document.querySelector('#help-hub-title');

  assert.equal(title.textContent, 'Olings Clash');
  const symbols = grid.querySelector('[data-help-topic="Clash Symbols"]');
  assert.ok(symbols);
  symbols.click();
  assert.equal(title.textContent, 'Clash Symbols');
  assert.equal(
    document
      .querySelector('#help-hub')
      .classList.contains('clash-symbols-open'),
    true
  );
  const symbolLibrary = grid.querySelector('[data-help-hub-clash-symbols]');
  assert.ok(symbolLibrary);
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'categories');
  assert.equal(
    symbolLibrary.querySelectorAll('[data-clash-symbol-category]').length,
    4
  );
  const categoryButtons = [
    ...symbolLibrary.querySelectorAll('[data-clash-symbol-category]')
  ];
  assert.deepEqual(
    categoryButtons.map((button) => button.textContent),
    [
      'Health & Defence',
      'Actions & States',
      'Positive Effects',
      'Negative Effects'
    ]
  );
  assert.equal(
    categoryButtons.every(
      (button) =>
        button.classList.contains('help-hub-section-button') &&
        button.childElementCount === 0
    ),
    true
  );
  const glossary = window.OlingClashAbilityDetails.getSymbolGlossary();
  assert.deepEqual(Array.from(glossary, ({ key }) => key).sort(), [
    'blocked',
    'blood-heart',
    'bloodbound',
    'burn',
    'burn-primed',
    'fortified',
    'heart',
    'junk',
    'locked',
    'marked',
    'overgrowth-heart',
    'passive',
    'reinforced',
    'shield',
    'steal-primed',
    'suppressed',
    'tag',
    'warded'
  ]);
  const symbolAssets = new Set(
    glossary.flatMap((definition) => [
      ...(definition.path ? [definition.path] : []),
      ...Object.values(definition.paths || {})
    ])
  );
  assert.equal(symbolAssets.size, 21);

  symbolLibrary.querySelector('[data-clash-symbol-category="health"]').click();
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'category');
  assert.equal(symbolLibrary.querySelector('[data-clash-symbol-back]'), null);
  const heartDefinition = symbolLibrary.querySelector(
    '[data-clash-icon-glossary-key="heart"]'
  );
  assert.ok(heartDefinition);
  assert.equal(heartDefinition.querySelectorAll('img').length, 2);
  heartDefinition.click();
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'detail');
  const heartDetail = symbolLibrary.querySelector(
    '[data-clash-symbol-detail="heart"]'
  );
  assert.ok(heartDetail);
  assert.equal(heartDetail.querySelectorAll('img').length, 2);
  assert.match(heartDetail.textContent, /normal health/i);
  assert.equal(
    heartDetail.querySelector(
      '.oling-clash-symbol-library__detail-visual > strong'
    ).textContent,
    'Heart'
  );
  assert.equal(heartDetail.querySelector('[data-clash-symbol-back]'), null);
  window.dispatchEvent(
    new window.CustomEvent('oe-account-state-changed', {
      detail: { account: null }
    })
  );
  assert.equal(title.textContent, 'Clash Symbols');
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'detail');
  assert.equal(
    grid.querySelector('[data-clash-symbol-detail="heart"]'),
    heartDetail
  );
  document.querySelector('#help-hub-back-button').click();
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'category');
  document.querySelector('#help-hub-back-button').click();
  assert.equal(symbolLibrary.dataset.clashSymbolView, 'categories');
  document.querySelector('#help-hub-back-button').click();

  const abilities = grid.querySelector('[data-help-topic="Clash Abilities"]');
  assert.ok(abilities);
  abilities.click();
  assert.equal(title.textContent, 'Clash Abilities');
  assert.ok(grid.querySelector('[data-help-hub-clash-abilities]'));
  await new Promise((resolve) => setImmediate(resolve));
  const abilityCard = grid.querySelector(
    '[data-clash-ability-library-key="moss-mend"]'
  );
  assert.ok(abilityCard);
  abilityCard.click();
  assert.equal(
    document.querySelector('[data-clash-ability-details] h2').textContent,
    'Mend'
  );
  assert.match(
    document.querySelectorAll('.oling-clash-ability-dialog__art')[1].src,
    /\/images\/olings\/builds\/mouth\/base\/moss-mouth\.svg$/
  );

  dom.window.close();
});

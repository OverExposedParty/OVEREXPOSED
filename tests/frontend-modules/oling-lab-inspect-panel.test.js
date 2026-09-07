const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

test('Oling details switch in one drawer, collapse, and close from the header', () => {
  const dom = new JSDOM(
    fs.readFileSync(
      path.join(__dirname, '../../public/pages/olings/lab.html'),
      'utf8'
    )
  );
  const { document } = dom.window;
  const context = {
    window: dom.window,
    document,
    requestAnimationFrame: (callback) => callback()
  };
  for (const file of [
    'core/lab-elements',
    'core/lab-selection',
    'ui/tab-menu',
    'olings/inspect'
  ]) {
    vm.runInNewContext(
      fs.readFileSync(
        path.join(__dirname, '../../public/scripts/olings/lab', `${file}.js`),
        'utf8'
      ),
      context
    );
  }
  const elements = dom.window.getOlingLabElements();
  const state = {
    olings: [
      {
        id: 'one',
        name: 'Pip',
        eggKey: 'base-egg',
        hatchedAt: '2026-09-01T12:00:00.000Z',
        matchingSet: { rarity: 'uncommon' },
        buildRarities: {
          flight: 'uncommon',
          body: 'common',
          eyes: 'common',
          mouth: 'common'
        },
        care: { energy: 72, maxEnergy: 100, status: 'ready' }
      },
      { id: 'two', name: 'Mossy', care: {} }
    ],
    eggs: new Map([['base-egg', { name: 'Base Egg' }]]),
    layers: ['flight', 'body', 'eyes', 'mouth']
  };
  const sounds = [];
  dom.window.playSoundEffect = (key) => sounds.push(key);
  const selection = dom.window.createOlingLabSelection({ state, elements });
  const inspect = dom.window.createOlingLabInspectTools({
    state,
    elements,
    helpers: {
      closeSelectedTarget: selection.closeSelectedTarget,
      renderLab() {},
      closeStoragePanel() {},
      closeMenu() {
        throw new Error('The modal should stay closed');
      },
      openMenu() {
        throw new Error('Inspection should use the drawer');
      },
      applyRarityTheme(element, rarity) {
        element.dataset.rarity = rarity;
      },
      formatTitle: (value) => value,
      createTabMenu: dom.window.createOlingLabTabMenuFactory({
        clearHatchTimer() {},
        clearAdventureTimer() {}
      })
    },
    previewTools: {
      getOlingId: (oling) => oling.id,
      getDisplayedEnergy: (value) => value || 0,
      createPreview: () => document.createElement('div'),
      createEnergyMeter: () => {
        const meter = document.createElement('div');
        meter.className = 'oling-lab-oling-energy';
        return meter;
      }
    },
    buildTools: {
      createBuildPresentation: (oling, options = {}) => [
        Object.assign(document.createElement('p'), {
          textContent: `${oling.name} build ${options.selectedLayer || ''}`
        })
      ]
    }
  });
  const selectionTools = selection.createSelectionTools({
    renderLab() {},
    onCloseSelection: () =>
      inspect.closeOlingPanel({ sound: false, release: false })
  });

  inspect.openOlingMenu('one');
  assert.equal(elements.olingPanel.hidden, false);
  assert.equal(elements.backdrop.hidden, true);
  assert.equal(state.selectedTarget.id, 'one');
  assert.equal(elements.olingPanelTitle.textContent, 'Pip');
  assert.equal(elements.olingPanelTabs.hidden, false);
  assert.equal(elements.olingPanelBack.textContent.trim(), 'Close');
  assert.equal(elements.olingPanelBack.classList.contains('is-close'), true);
  assert.equal(
    elements.olingPanelBack.getAttribute('aria-label'),
    'Close Oling menu'
  );
  const overviewSummary = elements.olingPanelContent.querySelector(
    '.oling-lab-oling-overview-summary'
  );
  assert.ok(overviewSummary);
  assert.equal(
    elements.olingPanelContent.querySelector(
      '.oling-lab-oling-hero .oling-lab-oling-energy'
    ),
    null
  );
  assert.ok(
    overviewSummary.querySelector(
      '.oling-lab-oling-overview-energy .is-overview-energy'
    )
  );
  assert.match(overviewSummary.textContent, /State/);
  assert.match(overviewSummary.textContent, /ready/);
  assert.match(overviewSummary.textContent, /Rarity Makeup/);
  assert.equal(
    overviewSummary.querySelector('.is-rarity-makeup > strong'),
    null
  );
  assert.deepEqual(
    [
      ...overviewSummary.querySelectorAll('.oling-lab-oling-rarity-segment')
    ].map((segment) => segment.dataset.rarity),
    ['uncommon', 'common', 'common', 'common']
  );
  assert.equal(
    elements.olingPanelContent.querySelector('.oling-lab-stats-toggle'),
    null
  );
  assert.equal(
    elements.olingPanelContent.querySelector('.oling-lab-oling-info-panel'),
    null
  );
  assert.equal(
    overviewSummary.querySelector('.oling-lab-oling-overview-energy > h3'),
    null
  );
  assert.match(overviewSummary.textContent, /Egg Origin/);
  assert.match(overviewSummary.textContent, /Base Egg/);
  assert.match(overviewSummary.textContent, /Hatched On/);
  assert.doesNotMatch(overviewSummary.textContent, /Unknown/);
  assert.deepEqual(
    [...elements.olingPanelTabs.querySelectorAll('[role="tab"]')].map(
      (tab) => tab.textContent
    ),
    ['Overview', 'Build']
  );
  assert.equal(
    elements.olingPanelContent.querySelector('.oling-lab-tab-list'),
    null
  );
  const rarityButtons = [
    ...overviewSummary.querySelectorAll('.oling-lab-oling-rarity-segment')
  ];
  assert.ok(rarityButtons.every((button) => button.type === 'button'));
  assert.ok(
    rarityButtons.every((button) => button.dataset.soundIntent === 'select')
  );
  rarityButtons[2].click();
  assert.equal(
    elements.olingPanelTabs
      .querySelector('[data-oling-lab-tab="Build"]')
      .getAttribute('aria-selected'),
    'true'
  );
  assert.match(elements.olingPanelContent.textContent, /Pip build eyes/);

  inspect.openOlingMenu('two');
  assert.equal(state.selectedTarget.id, 'two');
  assert.equal(elements.olingPanelTitle.textContent, 'Mossy');
  assert.deepEqual(sounds, ['sidePanelOpen']);
  elements.olingPanelToggle.click();
  assert.equal(state.olingPanelCollapsed, true);
  assert.equal(state.selectedTarget.id, 'two');
  inspect.openOlingMenu('two');
  assert.equal(state.olingPanelCollapsed, false);
  assert.deepEqual(sounds, [
    'sidePanelOpen',
    'sidePanelClose',
    'sidePanelOpen'
  ]);
  elements.olingPanelBack.click();
  assert.equal(elements.olingPanel.hidden, true);
  assert.equal(elements.olingPanelTabs.hidden, true);
  assert.equal(elements.olingPanelTabs.childElementCount, 0);
  assert.equal(state.selectedTarget, null);
  assert.equal(sounds.at(-1), 'sidePanelClose');

  inspect.openOlingMenu('one');
  selectionTools.toggleSelectedTarget('furniture', 'rack');
  assert.equal(elements.olingPanel.hidden, true);
  assert.equal(state.selectedTarget.id, 'rack');
  inspect.openOlingMenu('one');
  selection.closeSelectedTarget();
  assert.equal(elements.olingPanel.hidden, true);
  assert.equal(state.selectedTarget, null);
  dom.window.close();
});

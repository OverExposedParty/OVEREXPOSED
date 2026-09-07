const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const modulePath = path.join(
  __dirname,
  '../../public/scripts/olings/lab/ui/lab-rest-and-interactions.js'
);

test('Rest opens in a collapsible side panel with a header close control', () => {
  const dom = new JSDOM(`<!doctype html><body>
    <main id="room">
      <button data-oling-lab-placed-id="bed-one"></button>
    </main>
    <div id="backdrop" hidden></div>
    <aside id="rest-panel" hidden>
      <button id="rest-toggle" aria-expanded="false">Hide</button>
      <button id="rest-close" class="is-close">Close</button>
      <h2 id="rest-title">Rest</h2>
      <div id="rest-content"></div>
      <footer id="rest-footer"></footer>
    </aside>
  </body>`);
  const { document } = dom.window;
  const sounds = [];
  let modalOpenCount = 0;
  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.playSoundEffect = (key) => sounds.push(key);
  const context = { document, window: dom.window };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
    filename: modulePath
  });

  const state = {
    activeAdventure: null,
    activeRestBedPlacedId: null,
    restOlingIndex: 0,
    restPanelOpen: false,
    restPanelCollapsed: false,
    olings: [
      {
        id: 'oling-one',
        name: 'Pip',
        care: { energy: 50, maxEnergy: 100, isSleeping: false }
      }
    ],
    lab: {
      placedItems: [{ placedId: 'bed-one', itemId: 'basic_bed' }]
    }
  };
  const elements = {
    room: document.getElementById('room'),
    backdrop: document.getElementById('backdrop'),
    restPanel: document.getElementById('rest-panel'),
    restPanelToggle: document.getElementById('rest-toggle'),
    restPanelClose: document.getElementById('rest-close'),
    restPanelTitle: document.getElementById('rest-title'),
    restPanelContent: document.getElementById('rest-content'),
    restPanelFooter: document.getElementById('rest-footer')
  };
  const olingViews = {
    closeOlingPanel() {},
    closeStoragePanel() {},
    createPreview() {
      return document.createElement('div');
    },
    createEnergyMeter() {
      const meter = document.createElement('div');
      meter.innerHTML = `
        <span class="oling-lab-oling-energy-icon"></span>
        <span class="oling-lab-oling-energy-track">
          <span class="oling-lab-oling-energy-fill"></span>
        </span>
        <span class="oling-lab-oling-energy-value">50</span>`;
      return meter;
    }
  };
  const tools = context.window.createOlingLabRestAndInteractionTools({
    state,
    elements,
    OLING_REST_DURATION_MS: { common: 60000 },
    setStatus() {},
    renderLab() {},
    getRoaming: () => ({ isHeadingToBed: () => false }),
    getOlingViews: () => olingViews,
    getItem: () => ({ id: 'basic_bed', name: 'Basic Bed', rarity: 'common' }),
    openExplorerGateway() {},
    openMenu() {
      modalOpenCount += 1;
    },
    closeMenu() {},
    resolveMenuConfig: () => ({
      primaryColour: '#ffe0c7',
      secondaryColour: '#e89b70'
    }),
    createEmptyMessage: (message) =>
      Object.assign(document.createElement('p'), { textContent: message }),
    createInlineAction(label, onClick, options = {}) {
      const button = document.createElement('button');
      button.className = 'oling-lab-menu-action';
      button.disabled = Boolean(options.disabled);
      button.appendChild(
        Object.assign(document.createElement('span'), { textContent: label })
      );
      button.addEventListener('click', onClick);
      return button;
    },
    closeSelectedTarget() {},
    formatDuration: () => '1M',
    clearRestTimer() {},
    getIncubatorContext: () => null,
    openIncubatorMenu() {},
    openShelfStoragePanel() {},
    openFurnitureSlotsMenu() {}
  });

  tools.openBedRestMenu('bed-one');

  assert.equal(modalOpenCount, 0);
  assert.equal(state.restPanelOpen, true);
  assert.equal(state.activeRestBedPlacedId, 'bed-one');
  assert.equal(elements.restPanel.hidden, false);
  assert.equal(elements.restPanel.classList.contains('is-open'), true);
  assert.equal(elements.restPanelTitle.textContent, 'Rest');
  assert.match(elements.restPanelContent.textContent, /Pip/i);
  const previewWindow = elements.restPanelContent.querySelector(
    '.oling-lab-rest-preview-window'
  );
  assert.ok(previewWindow);
  assert.ok(
    previewWindow.querySelector('.oling-lab-rest-oling-preview'),
    'the Oling preview should be inside the preview window'
  );
  assert.equal(
    previewWindow.querySelectorAll('.oling-lab-rest-arrow').length,
    2,
    'both navigator arrows should be inside the preview window'
  );
  assert.match(
    elements.restPanelContent.querySelector('.oling-lab-rest-name-card')
      .textContent,
    /Oling\s*Pip/i
  );
  assert.match(
    elements.restPanelContent.querySelector('.oling-lab-rest-energy-card')
      .textContent,
    /Energy/i
  );
  assert.match(
    elements.restPanelContent.querySelector('.oling-lab-rest-charge-card')
      .textContent,
    /Fully Charged In\s*1M/i
  );
  assert.match(elements.restPanelFooter.textContent, /Sleep/i);
  assert.deepEqual(sounds, ['sidePanelOpen']);

  elements.restPanelToggle.click();
  assert.equal(state.restPanelCollapsed, true);
  assert.equal(elements.restPanelToggle.textContent, 'Show');

  elements.restPanelToggle.click();
  elements.restPanelClose.click();
  assert.equal(state.restPanelOpen, false);
  assert.equal(state.activeRestBedPlacedId, null);
  assert.equal(elements.restPanel.hidden, true);
  assert.equal(elements.restPanelContent.childElementCount, 0);
  assert.equal(elements.restPanelFooter.childElementCount, 0);
  assert.deepEqual(sounds, [
    'sidePanelOpen',
    'sidePanelClose',
    'sidePanelOpen',
    'sidePanelClose'
  ]);
});

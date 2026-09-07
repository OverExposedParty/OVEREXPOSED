const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const modulePath = path.join(
  __dirname,
  '../../public/scripts/olings/lab/explorer-gateway/lab-explorer-gateway.js'
);

test('Explorer Gateway opens as a collapsible side panel with external tabs and footer actions', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <main id="room">
      <button data-oling-lab-item-id="explorer_gateway"></button>
    </main>
    <div id="backdrop" hidden></div>
    <aside id="gateway-panel" hidden>
      <div id="gateway-tabs" hidden></div>
      <button id="gateway-toggle" aria-expanded="false">Hide</button>
      <button id="gateway-close">Close</button>
      <h2 id="gateway-title"></h2>
      <div id="gateway-content"></div>
      <footer id="gateway-footer" hidden></footer>
    </aside>
  </body>`);
  const { document } = dom.window;
  const sounds = [];
  let modalOpenCount = 0;
  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.playSoundEffect = (key) => sounds.push(key);
  dom.window.createOlingLabAdventureApi = () => ({
    loadGateway: async () => ({
      active: null,
      adventures: [
        {
          key: 'backyard-path',
          name: 'Backyard Path',
          durationMs: 300000,
          energyCost: 10,
          rewards: { accountXp: 20, opals: 2 }
        }
      ],
      history: [
        {
          adventureKey: 'backyard-path',
          adventureName: 'Backyard Path',
          olingId: 'oling-one',
          olingName: 'Mossy',
          completedAt: '2026-09-06T12:00:00.000Z',
          durationMs: 300000,
          energyCost: 10,
          rewards: { accountXp: 20, opals: 2 }
        }
      ],
      olings: [
        {
          id: 'oling-one',
          name: 'Mossy',
          traits: {},
          care: { energy: 100, isSleeping: false }
        }
      ],
      gatewayLevel: 1
    })
  });
  dom.window.createOlingLabExplorerRenderTools = () => ({
    createOlingPreview: () => document.createElement('div'),
    createSelectionSection: () => document.createElement('section'),
    details: (rows) =>
      Object.assign(document.createElement('div'), {
        textContent: rows.flat().join(' ')
      }),
    formatTime: () => '1M',
    section: (content) => {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      section.append(content);
      return section;
    }
  });
  const context = { document, window: dom.window };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
    filename: modulePath
  });

  const createInlineAction = (label, onClick, options = {}) => {
    const button = document.createElement('button');
    button.className = 'oling-lab-menu-action';
    button.disabled = Boolean(options.disabled);
    button.append(
      Object.assign(document.createElement('span'), { textContent: label })
    );
    button.addEventListener('click', onClick);
    return button;
  };
  const createTabMenu = (tabs, options = {}) => {
    const shell = document.createElement('div');
    shell.className = 'oling-lab-tab-menu';
    const tabList = document.createElement('div');
    tabList.className = 'oling-lab-tab-list';
    const panel = document.createElement('div');
    panel.className = 'oling-lab-tab-panel';
    const actions = document.createElement('div');
    actions.className = 'oling-lab-container-action-area';
    const activate = (tab) => {
      panel.replaceChildren(tab.content());
      actions.replaceChildren(...(options.actionContent?.(tab) || []));
      options.onActivate?.(tab);
    };
    tabs.forEach((tab) => {
      const button = Object.assign(document.createElement('button'), {
        textContent: tab.label
      });
      button.className = 'oling-lab-tab';
      button.addEventListener('click', () => activate(tab));
      tabList.append(button);
    });
    shell.append(tabList, panel, actions);
    activate(tabs.find((tab) => tab.label === options.initialLabel) || tabs[0]);
    return shell;
  };
  const state = {
    explorerTabLabel: 'Overview',
    explorerOlingIndex: 0,
    explorerAdventureKey: null,
    gatewayPanelOpen: false,
    gatewayPanelCollapsed: false
  };
  const elements = {
    room: document.getElementById('room'),
    backdrop: document.getElementById('backdrop'),
    gatewayPanel: document.getElementById('gateway-panel'),
    gatewayPanelTabs: document.getElementById('gateway-tabs'),
    gatewayPanelToggle: document.getElementById('gateway-toggle'),
    gatewayPanelClose: document.getElementById('gateway-close'),
    gatewayPanelTitle: document.getElementById('gateway-title'),
    gatewayPanelContent: document.getElementById('gateway-content'),
    gatewayPanelFooter: document.getElementById('gateway-footer')
  };
  const tools = context.window.createOlingLabExplorerGateway({
    state,
    elements,
    createDetailRow() {},
    getRoaming: () => null,
    setStatus() {},
    getAdventureDoorPlacedId: () => 'gateway-one',
    closeSelectedTarget() {},
    renderLab() {},
    createImage: () => document.createElement('img'),
    createInlineAction,
    formatTitle: (value) => value,
    openMenu() {
      modalOpenCount += 1;
    },
    closeMenu() {},
    createTabMenu,
    clearAdventureTimer() {},
    resolveMenuConfig: () => ({
      primaryColour: '#b4f0c4',
      secondaryColour: '#78d69a'
    })
  });

  await tools.openExplorerGateway();

  assert.equal(modalOpenCount, 0);
  assert.equal(state.gatewayPanelOpen, true);
  assert.equal(elements.gatewayPanel.hidden, false);
  assert.equal(elements.gatewayPanel.classList.contains('is-open'), true);
  assert.equal(elements.gatewayPanelTitle.textContent, 'Explorer Gateway');
  assert.match(elements.gatewayPanelTabs.textContent, /Overview/i);
  assert.equal(
    elements.gatewayPanelContent.querySelector(
      ':scope > .oling-lab-tab-menu > .oling-lab-tab-list'
    ),
    null,
    'tabs should be mounted outside the panel content'
  );
  assert.match(elements.gatewayPanelFooter.textContent, /Choose an adventure/i);
  assert.equal(elements.gatewayPanelFooter.hidden, false);
  const overview = elements.gatewayPanelContent.querySelector(
    '.oling-lab-gateway-overview'
  );
  const preview = overview.querySelector('.oling-lab-gateway-overview-preview');
  const cards = overview.querySelector('.oling-lab-gateway-overview-cards');
  assert.ok(preview);
  assert.equal(
    preview.querySelector('.oling-lab-gateway-overview-cards'),
    null
  );
  assert.equal(cards.parentElement, overview);
  assert.equal(cards.childElementCount, 3);
  assert.deepEqual(sounds, ['sidePanelOpen']);

  const clickTab = (label) => {
    [...elements.gatewayPanelTabs.querySelectorAll('button')]
      .find((button) => button.textContent === label)
      .click();
  };
  const waitForPanelRefresh = () =>
    new Promise((resolve) => setImmediate(resolve));

  clickTab('Adventures');
  elements.gatewayPanelContent
    .querySelector('.oling-lab-explorer-adventure-tile')
    .click();
  await waitForPanelRefresh();

  assert.equal(elements.gatewayPanelClose.textContent, 'Back');
  assert.equal(
    elements.gatewayPanelClose.classList.contains('is-close'),
    false
  );
  assert.equal(
    elements.gatewayPanelClose.getAttribute('aria-label'),
    'Back to adventures'
  );
  assert.ok(
    elements.gatewayPanelContent.querySelector(
      '.oling-lab-explorer-detail-preview'
    )
  );
  const olingStatus = elements.gatewayPanelContent.querySelector(
    '.oling-lab-explorer-oling-status'
  );
  const detailPanels = elements.gatewayPanelContent.querySelector(
    '.oling-lab-explorer-detail-panels'
  );
  assert.ok(olingStatus);
  assert.equal(olingStatus.classList.contains('is-ready'), true);
  assert.match(olingStatus.textContent, /Oling statusReady/i);
  assert.equal(olingStatus.querySelector('p'), null);
  assert.equal(
    olingStatus.previousElementSibling.classList.contains(
      'oling-lab-explorer-detail-preview'
    ),
    true
  );
  assert.equal(olingStatus.nextElementSibling, detailPanels);
  assert.equal(
    detailPanels.querySelectorAll(':scope > .oling-lab-explorer-detail-card')
      .length,
    2
  );
  assert.match(elements.gatewayPanelFooter.textContent, /Start adventure/i);

  elements.gatewayPanelClose.click();
  await waitForPanelRefresh();
  assert.equal(state.gatewayPanelOpen, true, 'Back must not close the panel');
  assert.equal(state.explorerAdventureKey, null);
  assert.equal(elements.gatewayPanelClose.textContent, 'Close');
  assert.equal(elements.gatewayPanelClose.classList.contains('is-close'), true);

  clickTab('Discoveries');
  elements.gatewayPanelContent
    .querySelector('.oling-lab-discovery-row')
    .click();
  await waitForPanelRefresh();
  assert.equal(
    elements.gatewayPanelClose.getAttribute('aria-label'),
    'Back to discoveries'
  );
  assert.equal(
    elements.gatewayPanelContent.querySelectorAll(
      '.oling-lab-explorer-detail-panels > .oling-lab-explorer-detail-card'
    ).length,
    2
  );

  elements.gatewayPanelClose.click();
  await waitForPanelRefresh();
  assert.equal(state.explorerDiscoveryIndex, null);
  assert.equal(elements.gatewayPanelClose.textContent, 'Close');

  elements.gatewayPanelToggle.click();
  assert.equal(state.gatewayPanelCollapsed, true);
  assert.equal(elements.gatewayPanelToggle.textContent, 'Show');

  elements.gatewayPanelToggle.click();
  elements.gatewayPanelClose.click();
  assert.equal(state.gatewayPanelOpen, false);
  assert.equal(elements.gatewayPanel.hidden, true);
  assert.equal(elements.gatewayPanelContent.childElementCount, 0);
  assert.equal(elements.gatewayPanelTabs.childElementCount, 0);
  assert.equal(elements.gatewayPanelFooter.childElementCount, 0);
});

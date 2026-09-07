const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const modulePath = path.join(
  __dirname,
  '..',
  '..',
  'public',
  'scripts',
  'olings',
  'lab',
  'furniture-menus',
  'shelf-storage.js'
);

function createHarness(items) {
  const dom = new JSDOM(`<!doctype html><body>
    <aside id="panel" hidden>
      <button id="toggle"></button>
      <button id="back"></button>
      <h2 id="title"></h2>
      <div id="content"></div>
      <button id="quick-sell" disabled></button>
    </aside>
    <div id="action-panel">
      <button class="oling-lab-action-panel-button is-interact"></button>
    </div>
  </body>`);
  const { document } = dom.window;
  const storageSlots = Array.from({ length: 16 }, (_, index) => ({
    slotId: `shelf-${index + 1}`,
    slotType: 'storage',
    maxStack: 8
  }));
  const state = {
    activeSupplyStoragePlacedId: null,
    supplyStoragePanelOpen: false,
    supplyStoragePanelCollapsed: false,
    lab: {
      placedItems: [{ placedId: 'shelf-one', itemId: 'supply_shelf' }]
    },
    catalog: new Map([
      [
        'supply_shelf',
        {
          id: 'supply_shelf',
          name: 'Supply Shelf',
          inventorySlots: storageSlots
        }
      ]
    ])
  };
  const quickSells = [];
  const priceRequests = [];
  const context = {
    document,
    Promise,
    window: dom.window
  };
  dom.window.requestAnimationFrame = (callback) => callback();
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
    filename: modulePath
  });
  const tools = context.window.createOlingLabShelfStorage(
    {
      state,
      elements: {
        supplyStoragePanel: document.getElementById('panel'),
        supplyStoragePanelToggle: document.getElementById('toggle'),
        supplyStoragePanelBack: document.getElementById('back'),
        supplyStoragePanelTitle: document.getElementById('title'),
        supplyStoragePanelContent: document.getElementById('content'),
        supplyStorageQuickSell: document.getElementById('quick-sell'),
        actionPanel: document.getElementById('action-panel')
      },
      createImage(source, alt) {
        return Object.assign(document.createElement('img'), {
          src: source,
          alt
        });
      },
      closeMenu() {},
      getOlingViews: () => ({ closeStoragePanel() {} }),
      getQuickSellPrices(items) {
        priceRequests.push(items);
        return Promise.resolve(
          items.map((item) => ({
            itemType: item.type,
            itemKey: item.key,
            unitPayout: 4
          }))
        );
      },
      openQuickSellDialog(...args) {
        quickSells.push(args);
      }
    },
    { getShelfInventoryItems: () => items }
  );
  return { document, quickSells, priceRequests, state, tools };
}

test('Supply Shelf opens as a side panel with compact stacks and no empty buttons', async () => {
  const { document, priceRequests, state, tools } = createHarness([
    {
      key: 'oling-cookie',
      type: 'consumable',
      name: 'Oling Cookie',
      image: '/cookie.svg',
      description: 'A crunchy energy-restoring snack.',
      quantity: 10
    },
    {
      key: 'base-egg',
      type: 'egg',
      name: 'Base Egg',
      image: '/egg.svg',
      quantity: 1
    }
  ]);

  tools.openShelfStoragePanel('shelf-one');
  await new Promise((resolve) => setImmediate(resolve));

  const panel = document.getElementById('panel');
  const buttons = [
    ...document.querySelectorAll('.oling-lab-supply-storage-item')
  ];
  assert.equal(panel.hidden, false);
  assert.equal(panel.classList.contains('is-open'), true);
  assert.equal(state.supplyStoragePanelOpen, true);
  assert.equal(buttons.length, 3);
  assert.equal(
    document.querySelector('.oling-lab-supply-storage-pagination'),
    null
  );
  assert.equal(priceRequests.length, 1);
  assert.equal(priceRequests[0].length, 2);
  assert.match(document.getElementById('content').textContent, /3\/16/);
  assert.match(
    document.getElementById('content').textContent,
    /Select an item/
  );

  buttons[0].click();
  assert.match(document.getElementById('content').textContent, /Oling Cookie/);
  assert.match(
    document.querySelector('.oling-lab-supply-storage-description').textContent,
    /crunchy energy-restoring snack/
  );
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-heading span')[1]
      .textContent,
    '8/8'
  );
  const units = [
    ...document.querySelectorAll('.oling-lab-supply-storage-unit')
  ];
  assert.equal(units.length, 8);
  assert.equal(document.getElementById('quick-sell').disabled, true);

  units[0].click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-unit.is-selected')
      .length,
    1
  );
  assert.equal(
    document.querySelector('.oling-lab-supply-storage-selector strong')
      .textContent,
    '1'
  );
  assert.equal(document.getElementById('quick-sell').disabled, false);
  assert.match(
    document.getElementById('quick-sell').textContent,
    /Quick Sell4/
  );
  assert.ok(document.querySelector('#quick-sell img[src$="/opal.svg"]'));
});

test('stack buttons and arrow selector stay synchronized', async () => {
  const item = {
    key: 'oling-cookie',
    type: 'consumable',
    name: 'Oling Cookie',
    image: '/cookie.svg',
    quantity: 5
  };
  const { document, priceRequests, tools } = createHarness([item]);
  tools.openShelfStoragePanel('shelf-one');
  await new Promise((resolve) => setImmediate(resolve));
  document.querySelector('.oling-lab-supply-storage-item').click();
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-heading span')[1]
      .textContent,
    '5/8'
  );

  document.querySelectorAll('.oling-lab-supply-storage-unit')[2].click();
  document
    .querySelector('.oling-lab-supply-storage-selector button:last-child')
    .click();
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-unit.is-selected')
      .length,
    2
  );
  assert.equal(
    document.querySelector('.oling-lab-supply-storage-selector strong')
      .textContent,
    '2'
  );
  assert.equal(priceRequests.length, 1);
  assert.match(
    document.getElementById('quick-sell').textContent,
    /Quick Sell8/
  );
  assert.doesNotMatch(document.getElementById('quick-sell').textContent, /…/);

  document
    .querySelector('.oling-lab-supply-storage-selector button:first-child')
    .click();
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-unit.is-selected')
      .length,
    1
  );
});

test('Supply Shelf footer shows the Opal payout and sells the selected quantity', async () => {
  const item = {
    key: 'oling-cookie',
    type: 'consumable',
    name: 'Oling Cookie',
    image: '/cookie.svg',
    quantity: 5
  };
  const { document, quickSells, state, tools } = createHarness([item]);
  tools.openShelfStoragePanel('shelf-one');
  await new Promise((resolve) => setImmediate(resolve));
  document.querySelector('.oling-lab-supply-storage-item').click();
  const increment = () =>
    document
      .querySelector('.oling-lab-supply-storage-selector button:last-child')
      .click();
  increment();
  increment();
  increment();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(
    document.getElementById('quick-sell').textContent,
    /Quick Sell12/
  );
  document.getElementById('quick-sell').click();

  assert.equal(quickSells.length, 1);
  assert.equal(quickSells[0][0].key, item.key);
  assert.equal(quickSells[0][1], 3);
  assert.equal(typeof quickSells[0][2].onComplete, 'function');

  document.getElementById('back').click();
  assert.equal(document.getElementById('panel').hidden, true);
  assert.equal(state.supplyStoragePanelOpen, false);
  assert.equal(state.activeSupplyStoragePlacedId, null);
});

test('Supply Shelf paginates its 16 stack capacity into 4x2 pages', () => {
  const { document, tools } = createHarness([
    {
      key: 'o-juice',
      type: 'consumable',
      name: 'O-Juice',
      image: '/o-juice.svg',
      quantity: 200
    }
  ]);

  tools.openShelfStoragePanel('shelf-one');

  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-item').length,
    8
  );
  assert.match(document.getElementById('content').textContent, /16\/16/);
  const pagination = document.querySelector(
    '.oling-lab-supply-storage-pagination'
  );
  assert.ok(pagination);
  assert.equal(pagination.querySelector('strong').textContent, '1 / 2');
  pagination.querySelector('button:last-child').click();
  assert.equal(
    document.querySelectorAll('.oling-lab-supply-storage-item').length,
    8
  );
  assert.equal(
    document.querySelector('.oling-lab-supply-storage-pagination strong')
      .textContent,
    '2 / 2'
  );
});

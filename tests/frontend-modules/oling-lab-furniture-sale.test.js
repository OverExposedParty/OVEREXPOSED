const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scripts = [
  '../../public/scripts/olings/lab/purchases/purchase-dialog-ui.js',
  '../../public/scripts/olings/lab/purchases/furniture-sale.js'
].map((file) => path.join(__dirname, file));

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('furniture sale control quotes before confirming and hydrates the sold lab', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <button data-oling-lab-furniture-sell="rest" hidden>Sell</button>
  </body>`);
  const { document } = dom.window;
  const requests = [];
  const responses = [
    {
      quote: {
        placedId: 'bed-1',
        itemKey: 'oling_bed',
        furnitureName: 'Oling Bed',
        paidPrice: 100,
        payout: 60
      }
    },
    {
      quote: {
        furnitureName: 'Oling Bed',
        payout: 60,
        balanceAfter: 160
      },
      account: { id: 'account-1' },
      lab: { placedItems: [] },
      inventory: { furniture: [] }
    }
  ];
  dom.window.fetch = async (url, options) => {
    requests.push([url, JSON.parse(options.body)]);
    return {
      ok: true,
      json: async () => ({ success: true, ...responses.shift() })
    };
  };
  dom.window.playSoundEffect = () => Promise.resolve();
  const context = {
    document,
    window: dom.window,
    fetch: dom.window.fetch,
    setImmediate
  };
  scripts.forEach((script) =>
    vm.runInNewContext(fs.readFileSync(script, 'utf8'), context, {
      filename: script
    })
  );

  const state = {
    visitorMode: false,
    tutorialMode: false,
    catalog: new Map([
      [
        'oling_bed',
        {
          id: 'oling_bed',
          name: 'Oling Bed',
          image: '/bed.svg'
        }
      ]
    ]),
    lab: {
      placedItems: [
        {
          placedId: 'bed-1',
          itemId: 'oling_bed',
          locked: false,
          containerSlots: []
        }
      ]
    },
    owned: new Set(['oling_bed'])
  };
  let panelsClosed = 0;
  const dialogUi = context.window.createOlingLabPurchaseDialogUi({
    closeSharedPopup: (element) => element.remove()
  });
  const sale = context.window.createOlingLabFurnitureSale({
    state,
    parsePayload: async (response) => response.json(),
    createImage: (src, alt) =>
      Object.assign(document.createElement('img'), { src, alt }),
    openSharedPopup() {},
    renderLab() {},
    syncAccountPayload() {},
    closeActiveFurniturePanels: () => {
      panelsClosed += 1;
    },
    dialogUi
  });
  const button = document.querySelector('[data-oling-lab-furniture-sell]');
  sale.setFurnitureSaleTarget('rest', 'bed-1');

  assert.equal(button.hidden, false);
  button.click();
  await flush();
  const confirm = document.querySelector(
    '.oling-furniture-sale-actions .is-warning'
  );
  assert.equal(confirm.disabled, false);
  assert.match(document.body.textContent, /Price paid100/);
  assert.match(document.body.textContent, /You receive60/);

  confirm.click();
  await flush();
  assert.deepEqual(requests, [
    ['/api/olings/lab/furniture-sale/quote', { placedId: 'bed-1' }],
    ['/api/olings/lab/furniture-sale', { placedId: 'bed-1' }]
  ]);
  assert.equal(state.lab.placedItems.length, 0);
  assert.equal(panelsClosed, 1);
  assert.match(document.body.textContent, /Furniture sold/);
});

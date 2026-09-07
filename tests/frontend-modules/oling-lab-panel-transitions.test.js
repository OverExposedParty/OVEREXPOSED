const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const modulePath = path.join(
  __dirname,
  '../../public/scripts/olings/lab/ui/panel-transitions.js'
);
const interactionsPath = path.join(
  __dirname,
  '../../public/scripts/olings/lab/ui/lab-rest-and-interactions.js'
);
const labEventsPath = path.join(
  __dirname,
  '../../public/scripts/olings/lab/core/lab-events.js'
);

function dispatchTransformEnd(window, panel) {
  const event = new window.Event('transitionend');
  Object.defineProperty(event, 'propertyName', { value: 'transform' });
  panel.dispatchEvent(event);
}

test('side panels finish exiting before the next panel enters', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="oling-lab-room" data-oling-lab-selected-furniture-id="chair-one">
      <div class="oling-lab-item is-selected"></div>
    </div>
    <aside id="first" class="oling-lab-wall-decoration-panel" hidden></aside>
    <aside id="second" class="oling-lab-wall-decoration-panel" hidden></aside>
  </body>`);
  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.matchMedia = () => ({ matches: false });
  const context = { document: dom.window.document, window: dom.window };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
    filename: modulePath
  });

  const transitions = dom.window.OlingLabPanelTransitions;
  const first = dom.window.document.getElementById('first');
  const second = dom.window.document.getElementById('second');
  await transitions.open(first);
  assert.equal(first.hidden, false);
  assert.equal(first.classList.contains('is-open'), true);

  let exitStarted = false;
  const closing = transitions.close(first, {
    beforeExit: () => {
      exitStarted = true;
    }
  });
  const opening = transitions.open(second);
  assert.equal(
    dom.window.document.getElementById('oling-lab-room').dataset
      .olingLabSelectedFurnitureId,
    undefined,
    'the old furniture footprint clears as its panel begins closing'
  );
  assert.equal(
    dom.window.document
      .querySelector('#oling-lab-room .oling-lab-item')
      .classList.contains('is-selected'),
    false
  );
  assert.equal(first.hidden, false, 'the exiting panel remains rendered');
  assert.equal(
    first.classList.contains('is-open'),
    true,
    'the panel holds fully open before it exits'
  );
  assert.equal(first.classList.contains('is-waiting-to-close'), true);
  assert.equal(exitStarted, false, 'the exit cue waits with the panel');
  assert.equal(second.hidden, true, 'the next panel waits for the exit');

  await new Promise((resolve) => dom.window.setTimeout(resolve, 170));
  assert.equal(exitStarted, true);
  assert.equal(first.classList.contains('is-waiting-to-close'), false);
  assert.equal(first.classList.contains('is-transitioning-out'), true);
  assert.equal(first.classList.contains('is-open'), false);
  dispatchTransformEnd(dom.window, first);
  await closing;
  await opening;
  assert.equal(first.hidden, true);
  assert.equal(second.hidden, false);
  assert.equal(second.classList.contains('is-open'), true);
});

test('collapsing a panel remains separate from closing it', async () => {
  const dom = new JSDOM(
    '<aside class="oling-lab-wall-decoration-panel is-open is-collapsed"></aside>'
  );
  dom.window.requestAnimationFrame = (callback) => callback();
  dom.window.matchMedia = () => ({ matches: false });
  const context = { document: dom.window.document, window: dom.window };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context, {
    filename: modulePath
  });

  const panel = dom.window.document.querySelector('aside');
  assert.equal(panel.hidden, false);
  assert.equal(panel.classList.contains('is-collapsed'), true);
  assert.equal(
    dom.window.OlingLabPanelTransitions.getPendingClose(panel),
    null
  );
});

test('furniture interaction waits for the current panel to exit', async () => {
  const dom = new JSDOM(`<!doctype html><body>
    <div id="oling-lab-room">
      <div class="oling-lab-item" data-oling-lab-placed-id="table-one"></div>
    </div>
  </body>`);
  const context = { document: dom.window.document, window: dom.window };
  vm.runInNewContext(fs.readFileSync(interactionsPath, 'utf8'), context, {
    filename: interactionsPath
  });

  let finishExit;
  const exit = new Promise((resolve) => {
    finishExit = resolve;
  });
  let openedPlacedId = null;
  const tools = dom.window.createOlingLabRestAndInteractionTools({
    state: {
      lab: {
        placedItems: [{ placedId: 'table-one', itemId: 'standard-table' }]
      }
    },
    elements: {
      room: dom.window.document.getElementById('oling-lab-room')
    },
    getItem: () => ({
      id: 'standard-table',
      name: 'Standard Table',
      containerSlots: [{ slotId: 'tabletop' }]
    }),
    getIncubatorContext: () => null,
    getOlingViews: () => ({
      closeStoragePanel: () => exit,
      closeOlingPanel: () => exit
    }),
    closeFurnitureSlotsPanel: () => exit,
    closeGatewayPanel: () => exit,
    closeIncubatorPanel: () => exit,
    closeShelfStoragePanel: () => exit,
    closeSelectedTarget() {},
    openFurnitureSlotsMenu: (placedId) => {
      openedPlacedId = placedId;
    },
    setStatus() {},
    renderLab() {}
  });

  const switching = tools.interactWithFurniture('table-one');
  await Promise.resolve();
  assert.equal(openedPlacedId, null);
  finishExit();
  await switching;
  assert.equal(openedPlacedId, 'table-one');
  assert.equal(
    dom.window.document.getElementById('oling-lab-room').dataset
      .olingLabSelectedFurnitureId,
    'table-one'
  );
  assert.equal(
    dom.window.document
      .querySelector('[data-oling-lab-placed-id="table-one"]')
      .classList.contains('is-selected'),
    true
  );
});

test('room deselection and Escape use the side-panel close cue', () => {
  const dom = new JSDOM(`<!doctype html><body>
    <button id="edit"></button>
    <button id="left"></button>
    <button id="right"></button>
    <div id="viewport"></div>
    <main id="room"><span id="floor"></span></main>
    <div id="backdrop" hidden></div>
    <div id="menu"></div>
  </body>`);
  const sounds = [];
  dom.window.playSoundEffect = (key) => sounds.push(key);
  const context = {
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    window: dom.window
  };
  vm.runInNewContext(fs.readFileSync(labEventsPath, 'utf8'), context, {
    filename: labEventsPath
  });

  const state = {
    camera: {},
    editMode: false,
    selectedTarget: { type: 'oling', id: 'oling-one' },
    olingPanelOpen: true
  };
  const closeSelection = () => {
    state.selectedTarget = null;
    state.olingPanelOpen = false;
  };
  context.window.bindOlingLabEvents({
    state,
    elements: {
      editToggle: dom.window.document.getElementById('edit'),
      customiseCategoryButtons: [],
      scrollLeft: dom.window.document.getElementById('left'),
      scrollRight: dom.window.document.getElementById('right'),
      viewport: dom.window.document.getElementById('viewport'),
      room: dom.window.document.getElementById('room'),
      backdrop: dom.window.document.getElementById('backdrop'),
      menu: dom.window.document.getElementById('menu'),
      menuClose: null
    },
    closeSelectedTarget: closeSelection,
    ensureCameraFrame() {},
    panLabBy() {},
    zoomLabAt() {},
    clampCameraTarget() {},
    closeMenu() {},
    renderLab() {}
  });

  dom.window.document.getElementById('floor').click();
  assert.deepEqual(sounds, ['sidePanelClose']);

  state.selectedTarget = { type: 'oling', id: 'oling-one' };
  state.olingPanelOpen = true;
  dom.window.document.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Escape' })
  );
  assert.deepEqual(sounds, ['sidePanelClose', 'sidePanelClose']);
});

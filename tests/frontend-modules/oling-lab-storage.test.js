const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const storageScript = path.join(
  __dirname,
  '../../public/scripts/olings/lab/olings/storage.js'
);

function createHarness({ withPanel = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body>
    ${
      withPanel
        ? `<aside id="storage-panel" hidden>
             <button id="storage-toggle"></button>
             <button id="storage-back" class="is-close" aria-label="Close Pod Rack menu" data-sound="none">Close</button>
             <div id="storage-content"></div>
           </aside>
           <div id="action-panel"><button class="oling-lab-action-panel-button is-interact"></button></div>
           <div id="viewport"></div>`
        : ''
    }
  </body>`);
  const { document } = dom.window;
  const sounds = [];
  dom.window.playSoundEffect = (key) => sounds.push(key);
  const context = { window: dom.window, document };
  vm.runInNewContext(fs.readFileSync(storageScript, 'utf8'), context, {
    filename: 'lab/olings/storage.js'
  });
  const releases = [];
  const stores = [];
  const openedMenus = [];
  const openedPopups = [];
  const captureHovers = [];
  const statuses = [];
  const state = {
    activeAdventure: null,
    activePodStoragePlacedId: 'pod-rack-one',
    ownedPods: [{ key: 'oling_pod', quantity: 1 }],
    catalog: new Map([
      [
        'pod_rack',
        {
          id: 'pod_rack',
          name: 'Pod Rack',
          podStorage: { capacity: 6 }
        }
      ]
    ]),
    lab: {
      placedItems: [{ placedId: 'pod-rack-one', itemId: 'pod_rack' }]
    },
    podDefinitions: new Map([
      [
        'oling_pod',
        {
          key: 'oling_pod',
          name: 'Disposable Oling Pod',
          description: 'Stores one Oling.',
          lifecycle: { onRelease: 'destroy' },
          assets: {
            empty: '/images/olings/lab/items/oling-pods/disposable/artwork.svg',
            occupied: null,
            layers: {
              back: '/images/olings/lab/items/oling-pods/disposable/layers/back.svg',
              front:
                '/images/olings/lab/items/oling-pods/disposable/layers/front.svg',
              base: '/images/olings/lab/items/oling-pods/disposable/layers/base.svg'
            }
          }
        }
      ]
    ]),
    olings: [
      {
        id: 'oling-1',
        name: 'Pip',
        residency: {
          state: 'stored',
          pod: {
            key: 'oling_pod',
            releaseOutcome: 'destroy',
            containerPlacedId: 'pod-rack-one'
          }
        }
      }
    ]
  };
  const tools = context.window.createOlingLabStorageTools({
    state,
    elements: withPanel
      ? {
          storagePanel: document.getElementById('storage-panel'),
          storagePanelToggle: document.getElementById('storage-toggle'),
          storagePanelBack: document.getElementById('storage-back'),
          storagePanelContent: document.getElementById('storage-content'),
          actionPanel: document.getElementById('action-panel'),
          viewport: document.getElementById('viewport')
        }
      : {},
    helpers: {
      closeMenu() {},
      openMenu(title, content, options) {
        openedMenus.push({ title, content, options });
      },
      createEmptyMessage(message) {
        return Object.assign(document.createElement('p'), {
          textContent: message
        });
      },
      createInlineAction(label, onClick, options = {}) {
        const button = Object.assign(document.createElement('button'), {
          disabled: Boolean(options.disabled)
        });
        if (options.className) button.classList.add(options.className);
        button.appendChild(
          Object.assign(document.createElement('span'), { textContent: label })
        );
        button.addEventListener('click', onClick);
        return button;
      },
      async storeOling(olingId, podKey, containerPlacedId) {
        stores.push({ olingId, podKey, containerPlacedId });
      },
      async transferStoredOling() {},
      async releaseOling(olingId) {
        releases.push(olingId);
        state.olings[0].residency = { state: 'active', pod: null };
      },
      openSharedPopup(dialog) {
        openedPopups.push(dialog);
      },
      closeSharedPopup(dialog) {
        dialog.remove();
      },
      setStatus(message) {
        statuses.push(message);
      },
      getRoaming() {
        return {
          setPodCaptureHover(olingId, enabled) {
            captureHovers.push({ olingId, enabled });
          }
        };
      }
    },
    previewTools: {
      getOlingId: (oling) => String(oling.id),
      createPreview() {
        return document.createElement('div');
      }
    }
  });
  return {
    document,
    captureHovers,
    openedMenus,
    openedPopups,
    releases,
    sounds,
    state,
    statuses,
    stores,
    tools
  };
}

test('one-use pod release requires a destructive confirmation click', async () => {
  const { releases, tools } = createHarness();
  const section = tools.createStoredOlingsSection();
  const releaseButton = section.querySelector('.is-destructive');

  releaseButton.click();

  assert.deepEqual(releases, []);
  assert.equal(releaseButton.textContent, 'Release & break pod');
  assert.equal(section.querySelector('.is-warning').hidden, false);

  releaseButton.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(releases, ['oling-1']);
  assert.match(section.textContent, /No Olings are stored/);
});

test('active Oling storage selects a configured owned pod', async () => {
  const { state, stores, tools } = createHarness();
  const activeOling = {
    id: 'oling-2',
    name: 'Dot',
    residency: { state: 'active' },
    care: { isSleeping: false }
  };
  state.olings.push(activeOling);
  const [section] = tools.createStoreOlingTab(activeOling);

  section.querySelector('button').click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(stores, [
    {
      olingId: 'oling-2',
      podKey: 'oling_pod',
      containerPlacedId: 'pod-rack-one'
    }
  ]);
  assert.match(section.textContent, /One use · breaks on release/);
});

test('stored Oling storage opens from a placed Pod Rack', () => {
  const { openedMenus, tools } = createHarness();

  tools.openStoredOlingsMenu();

  assert.equal(openedMenus.length, 1);
  assert.equal(openedMenus[0].title, 'Pod Rack');
  assert.equal(openedMenus[0].options.theme, 'inventory');
  assert.match(openedMenus[0].content[0].textContent, /Pip/);
});

test('the Pod Rack header close exits storage and returns focus to its action', () => {
  const { document, sounds, state, tools } = createHarness({ withPanel: true });
  tools.openStoredOlingsMenu();

  const back = document.getElementById('storage-back');
  assert.equal(back.textContent, 'Close');
  assert.equal(back.getAttribute('aria-label'), 'Close Pod Rack menu');
  assert.equal(back.classList.contains('is-close'), true);
  back.click();

  assert.equal(back.dataset.sound, 'none');
  assert.equal(document.getElementById('storage-panel').hidden, true);
  assert.equal(state.storagePanelOpen, false);
  assert.equal(state.activePodStoragePlacedId, null);
  assert.equal(
    document.activeElement,
    document.querySelector('.oling-lab-action-panel-button.is-interact')
  );
  assert.deepEqual(sounds, ['sidePanelOpen', 'sidePanelClose']);
});

test('storage opens as a side panel and warns before a one-use pod releases', async () => {
  const { document, openedPopups, releases, sounds, tools } = createHarness({
    withPanel: true
  });

  tools.openStoredOlingsMenu();

  const panel = document.getElementById('storage-panel');
  assert.equal(panel.hidden, false);
  assert.equal(panel.classList.contains('is-open'), true);
  assert.deepEqual(sounds, ['sidePanelOpen']);
  tools.openStoredOlingsMenu();
  assert.deepEqual(sounds, ['sidePanelOpen']);
  const panelToggle = document.getElementById('storage-toggle');
  assert.equal(panelToggle.dataset.sound, 'none');
  panelToggle.click();
  panelToggle.click();
  assert.deepEqual(sounds, [
    'sidePanelOpen',
    'sidePanelClose',
    'sidePanelOpen'
  ]);
  assert.match(
    document
      .querySelector('.oling-lab-storage-panel-card.is-occupied')
      .getAttribute('aria-label'),
    /Pip/
  );
  const occupiedArtwork = document.querySelector(
    '.oling-lab-storage-panel-card.is-occupied .oling-lab-pod-artwork.is-occupied'
  );
  assert.ok(occupiedArtwork);
  assert.deepEqual(
    [...occupiedArtwork.children].map((element) =>
      element.classList.contains('oling-lab-pod-artwork-layer')
        ? element.classList[1]
        : 'oling'
    ),
    ['is-back', 'oling', 'is-front', 'is-base']
  );
  assert.deepEqual(
    [...occupiedArtwork.querySelectorAll('.oling-lab-pod-artwork-layer')].map(
      (element) => element.src.split('/').at(-1)
    ),
    ['back.svg', 'front.svg', 'base.svg']
  );
  assert.ok(occupiedArtwork.querySelector('.is-pod-overlay'));
  assert.match(
    document.querySelector(
      '.oling-lab-storage-panel-card.is-empty .oling-lab-pod-artwork-base'
    ).src,
    /oling-pods\/disposable\/artwork\.svg$/
  );
  assert.equal(
    document.querySelector(
      '.oling-lab-storage-panel-card.is-empty .is-pod-overlay'
    ),
    null
  );
  assert.deepEqual(
    [
      ...document.querySelectorAll('.oling-lab-storage-panel-section-count')
    ].map((element) => element.textContent),
    ['1', '1']
  );
  assert.equal(
    document.querySelector('.oling-lab-storage-panel-stack-count').textContent,
    '1'
  );
  assert.deepEqual(
    [...document.querySelectorAll('.oling-lab-storage-panel-uses')].map(
      (element) => element.textContent
    ),
    ['1 USE']
  );
  assert.equal(
    document.querySelector('.oling-lab-storage-panel-oling-name').textContent,
    'Pip'
  );

  document.querySelector('.oling-lab-storage-panel-card.is-occupied').click();
  assert.equal(releases.length, 0);
  assert.equal(openedPopups.length, 1);
  assert.match(openedPopups[0].textContent, /permanently break the pod/);
  assert.equal(
    openedPopups[0].querySelector('.oling-lab-pod-release-cancel').dataset
      .sound,
    'none'
  );

  openedPopups[0].querySelector('.oe-purchase-confirm').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(releases, ['oling-1']);
});

test('an active Oling can target and drop onto an empty pod card', async () => {
  const { document, sounds, state, stores, tools } = createHarness({
    withPanel: true
  });
  const activeOling = {
    id: 'oling-2',
    name: 'Dot',
    residency: { state: 'active' },
    care: { isSleeping: false }
  };
  state.olings.push(activeOling);
  tools.openStoredOlingsMenu();
  const emptyPod = document.querySelector(
    '.oling-lab-storage-panel-card.is-empty'
  );
  emptyPod.getBoundingClientRect = () => ({
    left: 100,
    right: 250,
    top: 100,
    bottom: 250
  });

  const target = tools.getOlingStorageDropTarget(activeOling, {
    clientX: 150,
    clientY: 150
  });
  assert.equal(target.podKey, 'oling_pod');
  assert.equal(emptyPod.classList.contains('is-drop-target'), true);

  await tools.captureDraggedOling(activeOling, target);
  assert.deepEqual(stores, [
    {
      olingId: 'oling-2',
      podKey: 'oling_pod',
      containerPlacedId: 'pod-rack-one'
    }
  ]);
  assert.equal(sounds[sounds.length - 1], 'uiDragStore');
});

test('an empty pod freezes only the active Oling it overlaps', () => {
  const { captureHovers, document, state, tools } = createHarness({
    withPanel: true
  });
  state.olings.push({
    id: 'oling-2',
    name: 'Dot',
    residency: { state: 'active' },
    care: { isSleeping: false }
  });
  const roamer = document.createElement('button');
  roamer.className = 'oling-lab-roamer';
  roamer.dataset.olingId = 'oling-2';
  roamer.getBoundingClientRect = () => ({
    left: 100,
    right: 250,
    top: 100,
    bottom: 250,
    width: 150,
    height: 150
  });
  roamer.appendChild(
    Object.assign(document.createElement('div'), {
      className: 'oling-lab-oling-preview is-roaming'
    })
  );
  document.body.appendChild(roamer);
  tools.openStoredOlingsMenu();
  const pod = document.querySelector('.oling-lab-storage-panel-card.is-empty');
  const pointer = (type, clientX, clientY) => {
    const event = new document.defaultView.MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 7 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };

  const podImage = pod.querySelector('.oling-lab-pod-artwork-base');
  assert.equal(pod.draggable, false);
  assert.equal(podImage.draggable, false);
  assert.equal(
    podImage.dispatchEvent(
      new document.defaultView.MouseEvent('dragstart', {
        bubbles: true,
        cancelable: true
      })
    ),
    false
  );

  pod.dispatchEvent(pointer('pointerdown', 10, 10));
  document.dispatchEvent(pointer('pointermove', 150, 150));
  const ghost = document.querySelector('.oling-lab-pod-drag-ghost');
  assert.ok(ghost);
  assert.equal(ghost.children.length, 1);
  assert.ok(
    ghost.firstElementChild.classList.contains('oling-lab-pod-artwork')
  );
  assert.ok(ghost.classList.contains('is-snapped'));
  assert.equal(ghost.style.left, '175px');
  assert.equal(ghost.style.top, '175px');
  assert.equal(ghost.style.width, '150px');
  assert.equal(ghost.style.height, '150px');
  assert.equal(ghost.classList.contains('has-live-capture-layers'), true);
  assert.equal(roamer.classList.contains('has-pod-capture-layers'), true);
  assert.deepEqual(
    [...roamer.querySelectorAll('.oling-lab-pod-capture-layer')].map(
      (element) => element.src.split('/').at(-1)
    ),
    ['back.svg', 'front.svg', 'base.svg']
  );
  assert.deepEqual(captureHovers.at(-1), {
    olingId: 'oling-2',
    enabled: true
  });

  document.dispatchEvent(pointer('pointermove', 500, 500));
  assert.ok(!ghost.classList.contains('is-snapped'));
  assert.equal(ghost.style.left, '500px');
  assert.equal(ghost.style.top, '500px');
  assert.equal(ghost.style.width, '');
  assert.equal(ghost.style.height, '');
  assert.equal(ghost.classList.contains('has-live-capture-layers'), false);
  assert.equal(roamer.classList.contains('has-pod-capture-layers'), false);
  assert.equal(roamer.querySelector('.oling-lab-pod-capture-layer'), null);
  assert.deepEqual(captureHovers.at(-1), {
    olingId: 'oling-2',
    enabled: false
  });
  document.dispatchEvent(pointer('pointercancel', 500, 500));
});

test('an occupied pod can return to the storage panel without releasing', () => {
  const { document, openedPopups, releases, sounds, statuses, tools } =
    createHarness({ withPanel: true });
  const panel = document.getElementById('storage-panel');
  const viewport = document.getElementById('viewport');
  panel.getBoundingClientRect = () => ({
    left: 600,
    right: 900,
    top: 0,
    bottom: 700,
    width: 300,
    height: 700
  });
  viewport.getBoundingClientRect = () => ({
    left: 0,
    right: 1000,
    top: 0,
    bottom: 700,
    width: 1000,
    height: 700
  });
  const pointer = (type, clientX, clientY) => {
    const event = new document.defaultView.MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 9 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };

  tools.openStoredOlingsMenu();
  const pod = document.querySelector(
    '.oling-lab-storage-panel-card.is-occupied'
  );
  pod.dispatchEvent(pointer('pointerdown', 700, 120));
  document.dispatchEvent(pointer('pointermove', 300, 120));
  assert.equal(panel.classList.contains('is-drop-target'), false);

  document.dispatchEvent(pointer('pointermove', 700, 120));
  const ghost = document.querySelector('.oling-lab-pod-drag-ghost');
  assert.equal(panel.classList.contains('is-drop-target'), true);
  assert.equal(
    panel.dataset.storageDropMessage,
    'Drop here to keep Oling stored'
  );
  assert.equal(ghost.classList.contains('is-over-storage'), true);
  assert.match(statuses.at(-1), /keep Pip stored/);
  assert.equal(document.getElementById('storage-back').textContent, 'Close');

  document.dispatchEvent(pointer('pointerup', 700, 120));
  assert.equal(panel.classList.contains('is-drop-target'), false);
  assert.equal(document.querySelector('.oling-lab-pod-drag-ghost'), null);
  assert.deepEqual(releases, []);
  assert.deepEqual(openedPopups, []);
  assert.match(statuses.at(-1), /Pip remains safely stored/);
  assert.equal(sounds[sounds.length - 1], 'uiDragStore');
});

test('an empty pod can return to the storage panel without being consumed', () => {
  const { captureHovers, document, sounds, state, statuses, stores, tools } =
    createHarness({ withPanel: true });
  state.olings = [
    {
      id: 'oling-behind-panel',
      name: 'Hidden Oling',
      residency: { state: 'active' },
      care: { isSleeping: false }
    }
  ];
  const panel = document.getElementById('storage-panel');
  const viewport = document.getElementById('viewport');
  panel.getBoundingClientRect = () => ({
    left: 600,
    right: 900,
    top: 0,
    bottom: 700,
    width: 300,
    height: 700
  });
  viewport.getBoundingClientRect = () => ({
    left: 0,
    right: 1000,
    top: 0,
    bottom: 700,
    width: 1000,
    height: 700
  });
  const coveredRoamer = document.createElement('button');
  coveredRoamer.className = 'oling-lab-roamer';
  coveredRoamer.dataset.olingId = 'oling-behind-panel';
  coveredRoamer.getBoundingClientRect = () => ({
    left: 600,
    right: 700,
    top: 70,
    bottom: 170,
    width: 100,
    height: 100
  });
  document.body.appendChild(coveredRoamer);
  const pointer = (type, clientX, clientY) => {
    const event = new document.defaultView.MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 10 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };

  tools.openStoredOlingsMenu();
  const pod = document.querySelector('.oling-lab-storage-panel-card.is-empty');
  pod.dispatchEvent(pointer('pointerdown', 700, 120));
  document.dispatchEvent(pointer('pointermove', 300, 120));
  document.dispatchEvent(pointer('pointermove', 560, 120));

  const ghost = document.querySelector('.oling-lab-pod-drag-ghost');
  assert.equal(panel.classList.contains('is-drop-target'), true);
  assert.equal(
    panel.dataset.storageDropMessage,
    'Drop here to return empty pod'
  );
  assert.equal(ghost.classList.contains('is-over-storage'), true);

  document.dispatchEvent(pointer('pointerup', 560, 120));
  assert.equal(panel.classList.contains('is-drop-target'), false);
  assert.equal(panel.dataset.storageDropMessage, undefined);
  assert.deepEqual(stores, []);
  assert.deepEqual(captureHovers, []);
  assert.equal(state.ownedPods[0].quantity, 1);
  assert.match(statuses.at(-1), /empty pod remains available/);
  assert.equal(sounds[sounds.length - 1], 'uiDragStore');
});

test('a full six-Oling lab blocks release before consuming the pod', () => {
  const { document, openedPopups, releases, state, tools } = createHarness({
    withPanel: true
  });
  state.olingRoster = { activeCount: 6, limit: 6 };
  tools.openStoredOlingsMenu();

  document.querySelector('.oling-lab-storage-panel-card.is-occupied').click();

  assert.equal(openedPopups.length, 1);
  assert.equal(
    openedPopups[0].querySelector('.oe-purchase-confirm').disabled,
    true
  );
  assert.equal(releases.length, 0);
  assert.match(
    openedPopups[0].querySelector('.oling-lab-storage-dialog-status')
      .textContent,
    /6\/6/
  );
});

test('empty storage sections do not render zero totals', () => {
  const { document, state, tools } = createHarness({ withPanel: true });
  state.olings = [];
  state.ownedPods = [];

  tools.openStoredOlingsMenu();

  assert.equal(
    document.querySelectorAll('.oling-lab-storage-panel-section-count').length,
    0
  );
  assert.doesNotMatch(
    document.getElementById('storage-content').textContent,
    /(^|\D)0($|\D)/
  );
});

test('reusable pod configuration displays unlimited uses', () => {
  const { document, state, tools } = createHarness({ withPanel: true });
  state.ownedPods = [{ key: 'reusable_oling_pod', quantity: 2 }];
  state.podDefinitions.set('reusable_oling_pod', {
    key: 'reusable_oling_pod',
    name: 'Reusable Oling Pod',
    lifecycle: { onRelease: 'return-to-inventory', uses: null },
    assets: {
      empty: '/images/olings/lab/items/oling-pods/disposable/artwork.svg'
    }
  });

  tools.openStoredOlingsMenu();

  const card = document.querySelector('[data-pod-key="reusable_oling_pod"]');
  assert.equal(
    card.querySelector('.oling-lab-storage-panel-stack-count').textContent,
    '2'
  );
  assert.equal(
    card.querySelector('.oling-lab-storage-panel-uses').textContent,
    '∞ USES'
  );
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const scriptsDirectory = path.join(__dirname, '../../public/scripts/olings');
const featureScripts = [
  ['lab/ui/lab-privacy-settings.js', 'createOlingLabPrivacySettings'],
  ['lab/ui/lab-hatch-controls.js', 'createOlingLabHatchControls'],
  [
    'lab/ui/lab-rest-and-interactions.js',
    'createOlingLabRestAndInteractionTools'
  ],
  [
    'lab/explorer-gateway/lab-explorer-gateway.js',
    'createOlingLabExplorerGateway'
  ],
  ['lab/room/lab-renderer.js', 'createOlingLabRenderer'],
  ['lab/ui/lab-wallpapers.js', 'createOlingLabWallpapers'],
  ['lab/wall-decorations/wall-decorations.js', 'createOlingLabWallDecorations'],
  [
    'lab/furniture-placement/furniture-panel.js',
    'createOlingLabFurniturePanel'
  ],
  ['lab/data/lab-data-flow.js', 'createOlingLabDataFlow']
];
const explorerGatewayScripts = [
  ['lab/explorer-gateway/render-tools.js', 'createOlingLabExplorerRenderTools']
];
const roamingScripts = [
  ['lab/room/lab-roaming-targets.js', 'createOlingLabRoamingTargets']
];
const startupScripts = [
  ['lab/core/lab-runtime.js', 'createOlingLabRuntime'],
  ['lab/core/lab-startup.js', 'createOlingLabStartup']
];
const runtimeSupportScripts = [
  ['lab/core/lab-config.js', 'createOlingLabConfig'],
  ['lab/core/lab-state.js', 'createOlingLabState'],
  ['lab/core/lab-presentation.js', 'createOlingLabPresentation'],
  ['lab/core/lab-elements.js', 'getOlingLabElements'],
  ['lab/core/lab-selection.js', 'createOlingLabSelection'],
  ['lab/core/lab-events.js', 'bindOlingLabEvents']
];
const olingViewScripts = [
  ['lab/olings/preview.js', 'createOlingLabPreviewTools'],
  ['lab/olings/build.js', 'createOlingLabBuildTools'],
  ['lab/olings/storage.js', 'createOlingLabStorageTools'],
  ['lab/olings/inspect.js', 'createOlingLabInspectTools'],
  ['lab/olings/reveal.js', 'createOlingLabRevealTools']
];
const incubatorScripts = [
  ['lab/incubator/lab-incubator-core.js', 'createOlingLabIncubatorCore'],
  ['lab/incubator/lab-incubator-info.js', 'createOlingLabIncubatorInfo'],
  [
    'lab/incubator/lab-incubator-incubation.js',
    'createOlingLabIncubatorIncubation'
  ],
  [
    'lab/incubator/lab-incubator-influences.js',
    'createOlingLabIncubatorInfluences'
  ]
];
const furnitureMenuScripts = [
  [
    'lab/furniture-menus/action-panels.js',
    'createOlingLabFurnitureActionPanels'
  ],
  [
    'lab/furniture-menus/placement-menu.js',
    'createOlingLabFurniturePlacementMenu'
  ],
  ['lab/furniture-menus/slot-tabs.js', 'createOlingLabFurnitureSlotTabs'],
  ['lab/furniture-menus/shelf-inventory.js', 'createOlingLabShelfInventory'],
  ['lab/furniture-menus/shelf-storage.js', 'createOlingLabShelfStorage']
];
const furniturePlacementScripts = [
  ['lab/furniture-placement/grid-state.js', 'createOlingLabFurnitureGridState'],
  ['lab/furniture-placement/mutations.js', 'createOlingLabFurnitureMutations'],
  [
    'lab/furniture-placement/art-and-placement.js',
    'createOlingLabFurnitureArtAndPlacement'
  ]
];

test('Oling Lab loads its own rarity palette', () => {
  const context = {
    window: {},
    document: {
      querySelector: () => null,
      getElementById: () => null
    }
  };
  runtimeSupportScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/core/lab-runtime.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-runtime.js' }
  );

  const runtime = context.window.createOlingLabRuntime();
  assert.equal(
    runtime.constants.RARITY_PALETTE_ENDPOINT,
    '/json-files/olings/rarities.json'
  );
});

test('Oling Lab feature modules register their composition factories', () => {
  const context = { window: {} };

  featureScripts.forEach(([fileName, factoryName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
    assert.equal(typeof context.window[factoryName], 'function', factoryName);
  });
});

test('inserted incubator items leave inventory and return when removed', () => {
  const context = { window: {} };
  const fileName = 'lab/data/inventory-selectors.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const eggSlot = {
    slotId: 'egg',
    slotType: 'egg',
    itemKey: 'base-egg',
    itemType: 'egg',
    placedAt: null,
    influenceSlots: [
      {
        slotKey: 'influence-1',
        itemKey: 'oling-blanket',
        itemType: 'consumable',
        consumedAt: null
      }
    ]
  };
  const state = {
    ownedEggs: [{ key: 'base-egg', quantity: 1 }],
    ownedConsumables: [{ key: 'oling-blanket', quantity: 1 }],
    lab: {
      placedItems: [
        {
          inventorySlots: [],
          containerSlots: [{ inventorySlots: [eggSlot] }]
        }
      ]
    }
  };
  const selectors = context.window.createOlingLabInventorySelectors({ state });

  assert.equal(selectors.getAvailableEggQuantity('base-egg'), 0);
  assert.equal(selectors.getAvailableConsumableQuantity('oling-blanket'), 0);
  eggSlot.itemKey = null;
  eggSlot.itemType = null;
  assert.equal(selectors.getAvailableEggQuantity('base-egg'), 1);
  assert.equal(selectors.getAvailableConsumableQuantity('oling-blanket'), 0);
  eggSlot.influenceSlots = [];
  assert.equal(selectors.getAvailableConsumableQuantity('oling-blanket'), 1);
});

test('Oling Lab generated controls opt into global interaction sounds', () => {
  const dom = new JSDOM('<!doctype html><body></body>');
  const context = {
    document: dom.window.document,
    window: {}
  };
  const fileName = 'lab/ui/ui-elements.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );

  const controls = context.window.createOlingLabUiElements({
    createImage: () => dom.window.document.createElement('img'),
    applyRarityTheme() {}
  });
  const item = controls.createItemButton({ name: 'Test item' });
  const action = controls.createInlineAction('Continue', () => {});
  const muted = controls.createInlineAction('Silent', () => {}, {
    sound: false
  });
  const details = controls.createStatsToggleButton('Details', () => {});
  const back = controls.createPanelBackButton('Back', () => {});

  assert.equal(item.dataset.soundIntent, 'select');
  assert.equal(action.dataset.soundIntent, 'select');
  assert.equal(muted.dataset.sound, 'none');
  assert.equal(details.dataset.soundIntent, 'open');
  assert.equal(back.dataset.soundIntent, 'previous');
});

test('Oling Lab shelves retain images for display-only legacy inventory', () => {
  const context = { window: {} };
  for (const fileName of [
    'lab/data/catalog-selectors.js',
    'lab/furniture-menus/shelf-inventory.js'
  ]) {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  }

  const state = {
    consumables: new Map(),
    ownedConsumables: [{ key: 'oling-cookie', quantity: 5 }],
    ownedEggs: []
  };
  const selectors = context.window.createOlingLabCatalogSelectors({ state });
  const shelf = context.window.createOlingLabShelfInventory({
    state,
    ...selectors,
    getAvailableEggQuantity: () => 0,
    getEggImage: () => '',
    createImage() {},
    createInlineAction() {},
    createPanelBackButton() {},
    openQuickSellDialog() {}
  });

  assert.deepEqual(JSON.parse(JSON.stringify(shelf.getShelfInventoryItems())), [
    {
      key: 'oling-cookie',
      type: 'consumable',
      name: 'Oling Cookie',
      image: '/images/olings/lab/consumables/mood/happiness/oling-cookie.svg',
      description: 'A consumable item for your Olings.',
      quantity: 5
    }
  ]);
});

test('Oling Lab Customise controls switch between wall and furniture modes', async () => {
  const dispatchedEvents = [];
  const createEventTarget = (dataset = {}) => {
    const listeners = new Map();
    return {
      dataset,
      classList: { add() {}, remove() {} },
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      trigger(type, event = {}) {
        listeners.get(type)?.(event);
      }
    };
  };
  const context = {
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    document: { addEventListener() {} },
    window: {
      addEventListener() {},
      dispatchEvent(event) {
        dispatchedEvents.push(event);
      }
    }
  };
  const fileName = 'lab/core/lab-events.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const editToggle = createEventTarget();
  const wallStyle = createEventTarget({
    olingLabCustomiseCategory: 'wall-style'
  });
  const wallDecorations = createEventTarget({
    olingLabCustomiseCategory: 'wall-decorations'
  });
  const furniture = createEventTarget({
    olingLabCustomiseCategory: 'furniture'
  });
  const calls = [];
  let delayFurnitureClose = false;
  let finishFurnitureClose = null;
  const state = {
    editMode: false,
    customiseCategory: null,
    camera: {}
  };

  context.window.bindOlingLabEvents({
    state,
    elements: {
      editToggle,
      customiseCategoryButtons: [wallStyle, wallDecorations, furniture],
      scrollLeft: createEventTarget(),
      scrollRight: createEventTarget(),
      viewport: createEventTarget(),
      room: createEventTarget(),
      backdrop: createEventTarget(),
      menu: createEventTarget(),
      menuClose: null
    },
    closeSelectedTarget: () => calls.push('close-selection'),
    ensureCameraFrame() {},
    panLabBy() {},
    zoomLabAt() {},
    clampCameraTarget() {},
    closeMenu: (options) => calls.push(['close-menu', options]),
    openWallpaperMenu: () => calls.push('wall-style'),
    openWallDecorationsMenu: () => calls.push('wall-decorations'),
    openFurniturePanel: () => calls.push('furniture-panel'),
    closeFurniturePanel: () => {
      calls.push('close-furniture-panel');
      if (!delayFurnitureClose) return undefined;
      return new Promise((resolve) => {
        finishFurnitureClose = resolve;
      });
    },
    renderLab: () => calls.push('render')
  });

  editToggle.trigger('click');
  assert.equal(state.editMode, true);
  assert.equal(state.customiseCategory, 'furniture');
  assert.ok(calls.includes('furniture-panel'));
  assert.ok(
    calls.some(
      (call) =>
        Array.isArray(call) &&
        call[0] === 'close-menu' &&
        call[1]?.force === true
    )
  );
  assert.equal(dispatchedEvents[0].detail.enabled, true);

  delayFurnitureClose = true;
  wallStyle.trigger('click');
  assert.equal(state.customiseCategory, 'wall-style');
  assert.equal(calls.includes('wall-style'), false);
  finishFurnitureClose();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(calls.includes('wall-style'));
  delayFurnitureClose = false;

  wallDecorations.trigger('click');
  assert.equal(state.customiseCategory, 'wall-decorations');
  assert.ok(calls.includes('wall-decorations'));

  furniture.trigger('click');
  assert.equal(state.customiseCategory, 'furniture');
  assert.ok(
    calls.some(
      (call) =>
        Array.isArray(call) &&
        call[0] === 'close-menu' &&
        call[1]?.force === true
    )
  );

  editToggle.trigger('click');
  assert.equal(state.editMode, false);
  assert.equal(state.customiseCategory, null);
  assert.equal(dispatchedEvents.at(-1).detail.enabled, false);
});

test('Oling Lab page exposes the three Customise categories', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );

  ['wall-style', 'wall-decorations', 'furniture'].forEach((category) => {
    assert.match(
      page,
      new RegExp(`data-oling-lab-customise-category="${category}"`)
    );
  });
  assert.match(page, />\s*Wall Style\s*</);
  assert.match(page, />\s*Wall Decorations\s*</);
  assert.match(page, />\s*Furniture\s*</);
  const customiseIndex = page.indexOf('id="oling-lab-edit-toggle"');
  const furnitureIndex = page.indexOf('id="oling-lab-furniture-toggle"');
  const decorationsIndex = page.indexOf(
    'id="oling-lab-wall-decorations-toggle"'
  );
  const wallStyleIndex = page.indexOf('id="oling-lab-wall-style-toggle"');
  assert.ok(customiseIndex < furnitureIndex);
  assert.ok(furnitureIndex < decorationsIndex);
  assert.ok(decorationsIndex < wallStyleIndex);
  assert.match(page, /id="oling-lab-wall-style-panel"/);
  assert.match(page, /id="oling-lab-wall-style-panel-toggle"/);
  assert.match(page, /id="oling-lab-wall-style-panel-content"/);
  assert.match(page, /id="oling-lab-wall-style-panel-footer"/);
  assert.match(page, /id="oling-lab-wall-decoration-panel"/);
  assert.match(page, /id="oling-lab-wall-decoration-panel-toggle"/);
  assert.match(page, /id="oling-lab-wall-decoration-inventory"/);
  assert.match(page, /id="oling-lab-wall-decoration-store-all"/);
  assert.match(page, /id="oling-lab-furniture-panel"/);
  assert.match(page, /id="oling-lab-furniture-panel-toggle"/);
  assert.match(page, /id="oling-lab-furniture-inventory"/);
  assert.match(page, /id="oling-lab-inspect-panel-tabs"/);
  assert.match(page, />\s*Store All\s*</);

  const document = new JSDOM(page).window.document;
  [
    'oling-lab-wall-style-panel-toggle',
    'oling-lab-wall-decoration-panel-toggle',
    'oling-lab-furniture-panel-toggle',
    'oling-lab-storage-panel-toggle'
  ].forEach((id) => {
    assert.equal(document.getElementById(id).dataset.sound, 'none');
  });
  [
    'oling-lab-edit-toggle',
    'oling-lab-wall-style-toggle',
    'oling-lab-wall-decorations-toggle',
    'oling-lab-furniture-toggle'
  ].forEach((id) => {
    assert.equal(document.getElementById(id).dataset.sound, 'none');
  });
});

test('Oling Lab keeps the storage panel but removes its dedicated toolbar button', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );

  assert.doesNotMatch(page, /id="oling-lab-storage-toggle"/);
  assert.match(page, /id="oling-lab-storage-panel"/);
  assert.match(page, /id="oling-lab-storage-panel-toggle"/);
  assert.match(page, /id="oling-lab-storage-panel-back"/);
  assert.match(page, /id="oling-lab-storage-panel-content"/);
  assert.doesNotMatch(page, /id="oling-lab-storage-panel-footer"/);
  assert.doesNotMatch(page, /id="oling-lab-storage-panel-close"/);
  const back = new JSDOM(page).window.document.getElementById(
    'oling-lab-storage-panel-back'
  );
  assert.equal(back.dataset.sound, 'none');
  assert.equal(back.textContent.trim(), 'Close');
  assert.equal(back.classList.contains('is-close'), true);
  assert.equal(back.getAttribute('aria-label'), 'Close Pod Rack menu');
});

test('Oling Lab exposes Rest as a side panel with separate hide and close controls', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const document = new JSDOM(page).window.document;
  const panel = document.getElementById('oling-lab-rest-panel');
  const toggle = document.getElementById('oling-lab-rest-panel-toggle');
  const close = document.getElementById('oling-lab-rest-panel-close');

  assert.ok(panel);
  assert.equal(panel.hidden, true);
  assert.equal(toggle.textContent.trim(), 'Hide');
  assert.equal(close.textContent.trim(), 'Close');
  assert.equal(close.classList.contains('is-close'), true);
  assert.equal(close.getAttribute('aria-label'), 'Close Rest menu');
  assert.ok(document.getElementById('oling-lab-rest-panel-content'));
  assert.ok(document.getElementById('oling-lab-rest-panel-footer'));
});

test('Oling Lab exposes Explorer Gateway as a tabbed side panel', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const document = new JSDOM(page).window.document;
  const panel = document.getElementById('oling-lab-gateway-panel');
  const toggle = document.getElementById('oling-lab-gateway-panel-toggle');
  const close = document.getElementById('oling-lab-gateway-panel-close');

  assert.ok(panel);
  assert.equal(panel.hidden, true);
  assert.equal(toggle.textContent.trim(), 'Hide');
  assert.equal(close.textContent.trim(), 'Close');
  assert.equal(close.classList.contains('is-close'), true);
  assert.equal(close.getAttribute('aria-label'), 'Close Explorer Gateway menu');
  assert.ok(document.getElementById('oling-lab-gateway-panel-tabs'));
  assert.ok(document.getElementById('oling-lab-gateway-panel-content'));
  assert.ok(document.getElementById('oling-lab-gateway-panel-footer'));
});

test('Oling Lab furniture drawer waits before dragging and survives room renders', async () => {
  const dom = new JSDOM(`
    <main>
      <div id="room">
        <div class="oling-lab-cell" data-oling-lab-row="0" data-oling-lab-col="0"><button class="oling-lab-plus">+</button></div>
        <div class="oling-lab-cell" data-oling-lab-row="0" data-oling-lab-col="1"><button class="oling-lab-plus">+</button></div>
        <div class="oling-lab-cell" data-oling-lab-row="1" data-oling-lab-col="0"><button class="oling-lab-plus">+</button></div>
        <div class="oling-lab-cell" data-oling-lab-row="1" data-oling-lab-col="1"><button class="oling-lab-plus">+</button></div>
      </div>
      <aside id="panel" hidden>
        <button id="toggle"></button>
        <div id="inventory"></div>
      </aside>
    </main>
  `);
  const context = {
    Date,
    Map,
    Math,
    Set,
    document: dom.window.document,
    window: dom.window
  };
  const panelSounds = [];
  dom.window.playSoundEffect = (key) => panelSounds.push(key);
  const fileName = 'lab/furniture-placement/furniture-panel.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const document = dom.window.document;
  const room = document.getElementById('room');
  const panel = document.getElementById('panel');
  const item = {
    id: 'bed',
    name: 'Oling Bed',
    image: '/bed.svg',
    layer: 'room',
    width: 1,
    height: 1
  };
  const placed = new Set();
  const placements = [];
  const storedPlacements = [];
  const state = {
    editMode: true,
    customiseCategory: 'furniture',
    furniturePanelOpen: false,
    furniturePanelCollapsed: false,
    owned: new Set([item.id]),
    lab: { columns: 2, placedItems: [] }
  };
  dom.window.requestAnimationFrame = (callback) => callback();
  room.querySelector('.oling-lab-cell').getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100
  });
  panel.getBoundingClientRect = () => ({
    left: 300,
    right: 600,
    top: 0,
    bottom: 800
  });
  const furniture = context.window.createOlingLabFurniturePanel({
    state,
    elements: {
      room,
      furniturePanel: panel,
      furniturePanelToggle: document.getElementById('toggle'),
      furniturePanelInventory: document.getElementById('inventory')
    },
    rows: 2,
    dragHoldDelay: 20,
    furnitureTheme: {
      primaryColour: '#B7EBE8',
      secondaryColour: '#63C7C2'
    },
    getItem: (itemId) => (itemId === item.id ? item : null),
    isPlaced: (itemId) => placed.has(itemId),
    getAnchorRow: (_item, row) => row,
    canPlaceRoomItem: (_item, row, col) => row === 0 && col === 1,
    canMoveRoomItem: () => true,
    placeRoomItem(itemId, row, col) {
      placed.add(itemId);
      placements.push({ itemId, row, col });
    },
    moveRoomItem() {},
    storeRoomItem(placedId) {
      placed.delete(item.id);
      storedPlacements.push(placedId);
    },
    createImage(src, alt) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = alt;
      return image;
    },
    createFurnitureArt(currentItem) {
      const art = document.createElement('div');
      art.className = 'oling-lab-furniture-art';
      art.appendChild(
        Object.assign(document.createElement('img'), {
          src: currentItem.image
        })
      );
      return art;
    },
    setStatus() {}
  });
  const pointerEvent = (type, clientX, clientY) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };

  assert.equal(
    room.style.getPropertyValue('--furniture-primary-colour'),
    '#B7EBE8'
  );
  assert.equal(
    panel.style.getPropertyValue('--wall-decoration-panel-primary'),
    '#B7EBE8'
  );
  assert.equal(
    panel.style.getPropertyValue('--wall-decoration-panel-secondary'),
    '#63C7C2'
  );
  assert.equal(
    room.style.getPropertyValue('--furniture-secondary-colour'),
    '#63C7C2'
  );

  furniture.openFurniturePanel();
  assert.deepEqual(
    panelSounds.filter((key) => key.startsWith('sidePanel')),
    ['sidePanelOpen']
  );
  furniture.openFurniturePanel();
  assert.deepEqual(
    panelSounds.filter((key) => key.startsWith('sidePanel')),
    ['sidePanelOpen']
  );
  const card = document.querySelector('.oling-lab-furniture-card');
  assert.ok(card);
  assert.equal(card.disabled, false);
  card.dispatchEvent(pointerEvent('pointerdown', 350, 100));
  dom.window.dispatchEvent(pointerEvent('pointermove', 150, 50));
  assert.equal(document.querySelector('.oling-lab-furniture-drag-ghost'), null);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 25));

  const preview = room.querySelector('.oling-lab-furniture-drag-preview');
  assert.ok(preview);
  assert.equal(preview.style.getPropertyValue('--item-row'), '0');
  assert.equal(preview.style.getPropertyValue('--item-col'), '1');
  assert.equal(
    room
      .querySelector('[data-oling-lab-row="0"][data-oling-lab-col="1"]')
      .classList.contains('is-furniture-drag-target'),
    true
  );
  assert.equal(
    document
      .querySelector('.oling-lab-furniture-drag-ghost')
      .classList.contains('is-snapped'),
    true
  );

  dom.window.dispatchEvent(pointerEvent('pointerup', 150, 50));
  assert.deepEqual(placements, [{ itemId: 'bed', row: 0, col: 1 }]);
  assert.equal(room.querySelector('.oling-lab-furniture-drag-preview'), null);
  assert.equal(
    document.querySelector('.oling-lab-furniture-card').disabled,
    true
  );

  const placedElement = document.createElement('div');
  placedElement.className = 'oling-lab-item';
  placedElement.dataset.olingLabPlacedId = 'placed-bed';
  room.appendChild(placedElement);
  const originalBodyAppendChild = document.body.appendChild;
  let placedGhostClassAtAppend = '';
  document.body.appendChild = function appendChild(node) {
    if (node.classList?.contains('oling-lab-furniture-drag-ghost')) {
      placedGhostClassAtAppend = node.className;
    }
    return originalBodyAppendChild.call(this, node);
  };
  furniture.beginFurnitureDrag(
    pointerEvent('pointerdown', 150, 50),
    {
      placedId: 'placed-bed',
      itemId: item.id,
      row: 0,
      col: 1,
      locked: false
    },
    placedElement
  );
  assert.equal(document.querySelector('.oling-lab-furniture-drag-ghost'), null);
  await new Promise((resolve) => dom.window.setTimeout(resolve, 25));
  document.body.appendChild = originalBodyAppendChild;
  assert.match(placedGhostClassAtAppend, /\bis-snapped\b/);

  const regeneratedElement = document.createElement('div');
  regeneratedElement.className = 'oling-lab-item';
  regeneratedElement.dataset.olingLabPlacedId = 'placed-bed';
  placedElement.remove();
  room.querySelector('.oling-lab-furniture-drag-preview').remove();
  room.appendChild(regeneratedElement);
  furniture.syncFurnitureDragAfterRender();
  assert.equal(
    regeneratedElement.classList.contains('is-furniture-dragging'),
    true
  );
  assert.ok(room.querySelector('.oling-lab-furniture-drag-preview'));
  dom.window.dispatchEvent(pointerEvent('pointermove', 350, 100));

  assert.equal(panel.classList.contains('is-drop-target'), true);
  assert.equal(
    document
      .querySelector('.oling-lab-furniture-drag-ghost')
      .classList.contains('is-over-storage'),
    true
  );

  dom.window.dispatchEvent(pointerEvent('pointerup', 350, 100));
  assert.deepEqual(storedPlacements, ['placed-bed']);
  assert.equal(panel.classList.contains('is-drop-target'), false);
  assert.equal(document.querySelector('.oling-lab-furniture-drag-ghost'), null);
  assert.equal(
    regeneratedElement.classList.contains('is-furniture-dragging'),
    false
  );
  assert.equal(
    document.querySelector('.oling-lab-furniture-card').disabled,
    false
  );
  const panelToggle = document.getElementById('toggle');
  assert.equal(panelToggle.dataset.sound, 'none');
  panelToggle.click();
  assert.deepEqual(
    panelSounds.filter((key) => key.startsWith('sidePanel')),
    ['sidePanelOpen', 'sidePanelClose']
  );
  panelToggle.click();
  assert.deepEqual(
    panelSounds.filter((key) => key.startsWith('sidePanel')),
    ['sidePanelOpen', 'sidePanelClose', 'sidePanelOpen']
  );
});

test('Oling Lab swaps furniture only when both new footprints are valid', () => {
  const dom = new JSDOM('<div></div>');
  const context = {
    CustomEvent: dom.window.CustomEvent,
    Date,
    Map,
    Math,
    Set,
    window: dom.window
  };
  ['grid-state.js', 'mutations.js'].forEach((fileName) => {
    const scriptPath = `lab/furniture-placement/${fileName}`;
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, scriptPath), 'utf8'),
      context,
      { filename: scriptPath }
    );
  });

  const catalog = new Map([
    [
      'small',
      {
        id: 'small',
        layer: 'room',
        width: 1,
        height: 1,
        allowedRows: [0, 1]
      }
    ],
    [
      'wide',
      {
        id: 'wide',
        layer: 'room',
        width: 2,
        height: 1,
        allowedRows: [0, 1]
      }
    ],
    [
      'blocker',
      {
        id: 'blocker',
        layer: 'room',
        width: 1,
        height: 1,
        allowedRows: [0, 1]
      }
    ]
  ]);
  const first = {
    placedId: 'placed-small',
    itemId: 'small',
    row: 0,
    col: 0,
    width: 1,
    height: 1,
    locked: false
  };
  const second = {
    placedId: 'placed-wide',
    itemId: 'wide',
    row: 1,
    col: 2,
    width: 2,
    height: 1,
    locked: false
  };
  const state = {
    owned: new Set(catalog.keys()),
    lab: { columns: 4, placedItems: [first, second] }
  };
  const getItem = (itemId) => catalog.get(itemId);
  const gridState = context.window.createOlingLabFurnitureGridState({
    state,
    rows: 2,
    getItem,
    isPlaced: () => true
  });
  const swap = gridState.getRoomItemSwap(first, second);
  assert.deepEqual(
    { ...swap.first },
    { placedId: 'placed-small', row: 1, col: 2 }
  );
  assert.deepEqual(
    { ...swap.second },
    { placedId: 'placed-wide', row: 0, col: 0 }
  );

  let renderCount = 0;
  let saveCount = 0;
  const mutations = context.window.createOlingLabFurnitureMutations({
    state,
    getItem,
    isPlaced: () => true,
    closeMenu() {},
    closeSelectedTarget() {},
    renderLab() {
      renderCount += 1;
    },
    saveLab() {
      saveCount += 1;
    },
    gridState
  });
  assert.equal(mutations.swapRoomItems(first.placedId, second.placedId), true);
  assert.deepEqual(
    [first.row, first.col, second.row, second.col],
    [1, 2, 0, 0]
  );
  assert.equal(renderCount, 1);
  assert.equal(saveCount, 1);

  Object.assign(first, { row: 0, col: 0 });
  Object.assign(second, { row: 1, col: 2 });
  state.lab.placedItems.push({
    placedId: 'placed-blocker',
    itemId: 'blocker',
    row: 0,
    col: 1,
    width: 1,
    height: 1,
    locked: false
  });
  assert.equal(gridState.getRoomItemSwap(first, second), null);
  assert.equal(mutations.swapRoomItems(first.placedId, second.placedId), false);
  assert.deepEqual(
    [first.row, first.col, second.row, second.col],
    [0, 0, 1, 2]
  );
  assert.equal(renderCount, 1);
  assert.equal(saveCount, 1);
});

test('Oling Lab uses furniture placement sounds with a global fallback', () => {
  const dom = new JSDOM('<div></div>');
  const playedSounds = [];
  const context = {
    CustomEvent: dom.window.CustomEvent,
    Date,
    Promise,
    window: {
      dispatchEvent() {},
      playSoundEffect(soundKey) {
        playedSounds.push(soundKey);
      }
    }
  };
  const fileName = 'lab/furniture-placement/mutations.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );

  const parent = {
    placedId: 'parent',
    itemId: 'parent',
    containerSlots: [{ slotId: 'attachment', itemId: null }]
  };
  const swapTarget = {
    placedId: 'placed-swap-target',
    itemId: 'swap-target',
    row: 0,
    col: 2
  };
  const catalog = new Map([
    [
      'table',
      {
        id: 'table',
        type: 'table',
        width: 1,
        height: 1,
        sounds: { placed: 'olingLabFurnitureTablePlaced' }
      }
    ],
    ['attachment', { id: 'attachment', type: 'attachment' }],
    ['swap-target', { id: 'swap-target', type: 'storage' }]
  ]);
  const state = {
    lab: { placedItems: [parent, swapTarget] },
    owned: new Set(),
    olings: []
  };
  const mutations = context.window.createOlingLabFurnitureMutations({
    state,
    getItem: (itemId) => catalog.get(itemId),
    isPlaced: () => false,
    closeMenu() {},
    closeSelectedTarget() {},
    renderLab() {},
    saveLab() {},
    gridState: {
      canPlaceRoomItem: () => true,
      canMoveRoomItem: () => true,
      createPlacedId: (itemId) => `placed-${itemId}`,
      getAnchorRow: (_item, row) => row,
      getRoomItemSwap: (first, second) => ({
        first: { row: second.row, col: second.col },
        second: { row: first.row, col: first.col }
      })
    }
  });

  mutations.placeRoomItem('table', 0, 0);
  mutations.moveRoomItem('placed-table', 0, 1);
  mutations.swapRoomItems('placed-table', 'placed-swap-target');
  mutations.placeContainerItem('parent', 'attachment', 'attachment');

  assert.deepEqual(playedSounds, [
    'olingLabFurnitureTablePlaced',
    'olingLabFurnitureTablePlaced',
    'olingLabFurnitureTablePlaced',
    'uiDragPlace'
  ]);
});

test('Oling Lab keeps occupied storage and incubators placed', () => {
  const dom = new JSDOM('<div></div>');
  const context = {
    CustomEvent: dom.window.CustomEvent,
    Date,
    window: dom.window
  };
  const fileName = 'lab/furniture-placement/mutations.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const shelf = {
    placedId: 'placed-shelf',
    itemId: 'supply_shelf',
    locked: false,
    inventorySlots: [],
    containerSlots: []
  };
  const table = {
    placedId: 'placed-table',
    itemId: 'standard_table',
    locked: false,
    inventorySlots: [],
    containerSlots: [
      {
        slotId: 'tabletop',
        itemId: 'incubeta',
        inventorySlots: [
          {
            slotId: 'egg',
            itemKey: 'base_egg',
            quantity: 1,
            influenceSlots: []
          }
        ]
      }
    ]
  };
  const catalog = new Map([
    [
      'supply_shelf',
      {
        id: 'supply_shelf',
        name: 'Supply Shelf',
        inventorySlots: [{ slotId: 'shelf-1', slotType: 'storage' }]
      }
    ],
    ['standard_table', { id: 'standard_table', name: 'Standard Table' }],
    ['incubeta', { id: 'incubeta', name: 'Incubeta' }]
  ]);
  const statuses = [];
  let saveCount = 0;
  const state = {
    owned: new Set(),
    ownedEggs: [{ key: 'base_egg', quantity: 1 }],
    ownedConsumables: [],
    olings: [],
    lab: { placedItems: [shelf, table] }
  };
  const mutations = context.window.createOlingLabFurnitureMutations({
    state,
    getItem: (itemId) => catalog.get(itemId),
    closeMenu() {},
    closeSelectedTarget() {},
    renderLab() {},
    saveLab() {
      saveCount += 1;
    },
    setStatus(message) {
      statuses.push(message);
    }
  });

  assert.equal(mutations.storeRoomItem(shelf.placedId), false);
  assert.match(statuses.at(-1), /Remove every item from Supply Shelf/);
  assert.equal(mutations.storeRoomItem(table.placedId), false);
  assert.match(statuses.at(-1), /Remove every attached item/);
  assert.equal(mutations.storeContainerItem(table.placedId, 'tabletop'), false);
  assert.match(statuses.at(-1), /Remove every item from Incubeta/);
  assert.equal(state.lab.placedItems.length, 2);
  assert.equal(table.containerSlots[0].itemId, 'incubeta');
  assert.equal(saveCount, 0);
});

test('Oling Lab completes stationary furniture drops and valid hover swaps', () => {
  const dom = new JSDOM(`
    <div id="room">
      <div class="oling-lab-cell" data-oling-lab-row="0" data-oling-lab-col="0"></div>
      <div class="oling-lab-cell" data-oling-lab-row="0" data-oling-lab-col="1"></div>
    </div>
    <aside id="panel"><button id="toggle"></button><div id="inventory"></div></aside>
  `);
  const context = {
    Date,
    Map,
    Math,
    Set,
    document: dom.window.document,
    window: dom.window
  };
  const scriptPath = 'lab/furniture-placement/furniture-panel.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, scriptPath), 'utf8'),
    context,
    { filename: scriptPath }
  );

  const document = dom.window.document;
  const room = document.getElementById('room');
  room.querySelector('.oling-lab-cell').getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100
  });
  const source = {
    placedId: 'placed-source',
    itemId: 'source',
    row: 0,
    col: 0,
    width: 1,
    height: 1,
    locked: false
  };
  const target = {
    placedId: 'placed-target',
    itemId: 'target',
    row: 0,
    col: 1,
    width: 1,
    height: 1,
    locked: false
  };
  const catalog = new Map([
    [
      'source',
      { id: 'source', name: 'Source', layer: 'room', width: 1, height: 1 }
    ],
    [
      'target',
      { id: 'target', name: 'Target', layer: 'room', width: 1, height: 1 }
    ]
  ]);
  const sourceElement = Object.assign(document.createElement('div'), {
    className: 'oling-lab-item'
  });
  sourceElement.dataset.olingLabPlacedId = source.placedId;
  const targetElement = Object.assign(document.createElement('div'), {
    className: 'oling-lab-item'
  });
  targetElement.dataset.olingLabPlacedId = target.placedId;
  room.append(sourceElement, targetElement);

  const completedMoves = [];
  const completedSwaps = [];
  const furniture = context.window.createOlingLabFurniturePanel({
    state: {
      editMode: true,
      customiseCategory: 'furniture',
      furniturePanelOpen: false,
      furniturePanelCollapsed: false,
      owned: new Set(catalog.keys()),
      lab: { columns: 2, placedItems: [source, target] }
    },
    elements: {
      room,
      furniturePanel: document.getElementById('panel'),
      furniturePanelToggle: document.getElementById('toggle'),
      furniturePanelInventory: document.getElementById('inventory')
    },
    rows: 1,
    dragHoldDelay: 0,
    getItem: (itemId) => catalog.get(itemId),
    isPlaced: () => true,
    getAnchorRow: (_item, row) => row,
    canPlaceRoomItem: () => false,
    canMoveRoomItem: () => true,
    getOccupiedMap: () =>
      new Map([
        ['0:0', source],
        ['0:1', target]
      ]),
    getRoomItemSwap: (first, second) =>
      first.placedId === source.placedId && second.placedId === target.placedId
        ? {
            first: { placedId: first.placedId, row: 0, col: 1 },
            second: { placedId: second.placedId, row: 0, col: 0 }
          }
        : null,
    placeRoomItem() {},
    moveRoomItem(placedId, row, col) {
      completedMoves.push([placedId, row, col]);
    },
    swapRoomItems(firstPlacedId, secondPlacedId) {
      completedSwaps.push([firstPlacedId, secondPlacedId]);
      return true;
    },
    storeRoomItem() {},
    createImage: () => document.createElement('img'),
    createFurnitureArt(item) {
      const art = document.createElement('div');
      art.dataset.itemId = item.id;
      return art;
    },
    setStatus() {}
  });
  const pointerEvent = (type, clientX, clientY) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };

  furniture.beginFurnitureDrag(
    pointerEvent('pointerdown', 50, 50),
    source,
    sourceElement
  );
  dom.window.dispatchEvent(pointerEvent('pointerup', 50, 50));
  assert.deepEqual(completedMoves, [['placed-source', 0, 0]]);

  furniture.beginFurnitureDrag(
    pointerEvent('pointerdown', 50, 50),
    source,
    sourceElement
  );
  dom.window.dispatchEvent(pointerEvent('pointermove', 150, 50));

  const previews = room.querySelectorAll('.oling-lab-furniture-drag-preview');
  assert.equal(previews.length, 2);
  assert.equal(
    targetElement.classList.contains('is-furniture-swap-target'),
    true
  );
  assert.equal(
    room
      .querySelector('.is-furniture-swap-preview')
      .style.getPropertyValue('--item-col'),
    '0'
  );
  assert.equal(
    [...previews]
      .find(
        (preview) => !preview.classList.contains('is-furniture-swap-preview')
      )
      .style.getPropertyValue('--item-col'),
    '1'
  );

  dom.window.dispatchEvent(pointerEvent('pointerup', 150, 50));
  assert.deepEqual(completedSwaps, [['placed-source', 'placed-target']]);
  assert.equal(room.querySelector('.oling-lab-furniture-drag-preview'), null);
  assert.equal(
    targetElement.classList.contains('is-furniture-swap-target'),
    false
  );
});

test('Oling Lab renders one purchase control for an entire locked column', () => {
  const dom = new JSDOM('<div id="grid"></div>');
  const context = {
    document: dom.window.document,
    window: dom.window
  };
  const fileName = 'lab/room/lab-renderer.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const openedColumns = [];
  const renderer = context.window.createOlingLabRenderer({
    state: {
      editMode: true,
      customiseCategory: 'furniture'
    },
    rows: 2,
    isLabCellUnlocked: (_row, col) => col === 0,
    getLabExpansionColumn: (col) =>
      col === 1 ? { col, price: 150, eligible: true } : null,
    openLabColumnPurchaseDialog(col) {
      openedColumns.push(col);
    }
  });
  const grid = dom.window.document.getElementById('grid');

  grid.appendChild(renderer.renderCells(2, new Map()));

  const purchases = grid.querySelectorAll('.oling-lab-expansion-purchase');
  assert.equal(purchases.length, 1);
  assert.equal(purchases[0].parentElement.dataset.olingLabRow, '0');
  assert.equal(purchases[0].parentElement.dataset.olingLabCol, '1');
  assert.equal(
    purchases[0].getAttribute('aria-label'),
    'Unlock lab column 2 for 150 Opals'
  );
  purchases[0].click();
  assert.deepEqual(openedColumns, [1]);
});

test('Oling Lab purchases a whole column with one request', async () => {
  const dom = new JSDOM('<body></body>');
  let request;
  const payload = {
    message: 'Olings Lab column unlocked.',
    lab: { columns: 4 },
    expansion: { balance: 50, columns: [] },
    purchase: {
      col: 3,
      cellKeys: ['0:3', '1:3'],
      price: 150,
      balanceAfter: 50
    }
  };
  const context = {
    console,
    document: dom.window.document,
    window: dom.window,
    fetch: async (url, options) => {
      request = { url, options };
      return {};
    }
  };
  const fileName = 'lab/purchases/lab-expansion.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const state = {
    expansion: { balance: 200, columns: [] },
    expanding: false
  };
  const tools = context.window.createOlingLabExpansionPurchase({
    state,
    labExpansionEndpoint: '/api/olings/lab/expand',
    setStatus() {},
    parsePayload: async () => payload,
    getLabExpansionColumn: (col) => ({ col, price: 150 }),
    openSharedPopup() {},
    renderLab() {},
    syncAccountPayload() {},
    dialogUi: {
      closePurchaseDialogs() {},
      createOpalValue(value) {
        return Object.assign(dom.window.document.createElement('span'), {
          textContent: String(value)
        });
      },
      createPurchaseRow(label, value) {
        return Object.assign(dom.window.document.createElement('div'), {
          textContent: `${label}: ${value}`
        });
      }
    }
  });

  tools.openLabColumnPurchaseDialog(3);
  assert.equal(
    dom.window.document.querySelector('.oe-purchase-title').textContent,
    'Buy this column?'
  );
  dom.window.document.querySelector('.oe-purchase-confirm').click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(request.url, '/api/olings/lab/expand');
  assert.deepEqual(JSON.parse(request.options.body), { col: 3 });
  assert.equal(state.lab.columns, 4);
  assert.equal(state.expansion.balance, 50);
  assert.equal(
    dom.window.document.querySelector('.oe-purchase-detail').textContent,
    'Column 4'
  );
});

test('Oling Lab furniture view renders drag handles and store controls', () => {
  const dom = new JSDOM('<div id="room"></div>');
  const context = {
    document: dom.window.document,
    window: dom.window
  };
  const fileName = 'lab/room/lab-renderer.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const document = dom.window.document;
  const item = {
    id: 'bed',
    name: 'Oling Bed',
    type: 'sleep-pod',
    width: 1,
    height: 1,
    inventorySlots: []
  };
  const placed = {
    placedId: 'placed-bed',
    itemId: item.id,
    row: 0,
    col: 0,
    width: 1,
    height: 1,
    locked: false,
    containerSlots: []
  };
  const state = {
    editMode: true,
    customiseCategory: 'furniture',
    lab: { placedItems: [placed] }
  };
  let dragCount = 0;
  let storeCount = 0;
  let selectionCount = 0;
  const renderer = context.window.createOlingLabRenderer({
    state,
    rows: 2,
    isLabCellUnlocked: () => true,
    getLabExpansionColumn: () => null,
    getItem: () => item,
    getFurnitureInteractionAction: () => ({ theme: 'care-mood' }),
    resolveMenuConfig: () => ({
      primaryColour: '#FFE0C7',
      secondaryColour: '#E89B70'
    }),
    isTargetSelected: () => false,
    toggleSelectedTarget() {
      selectionCount += 1;
    },
    createFurnitureArt() {
      return document.createElement('div');
    },
    getShelfInventoryItems: () => [],
    createImage: () => document.createElement('img'),
    canUseLabInteraction: (interaction) => interaction === 'furnitureDragging',
    beginFurnitureDrag() {
      dragCount += 1;
    },
    storeFurnitureFromCustomise() {
      storeCount += 1;
    }
  });
  const insertionGrid = document.createElement('div');
  insertionGrid.appendChild(renderer.renderCells(2, new Map()));
  const insertion = insertionGrid.querySelector('.oling-lab-plus');
  assert.equal(insertion.tagName, 'SPAN');
  assert.equal(insertion.getAttribute('aria-hidden'), 'true');
  assert.equal(insertionGrid.querySelector('button.oling-lab-plus'), null);

  const occupiedGrid = document.createElement('div');
  occupiedGrid.appendChild(renderer.renderCells(2, new Map([['0:0', placed]])));
  assert.equal(
    occupiedGrid
      .querySelector('[data-oling-lab-row="0"][data-oling-lab-col="0"]')
      .classList.contains('is-furniture-occupied'),
    true
  );
  occupiedGrid.querySelector('.oling-lab-cell-hit').click();
  assert.equal(selectionCount, 0);
  assert.equal(occupiedGrid.querySelector('.is-furniture-internal-edge'), null);

  const room = document.getElementById('room');
  room.appendChild(renderer.renderItems());
  const handle = room.querySelector('.oling-lab-furniture-handle');
  const remove = room.querySelector('.oling-lab-furniture-remove');
  const footprintLabel = room.querySelector(
    '.oling-lab-furniture-footprint-label'
  );
  assert.ok(handle);
  assert.ok(remove);
  assert.ok(footprintLabel);
  assert.equal(
    footprintLabel.querySelector('.oling-lab-furniture-footprint-type')
      .textContent,
    'Sleep Pod'
  );
  assert.equal(
    footprintLabel.querySelector('.oling-lab-furniture-footprint-name')
      .textContent,
    'Oling Bed'
  );
  assert.equal(footprintLabel.getAttribute('aria-hidden'), 'true');
  assert.equal(
    handle.parentElement.style.getPropertyValue(
      '--furniture-footprint-primary-colour'
    ),
    '#FFE0C7'
  );
  assert.equal(
    handle.parentElement.style.getPropertyValue(
      '--furniture-footprint-secondary-colour'
    ),
    '#E89B70'
  );
  assert.equal(handle.parentElement.inert, false);

  const pointerDown = new dom.window.MouseEvent('pointerdown', {
    bubbles: true,
    button: 0
  });
  Object.defineProperties(pointerDown, {
    isPrimary: { value: true },
    pointerId: { value: 1 },
    pointerType: { value: 'mouse' }
  });
  handle.dispatchEvent(pointerDown);
  handle.click();
  remove.click();
  assert.equal(dragCount, 1);
  assert.equal(storeCount, 1);
  assert.equal(selectionCount, 0);

  state.customiseCategory = 'wall-decorations';
  room.replaceChildren(renderer.renderItems());
  assert.equal(room.querySelector('.oling-lab-furniture-handle'), null);
  assert.equal(room.querySelector('.oling-lab-furniture-remove'), null);
});

test('Oling Lab presentation globally hides Olings throughout Customise mode', () => {
  const context = {
    Map,
    Set,
    window: { location: { pathname: '/olings/lab' } }
  };
  [
    'lab/core/lab-config.js',
    'lab/core/lab-state.js',
    'lab/core/lab-presentation.js'
  ].forEach((fileName) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });

  const constants = context.window.createOlingLabConfig(
    context.window.location
  );
  const state = context.window.createOlingLabState(constants, false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(constants.OLING_CONTAINER_THEMES['wall-style'])),
    { primaryColour: '#FFD0C2', secondaryColour: '#FF9F80' }
  );
  assert.equal(
    constants.OLING_CONTAINER_THEMES['wall-decorations'].primaryColour,
    '#C9BEFF'
  );
  assert.equal(
    constants.OLING_CONTAINER_THEMES['wall-decorations'].secondaryColour,
    '#9D8AFF'
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(constants.OLING_CONTAINER_THEMES.furniture)),
    { primaryColour: '#B7EBE8', secondaryColour: '#63C7C2' }
  );
  assert.equal(constants.OLING_VISIBILITY_CONTEXTS.CUSTOMISE, 'customise');
  assert.equal(constants.LAB_DRAG_HOLD_DELAY_MS, 220);
  assert.equal(constants.OLING_VISIBILITY_CONTEXTS.WALL_DECORATIONS, undefined);
  assert.equal(constants.LAB_PRESENTATION_MODES, undefined);
  const presentation = context.window.createOlingLabPresentation({
    state,
    constants
  });

  assert.equal(presentation.canUseLabInteraction('furnitureMenus'), true);

  const visitorConstants = context.window.createOlingLabConfig({
    pathname: '/olings/lab/Alice'
  });
  const visitorState = context.window.createOlingLabState(
    visitorConstants,
    false
  );
  const visitorPresentation = context.window.createOlingLabPresentation({
    state: visitorState,
    constants: visitorConstants
  });
  assert.equal(visitorConstants.VISITOR_MODE, true);
  assert.equal(visitorConstants.VISITOR_USERNAME, 'Alice');
  assert.equal(visitorConstants.LAB_ENDPOINT, '/api/olings/labs/Alice');
  assert.equal(visitorPresentation.canUseLabInteraction('camera'), true);
  assert.equal(
    visitorPresentation.canUseLabInteraction('olingInteractions'),
    false
  );
  assert.equal(
    visitorPresentation.canUseLabInteraction('furnitureDragging'),
    false
  );
  state.editMode = true;
  state.customiseCategory = 'furniture';
  presentation.syncCustomisePresentation();
  assert.equal(presentation.canUseLabInteraction('furnitureMenus'), false);
  assert.equal(presentation.canUseLabInteraction('furnitureDragging'), true);
  assert.equal(presentation.shouldRenderOlings(), false);

  state.customiseCategory = 'wall-style';
  presentation.syncCustomisePresentation();
  assert.equal(presentation.shouldRenderOlings(), false);

  state.customiseCategory = 'wall-decorations';
  presentation.syncCustomisePresentation();
  assert.equal(presentation.canUseLabInteraction('furnitureMenus'), false);
  assert.equal(presentation.canUseLabInteraction('olingMenus'), false);
  assert.equal(presentation.canUseLabInteraction('wallDecorations'), true);
  assert.equal(presentation.shouldRenderOlings(), false);

  presentation.setOlingsHidden('preview', true);
  state.editMode = false;
  state.customiseCategory = null;
  presentation.syncCustomisePresentation();
  assert.equal(presentation.shouldRenderOlings(), false);
  presentation.setOlingsHidden('preview', false);
  assert.equal(presentation.shouldRenderOlings(), true);
});

test('Oling Lab wall-decoration drawer toggles and confirms storing everything', () => {
  const dom = new JSDOM(`
    <main>
      <div id="room"><div class="oling-lab-cell"></div></div>
      <aside id="panel" hidden>
        <button id="toggle"></button>
        <div id="inventory"></div>
        <button id="store-all"></button>
      </aside>
    </main>
  `);
  const context = {
    Date,
    JSON,
    Map,
    Math,
    document: dom.window.document,
    window: dom.window
  };
  const panelSounds = [];
  dom.window.playSoundEffect = (key) => panelSounds.push(key);
  const fileName = 'lab/wall-decorations/wall-decorations.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const document = dom.window.document;
  const state = {
    editMode: true,
    customiseCategory: 'wall-decorations',
    wallDecorationPanelCollapsed: false,
    wallDecorations: new Map([
      [
        'poster',
        {
          id: 'poster',
          name: 'Oling Clash Beta Poster',
          type: 'poster',
          image: '/poster.svg',
          width: 1,
          height: 1
        }
      ]
    ]),
    ownedWallDecorations: new Map([['poster', 1]]),
    catalog: new Map(),
    lab: {
      columns: 4,
      placedItems: [],
      placedWallDecorations: [
        {
          placedId: 'placed-poster',
          itemId: 'poster',
          anchorRow: 0,
          anchorCol: 0,
          offsetX: 0.5,
          offsetY: 0.5
        }
      ]
    }
  };
  let saveCount = 0;
  let openPanelFrame = null;
  dom.window.requestAnimationFrame = (callback) => {
    openPanelFrame = callback;
    return 1;
  };
  const panel = document.getElementById('panel');
  const decorations = context.window.createOlingLabWallDecorations({
    state,
    elements: {
      room: document.getElementById('room'),
      wallDecorationPanel: panel,
      wallDecorationPanelToggle: document.getElementById('toggle'),
      wallDecorationPanelInventory: document.getElementById('inventory'),
      wallDecorationStoreAll: document.getElementById('store-all')
    },
    rows: 2,
    dragHoldDelay: 0,
    wallDecorationTheme: {
      primaryColour: '#C9BEFF',
      secondaryColour: '#9D8AFF'
    },
    isLabCellUnlocked: () => true,
    createImage(src, alt) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = alt;
      return image;
    },
    openSharedPopup() {},
    closeSharedPopup(dialog) {
      dialog.remove();
    },
    setStatus() {},
    renderLab() {},
    saveLab() {
      saveCount += 1;
    }
  });

  decorations.openWallDecorationsMenu();
  assert.equal(panel.hidden, false);
  assert.equal(panel.classList.contains('is-open'), false);
  openPanelFrame();
  assert.equal(panel.classList.contains('is-open'), true);
  assert.deepEqual(panelSounds, ['sidePanelOpen']);
  assert.equal(
    panel.style.getPropertyValue('--wall-decoration-panel-primary'),
    '#C9BEFF'
  );
  assert.equal(
    panel.style.getPropertyValue('--wall-decoration-panel-secondary'),
    '#9D8AFF'
  );
  const room = document.getElementById('room');
  assert.equal(
    room.style.getPropertyValue('--wall-decoration-primary-colour'),
    '#C9BEFF'
  );
  assert.equal(
    document.querySelector('.oling-lab-wall-decoration-card').disabled,
    true
  );
  assert.equal(
    document
      .querySelector('.oling-lab-wall-decoration-card-copy strong')
      .classList.contains('is-long-name'),
    true
  );

  room.querySelector('.oling-lab-cell').getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100
  });
  panel.getBoundingClientRect = () => ({
    left: 300,
    right: 600,
    top: 0,
    bottom: 800
  });
  room.appendChild(decorations.renderWallDecorations());
  const placedDecoration = room.querySelector('.oling-lab-wall-decoration');
  const pointerEvent = (type, clientX, clientY) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };
  placedDecoration
    .querySelector('.oling-lab-wall-decoration-handle')
    .dispatchEvent(pointerEvent('pointerdown', 50, 50));
  assert.equal(placedDecoration.classList.contains('is-dragging'), true);
  assert.ok(document.querySelector('.oling-lab-wall-decoration-drag-ghost'));
  assert.equal(decorations.renderWallDecorations().childElementCount, 0);

  dom.window.dispatchEvent(pointerEvent('pointermove', 350, 200));
  assert.equal(panel.classList.contains('is-drop-target'), true);
  assert.equal(
    document
      .querySelector('.oling-lab-wall-decoration-drag-ghost')
      .classList.contains('is-over-storage'),
    true
  );
  dom.window.dispatchEvent(pointerEvent('pointercancel', 350, 200));
  assert.equal(placedDecoration.classList.contains('is-dragging'), false);
  assert.equal(
    document.querySelector('.oling-lab-wall-decoration-drag-ghost'),
    null
  );
  assert.equal(decorations.renderWallDecorations().childElementCount, 1);

  placedDecoration
    .querySelector('.oling-lab-wall-decoration-handle')
    .dispatchEvent(pointerEvent('pointerdown', 50, 50));
  const detachedPlacement = state.lab.placedWallDecorations[0];
  state.lab = {
    ...state.lab,
    placedWallDecorations: state.lab.placedWallDecorations.map((placed) => ({
      ...placed
    }))
  };
  dom.window.dispatchEvent(pointerEvent('pointermove', 150, 50));
  dom.window.dispatchEvent(pointerEvent('pointerup', 250, 50));

  assert.equal(detachedPlacement.anchorCol, 0);
  assert.equal(state.lab.placedWallDecorations[0].anchorCol, 2);
  assert.equal(state.lab.placedWallDecorations[0].offsetX, 0.5);
  assert.equal(saveCount, 1);
  assert.equal(
    panelSounds[panelSounds.length - 1],
    'olingLabWallDecorationPosterPlaced'
  );

  document.getElementById('toggle').click();
  assert.equal(panel.classList.contains('is-collapsed'), true);
  assert.deepEqual(
    panelSounds.filter((key) => key.startsWith('sidePanel')),
    ['sidePanelOpen', 'sidePanelClose']
  );

  placedDecoration
    .querySelector('.oling-lab-wall-decoration-handle')
    .dispatchEvent(pointerEvent('pointerdown', 250, 50));
  assert.equal(panel.classList.contains('is-collapsed'), true);
  dom.window.dispatchEvent(pointerEvent('pointermove', 350, 200));
  assert.equal(panel.classList.contains('is-drop-target'), false);
  assert.equal(
    document
      .querySelector('.oling-lab-wall-decoration-drag-ghost')
      .classList.contains('is-over-storage'),
    false
  );
  dom.window.dispatchEvent(pointerEvent('pointercancel', 350, 200));
  assert.equal(state.lab.placedWallDecorations.length, 1);

  document.getElementById('toggle').click();
  document.getElementById('store-all').click();
  document.querySelector('.oe-purchase-confirm').click();

  assert.equal(state.lab.placedWallDecorations.length, 0);
  assert.equal(saveCount, 2);
  assert.equal(document.querySelector('.oe-purchase-dialog'), null);

  const inventoryCard = document.querySelector(
    '.oling-lab-wall-decoration-card'
  );
  inventoryCard.dispatchEvent(pointerEvent('pointerdown', 350, 200));
  assert.equal(panel.classList.contains('is-drop-target'), true);

  dom.window.dispatchEvent(pointerEvent('pointermove', 250, 50));
  assert.equal(panel.classList.contains('is-drop-target'), true);

  dom.window.dispatchEvent(pointerEvent('pointerup', 350, 200));
  assert.equal(panel.classList.contains('is-drop-target'), false);
  assert.equal(state.lab.placedWallDecorations.length, 0);
  assert.equal(saveCount, 2);

  inventoryCard.click();
  inventoryCard.click();
  assert.equal(state.lab.placedWallDecorations.length, 1);
  assert.equal(
    panelSounds[panelSounds.length - 1],
    'olingLabWallDecorationPosterPlaced'
  );
});

test('Oling Lab wallpapers apply one catalogued image and persist selection', () => {
  const context = { window: {}, JSON };
  const fileName = 'lab/ui/lab-wallpapers.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const styleChanges = [];
  const calls = [];
  const state = {
    lab: { appearance: { wallpaperKey: 'brick' } },
    ownedWallpapers: new Set(['brick', 'moss-brick']),
    wallpapers: new Map([
      [
        'brick',
        {
          key: 'brick',
          name: 'Brick',
          image: '/images/olings/lab/wallpapers/brick/tile.svg'
        }
      ],
      [
        'moss-brick',
        {
          key: 'moss-brick',
          name: 'Moss Brick',
          image: '/images/olings/lab/wallpapers/moss-brick/tile.svg'
        }
      ]
    ])
  };
  const wallpapers = context.window.createOlingLabWallpapers({
    state,
    elements: {
      room: {
        style: {
          setProperty: (...args) => styleChanges.push(args),
          removeProperty: (...args) => styleChanges.push(args)
        }
      },
      menuContent: null,
      menuFooter: null
    },
    defaultWallpaperKey: 'brick',
    closeMenu: () => calls.push('close'),
    renderLab: () => calls.push('render'),
    saveLab: () => calls.push('save')
  });

  wallpapers.applyWallpaper();
  assert.deepEqual(styleChanges[0], [
    '--oling-lab-wallpaper-image',
    'url("/images/olings/lab/wallpapers/brick/tile.svg")'
  ]);

  wallpapers.selectWallpaper('moss-brick');
  assert.equal(state.lab.appearance.wallpaperKey, 'brick');
  assert.equal(wallpapers.getSelectedWallpaper().key, 'moss-brick');
  assert.equal(styleChanges.length, 5);
  assert.deepEqual(calls, []);
  wallpapers.applyWallpaperSelection();
  assert.equal(state.lab.appearance.wallpaperKey, 'moss-brick');
  assert.deepEqual(styleChanges[5], [
    '--oling-lab-wallpaper-image',
    'url("/images/olings/lab/wallpapers/moss-brick/tile.svg")'
  ]);
  assert.deepEqual(calls, ['render', 'save']);
});

test('Oling Lab Wall Style opens as a gallery then shows a Lab preview', async () => {
  const dom = new JSDOM(`
    <div id="room" class="oling-lab-room" style="--lab-columns: 10; --oling-lab-cell: 512px">
      <div class="oling-lab-cell"></div>
      <div class="oling-lab-item" style="--item-row: 1; --item-col: 1; --item-width: 1; --item-height: 1">
        <div class="oling-lab-furniture-art">Furniture</div>
        <button class="oling-lab-item-hit">Open</button>
      </div>
      <div class="oling-lab-wall-decoration" style="--wall-decoration-x: 1.5; --wall-decoration-y: 0.75; --wall-decoration-width: 0.5; --wall-decoration-height: 1">
        <img src="/poster.svg" alt="Poster">
      </div>
      <button class="oling-lab-roamer">Oling</button>
    </div>
    <aside id="wall-style-panel" hidden>
      <button id="wall-style-toggle"></button>
      <header id="wall-style-header"><h2 id="wall-style-title"></h2></header>
      <div id="wall-style-content"></div>
      <footer id="wall-style-footer"></footer>
    </aside>
  `);
  const context = {
    document: dom.window.document,
    JSON,
    window: dom.window
  };
  const panelSounds = [];
  dom.window.playSoundEffect = (key) => panelSounds.push(key);
  const fileName = 'lab/ui/lab-wallpapers.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const document = dom.window.document;
  const elements = {
    room: document.getElementById('room'),
    wallStylePanel: document.getElementById('wall-style-panel'),
    wallStylePanelToggle: document.getElementById('wall-style-toggle'),
    wallStylePanelHeader: document.getElementById('wall-style-header'),
    wallStylePanelTitle: document.getElementById('wall-style-title'),
    wallStylePanelContent: document.getElementById('wall-style-content'),
    wallStylePanelFooter: document.getElementById('wall-style-footer')
  };
  elements.menuTitle = elements.wallStylePanelTitle;
  elements.menuContent = elements.wallStylePanelContent;
  elements.menuFooter = elements.wallStylePanelFooter;
  const state = {
    wallStylePanelOpen: false,
    wallStylePanelCollapsed: false,
    lab: { appearance: { wallpaperKey: 'brick' }, columns: 4 },
    ownedWallpapers: new Set(['brick', 'concrete', 'prototype']),
    wallpapers: new Map(
      ['Brick', 'Concrete', 'Prototype'].map((name) => {
        const key = name.toLowerCase();
        return [
          key,
          {
            key,
            name,
            image: `/images/olings/lab/wallpapers/${key}/tile.svg`
          }
        ];
      })
    )
  };
  const wallpapers = context.window.createOlingLabWallpapers({
    state,
    elements,
    defaultWallpaperKey: 'brick',
    createInlineAction(label, onClick) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    },
    wallpaperTheme: {
      primaryColour: '#FFD0C2',
      secondaryColour: '#FF9F80'
    },
    renderLab() {},
    saveLab() {}
  });

  wallpapers.applyWallpaper();
  const committedWallpaperImage = elements.room.style.getPropertyValue(
    '--oling-lab-wallpaper-image'
  );
  wallpapers.openWallpaperMenu();

  assert.equal(elements.wallStylePanel.hidden, false);
  assert.equal(elements.wallStylePanel.classList.contains('is-open'), true);
  assert.deepEqual(panelSounds, ['sidePanelOpen']);
  assert.equal(
    elements.wallStylePanel.style.getPropertyValue(
      '--wall-decoration-panel-primary'
    ),
    '#FFD0C2'
  );
  assert.equal(elements.menuTitle.textContent, 'Wall Style');
  assert.equal(elements.menuFooter.hidden, true);
  assert.equal(
    elements.menuFooter.firstElementChild.classList.contains(
      'are-actions-hidden'
    ),
    true
  );
  assert.equal(elements.menuFooter.querySelectorAll('button').length, 1);
  assert.equal(elements.menuFooter.textContent.trim(), 'Apply');
  elements.wallStylePanelToggle.click();
  assert.equal(
    elements.wallStylePanel.classList.contains('is-collapsed'),
    true
  );
  assert.deepEqual(panelSounds, ['sidePanelOpen', 'sidePanelClose']);
  assert.equal(elements.wallStylePanelToggle.textContent, 'Show');
  elements.wallStylePanelToggle.click();
  assert.equal(
    elements.wallStylePanel.classList.contains('is-collapsed'),
    false
  );
  assert.deepEqual(panelSounds, [
    'sidePanelOpen',
    'sidePanelClose',
    'sidePanelOpen'
  ]);
  assert.equal(elements.wallStylePanelToggle.textContent, 'Hide');
  assert.equal(
    elements.menuContent.querySelectorAll('.oling-lab-wallpaper-gallery-card')
      .length,
    3
  );
  assert.equal(
    elements.menuContent.querySelector('.oling-lab-wallpaper-carousel'),
    null
  );
  const galleryCards = elements.menuContent.querySelectorAll(
    '.oling-lab-wallpaper-gallery-card'
  );
  assert.equal(
    elements.menuContent.querySelector(
      '.oling-lab-wallpaper-gallery .oling-lab-wallpaper-lab-preview'
    ),
    null
  );
  assert.equal(
    galleryCards[0].querySelector('img').getAttribute('src'),
    '/images/olings/lab/wallpapers/brick/tile.svg'
  );
  elements.menuContent
    .querySelectorAll('.oling-lab-wallpaper-gallery-card')[1]
    .click();
  assert.equal(state.lab.appearance.wallpaperKey, 'brick');
  assert.equal(wallpapers.getSelectedWallpaper().key, 'concrete');
  assert.equal(
    elements.room.style.getPropertyValue('--oling-lab-wallpaper-image'),
    committedWallpaperImage
  );
  assert.equal(elements.menuTitle.textContent, 'Concrete');
  assert.equal(elements.menuFooter.hidden, false);
  assert.equal(
    elements.menuFooter.firstElementChild.classList.contains(
      'are-actions-hidden'
    ),
    false
  );
  assert.equal(elements.menuFooter.textContent.trim(), 'Apply');
  assert.equal(
    elements.menuContent.querySelector(
      '.oling-lab-wallpaper-carousel-position'
    ),
    null
  );
  assert.equal(
    elements.menuContent.querySelector(
      '.oling-lab-wallpaper-carousel-card figcaption'
    ),
    null
  );
  assert.equal(
    elements.menuContent.querySelectorAll('.oling-lab-wallpaper-carousel-card')
      .length,
    1
  );
  const snapshot = elements.menuContent.querySelector(
    '.oling-lab-wallpaper-room-snapshot'
  );
  assert.equal(snapshot.style.getPropertyValue('--lab-columns'), '4');
  assert.equal(snapshot.style.left, '-6.25%');
  assert.equal(snapshot.style.top, '0%');
  assert.equal(snapshot.style.width, '112.5%');
  assert.equal(snapshot.style.height, '100%');
  assert.equal(
    snapshot.style.getPropertyValue('--oling-lab-wallpaper-size'),
    '25% 50%'
  );
  const previewItem = snapshot.querySelector('.oling-lab-item');
  assert.equal(previewItem.style.width, '25%');
  assert.equal(previewItem.style.height, '50%');
  assert.ok(previewItem.querySelector('.oling-lab-furniture-art'));
  const previewDecoration = snapshot.querySelector(
    '.oling-lab-wall-decoration'
  );
  assert.equal(previewDecoration.style.left, '31.25%');
  assert.equal(previewDecoration.style.top, '12.5%');
  assert.equal(previewDecoration.style.width, '12.5%');
  assert.equal(previewDecoration.style.height, '50%');
  assert.equal(snapshot.querySelector('.oling-lab-cell'), null);
  assert.equal(snapshot.querySelector('.oling-lab-roamer'), null);
  assert.equal(snapshot.querySelector('.oling-lab-item-hit'), null);
  const originalVariant = elements.menuContent.querySelector(
    '.oling-lab-wallpaper-variant'
  );
  assert.equal(
    elements.menuContent.querySelector(
      '.oling-lab-wallpaper-variant-section h3'
    ),
    null
  );
  assert.equal(originalVariant.textContent.trim(), 'Original');
  assert.equal(
    originalVariant.querySelector('img').getAttribute('src'),
    '/images/olings/lab/wallpapers/concrete/tile.svg'
  );
  assert.ok(document.querySelector('[data-oling-lab-wallpaper-back]'));
  assert.equal(
    document.querySelector('[data-oling-lab-wallpaper-back]').textContent,
    'Back'
  );
  assert.equal(
    elements.menuContent.querySelectorAll('.oling-lab-wallpaper-carousel-arrow')
      .length,
    0
  );
  assert.equal(wallpapers.getSelectedWallpaper().key, 'concrete');
  assert.equal(
    elements.room.style.getPropertyValue('--oling-lab-wallpaper-image'),
    committedWallpaperImage
  );
  const applyButton = elements.menuFooter.querySelector(
    '[data-oling-lab-wallpaper-apply]'
  );
  assert.equal(applyButton.disabled, false);
  applyButton.click();
  assert.equal(state.lab.appearance.wallpaperKey, 'concrete');
  assert.equal(elements.wallStylePanel.hidden, false);
  assert.equal(elements.wallStylePanel.classList.contains('is-open'), true);
  assert.ok(elements.menuContent.querySelector('.oling-lab-wallpaper-detail'));
  assert.equal(applyButton.disabled, true);
  document.querySelector('[data-oling-lab-wallpaper-back]').click();
  assert.equal(
    elements.menuContent.querySelectorAll('.oling-lab-wallpaper-gallery-card')
      .length,
    3
  );
  assert.equal(document.querySelector('[data-oling-lab-wallpaper-back]'), null);
  assert.equal(elements.menuTitle.textContent, 'Wall Style');
  assert.equal(elements.menuFooter.hidden, true);
  assert.equal(
    elements.menuFooter.firstElementChild.classList.contains(
      'are-actions-hidden'
    ),
    true
  );
  const closingPanel = wallpapers.closeWallpaperPanel();
  assert.equal(elements.wallStylePanel.hidden, false);
  assert.equal(elements.wallStylePanel.classList.contains('is-open'), false);
  const transitionEnd = new dom.window.Event('transitionend');
  Object.defineProperty(transitionEnd, 'propertyName', {
    value: 'transform'
  });
  elements.wallStylePanel.dispatchEvent(transitionEnd);
  await closingPanel;
  assert.equal(elements.wallStylePanel.hidden, true);
  assert.equal(wallpapers.getSelectedWallpaper().key, 'concrete');
});

test('Oling Lab drags remembered wallpapers and variants onto the room', async () => {
  const dom = new JSDOM(`
    <div id="viewport"><div id="room" class="oling-lab-room"></div></div>
    <aside id="wall-style-panel" hidden>
      <button id="wall-style-toggle"></button>
      <header id="wall-style-header"><h2 id="wall-style-title"></h2></header>
      <div id="wall-style-content"></div>
      <footer id="wall-style-footer"></footer>
    </aside>
  `);
  const context = {
    document: dom.window.document,
    JSON,
    Map,
    Set,
    window: dom.window
  };
  const fileName = 'lab/ui/lab-wallpapers.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );

  const document = dom.window.document;
  const elements = {
    viewport: document.getElementById('viewport'),
    room: document.getElementById('room'),
    wallStylePanel: document.getElementById('wall-style-panel'),
    wallStylePanelToggle: document.getElementById('wall-style-toggle'),
    wallStylePanelHeader: document.getElementById('wall-style-header'),
    wallStylePanelTitle: document.getElementById('wall-style-title'),
    wallStylePanelContent: document.getElementById('wall-style-content'),
    wallStylePanelFooter: document.getElementById('wall-style-footer')
  };
  elements.viewport.getBoundingClientRect = () => ({
    left: 0,
    right: 300,
    top: 0,
    bottom: 300
  });
  elements.wallStylePanel.getBoundingClientRect = () => ({
    left: 300,
    right: 600,
    top: 0,
    bottom: 600
  });
  dom.window.requestAnimationFrame = (callback) => callback();

  const state = {
    wallStylePanelOpen: false,
    wallStylePanelCollapsed: false,
    wallpaperVariantSelections: new Map([['brick', 'blue']]),
    lab: {
      appearance: { wallpaperKey: 'concrete', wallpaperVariantKey: null },
      columns: 3,
      placedItems: []
    },
    ownedWallpapers: new Set(['brick', 'concrete']),
    ownedWallpaperVariants: new Set(['brick:blue']),
    wallpapers: new Map([
      [
        'brick',
        {
          key: 'brick',
          name: 'Brick',
          image: '/brick.svg',
          variants: {
            blue: { name: 'Blue', image: '/brick-blue.svg' }
          }
        }
      ],
      [
        'concrete',
        {
          key: 'concrete',
          name: 'Concrete',
          image: '/concrete.svg'
        }
      ]
    ])
  };
  let saveCount = 0;
  const wallpapers = context.window.createOlingLabWallpapers({
    state,
    elements,
    defaultWallpaperKey: 'brick',
    dragHoldDelay: 20,
    createInlineAction(label, onClick) {
      const button = document.createElement('button');
      button.append(
        Object.assign(document.createElement('span'), { textContent: label })
      );
      button.addEventListener('click', onClick);
      return button;
    },
    renderLab() {},
    saveLab() {
      saveCount += 1;
    }
  });
  const pointerEvent = (type, clientX, clientY) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      button: 0
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' }
    });
    return event;
  };
  const beginHeldDrag = async (source, clientX, clientY) => {
    source.dispatchEvent(pointerEvent('pointerdown', clientX, clientY));
    assert.equal(
      document.querySelector('.oling-lab-wallpaper-drag-ghost'),
      null
    );
    await new Promise((resolve) => dom.window.setTimeout(resolve, 25));
    assert.ok(document.querySelector('.oling-lab-wallpaper-drag-ghost'));
  };

  wallpapers.openWallpaperMenu();
  const brickCard = elements.wallStylePanelContent.querySelector(
    '[data-oling-lab-wallpaper-key="brick"]'
  );
  assert.equal(
    brickCard.querySelector('img').getAttribute('src'),
    '/brick-blue.svg'
  );

  brickCard.dispatchEvent(pointerEvent('pointerdown', 400, 120));
  dom.window.dispatchEvent(pointerEvent('pointerup', 400, 120));
  assert.equal(document.querySelector('.oling-lab-wallpaper-drag-ghost'), null);

  await beginHeldDrag(brickCard, 400, 120);
  dom.window.dispatchEvent(pointerEvent('pointermove', 120, 120));
  const rememberedPreview = elements.room.querySelector(
    '.oling-lab-wallpaper-drop-preview'
  );
  assert.ok(rememberedPreview);
  assert.equal(
    rememberedPreview.style.getPropertyValue('--oling-lab-wallpaper-image'),
    'url("/brick-blue.svg")'
  );
  assert.equal(state.lab.appearance.wallpaperKey, 'concrete');

  dom.window.dispatchEvent(pointerEvent('pointerup', 120, 120));
  assert.equal(state.lab.appearance.wallpaperKey, 'brick');
  assert.equal(state.lab.appearance.wallpaperVariantKey, 'blue');
  assert.equal(saveCount, 1);
  assert.equal(
    elements.room.querySelector('.oling-lab-wallpaper-drop-preview'),
    null
  );

  brickCard.click();
  assert.equal(
    elements.wallStylePanelContent.querySelector(
      '.oling-lab-wallpaper-carousel'
    ),
    null
  );
  brickCard.click();
  let originalVariant = elements.wallStylePanelContent.querySelector(
    '.oling-lab-wallpaper-variant[data-oling-lab-wallpaper-variant-key=""]'
  );
  await beginHeldDrag(originalVariant, 400, 180);
  dom.window.dispatchEvent(pointerEvent('pointermove', 450, 220));
  dom.window.dispatchEvent(pointerEvent('pointerup', 450, 220));
  assert.equal(state.lab.appearance.wallpaperVariantKey, 'blue');
  assert.equal(saveCount, 1);

  originalVariant.click();
  originalVariant.click();
  assert.equal(state.lab.appearance.wallpaperVariantKey, 'blue');
  assert.equal(
    elements.room.style.getPropertyValue('--oling-lab-wallpaper-image'),
    'url("/brick-blue.svg")'
  );
  originalVariant = elements.wallStylePanelContent.querySelector(
    '.oling-lab-wallpaper-variant[data-oling-lab-wallpaper-variant-key=""]'
  );
  await beginHeldDrag(originalVariant, 400, 180);
  dom.window.dispatchEvent(pointerEvent('pointermove', 120, 120));
  const originalPreview = elements.room.querySelector(
    '.oling-lab-wallpaper-drop-preview'
  );
  assert.equal(
    originalPreview.style.getPropertyValue('--oling-lab-wallpaper-image'),
    'url("/brick.svg")'
  );
  dom.window.dispatchEvent(pointerEvent('pointerup', 120, 120));
  assert.equal(state.lab.appearance.wallpaperKey, 'brick');
  assert.equal(state.lab.appearance.wallpaperVariantKey, null);
  assert.equal(saveCount, 2);
  assert.equal(
    elements.wallStylePanelContent
      .querySelector('.oling-lab-wallpaper-room-snapshot')
      .style.getPropertyValue('--oling-lab-wallpaper-image'),
    'url("/brick.svg")'
  );
});

test('Oling Lab renders an owned wallpaper variant from the source SVG once', async () => {
  const dom = new JSDOM('<div id="room"></div>');
  const source = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
      <style>.wall { fill: var(--wall-primary, #000000); }</style>
      <rect class="wall" width="10" height="10" />
    </svg>
  `;
  const createdBlobs = [];
  let fetchCount = 0;
  const context = {
    Blob,
    console,
    DOMParser: dom.window.DOMParser,
    fetch: async () => {
      fetchCount += 1;
      return { ok: true, text: async () => source };
    },
    JSON,
    Map,
    Promise,
    Set,
    URL: {
      createObjectURL(blob) {
        createdBlobs.push(blob);
        return 'blob:brick-blue';
      },
      revokeObjectURL() {}
    },
    window: { addEventListener() {} },
    XMLSerializer: dom.window.XMLSerializer
  };
  const fileName = 'lab/ui/lab-wallpapers.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const room = dom.window.document.getElementById('room');
  const state = {
    lab: {
      appearance: { wallpaperKey: 'brick', wallpaperVariantKey: 'blue' }
    },
    ownedWallpapers: new Set(),
    ownedWallpaperVariants: new Set(['brick:blue']),
    wallpapers: new Map([
      [
        'brick',
        {
          key: 'brick',
          name: 'Brick',
          image: '/brick.svg',
          variants: {
            blue: {
              name: 'Blue',
              colours: { primary: '#123456' }
            }
          }
        }
      ]
    ])
  };
  const wallpapers = context.window.createOlingLabWallpapers({
    state,
    elements: { room, menuContent: null, menuFooter: null },
    defaultWallpaperKey: 'brick',
    closeMenu() {},
    renderLab() {},
    saveLab() {}
  });

  wallpapers.applyWallpaper();
  await new Promise((resolve) => setTimeout(resolve, 0));
  wallpapers.applyWallpaper();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(fetchCount, 1);
  assert.equal(createdBlobs.length, 1);
  assert.equal(
    room.style.getPropertyValue('--oling-lab-wallpaper-image'),
    'url("blob:brick-blue")'
  );
  assert.match(await createdBlobs[0].text(), /--wall-primary:\s*#123456/);
});

test('Oling Lab offers a separately owned variant without base ownership', () => {
  const dom = new JSDOM(`
    <div id="room"></div>
    <aside id="wall-style-panel" hidden>
      <button id="wall-style-toggle"></button>
      <header id="wall-style-header"><h2 id="wall-style-title"></h2></header>
      <div id="wall-style-content"></div>
      <footer id="wall-style-footer"></footer>
    </aside>
  `);
  const context = {
    document: dom.window.document,
    JSON,
    window: dom.window
  };
  const fileName = 'lab/ui/lab-wallpapers.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  const document = dom.window.document;
  const elements = {
    room: document.getElementById('room'),
    wallStylePanel: document.getElementById('wall-style-panel'),
    wallStylePanelToggle: document.getElementById('wall-style-toggle'),
    wallStylePanelHeader: document.getElementById('wall-style-header'),
    wallStylePanelTitle: document.getElementById('wall-style-title'),
    wallStylePanelContent: document.getElementById('wall-style-content'),
    wallStylePanelFooter: document.getElementById('wall-style-footer')
  };
  elements.menuContent = elements.wallStylePanelContent;
  elements.menuFooter = elements.wallStylePanelFooter;
  const state = {
    wallStylePanelOpen: false,
    wallStylePanelCollapsed: false,
    lab: {
      appearance: { wallpaperKey: 'brick', wallpaperVariantKey: 'blue' }
    },
    ownedWallpapers: new Set(),
    ownedWallpaperVariants: new Set(['brick:blue']),
    wallpapers: new Map([
      [
        'brick',
        {
          key: 'brick',
          name: 'Brick',
          image: '/brick.svg',
          variants: {
            blue: {
              name: 'Blue',
              image: '/brick-blue.svg',
              swatchColour: '#123456'
            }
          }
        }
      ]
    ])
  };
  const wallpapers = context.window.createOlingLabWallpapers({
    state,
    elements,
    defaultWallpaperKey: 'brick',
    createInlineAction(label, onClick) {
      const button = document.createElement('button');
      button.textContent = label;
      button.addEventListener('click', onClick);
      return button;
    },
    renderLab() {},
    saveLab() {}
  });

  wallpapers.openWallpaperMenu();

  elements.menuContent
    .querySelector('.oling-lab-wallpaper-gallery-card')
    .click();

  const variant = elements.menuContent.querySelector(
    '.oling-lab-wallpaper-variant'
  );
  assert.equal(
    elements.menuContent.querySelector(
      '.oling-lab-wallpaper-carousel-card figcaption'
    ).textContent,
    'Blue'
  );
  assert.equal(variant.textContent.trim(), 'Blue');
  assert.equal(variant.getAttribute('aria-pressed'), 'true');
  assert.equal(
    variant.querySelector('img').getAttribute('src'),
    '/brick-blue.svg'
  );
});

test('Oling Lab serializes full-state saves and preserves newer local changes', async () => {
  const requests = [];
  const hydrations = [];
  const context = {
    console,
    JSON,
    Promise,
    window: {
      createOlingLabApi: () => ({
        saveLab: (lab) =>
          new Promise((resolve) => requests.push({ lab, resolve }))
      }),
      createOlingLabStateHydrator: () => ({
        hydrateSavedLab: (payload, options) =>
          hydrations.push({ payload, options })
      })
    }
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/data/lab-data-flow.js'),
      'utf8'
    ),
    context,
    { filename: 'lab/data/lab-data-flow.js' }
  );
  const state = {
    tutorialMode: false,
    lab: { appearance: { wallpaperKey: 'brick' }, revision: 1 },
    saving: false
  };
  const dataFlow = context.window.createOlingLabDataFlow({
    state,
    setStatus() {},
    renderLab() {},
    getRoaming() {}
  });

  const firstSave = dataFlow.saveLab();
  state.lab.revision = 2;
  const secondSave = dataFlow.saveLab();
  await Promise.resolve();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].lab.revision, 1);
  requests[0].resolve({ lab: { revision: 1 } });
  await firstSave;
  await Promise.resolve();

  assert.equal(requests.length, 2);
  assert.equal(requests[1].lab.revision, 2);
  assert.equal(hydrations[0].options.preserveLocalLab, true);
  requests[1].resolve({ lab: { revision: 2 } });
  await secondSave;

  assert.equal(hydrations[1].options.preserveLocalLab, false);
  assert.equal(state.saving, false);
});

test('Oling Lab Explorer Gateway support modules load before the facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/explorer-gateway/lab-explorer-gateway.js'"
  );

  assert.ok(facadeIndex > -1);
  explorerGatewayScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );

    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });
});

test('Oling Lab roaming support modules load before the facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf("'/scripts/olings/lab/room/lab-roaming.js'");

  assert.ok(facadeIndex > -1);
  roamingScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );

    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });
});

test('Oling Lab bed drops use the rest mask and reject occupied beds', () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/room/lab-roaming-targets.js'),
      'utf8'
    ),
    context
  );
  const bed = {
    type: 'bed',
    sleepSlots: [{ slotId: 'sleep-1', x: 256, y: 256 }],
    restPlacement: {
      totalPixels: 100,
      runs: [{ y: 256, start: 206, end: 306, totalPixels: 100 }]
    }
  };
  const state = {
    lab: {
      placedItems: [
        {
          placedId: 'bed-1',
          itemId: 'bed',
          col: 0,
          row: 0,
          width: 1,
          height: 1
        }
      ]
    },
    catalog: new Map([['bed', bed]]),
    olings: [],
    olingRoam: new Map()
  };
  const bounds = { cell: 512, size: 72 };
  const targets = context.window.createOlingLabRoamingTargets({
    state,
    constants: { minSpeed: 18, maxSpeed: 34 },
    getRoomMetrics: () => bounds,
    getSeededRatio: () => 0.5,
    getOlingId: (oling) => String(oling.id)
  });

  const available = targets.getBedDropTarget(256, 256, 'oling-1', bounds);
  assert.equal(available.placedId, 'bed-1');
  assert.equal(available.sleepSlotId, 'sleep-1');
  assert.equal(targets.getBedDropTarget(100, 100, 'oling-1', bounds), null);

  state.olings.push({
    id: 'oling-2',
    care: {
      isSleeping: true,
      sleepBedPlacedId: 'bed-1',
      sleepBedSlotId: 'sleep-1'
    }
  });
  assert.equal(targets.getBedDropTarget(256, 256, 'oling-1', bounds), null);
});

test('Oling Lab furniture drag interactions use projected Oling bounds and occupancy', () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/room/lab-roaming-targets.js'),
      'utf8'
    ),
    context
  );
  const bed = {
    type: 'bed',
    sleepSlots: [{ slotId: 'sleep-1', x: 256, y: 256 }],
    gridPlacement: { x: 160, y: 416, width: 192, height: 96 },
    dragInteractions: [
      {
        accepts: ['oling'],
        action: 'rest',
        collisionArea: 'placement-grid',
        snapTarget: 'rest-grid'
      }
    ]
  };
  const state = {
    lab: {
      placedItems: [
        {
          placedId: 'bed-1',
          itemId: 'bed',
          col: 0,
          row: 0,
          width: 1,
          height: 1
        }
      ]
    },
    catalog: new Map([['bed', bed]]),
    olings: [],
    olingRoam: new Map()
  };
  const bounds = { cell: 512, size: 72 };
  const targets = context.window.createOlingLabRoamingTargets({
    state,
    constants: { minSpeed: 18, maxSpeed: 34 },
    getRoomMetrics: () => bounds,
    getSeededRatio: () => 0.5,
    getOlingId: (oling) => String(oling.id)
  });
  const getTarget = (x) =>
    targets.getFurnitureDragInteractionTarget(
      {
        draggableType: 'oling',
        draggableId: 'oling-1',
        action: 'rest',
        x,
        y: 428,
        width: 72,
        height: 72
      },
      bounds
    );

  const edgeOverlap = getTarget(340);
  assert.equal(edgeOverlap.placedId, 'bed-1');
  assert.equal(edgeOverlap.action, 'rest');
  assert.deepEqual({ ...edgeOverlap.target }, { x: 220, y: 428 });
  assert.equal(getTarget(352), null);
  assert.equal(targets.getBedDropTarget(256, 256, 'oling-1', bounds), null);
  assert.equal(targets.isPointOverBed('bed-1', 256, 464, bounds), true);
  assert.equal(targets.isPointOverBed('bed-1', 256, 256, bounds), false);

  state.olings.push({
    id: 'oling-2',
    care: {
      isSleeping: true,
      sleepBedPlacedId: 'bed-1',
      sleepBedSlotId: 'sleep-1'
    }
  });
  assert.equal(getTarget(500), null);
});

test('Oling Lab roaming promotes pointer movement to the carried state', async () => {
  const dom = new JSDOM('<div id="room"></div>');
  let scheduledFrame = null;
  let frameId = 0;
  dom.window.requestAnimationFrame = (callback) => {
    scheduledFrame = callback;
    frameId += 1;
    return frameId;
  };
  const advanceFrame = (timestamp) => {
    const callback = scheduledFrame;
    scheduledFrame = null;
    assert.equal(typeof callback, 'function');
    callback(timestamp);
  };
  const { document } = dom.window;
  const room = document.getElementById('room');
  room.style.setProperty('--oling-lab-cell', '512px');
  Object.defineProperties(room, {
    clientHeight: { value: 1024 },
    getBoundingClientRect: {
      value: () => ({ left: 0, top: 0, width: 1024, height: 1024 })
    }
  });
  const context = vm.createContext({
    console,
    document,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    window: dom.window
  });
  dom.window.OlingFlightMotion = {
    configure() {},
    resolveMotion: () => 'flutter',
    setMotionDuration() {},
    setPaused(root, isPaused) {
      root.classList.toggle('is-flight-motion-paused', isPaused);
    },
    setSpeedMultiplier() {}
  };
  dom.window.OlingLabRestVisuals = {
    create: () => ({ stop() {}, sync() {} })
  };
  const sounds = [];
  dom.window.playSoundEffect = (key) => sounds.push(key);
  ['lab/room/lab-roaming-targets.js', 'lab/room/lab-roaming.js'].forEach(
    (fileName) =>
      vm.runInContext(
        fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
        context,
        { filename: fileName }
      )
  );
  const oling = { id: 'oling-1', name: 'Oling', care: {} };
  const state = {
    lab: { columns: 2, placedItems: [] },
    catalog: new Map(),
    olings: [oling],
    olingRoam: new Map(),
    activeAdventure: null,
    editMode: false,
    selectedTarget: null
  };
  let closedSelection = 0;
  const inspectedOlings = [];
  let bedArrivals = 0;
  let wakeRequests = 0;
  let resolveWake = null;
  const visualPlaybackRates = [];
  const roaming = dom.window.OlingLabRoaming.create({
    state,
    elements: { room },
    helpers: {
      createOlingPreview: () => {
        const preview = document.createElement('div');
        preview.className = 'oling-lab-oling-preview';
        preview.getAnimations = () => [
          {
            updatePlaybackRate(rate) {
              visualPlaybackRates.push(rate);
            }
          }
        ];
        return preview;
      },
      closeSelectedTarget: () => {
        closedSelection += 1;
        state.selectedTarget = null;
      },
      isTargetSelected: () => false,
      openOlingMenu: (id) => inspectedOlings.push(id),
      resolveMenuConfig: () => ({
        primaryColour: '#ffd1e8',
        secondaryColour: '#e39bc1'
      }),
      toggleSelectedTarget() {}
    },
    callbacks: {
      onBedArrival: () => {
        bedArrivals += 1;
      },
      onCarryWake: () => {
        wakeRequests += 1;
        return new Promise((resolve) => {
          resolveWake = () => {
            oling.care.isSleeping = false;
            resolve(true);
          };
        });
      },
      updateSelectedOlingPanel() {}
    },
    constants: {
      rows: 2,
      dragHoldDelayMs: 0,
      minYRatio: 0.22,
      maxYRatio: 0.78,
      minSpeed: 18,
      maxSpeed: 34,
      carryFollowLagMs: 80,
      releaseGlide: {
        sampleWindowMs: 110,
        velocityScale: 0.82,
        minSpeed: 45,
        maxSpeed: 900,
        decelerationMs: 260,
        edgeBounce: 0.35,
        edgeTangentialDamping: 0.9,
        maxBounces: 2
      },
      restVisuals: {}
    }
  });
  room.appendChild(roaming.renderOlings());
  roaming.start();
  advanceFrame(1000);
  let currentFrameAt = 1000;
  const advanceNextFrame = (elapsedMs = 16) => {
    currentFrameAt += elapsedMs;
    advanceFrame(currentFrameAt);
  };
  const roamState = roaming.getRoamState('oling-1');
  const roamer = room.querySelector('.oling-lab-roamer');
  const roamingPreview = roamer.querySelector('.oling-lab-oling-preview');
  const footprintLabel = roamer.querySelector(
    '.oling-lab-oling-footprint-label'
  );
  let previewVisualOffsetX = 0;
  let previewVisualOffsetY = 0;
  roamer.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: roamState.size,
    height: roamState.size
  });
  roamingPreview.getBoundingClientRect = () => ({
    left: previewVisualOffsetX,
    top: previewVisualOffsetY,
    width: roamState.size,
    height: roamState.size
  });
  assert.equal(roamer.dataset.pressFeedback, 'none');
  assert.equal(footprintLabel.getAttribute('aria-hidden'), 'true');
  assert.equal(
    footprintLabel.querySelector('.oling-lab-oling-footprint-type').textContent,
    'Oling'
  );
  assert.equal(
    footprintLabel.querySelector('.oling-lab-oling-footprint-name').textContent,
    'Oling'
  );
  assert.equal(
    roamer.style.getPropertyValue('--oling-footprint-primary-colour'),
    '#ffd1e8'
  );
  assert.equal(
    roamer.style.getPropertyValue('--oling-footprint-secondary-colour'),
    '#e39bc1'
  );
  const dispatchPointer = (type, clientX, clientY, timeStamp = 0) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX,
      clientY
    });
    Object.defineProperties(event, {
      isPrimary: { value: true },
      pointerId: { value: 1 },
      pointerType: { value: 'mouse' },
      timeStamp: { value: timeStamp }
    });
    roamer.dispatchEvent(event);
  };
  const startX = roamState.x + 20;
  const startY = roamState.y + 20;

  const hoverStartX = roamState.x;
  const hoverStartY = roamState.y;
  assert.equal(roaming.setPodCaptureHover('oling-1', true), true);
  advanceNextFrame();
  assert.equal(roamState.x, hoverStartX);
  assert.equal(roamState.y, hoverStartY);
  assert.equal(roamer.classList.contains('is-pod-hover-target'), true);
  roaming.setPodCaptureHover('oling-1', false);
  advanceNextFrame();
  assert.equal(roamer.classList.contains('is-pod-hover-target'), false);

  dispatchPointer('pointerdown', startX, startY);
  dispatchPointer('pointermove', startX + 3, startY + 3);
  assert.equal(roamState.activity, 'idle');
  dispatchPointer('pointermove', startX + 30, startY + 20);
  assert.equal(roamState.activity, 'carried');
  assert.equal(roamer.dataset.olingActivity, 'carried');
  assert.equal(closedSelection, 1);
  assert.equal(sounds[sounds.length - 1], 'olingLabRoamingPickup1');
  dispatchPointer('pointerup', startX + 30, startY + 20);
  assert.equal(roamState.activity, 'idle');
  assert.equal(roamState.suppressClick, true);
  roamer.click();
  assert.deepEqual(inspectedOlings, []);
  roamer.click();
  assert.deepEqual(inspectedOlings, ['oling-1']);

  roamState.x = 100;
  roamState.y = 100;
  previewVisualOffsetY = 12;
  dispatchPointer('pointerdown', 120, 120);
  dispatchPointer('pointermove', 820, 820);
  const pointerTargetX = 820 - roamState.size / 2;
  const pointerTargetY = 820 - roamState.size / 2;
  assert.equal(roamState.carry.targetCenterX, 820);
  assert.equal(roamState.carry.targetCenterY, 820);
  assert.equal(roamState.x, 100);
  assert.equal(roamState.y, 112);
  advanceNextFrame();
  assert.equal(roamState.x, 100);
  assert.equal(roamState.y, 112);
  advanceNextFrame();
  assert.ok(roamState.x > 100 && roamState.x < pointerTargetX);
  assert.ok(roamState.y > 100 && roamState.y < pointerTargetY);
  const slowedPlaybackRate = visualPlaybackRates.at(-1);
  assert.ok(slowedPlaybackRate < 1);
  dispatchPointer('pointerup', 820, 820);
  const releasedX = roamState.x;
  const releasedY = roamState.y;
  previewVisualOffsetY = 0;
  advanceNextFrame();
  assert.ok(visualPlaybackRates.at(-1) > slowedPlaybackRate);
  assert.ok(Math.abs(roamState.x - releasedX) < 1);
  assert.ok(Math.abs(roamState.y - releasedY) < 1);
  previewVisualOffsetX = 0;
  previewVisualOffsetY = 0;

  const roomMaxX = 1024 - roamState.size;
  roamState.x = roomMaxX - 5;
  roamState.y = 400;
  sounds.length = 0;
  const ambientVx = roamState.vx;
  const ambientVy = roamState.vy;
  const throwStartX = roamState.x + roamState.size / 2;
  const throwStartY = roamState.y + roamState.size / 2;
  dispatchPointer('pointerdown', throwStartX, throwStartY, 1000);
  dispatchPointer('pointermove', throwStartX + 80, throwStartY, 1040);
  assert.equal(sounds.includes('olingLabRoamingEdgeHit'), false);
  dispatchPointer('pointerup', throwStartX + 140, throwStartY, 1080);
  assert.equal(sounds.includes('olingLabRoamingEdgeHit'), false);
  assert.equal(roamState.activity, 'release-glide');
  assert.equal(roamer.dataset.olingActivity, 'gliding');
  assert.ok(roamState.vx > 0);
  assert.ok(Math.hypot(roamState.vx, roamState.vy) <= 900);
  advanceNextFrame();
  assert.equal(roamState.x, roomMaxX);
  assert.ok(roamState.vx < 0);
  assert.ok(Math.abs(roamState.vx) < 900 * 0.35);
  assert.equal(roamState.releaseGlide.bounces, 1);
  assert.equal(
    sounds.filter((key) => key === 'olingLabRoamingEdgeHit').length,
    1
  );
  roamState.x = roomMaxX;
  roamState.vx = 8;
  roamState.vy = 100;
  advanceNextFrame();
  assert.equal(
    sounds.filter((key) => key === 'olingLabRoamingEdgeHit').length,
    1
  );
  for (let index = 0; index < 200 && roamState.releaseGlide; index += 1) {
    advanceNextFrame();
  }
  assert.equal(roamState.releaseGlide, null);
  assert.equal(roamState.activity, 'idle');
  assert.equal(roamState.vx, ambientVx);
  assert.equal(roamState.vy, ambientVy);
  assert.ok(roamState.x >= 0 && roamState.x <= roomMaxX);

  dom.window.matchMedia = () => ({ matches: true });
  roamState.x = 400;
  roamState.y = 400;
  dispatchPointer('pointerdown', 440, 440, 2000);
  dispatchPointer('pointermove', 540, 440, 2040);
  dispatchPointer('pointerup', 620, 440, 2080);
  assert.equal(roamState.releaseGlide, null);
  assert.equal(roamState.activity, 'idle');
  dom.window.matchMedia = () => ({ matches: false });

  state.lab.placedItems = [
    {
      placedId: 'bed-1',
      itemId: 'bed',
      col: 0,
      row: 0,
      width: 1,
      height: 1
    }
  ];
  state.catalog.set('bed', {
    type: 'bed',
    sleepSlots: [{ slotId: 'sleep-1', x: 256, y: 256 }],
    gridPlacement: { x: 160, y: 416, width: 192, height: 96 },
    dragInteractions: [
      {
        accepts: ['oling'],
        action: 'rest',
        collisionArea: 'placement-grid',
        snapTarget: 'rest-grid'
      }
    ]
  });
  roamState.x = 50;
  roamState.y = 50;
  const bedRestX = 256 - roamState.size / 2;
  const bedRestY = 464 - roamState.size / 2;
  dispatchPointer('pointerdown', 70, 70);
  dispatchPointer('pointermove', 370, 464);
  assert.equal(roamState.x, 50);
  assert.equal(roamState.carry.dragInteraction.placedId, 'bed-1');
  for (let index = 0; index < 30; index += 1) advanceNextFrame();
  assert.ok(Math.abs(roamState.x - bedRestX) < 5);
  assert.ok(Math.abs(roamState.y - bedRestY) < 5);

  dispatchPointer('pointermove', 820, 820);
  assert.equal(roamState.carry.dragInteraction, null);
  const detachedX = roamState.x;
  advanceNextFrame();
  assert.ok(roamState.x > detachedX);

  dispatchPointer('pointermove', 370, 464);
  assert.equal(roamState.carry.dragInteraction.placedId, 'bed-1');
  for (let index = 0; index < 40; index += 1) advanceNextFrame();
  dispatchPointer('pointerup', 370, 464);
  assert.ok(Math.abs(roamState.x - bedRestX) < 0.2);
  assert.ok(Math.abs(roamState.y - bedRestY) < 0.2);
  assert.equal(bedArrivals, 0);
  assert.equal(roamState.bedJourney.placedId, 'bed-1');
  assert.equal(roamState.bedJourney.phase, 'travelling');
  advanceNextFrame();
  for (let index = 0; index < 100 && bedArrivals === 0; index += 1) {
    advanceNextFrame();
  }
  assert.equal(bedArrivals, 1);
  assert.equal(roamState.bedJourney.phase, 'arrived');
  roamState.bedJourney = null;

  state.catalog.set('bed', {
    type: 'bed',
    sleepSlots: [{ slotId: 'sleep-1', x: 256, y: 256 }],
    restPlacement: {
      totalPixels: 80,
      runs: [{ y: 256, start: 216, end: 296, totalPixels: 80 }]
    }
  });
  oling.care = {
    isSleeping: true,
    sleepBedPlacedId: 'bed-1',
    sleepBedSlotId: 'sleep-1'
  };
  const sleepingPosition = 256 - roamState.size / 2;
  roamState.activity = 'sleeping';
  roamState.x = sleepingPosition;
  roamState.y = sleepingPosition;
  dispatchPointer('pointerdown', 256, 256);
  dispatchPointer('pointermove', 266, 256);
  assert.equal(roamState.activity, 'carried');
  assert.equal(wakeRequests, 0);
  advanceNextFrame();
  advanceNextFrame();
  dispatchPointer('pointerup', 266, 256);
  assert.equal(roamState.activity, 'returning-to-sleep');
  assert.ok(roamState.x > sleepingPosition);
  assert.ok(roamState.x < sleepingPosition + 10);
  for (let index = 0; index < 100 && roamState.restReturn; index += 1) {
    advanceNextFrame();
  }
  assert.equal(roamState.restReturn, null);
  assert.equal(roamState.activity, 'sleeping');

  roamState.activity = 'sleeping';
  roamState.x = sleepingPosition;
  roamState.y = sleepingPosition;

  dispatchPointer('pointerdown', 256, 256);
  dispatchPointer('pointermove', 360, 256);
  assert.equal(roamState.activity, 'carried');
  for (let index = 0; index < 20 && wakeRequests === 0; index += 1) {
    advanceNextFrame();
  }
  assert.equal(wakeRequests, 1);
  dispatchPointer('pointerup', 360, 256);
  assert.equal(roamState.activity, 'waking-from-carry');
  dispatchPointer('pointerdown', 360, 256);
  assert.equal(roamState.carry, null);
  resolveWake();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(roamState.activity, 'idle');
  dom.window.close();
});

test('Oling Lab loads feature modules before its startup script', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const startupIndex = page.indexOf("'/scripts/olings/lab/core/lab.js'");

  assert.ok(startupIndex > -1);
  featureScripts.forEach(([fileName]) => {
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < startupIndex, `${fileName} should load first`);
  });
});

test('Oling Lab runtime and coordinator load before its entry script', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const entryIndex = page.indexOf("'/scripts/olings/lab/core/lab.js'");

  assert.ok(entryIndex > -1);
  let previousIndex = -1;
  runtimeSupportScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < entryIndex, `${fileName} should load first`);
  });
  startupScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > previousIndex, `${fileName} should load in order`);
    assert.ok(scriptIndex < entryIndex, `${fileName} should load first`);
    previousIndex = scriptIndex;
  });
});

test('Oling view modules load before their shared facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/olings/lab-olings.js'"
  );
  const context = { window: {} };

  assert.ok(facadeIndex > -1);
  olingViewScripts.forEach(([fileName, factoryName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });

  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/olings/lab-olings.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-olings.js' }
  );
  const views = context.window.OlingLabOlings.create({
    state: { layers: [], consumables: new Map() },
    helpers: {}
  });
  assert.equal(typeof views.createPreview, 'function');
  assert.equal(typeof views.createRevealMenu, 'function');
  assert.equal(typeof views.openOlingMenu, 'function');
});

test('individual Oling menus expose only Overview and Build tabs', () => {
  const context = { window: {} };
  const fileName = 'lab/olings/inspect.js';
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
    context,
    { filename: fileName }
  );
  let tabs = [];
  const tools = context.window.createOlingLabInspectTools({
    state: { olings: [{ id: 'oling-1', name: 'First Oling' }] },
    helpers: {
      createTabMenu(nextTabs) {
        tabs = nextTabs;
        return {};
      },
      openMenu() {}
    },
    previewTools: { getOlingId: (oling) => oling.id }
  });

  tools.openOlingMenu('oling-1');

  assert.deepEqual(
    Array.from(tabs, (tab) => tab.label),
    ['Overview', 'Build']
  );
});

test('Oling Lab incubator modules load before their compatibility facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/incubator/lab-incubator.js'"
  );

  assert.ok(facadeIndex > -1);
  incubatorScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );

    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });
});

test('Oling Lab furniture menu modules load before their compatibility facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/furniture-menus/lab-furniture-menus.js'"
  );

  assert.ok(facadeIndex > -1);
  furnitureMenuScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );

    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });
});

test('Oling Lab furniture slot menus stay closed throughout Customise mode', () => {
  const context = { window: {} };

  furnitureMenuScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/furniture-menus/lab-furniture-menus.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-furniture-menus.js' }
  );

  const item = {
    id: 'table',
    name: 'Table',
    containerSlots: [{ slotId: 'display', label: 'Display' }],
    inventorySlots: []
  };
  const state = {
    editMode: true,
    lab: { placedItems: [{ placedId: 'placed-table', itemId: item.id }] }
  };
  let menuOpenCount = 0;
  const menus = context.window.createOlingLabFurnitureMenus({
    state,
    getItem: () => item,
    formatTitle: (value) => value,
    createTabMenu: () => ({}),
    openMenu() {
      menuOpenCount += 1;
    }
  });
  assert.equal(typeof menus.createActionPanel, 'function');
  assert.equal(typeof menus.openSlotMenu, 'function');
  assert.equal(typeof menus.openFurnitureSlotsMenu, 'function');
  menus.openFurnitureSlotsMenu('placed-table');
  assert.equal(menuOpenCount, 0);
  state.editMode = false;
  menus.openFurnitureSlotsMenu('placed-table');
  assert.equal(menuOpenCount, 1);
});

test('the standard door action panel cycles owner-only Lab Access settings', async () => {
  const dom = new JSDOM('<!doctype html><div id="menu"></div>');
  const context = {
    document: dom.window.document,
    window: dom.window
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/furniture-menus/action-panels.js'),
      'utf8'
    ),
    context,
    { filename: 'action-panels.js' }
  );

  const door = {
    id: 'standard_door',
    name: 'Standard Door',
    type: 'door',
    containerSlots: [],
    inventorySlots: []
  };
  const state = {
    editMode: false,
    visitorMode: false,
    tutorialMode: false,
    selectedTarget: { type: 'furniture', id: 'door' },
    sellConfirmTarget: null,
    lab: {
      placedItems: [
        {
          placedId: 'door',
          itemId: door.id,
          locked: true,
          row: 1,
          col: 1,
          width: 2,
          height: 3
        }
      ]
    }
  };
  let visibility = 'private';
  let renderCount = 0;
  const labels = {
    private: 'Private',
    'friends-only': 'Friends Only',
    public: 'Public'
  };
  const panels = context.window.createOlingLabFurnitureActionPanels({
    state,
    getItem: () => door,
    resolveMenuConfig: () => ({}),
    applyActionPanelTheme() {},
    getTargetKey: (target) => (target ? `${target.type}:${target.id}` : ''),
    interactWithFurniture() {},
    getFurnitureInteractionAction: () => ({
      label: 'Use gateway',
      disabled: false
    }),
    cycleLabVisibility: async () => {
      visibility =
        visibility === 'private'
          ? 'friends-only'
          : visibility === 'friends-only'
            ? 'public'
            : 'private';
      return visibility;
    },
    getLabVisibility: () => visibility,
    getLabVisibilityLabel: (value) => labels[value],
    isLabPrivacyUpdating: () => false,
    renderLab() {
      renderCount += 1;
    }
  });

  const panel = panels.createActionPanel();
  dom.window.document.querySelector('#menu').appendChild(panel);
  assert.equal(panel.querySelector('.is-edit'), null);
  assert.doesNotMatch(panel.textContent, /edit furniture/i);
  assert.equal(panel.querySelector('.is-sell').dataset.soundIntent, 'warning');
  assert.equal(panel.querySelector('.is-interact').dataset.sound, 'none');
  const button = panel.querySelector('.is-access');
  assert.equal(button.textContent, 'Lab Access: Private');
  assert.equal(button.dataset.sound, 'none');
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(button.textContent, 'Lab Access: Friends Only');
  assert.equal(renderCount, 0);
  assert.equal(panel.isConnected, true);

  state.visitorMode = true;
  assert.equal(panels.createActionPanel().querySelector('.is-access'), null);
});

test('Oling Lab privacy cycles Private, Friends Only, Public, then Private', async () => {
  const dom = new JSDOM('<!doctype html><main class="oling-lab-page"></main>');
  const requests = [];
  const sounds = [];
  const context = {
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    fetch: async (url, options) => {
      const visibility = JSON.parse(options.body).visibility;
      requests.push({ url, visibility });
      return { payload: { privacy: { visibility } } };
    },
    window: dom.window
  };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/ui/lab-privacy-settings.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-privacy-settings.js' }
  );
  const state = {
    visitorMode: false,
    tutorialMode: false,
    lab: { visibility: 'private' },
    labPrivacy: { visibility: 'private' }
  };
  const tools = context.window.createOlingLabPrivacySettings({
    state,
    elements: {
      page: dom.window.document.querySelector('.oling-lab-page')
    },
    endpoint: '/api/olings/lab/privacy',
    parsePayload: async (response) => response.payload,
    playSound: async (key) => sounds.push(key),
    setStatus() {}
  });

  assert.equal(await tools.cycleVisibility(), 'friends-only');
  assert.equal(await tools.cycleVisibility(), 'public');
  assert.equal(await tools.cycleVisibility(), 'private');
  assert.deepEqual(
    requests.map(({ visibility }) => visibility),
    ['friends-only', 'public', 'private']
  );
  assert.deepEqual(sounds, [
    'olingLabPrivacyFriendsOnly',
    'olingLabPrivacyPublic',
    'olingLabPrivacyPrivate'
  ]);
});

test('Oling Lab registers each privacy sound against its matching asset', () => {
  const source = fs.readFileSync(
    path.join(scriptsDirectory, 'lab/core/lab.js'),
    'utf8'
  );
  assert.match(source, /olingLabPrivacyPrivate:[\s\S]*?privacy\/private\.wav/);
  assert.match(
    source,
    /olingLabPrivacyFriendsOnly:[\s\S]*?privacy\/friends-only\.wav/
  );
  assert.match(source, /olingLabPrivacyPublic:[\s\S]*?privacy\/public\.wav/);
});

test('Oling Lab registers its post-release edge impact sound', () => {
  const source = fs.readFileSync(
    path.join(scriptsDirectory, 'lab/core/lab.js'),
    'utf8'
  );
  let registrations;
  vm.runInNewContext(source, {
    window: {
      OEAudio: {
        register(definitions) {
          registrations = definitions;
        }
      },
      createOlingLabStartup() {}
    }
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(registrations.olingLabRoamingEdgeHit)),
    {
      src: '/sounds/olings/lab/roaming/edge-hit.wav',
      group: 'olings',
      preload: true,
      cooldown: 150,
      lane: 'independent',
      maxInstances: 2
    }
  );
});

test('Oling Lab registers its first roaming Oling pickup sound', () => {
  const source = fs.readFileSync(
    path.join(scriptsDirectory, 'lab/core/lab.js'),
    'utf8'
  );
  let registrations;
  vm.runInNewContext(source, {
    window: {
      OEAudio: {
        register(definitions) {
          registrations = definitions;
        }
      },
      createOlingLabStartup() {}
    }
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(registrations.olingLabRoamingPickup1)),
    {
      src: '/sounds/olings/lab/roaming/pickup/default/1.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    }
  );
});

test('Oling Lab registers each movable furniture placement sound', () => {
  const source = fs.readFileSync(
    path.join(scriptsDirectory, 'lab/core/lab.js'),
    'utf8'
  );
  let registrations;
  vm.runInNewContext(source, {
    window: {
      OEAudio: {
        register(definitions) {
          registrations = definitions;
        }
      },
      createOlingLabStartup() {}
    }
  });
  [
    ['StandardTable', 'tables/standard-table'],
    ['Incubeta', 'incubators/incubeta'],
    ['ExplorerGateway', 'door-modules/explorer-gateway'],
    ['OlingBed', 'beds/oling-bed'],
    ['SupplyShelf', 'storage/supply-shelf'],
    ['PodRack', 'storage/pod-rack'],
    ['BasicHangingLight', 'ceiling-lights/basic-hanging-light']
  ].forEach(([key, folder]) => {
    const definition = registrations[`olingLabFurniture${key}Placed`];
    assert.equal(
      definition.src,
      `/sounds/olings/lab/furniture/${folder}/placed.wav`
    );
    assert.equal(definition.lane, 'independent');
    assert.equal(definition.maxInstances, 2);
  });
  assert.equal(registrations.olingLabFurnitureStandardDoorPlaced, undefined);
});

test('Oling Lab registers each wall-decoration type placement sound', () => {
  const source = fs.readFileSync(
    path.join(scriptsDirectory, 'lab/core/lab.js'),
    'utf8'
  );
  let registrations;
  vm.runInNewContext(source, {
    window: {
      OEAudio: {
        register(definitions) {
          registrations = definitions;
        }
      },
      createOlingLabStartup() {}
    }
  });
  [
    ['Poster', 'posters'],
    ['Sign', 'signs'],
    ['Clock', 'clocks'],
    ['Shelf', 'shelves']
  ].forEach(([key, folder]) => {
    const definition = registrations[`olingLabWallDecoration${key}Placed`];
    assert.equal(
      definition.src,
      `/sounds/olings/lab/wall-decorations/${folder}/placed.wav`
    );
    assert.equal(definition.lane, 'independent');
    assert.equal(definition.maxInstances, 2);
  });
});

test('Oling Lab furniture placement modules load before their compatibility facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/olings/lab.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/furniture-placement/lab-furniture-placement.js'"
  );

  assert.ok(facadeIndex > -1);
  furniturePlacementScripts.forEach(([fileName, factoryName]) => {
    const context = { window: {} };
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );

    assert.equal(typeof context.window[factoryName], 'function', factoryName);
    const scriptIndex = page.indexOf(`'/scripts/olings/${fileName}'`);
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < facadeIndex, `${fileName} should load first`);
  });
});

test('Oling Lab furniture placement facade composes its extracted modules', () => {
  const context = {
    Date,
    Map,
    Math,
    Set,
    window: {}
  };

  furniturePlacementScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(
        scriptsDirectory,
        'lab/furniture-placement/lab-furniture-placement.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'lab-furniture-placement.js' }
  );

  const placement = context.window.createOlingLabFurniturePlacement({
    state: {
      lab: {
        columns: 3,
        placedItems: [],
        unlockedCells: ['0:0', '0:1', '0:2', '1:0', '1:1', '1:2']
      },
      owned: new Set()
    },
    rows: 2,
    furnitureGridSize: 512,
    getLabImageAssetUrl: (assetPath) => assetPath,
    getItem: () => null,
    isPlaced: () => false,
    closeMenu() {},
    closeSelectedTarget() {},
    renderLab() {},
    saveLab() {}
  });

  assert.equal(typeof placement.getOccupiedMap, 'function');
  assert.equal(typeof placement.getRoomPlacementBlockReason, 'function');
  assert.equal(typeof placement.placeRoomItem, 'function');
  assert.equal(typeof placement.storeContainerItem, 'function');
  assert.equal(typeof placement.createFurnitureArt, 'function');
  assert.equal(typeof placement.loadFurnitureGridPlacements, 'function');
});

test('Oling Lab incubator facade composes its extracted modules', () => {
  const context = { window: {} };

  incubatorScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/incubator/lab-incubator.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-incubator.js' }
  );

  const incubator = context.window.createOlingLabIncubator({});
  assert.equal(typeof incubator.getIncubatorContext, 'function');
  assert.equal(typeof incubator.hatchEggFromIncubator, 'function');
  assert.equal(typeof incubator.openIncubatorMenu, 'function');
});

test('Oling Lab incubator opens in its drawer with external tabs and footer actions', () => {
  const dom = new JSDOM(`
    <main id="room"></main>
    <aside id="panel" hidden>
      <div id="tabs" hidden></div>
      <button id="toggle"></button>
      <button id="back"></button>
      <h2 id="title"></h2>
      <div id="content"></div>
      <footer id="footer"></footer>
    </aside>
  `);
  const { document } = dom.window;
  const contextData = {
    parentPlacedId: 'placed-incubator',
    slotId: 'incubator-slot',
    incubator: { name: 'Basic Incubator' },
    inventorySlots: [{ slotId: 'egg', slotType: 'egg', itemKey: null }]
  };
  let viewingInfo = false;
  const core = {
    getIncubatorContext: () => contextData,
    getIncubatorEggSlot: (context) => context.inventorySlots[0],
    getStagedIncubatorEggKey: () => null,
    getActiveItemInfluenceSlot: () => '',
    isSelectingIncubatorEgg: () => false,
    isViewingIncubatorHatchDetails: () => false,
    isViewingIncubatorEggInfo: () => false,
    isViewingIncubatorInfo: () => viewingInfo,
    setIncubatorEggSelection() {},
    setStagedIncubatorEggKey() {},
    setIncubatorHatchDetails() {},
    setActiveItemInfluenceSlot() {},
    setIncubatorEggInfo() {},
    setIncubatorInfo(_context, value) {
      viewingInfo = value;
    },
    setPanelInteractivity() {},
    openStagePanel() {},
    closeStagePanel() {},
    removeEggFromIncubator() {},
    hatchEggFromIncubator() {},
    startHatchingStagedEgg() {}
  };
  const context = {
    CustomEvent: dom.window.CustomEvent,
    Promise,
    document,
    window: dom.window
  };
  context.window.createOlingLabIncubatorCore = () => core;
  context.window.createOlingLabIncubatorInfo = () => ({
    createIncubatorInfoStage: () => [document.createElement('section')]
  });
  context.window.createOlingLabIncubatorIncubation = () => ({
    createEggTab: () => [document.createElement('section')],
    createIncubateTab: () => [document.createElement('section')],
    createIncubatorFooterActions: () => []
  });
  context.window.createOlingLabIncubatorInfluences = () => ({
    createItemsTab: () => [document.createElement('section')],
    createInfluenceFooterActions: (_context, _onChange) => [
      createInlineAction('Insert Influence', () => {}, {
        className: 'is-hatch-action is-influence-action',
        disabled: true
      })
    ]
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/incubator/lab-incubator.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-incubator.js' }
  );

  const state = {
    incubatorPanelOpen: false,
    incubatorPanelCollapsed: false,
    incubatorPanelTabLabel: 'Incubate',
    selectedTarget: null
  };
  const elements = {
    room: document.getElementById('room'),
    backdrop: { hidden: true },
    incubatorPanel: document.getElementById('panel'),
    incubatorPanelTabs: document.getElementById('tabs'),
    incubatorPanelToggle: document.getElementById('toggle'),
    incubatorPanelBack: document.getElementById('back'),
    incubatorPanelTitle: document.getElementById('title'),
    incubatorPanelContent: document.getElementById('content'),
    incubatorPanelFooter: document.getElementById('footer')
  };
  let modalOpenCount = 0;
  const createInlineAction = (label, onClick, options = {}) => {
    const button = document.createElement('button');
    button.className = `oling-lab-menu-action ${options.className || ''}`;
    if (options.sound === false) button.dataset.sound = 'none';
    else if (options.soundIntent)
      button.dataset.soundIntent = options.soundIntent;
    button.disabled = Boolean(options.disabled);
    button.appendChild(
      Object.assign(document.createElement('span'), { textContent: label })
    );
    button.addEventListener('click', onClick);
    return button;
  };
  const createTabMenu = (tabs, options = {}) => {
    const shell = document.createElement('div');
    const list = document.createElement('div');
    list.className = 'oling-lab-tab-list';
    const panel = document.createElement('div');
    tabs.forEach((tab) => {
      const button = document.createElement('button');
      button.dataset.olingLabTab = tab.label;
      button.textContent = tab.label;
      button.addEventListener('click', () => {
        panel.replaceChildren(...tab.content());
        options.onActivate?.(tab);
      });
      list.appendChild(button);
    });
    const initial =
      tabs.find((tab) => tab.label === options.initialLabel) || tabs[0];
    panel.replaceChildren(...initial.content());
    options.onActivate?.(initial);
    shell.append(list, panel);
    return shell;
  };
  const incubator = context.window.createOlingLabIncubator({
    state,
    elements,
    createInlineAction,
    createTabMenu,
    getEgg: () => null,
    getHatchProgress: () => ({ isReady: false }),
    resolveMenuConfig: () => ({
      primaryColour: '#ffd6a5',
      secondaryColour: '#e8b77e'
    }),
    startIncubatorCountdown() {},
    renderLab() {},
    closeMenu() {},
    closeSelectedTarget() {},
    openMenu() {
      modalOpenCount += 1;
    }
  });

  incubator.openIncubatorMenu(contextData);
  assert.equal(modalOpenCount, 0);
  assert.equal(elements.incubatorPanel.hidden, false);
  assert.equal(elements.incubatorPanelTitle.textContent, 'Basic Incubator');
  assert.deepEqual(
    [...elements.incubatorPanelTabs.querySelectorAll('button')].map(
      (button) => button.textContent
    ),
    ['Incubate', 'Egg', 'Influences', 'Info']
  );
  assert.equal(elements.incubatorPanelBack.textContent, 'Close');
  assert.equal(
    elements.incubatorPanelBack.classList.contains('is-close'),
    true
  );
  assert.equal(
    elements.incubatorPanelBack.getAttribute('aria-label'),
    'Close incubator menu'
  );
  assert.doesNotMatch(elements.incubatorPanelFooter.textContent, /Close Menu/);
  assert.match(elements.incubatorPanelFooter.textContent, /Insert Egg/);

  elements.incubatorPanelTabs
    .querySelector('[data-oling-lab-tab="Influences"]')
    .click();
  assert.doesNotMatch(elements.incubatorPanelFooter.textContent, /Close Menu/);
  assert.match(elements.incubatorPanelFooter.textContent, /Insert Influence/);
  assert.doesNotMatch(
    elements.incubatorPanelFooter.textContent,
    /Remove Influence/
  );
  assert.doesNotMatch(elements.incubatorPanelFooter.textContent, /Egg/);
  assert.equal(
    [...elements.incubatorPanelFooter.querySelectorAll('button')].find(
      (button) => button.textContent === 'Insert Influence'
    ).disabled,
    true
  );

  viewingInfo = true;
  elements.incubatorPanelTabs
    .querySelector('[data-oling-lab-tab="Info"]')
    .click();
  assert.equal(elements.incubatorPanelBack.textContent, 'Back');
  assert.equal(
    elements.incubatorPanelBack.classList.contains('is-close'),
    false
  );
  assert.equal(
    elements.incubatorPanelBack.getAttribute('aria-label'),
    'Back to incubator overview'
  );
  elements.incubatorPanelBack.click();
  assert.equal(state.incubatorPanelOpen, true);
  assert.equal(elements.incubatorPanelBack.textContent, 'Close');
  assert.equal(
    elements.incubatorPanelBack.classList.contains('is-close'),
    true
  );

  elements.incubatorPanelToggle.click();
  assert.equal(state.incubatorPanelCollapsed, true);
  assert.ok(elements.incubatorPanel.classList.contains('is-collapsed'));
  elements.incubatorPanelBack.click();
  assert.equal(state.incubatorPanelOpen, false);
  assert.equal(elements.incubatorPanel.hidden, true);
});

test('Oling Lab incubator actions retain their cross-module callbacks', () => {
  const dom = new JSDOM('<main id="menu"></main>', {
    pretendToBeVisual: true
  });
  const context = {
    CustomEvent: dom.window.CustomEvent,
    Date,
    document: dom.window.document,
    window: dom.window
  };

  incubatorScripts.forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(
      path.join(scriptsDirectory, 'lab/incubator/lab-incubator.js'),
      'utf8'
    ),
    context,
    { filename: 'lab-incubator.js' }
  );

  const eggSlot = {
    slotId: 'egg',
    slotType: 'egg',
    itemKey: null,
    influenceSlots: []
  };
  const incubatorSlot = {
    slotId: 'incubator-slot',
    itemId: 'basic-incubator',
    inventorySlots: [eggSlot]
  };
  const incubatorItem = {
    key: 'basic-incubator',
    name: 'Incubator',
    type: 'incubator',
    description: 'A worn but reliable incubator.',
    rarity: 'basic',
    hatchSpeed: 'Normal',
    specialEffect: 'None',
    passiveBonus: 'None',
    influenceSlotCount: 1,
    image: '/incubator.svg'
  };
  const egg = {
    key: 'test-egg',
    name: 'Test Egg',
    image: '/egg.svg',
    sets: [
      {
        key: 'moss',
        name: 'Moss',
        rarity: 'common',
        metadata: {
          layers: {
            flight: '/moss-flight.svg',
            body: '/moss-body.svg',
            eyes: '/moss-eyes.svg',
            mouth: '/moss-mouth.svg'
          }
        }
      },
      {
        key: 'stone',
        name: 'Stone',
        rarity: 'uncommon',
        metadata: {
          layers: {
            flight: '/stone-flight.svg',
            body: '/stone-body.svg',
            eyes: '/stone-eyes.svg',
            mouth: '/stone-mouth.svg'
          }
        }
      }
    ],
    rarityOdds: {}
  };
  const eggs = [
    egg,
    ...Array.from({ length: 8 }, (_, index) => ({
      ...egg,
      key: `test-egg-${index + 2}`,
      name: `Test Egg ${index + 2}`
    }))
  ];
  const consumable = {
    key: 'speed-boost',
    name: 'Speed Boost',
    category: 'hatching',
    subcategory: 'speed',
    target: 'egg',
    description: 'Helps an Oling egg hatch 25% faster.',
    effect: { type: 'hatch_speed', amount: 25 },
    assets: {}
  };
  const consumables = [
    consumable,
    ...Array.from({ length: 8 }, (_, index) => ({
      ...consumable,
      key: `test-influence-${index + 2}`,
      name: `Test Influence ${index + 2}`
    }))
  ];
  const state = {
    layers: ['flight', 'body', 'eyes', 'mouth'],
    animatingIncubatorPanelTarget: null,
    hatching: false,
    incubatorItemInfluenceSelections: {},
    incubatorPendingInfluenceSelections: {},
    incubatorPanelTargets: {},
    lab: {
      placedItems: [
        {
          placedId: 'placed-incubator',
          containerSlots: [incubatorSlot]
        }
      ]
    },
    olings: [],
    ownedConsumables: consumables.map((item) => ({
      key: item.key,
      quantity: 1
    })),
    ownedEggs: eggs.map((item) => ({ key: item.key, quantity: 1 }))
  };
  const menu = dom.window.document.getElementById('menu');
  let openCount = 0;

  const createButton = (label, onClick, options = {}) => {
    const button = dom.window.document.createElement('button');
    button.type = 'button';
    button.className = 'oling-lab-menu-action';
    button.textContent = label;
    button.disabled = Boolean(options.disabled);
    if (onClick) button.addEventListener('click', onClick);
    return button;
  };
  const incubator = context.window.createOlingLabIncubator({
    state,
    elements: { backdrop: { hidden: false }, menuContent: menu },
    hatchEndpoint: '/api/olings/hatch',
    eggPickerTransitionMs: 0,
    setStatus() {},
    startIncubatorCountdown() {},
    parsePayload: async (response) => response,
    getItem: (key) => (key === incubatorItem.key ? incubatorItem : null),
    getEgg: (key) => eggs.find((item) => item.key === key) || null,
    getConsumable: (key) =>
      consumables.find((item) => item.key === key) || null,
    applyRarityTheme() {},
    getAvailableEggQuantity: () => 1,
    createImage(src, alt) {
      const image = dom.window.document.createElement('img');
      image.src = src;
      image.alt = alt;
      return image;
    },
    getEggImage: (item) => item?.image || '',
    createItemButton(item, options = {}) {
      return createButton(item.name, options.onClick, options);
    },
    createInlineAction: createButton,
    createHatchEggAction: () => createButton('Hatch'),
    syncIncubatorHatchActions() {},
    createStatsToggleButton: createButton,
    createPanelBackButton: createButton,
    createSquareMarker(label, className) {
      const marker = dom.window.document.createElement('span');
      marker.className = className;
      marker.textContent = label;
      return marker;
    },
    createEmptyMessage(message) {
      const empty = dom.window.document.createElement('p');
      empty.className = 'oling-lab-menu-empty';
      empty.textContent = message;
      return empty;
    },
    createConstrainedEmptyTab(message) {
      const empty = dom.window.document.createElement('p');
      empty.textContent = message;
      return [empty];
    },
    createDetailRow(label, value) {
      const row = dom.window.document.createElement('div');
      row.textContent = `${label}: ${value}`;
      return row;
    },
    createCompactDetailPair() {
      return dom.window.document.createElement('div');
    },
    formatTitle: (value) => String(value),
    formatOdds: (value) => String(value),
    formatInfluenceEffect: () => '+25% speed',
    formatDuration: () => '1 minute',
    getHatchProgress: () => ({
      isReady: false,
      readyAt: Date.now() + 60000,
      remainingMs: 60000
    }),
    createTabMenu(tabs, options = {}) {
      const tabMenu = dom.window.document.createElement('section');
      const tabList = dom.window.document.createElement('div');
      const panel = dom.window.document.createElement('div');
      const actionArea = dom.window.document.createElement('div');
      actionArea.className = 'oling-lab-container-action-area';
      const renderTab = (tab) => {
        const content = tab.content();
        const children = Array.isArray(content) ? content : [content];
        panel.replaceChildren(...children);
        actionArea.dataset.olingActiveTab = tab.label;
        actionArea.replaceChildren(...(options.actionContent?.(tab) || []));
        options.onActivate?.(tab);
      };
      tabs.forEach((tab) => {
        const tabButton = createButton(tab.label, () => renderTab(tab));
        tabButton.dataset.olingLabTab = tab.label;
        tabList.appendChild(tabButton);
      });
      tabMenu.append(tabList, panel, actionArea);
      renderTab(tabs[0]);
      return tabMenu;
    },
    openMenu(title, children) {
      openCount += 1;
      menu.replaceChildren(...children);
    },
    closeMenu() {},
    closeSelectedTarget() {},
    getRoaming: () => null,
    getOlingViews: () => null,
    renderLab() {},
    saveLab() {}
  });
  const incubatorContext = {
    parentPlacedId: 'placed-incubator',
    slotId: incubatorSlot.slotId,
    slot: incubatorSlot,
    incubator: incubatorItem,
    inventorySlots: incubatorSlot.inventorySlots
  };

  incubator.openIncubatorMenu(incubatorContext);
  assert.equal(openCount, 1);
  let previewFrame = menu.querySelector('.oling-lab-incubator-preview-frame');
  assert.ok(previewFrame);
  assert.ok(
    previewFrame.firstElementChild?.classList.contains(
      'oling-lab-egg-insertion-stage'
    )
  );
  assert.equal(
    previewFrame.querySelector(':scope > .oling-lab-incubate-panel'),
    null
  );

  state.ownedEggs = [];
  [...menu.querySelectorAll('button')]
    .find((button) => button.textContent === 'Incubate')
    .click();
  const emptyEggGrid = menu.querySelector('.oling-lab-egg-picker-grid');
  assert.ok(emptyEggGrid.classList.contains('is-empty-inventory'));
  assert.equal(
    emptyEggGrid.querySelectorAll('.oling-lab-incubator-egg-empty-cell').length,
    8
  );
  assert.equal(
    emptyEggGrid.querySelector('.oling-lab-incubator-egg-empty-message')
      .textContent,
    'No eggs available.'
  );
  assert.equal(emptyEggGrid.querySelector('.oling-lab-menu-empty'), null);
  state.ownedEggs = eggs.map((item) => ({ key: item.key, quantity: 1 }));
  [...menu.querySelectorAll('button')]
    .find((button) => button.textContent === 'Incubate')
    .click();
  assert.equal(
    menu.querySelectorAll('.oling-lab-incubator-egg-card').length,
    8
  );

  [...menu.querySelectorAll('button')]
    .find((button) => button.textContent === 'Influences')
    .click();
  previewFrame = menu.querySelector('.oling-lab-incubator-preview-frame');
  assert.ok(previewFrame);
  assert.equal(
    menu
      .querySelector('.oling-lab-items-stage')
      .classList.contains('oling-lab-egg-insertion-stage'),
    false
  );
  assert.equal(
    previewFrame.parentElement.className.includes('oling-lab-items-stage'),
    true
  );
  assert.equal(
    previewFrame.firstElementChild?.className,
    'oling-lab-item-slot-row'
  );
  const influenceSlotRow = menu.querySelector('.oling-lab-item-slot-row');
  assert.equal(influenceSlotRow.dataset.influenceSlotCount, '1');
  assert.equal(
    menu.querySelectorAll('.oling-lab-item-influence-slot').length,
    1
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-slot').textContent,
    /Add Influence/
  );
  assert.ok(menu.querySelector('.oling-lab-item-influence-inventory-panel'));
  assert.equal(
    menu.querySelector(
      '.oling-lab-item-influence-inventory-panel.oling-lab-side-panel'
    ),
    null
  );
  assert.equal(
    menu.querySelectorAll('.oling-lab-item-influence-inventory-card').length,
    8
  );
  assert.equal(
    menu.querySelectorAll('.oling-lab-item-influence-inventory-grid > *')
      .length,
    8
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-description')
      .classList.contains('is-guidance')
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-description').textContent,
    /Choose an item above to discover how it can shape your Oling\./
  );
  assert.equal(
    menu.querySelector('.oling-lab-item-influence-pagination strong')
      .textContent,
    '1 / 2'
  );
  menu.querySelector('[aria-label="Next influence page"]').click();
  assert.equal(
    menu.querySelectorAll('.oling-lab-item-influence-inventory-card').length,
    1
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-inventory-card').textContent,
    /Test Influence 9/
  );
  assert.equal(
    menu.querySelectorAll('.oling-lab-item-influence-inventory-grid > *')
      .length,
    8
  );
  menu.querySelector('[aria-label="Previous influence page"]').click();
  assert.equal(
    menu
      .querySelector('.oling-lab-item-influence-inventory-card')
      .hasAttribute('data-badge'),
    false
  );
  const getInfluenceFooterButton = (label) =>
    [...menu.querySelectorAll('.oling-lab-container-action-area button')].find(
      (button) => button.textContent === label
    );
  assert.equal(getInfluenceFooterButton('Close Menu').disabled, false);
  assert.equal(getInfluenceFooterButton('Remove Influence'), undefined);
  assert.equal(getInfluenceFooterButton('Insert Influence').disabled, true);
  assert.equal(getInfluenceFooterButton('Remove Egg'), undefined);
  assert.equal(getInfluenceFooterButton('Start Hatching'), undefined);
  menu.querySelector('.oling-lab-item-influence-slot').click();
  assert.doesNotThrow(() =>
    [...menu.querySelectorAll('.oling-lab-menu-action')]
      .find((button) => button.textContent.startsWith('Speed Boost'))
      .click()
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-inventory-card')
      .classList.contains('is-selected')
  );
  assert.equal(
    menu
      .querySelector('.oling-lab-item-influence-inventory-card')
      .hasAttribute('data-badge'),
    false
  );
  assert.doesNotMatch(
    menu.querySelector('.oling-lab-item-influence-description').textContent,
    /Helps an Oling egg hatch 25% faster\./
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-description').textContent,
    /Affects: Egg hatching · \+25% speed/
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-slot').textContent,
    /Add Influence/
  );
  assert.equal(getInfluenceFooterButton('Remove Influence'), undefined);
  assert.equal(getInfluenceFooterButton('Insert Influence').disabled, false);

  menu.querySelector('.oling-lab-item-influence-inventory-card').click();
  assert.equal(
    menu
      .querySelector('.oling-lab-item-influence-inventory-card')
      .classList.contains('is-selected'),
    false
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-description')
      .classList.contains('is-guidance')
  );
  assert.equal(getInfluenceFooterButton('Insert Influence').disabled, true);

  menu.querySelector('.oling-lab-item-influence-inventory-card').click();
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-inventory-card')
      .classList.contains('is-selected')
  );
  assert.equal(getInfluenceFooterButton('Insert Influence').disabled, false);

  getInfluenceFooterButton('Insert Influence').click();
  assert.match(
    menu.querySelector('.oling-lab-item-influence-slot').textContent,
    /Speed Boost/
  );
  assert.equal(getInfluenceFooterButton('Remove Influence').disabled, false);
  assert.equal(getInfluenceFooterButton('Insert Influence'), undefined);
  assert.equal(
    menu.querySelector('.oling-lab-item-influence-inventory-browser'),
    null
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-inventory-panel')
      .classList.contains('is-filled-single-slot')
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-description')
      .classList.contains('is-expanded')
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-description').textContent,
    /Helps an Oling egg hatch 25% faster\./
  );

  getInfluenceFooterButton('Remove Influence').click();
  assert.match(
    menu.querySelector('.oling-lab-item-influence-slot').textContent,
    /Add Influence/
  );
  assert.equal(getInfluenceFooterButton('Remove Influence'), undefined);
  assert.equal(getInfluenceFooterButton('Insert Influence').disabled, true);
  assert.ok(menu.querySelector('.oling-lab-item-influence-inventory-browser'));
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-description')
      .classList.contains('is-guidance')
  );
  assert.match(
    menu.querySelector('.oling-lab-item-influence-description').textContent,
    /Choose an item above to discover how it can shape your Oling\./
  );
  const itemDropSlot = menu.querySelector('.oling-lab-item-influence-slot');
  itemDropSlot.getBoundingClientRect = () => ({
    top: 0,
    right: 200,
    bottom: 200,
    left: 0
  });
  const pointerEvent = (type, clientX, clientY) => {
    const event = new dom.window.MouseEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
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
  menu
    .querySelector('.oling-lab-item-influence-inventory-card')
    .dispatchEvent(pointerEvent('pointerdown', 300, 300));
  dom.window.document.dispatchEvent(pointerEvent('pointermove', 100, 100));
  assert.ok(
    dom.window.document.querySelector('.oling-lab-item-influence-drag-ghost')
  );
  assert.ok(itemDropSlot.classList.contains('is-item-drop-target'));
  dom.window.document.dispatchEvent(pointerEvent('pointerup', 100, 100));
  assert.equal(
    dom.window.document.querySelector('.oling-lab-item-influence-drag-ghost'),
    null
  );
  assert.ok(
    menu
      .querySelector('.oling-lab-item-influence-slot')
      .textContent.includes('Speed Boost')
  );
  assert.equal(getInfluenceFooterButton('Remove Influence').disabled, false);
  assert.equal(getInfluenceFooterButton('Insert Influence'), undefined);
  assert.equal(
    menu.querySelector('.oling-lab-item-influence-inventory-browser'),
    null
  );

  [...menu.querySelectorAll('button')]
    .find((button) => button.textContent === 'Incubate')
    .click();
  assert.equal(
    menu.querySelector('.oling-lab-egg-insertion-stage').dataset
      .olingEggDropMessage,
    'Drop to insert egg'
  );
  assert.equal(
    menu.querySelectorAll('.oling-lab-incubator-egg-card').length,
    8
  );
  assert.equal(
    menu.querySelector('.oling-lab-incubator-egg-pagination strong')
      .textContent,
    '1 / 2'
  );
  menu.querySelector('[aria-label="Next egg page"]').click();
  assert.equal(
    menu.querySelectorAll('.oling-lab-incubator-egg-card').length,
    1
  );
  assert.match(
    menu.querySelector('.oling-lab-incubator-egg-card').textContent,
    /Test Egg 9/
  );
  menu.querySelector('[aria-label="Previous egg page"]').click();
  assert.ok(
    menu
      .querySelector('.oling-lab-incubator-egg-description')
      .classList.contains('is-guidance')
  );
  assert.match(
    menu.querySelector('.oling-lab-incubator-egg-description').textContent,
    /Choose an egg above to discover what could hatch from it\./
  );
  const getIncubateFooterButton = (label) =>
    [...menu.querySelectorAll('.oling-lab-container-action-area button')].find(
      (button) => button.textContent === label
    );
  assert.equal(getIncubateFooterButton('Insert Egg').disabled, true);
  assert.equal(getIncubateFooterButton('Remove Egg'), undefined);
  assert.equal(getIncubateFooterButton('Start Hatching'), undefined);
  const eggDropStage = menu.querySelector('.oling-lab-egg-insertion-stage');
  eggDropStage.getBoundingClientRect = () => ({
    top: 0,
    right: 200,
    bottom: 200,
    left: 0
  });
  menu
    .querySelector('[data-oling-egg-key="test-egg"]')
    .dispatchEvent(pointerEvent('pointerdown', 300, 300));
  dom.window.document.dispatchEvent(pointerEvent('pointermove', 100, 100));
  assert.ok(dom.window.document.querySelector('.oling-lab-egg-drag-ghost'));
  assert.ok(eggDropStage.classList.contains('is-egg-drop-target'));
  dom.window.document.dispatchEvent(pointerEvent('pointerup', 100, 100));
  assert.equal(
    dom.window.document.querySelector('.oling-lab-egg-drag-ghost'),
    null
  );
  assert.equal(eggSlot.itemKey, egg.key);
  assert.equal(eggSlot.placedAt, null);
  assert.equal(menu.querySelector('.oling-lab-incubator-egg-inventory'), null);
  incubator.removeEggFromIncubator(incubatorContext);
  assert.equal(eggSlot.itemKey, null);
  assert.ok(menu.querySelector('.oling-lab-incubator-egg-inventory'));
  assert.doesNotThrow(() =>
    menu.querySelector('.oling-lab-egg-insertion-slot').click()
  );
  assert.equal(openCount, 3);
  assert.doesNotThrow(() =>
    menu.querySelector('[data-oling-egg-key="test-egg"]').click()
  );
  assert.equal(eggSlot.itemKey, null);
  assert.equal(incubator.getStagedIncubatorEggKey(incubatorContext), egg.key);
  assert.equal(openCount, 3);
  assert.ok(
    menu
      .querySelector('[data-oling-egg-key="test-egg"]')
      .classList.contains('is-selected')
  );
  assert.match(
    menu.querySelector('.oling-lab-incubator-egg-description').textContent,
    /Collection: base · Hatch time:/
  );
  assert.equal(
    menu.querySelector('.oling-lab-incubator-egg-description').children.length,
    2
  );
  assert.doesNotMatch(
    menu.querySelector('.oling-lab-incubator-egg-description').textContent,
    /Hatch odds:/
  );
  assert.equal(getIncubateFooterButton('Insert Egg').disabled, false);
  menu.querySelector('[data-oling-egg-key="test-egg"]').click();
  assert.equal(incubator.getStagedIncubatorEggKey(incubatorContext), null);
  assert.ok(
    menu
      .querySelector('.oling-lab-incubator-egg-description')
      .classList.contains('is-guidance')
  );
  assert.equal(getIncubateFooterButton('Insert Egg').disabled, true);
  menu.querySelector('[data-oling-egg-key="test-egg"]').click();
  assert.equal(incubator.getStagedIncubatorEggKey(incubatorContext), egg.key);
  assert.equal(getIncubateFooterButton('Insert Egg').disabled, false);
  getIncubateFooterButton('Insert Egg').click();
  assert.equal(eggSlot.itemKey, egg.key);
  assert.equal(eggSlot.placedAt, null);
  assert.equal(incubator.getStagedIncubatorEggKey(incubatorContext), null);
  assert.equal(openCount, 4);
  assert.equal(
    menu.querySelector('.oling-lab-egg-insertion-stage').dataset
      .olingEggDropMessage,
    'Egg inserted'
  );
  const readyToStartBadge = menu.querySelector(
    '.oling-lab-hatch-timer-badge.is-ready-to-start'
  );
  assert.ok(readyToStartBadge);
  assert.equal(readyToStartBadge.textContent, 'Ready to start');
  assert.equal(menu.querySelector('.oling-lab-incubator-egg-inventory'), null);
  const stagedInfluenceCard = menu.querySelector(
    '[data-oling-influence-slot="influence-1"]'
  );
  assert.ok(stagedInfluenceCard);
  assert.equal(stagedInfluenceCard.disabled, false);
  assert.match(stagedInfluenceCard.textContent, /Speed Boost/);
  assert.doesNotThrow(() => stagedInfluenceCard.click());
  assert.equal(state.incubatorPanelTabLabel, 'Influences');
  assert.doesNotThrow(() =>
    [...menu.querySelectorAll('button')]
      .find((button) => button.textContent === 'Influences')
      .click()
  );
  assert.ok(menu.querySelector('.oling-lab-item-influence-inventory-panel'));
  assert.equal(
    menu
      .querySelector('.oling-lab-items-stage')
      .classList.contains('is-selecting-item-influence'),
    false
  );
  assert.equal(incubator.startHatchingStagedEgg(incubatorContext), true);
  assert.equal(eggSlot.itemKey, egg.key);
  assert.ok(Number.isFinite(new Date(eggSlot.placedAt).getTime()));
  assert.equal(eggSlot.influenceSlots[0].slotKey, 'influence-1');
  assert.equal(eggSlot.influenceSlots[0].itemKey, consumable.key);
  assert.equal(openCount, 6);
  const lockedInfluenceCard = menu.querySelector(
    '[data-oling-influence-slot="influence-1"]'
  );
  assert.ok(lockedInfluenceCard);
  assert.equal(lockedInfluenceCard.disabled, true);
  assert.match(lockedInfluenceCard.textContent, /Speed Boost/);

  [...menu.querySelectorAll('button')]
    .find((button) => button.textContent === 'Incubate')
    .click();
  const hatchInfluenceCard = menu.querySelector(
    '.oling-lab-incubator-influence-card'
  );
  assert.ok(
    hatchInfluenceCard.classList.contains('oling-lab-item-influence-slot')
  );
  assert.equal(hatchInfluenceCard.disabled, true);
  assert.match(hatchInfluenceCard.textContent, /Speed Boost/);

  eggSlot.influenceSlots[0].itemKey = null;
  state.incubatorPanelTabLabel = 'Incubate';
  incubator.openIncubatorMenu(incubatorContext);
  const emptyHatchInfluenceCard = menu.querySelector(
    '.oling-lab-incubator-influence-card'
  );
  assert.equal(emptyHatchInfluenceCard.disabled, true);
  assert.match(
    emptyHatchInfluenceCard.textContent,
    /No InfluenceNo influence was applied to this hatch\.Not applied/
  );
  assert.equal(
    emptyHatchInfluenceCard.querySelector('.oling-lab-item-influence-marker'),
    null
  );

  assert.doesNotThrow(() =>
    [...menu.querySelectorAll('button')]
      .find((button) => button.textContent === 'Egg')
      .click()
  );
  assert.ok(menu.querySelector('.oling-lab-egg-info-stage'));
  previewFrame = menu.querySelector('.oling-lab-incubator-preview-frame');
  assert.equal(previewFrame.firstElementChild?.className, 'oling-lab-egg-used');
  const completeBuildGrid = menu.querySelector(
    '.oling-lab-complete-set-preview-grid'
  );
  assert.ok(completeBuildGrid);
  assert.equal(
    completeBuildGrid.getAttribute('aria-label'),
    'Test Egg possible Oling builds'
  );
  assert.equal(
    completeBuildGrid.querySelectorAll('.oling-lab-complete-set-preview')
      .length,
    2
  );
  assert.equal(
    completeBuildGrid.querySelectorAll(
      '.oling-lab-set-build-art > .oling-lab-oling-layer'
    ).length,
    8
  );
  assert.deepEqual(
    [
      ...completeBuildGrid
        .querySelector('.oling-lab-set-build-art')
        .querySelectorAll('.oling-lab-oling-layer')
    ].map((layer) => layer.className),
    [
      'oling-lab-oling-layer is-flight',
      'oling-lab-oling-layer is-body',
      'oling-lab-oling-layer is-eyes',
      'oling-lab-oling-layer is-mouth'
    ]
  );
  assert.match(completeBuildGrid.textContent, /MosscommonStoneuncommon/);
  assert.match(
    menu.querySelector('.oling-lab-egg-info-panel h3').textContent,
    /Possible Oling Builds/
  );
  assert.equal(
    menu.querySelector('.oling-lab-egg-info-panel .oling-lab-incubator-copy'),
    null
  );
  assert.equal(
    menu.querySelector('.oling-lab-egg-info-panel .oling-lab-detail-list'),
    null
  );

  assert.doesNotThrow(() =>
    [...menu.querySelectorAll('button')]
      .find((button) => button.textContent === 'Info')
      .click()
  );
  previewFrame = menu.querySelector('.oling-lab-incubator-preview-frame');
  assert.equal(
    previewFrame.firstElementChild?.className,
    'oling-lab-incubator-used'
  );
  const incubatorInfoPanel = menu.querySelector(
    '.oling-lab-incubator-info-panel'
  );
  assert.equal(incubatorInfoPanel.querySelector('h3'), null);
  assert.equal(
    incubatorInfoPanel.querySelector('.oling-lab-incubator-description-name')
      .textContent,
    'Incubator'
  );
  assert.equal(
    incubatorInfoPanel.querySelector(
      '.oling-lab-incubator-description-card > p'
    ).textContent,
    'A worn but reliable incubator.'
  );
  const incubatorInfoGrid = incubatorInfoPanel.querySelector(
    '.oling-lab-incubator-info-grid'
  );
  assert.equal(incubatorInfoGrid.children.length, 4);
  assert.match(
    incubatorInfoGrid.textContent,
    /Rarity: basicHatch Speed: NormalSpecial Effect: NonePassive Bonuses: None/
  );
});

test('Oling Lab startup composes its feature factories without hanging', async () => {
  const calls = [];
  const createToolset = (overrides = {}) =>
    new Proxy(overrides, {
      get(target, property) {
        return property in target ? target[property] : () => undefined;
      }
    });
  const element = createToolset({
    hidden: true,
    classList: createToolset(),
    style: createToolset(),
    addEventListener() {},
    setAttribute() {}
  });
  const context = {
    Promise,
    Map,
    Set,
    Math,
    JSON,
    Date,
    encodeURIComponent,
    document: {
      querySelector: () => element,
      getElementById: () => element,
      addEventListener() {}
    },
    window: {
      clearInterval() {},
      setInterval() {},
      setTimeout() {},
      addEventListener() {},
      SetScriptLoaded(pathname) {
        calls.push(pathname);
      },
      Ready: { set: (key) => calls.push(key) },
      createOlingLabCamera: () =>
        createToolset({
          getDisplayedLabColumns: () => 1,
          clampCameraTarget() {},
          ensureCameraFrame() {},
          resetCameraIfNeeded() {},
          zoomLabAt() {},
          panLabBy() {}
        }),
      createOlingLabData: () => createToolset(),
      createOlingLabMenuShell: () => createToolset(),
      createOlingLabDataFlow: () =>
        createToolset({
          loadRarityPalette: () => Promise.resolve(),
          loadLab() {}
        }),
      createOlingLabFurniturePlacement: () => createToolset(),
      createOlingLabUi: () => createToolset(),
      createOlingLabWallpapers: () =>
        createToolset({ applyWallpaper() {}, openWallpaperMenu() {} }),
      createOlingLabHatchControls: () => createToolset(),
      createOlingLabIncubator: () => createToolset(),
      createOlingLabRestAndInteractionTools: () => createToolset(),
      createOlingLabExplorerGateway: () => createToolset(),
      createOlingLabPurchases: () => createToolset(),
      createOlingLabFurnitureMenus: () => createToolset(),
      createOlingLabRenderer: () => createToolset({ renderLab() {} }),
      OlingLabOlings: { create: () => createToolset() },
      OlingLabRoaming: { create: () => createToolset() }
    }
  };

  [...runtimeSupportScripts, ...startupScripts].forEach(([fileName]) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });
  vm.runInNewContext(
    fs.readFileSync(path.join(scriptsDirectory, 'lab/core/lab.js'), 'utf8'),
    context,
    { filename: 'lab.js' }
  );
  await Promise.resolve();

  assert.deepEqual(calls, ['/scripts/olings/lab/core/lab.js', 'oling-lab']);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptsDirectory = path.join(__dirname, '../../public/scripts/olings');
const featureScripts = [
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
  ['lab/data/lab-data-flow.js', 'createOlingLabDataFlow']
];
const explorerGatewayScripts = [
  [
    'lab/explorer-gateway/render-tools.js',
    'createOlingLabExplorerRenderTools'
  ]
];
const roamingScripts = [
  ['lab/room/lab-roaming-targets.js', 'createOlingLabRoamingTargets']
];
const startupScripts = [
  ['lab/core/lab-runtime.js', 'createOlingLabRuntime'],
  ['lab/core/lab-startup.js', 'createOlingLabStartup']
];
const olingViewScripts = [
  ['lab/olings/preview.js', 'createOlingLabPreviewTools'],
  ['lab/olings/build.js', 'createOlingLabBuildTools'],
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
  ['lab/furniture-menus/furniture-tabs.js', 'createOlingLabFurnitureTabs'],
  ['lab/furniture-menus/slot-tabs.js', 'createOlingLabFurnitureSlotTabs'],
  ['lab/furniture-menus/shelf-inventory.js', 'createOlingLabShelfInventory'],
  ['lab/furniture-menus/shelf-storage.js', 'createOlingLabShelfStorage']
];
const furniturePlacementScripts = [
  [
    'lab/furniture-placement/grid-state.js',
    'createOlingLabFurnitureGridState'
  ],
  [
    'lab/furniture-placement/mutations.js',
    'createOlingLabFurnitureMutations'
  ],
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
  const facadeIndex = page.indexOf(
    "'/scripts/olings/lab/room/lab-roaming.js'"
  );

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

test('Oling Lab furniture menu facade composes its extracted modules', () => {
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
      path.join(
        scriptsDirectory,
        'lab/furniture-menus/lab-furniture-menus.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'lab-furniture-menus.js' }
  );

  const menus = context.window.createOlingLabFurnitureMenus({});
  assert.equal(typeof menus.createActionPanel, 'function');
  assert.equal(typeof menus.openSlotMenu, 'function');
  assert.equal(typeof menus.openPlacedItemMenu, 'function');
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

  startupScripts.forEach(([fileName]) => {
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

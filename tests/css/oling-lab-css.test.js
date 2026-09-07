const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/olings');
const labEntryPath = path.join(cssDirectory, 'lab', 'lab.css');
const modules = [
  'core/base-and-room.css',
  'core/rest-visuals.css',
  'core/base-actions.css',
  'core/lab-expansion.css',
  'menu-and-adventures/index.css',
  'furniture-and-storage/index.css',
  'incubation/index.css',
  'hatch-and-olings/index.css',
  'core/panel-controls.css',
  'core/panel-surfaces.css',
  'core/responsive.css',
  'tutorial/lab-tutorial.css',
  'core/privacy-settings.css'
];
const furnitureAndStorageModules = [
  'furniture-info-and-move.css',
  'furniture-slots.css',
  'shelf-stage.css',
  'shelf-stack-and-selling.css',
  'item-influence.css',
  'item-influence-panel.css'
];
const menuAndAdventureModules = [
  'shell.css',
  'rest-panel.css',
  'explorer-adventures.css',
  'gateway-and-active-adventure.css',
  'action-cards.css',
  'tabs.css',
  'explorer-layout.css'
];
const incubationModules = [
  'inventory-actions.css',
  'hero-and-used.css',
  'dashboard-status.css',
  'egg-insertion-and-picker.css',
  'detail-panels.css',
  'detail-rows-and-previews.css',
  'side-panel.css'
];
const hatchAndOlingModules = [
  'hatch-reveal.css',
  'hatch-build.css',
  'hatch-influences.css',
  'oling-info.css',
  'oling-actions-and-preview.css',
  'side-panel-and-layout.css',
  'oling-name-editor.css',
  'oling-storage.css'
];

test('single incubator influence slots mirror the Incubate layout', () => {
  const styles = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'furniture-and-storage',
      'item-influence.css'
    ),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-item-slot-row\[data-influence-slot-count='1'\]\s*{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*grid-template-rows: minmax\(0, 1fr\)[^}]*padding: 0/s
  );
  assert.match(
    styles,
    /\.oling-lab-item-slot-row\[data-influence-slot-count='1'\][^{]*\.oling-lab-item-influence-slot\s*{[^}]*grid-template-rows: minmax\(0, 1fr\) auto[^}]*place-items: center[^}]*padding: 1rem[^}]*background: transparent/s
  );
  assert.match(
    styles,
    /\.oling-lab-item-slot-row\[data-influence-slot-count='1'\][^{]*\.oling-lab-item-influence-marker\s*{[^}]*position: relative[^}]*height: 30%[^}]*transform: none/s
  );
  assert.match(
    styles,
    /\.oling-lab-items-stage\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s
  );
  assert.doesNotMatch(
    styles,
    /\.oling-lab-items-stage > \.oling-lab-item-slot-row/
  );
});

test('Incubator egg inventory mirrors the paginated Influence layout', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'side-panel.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-incubator-egg-inventory \.oling-lab-incubator-egg-card\s*{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*grid-template-rows: minmax\(0, 1fr\)[^}]*width: 100%[^}]*aspect-ratio: 1 \/ 1[^}]*background: rgb\(255 255 255 \/ 10%\)[^}]*color: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-preview-frame\s*{[^}]*width: 100%[^}]*height: auto[^}]*aspect-ratio: 16 \/ 9[^}]*overflow: hidden/s
  );
  assert.doesNotMatch(
    styles,
    /\.oling-lab-incubator-overview\.is-choosing-egg[^}]*height: auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-inventory \.oling-lab-egg-picker-grid\s*{[^}]*position: relative[^}]*display: grid[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*grid-template-rows: repeat\(2, auto\)[^}]*overflow: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-empty-cell\s*{[^}]*width: 100%[^}]*aspect-ratio: 1 \/ 1[^}]*visibility: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-empty-message\s*{[^}]*position: absolute[^}]*inset: 0[^}]*display: grid[^}]*place-items: center[^}]*border: 2px dashed currentColor[^}]*pointer-events: none/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-pagination\s*{[^}]*grid-template-columns: 2rem minmax\(0, 1fr\) 2rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-description\s*{[^}]*display: grid[^}]*overflow: hidden[^}]*background: rgb\(255 255 255 \/ 8%\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-menu-action\.is-egg-action:disabled\s*{[^}]*background: #6e7478[^}]*color: #d7dadd[^}]*opacity: 1/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-quantity\s*{[^}]*top: 0\.4rem[^}]*left: 0\.45rem[^}]*font-size: 0\.8rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-name\s*{[^}]*right: 0\.3rem[^}]*bottom: 0\.35rem[^}]*left: 0\.3rem[^}]*font-size: clamp\(0\.5rem, 1\.6vw, 0\.68rem\)[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-card > img,[^{]*\.oling-lab-incubator-egg-placeholder\s*{[^}]*width: 100%[^}]*height: 100%[^}]*padding: 0/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-card\.is-selected\s*{[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-egg-card:not\(:disabled\):hover\s*{[^}]*background: var\(--oling-lab-menu-secondary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
});

test('Incubator egg drop target uses the themed Drop to Store treatment', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'side-panel.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-egg-insertion-stage\.is-egg-drop-target::after\s*{[^}]*display: grid[^}]*place-items: center[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)[^}]*content: attr\(data-oling-egg-drop-message\)[^}]*font-size: 1\.2rem[^}]*font-weight: 900/s
  );
  assert.match(
    styles,
    /\.oling-lab-hatch-timer-badge:is\(\.is-staged, \.is-ready-to-start\)\s*{[^}]*top: 1rem[^}]*right: auto[^}]*bottom: auto[^}]*left: 50%[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*transform: translateX\(-50%\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-drag-ghost\s*{[^}]*width: 6\.5rem[^}]*aspect-ratio: 1[^}]*pointer-events: none[^}]*transform: translate\(-50%, -50%\)[^}]*transition: transform 160ms ease/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-drag-ghost\.is-over-incubator\s*{[^}]*transform: translate\(-50%, -50%\) scale\(0\.55\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-drag-ghost > img,[^{]*\.oling-lab-egg-drag-ghost > \.oling-lab-incubator-egg-placeholder\s*{[^}]*width: 100%[^}]*height: 100%[^}]*object-fit: contain/s
  );
});

test('Incubator overview replaces staged egg inventory with influence shortcuts', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'side-panel.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-incubator-influence-summary\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\)[^}]*overflow: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-preview-frame\s*{[^}]*position: relative[^}]*box-sizing: border-box[^}]*width: 100%[^}]*height: auto[^}]*aspect-ratio: 16 \/ 9[^}]*background:/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-preview-frame[\s\S]*> :is\([^}]*\.oling-lab-egg-insertion-stage,[^}]*\.oling-lab-item-slot-row,[^}]*\.oling-lab-incubator-used,[^}]*\.oling-lab-egg-used[^}]*\)\s*{[^}]*width: 100%[^}]*height: 100%[^}]*min-height: 0[^}]*aspect-ratio: auto/s
  );
  assert.doesNotMatch(styles, /--oling-lab-incubator-preview-height|1cqw/);
  assert.match(
    styles,
    /\.oling-lab-incubator-overview:not\(\.is-choosing-egg\)[^{]*\.oling-lab-incubator-influence-summary\s*{[^}]*align-self: stretch[^}]*height: 100%/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-insertion-stage\.is-drawer-detail\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s
  );
  assert.match(
    styles,
    /\.is-drawer-detail[^{]*:is\(\.oling-lab-incubator-used, \.oling-lab-egg-used\)\s*{[^}]*width: 100%[^}]*height: 100%[^}]*aspect-ratio: auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-grid\s*{[^}]*display: grid[^}]*grid-auto-columns: minmax\(12rem, 1fr\)[^}]*grid-auto-flow: column[^}]*height: 100%[^}]*overflow-x: auto[^}]*overflow-y: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card\s*{[^}]*grid-template:[^}]*'status' auto[^}]*'visual' minmax\(0, 1fr\)[^}]*'name' auto[^}]*width: 100%[^}]*height: 100%[^}]*background: rgb\(255 255 255 \/ 10%\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card[^{]*> \.oling-lab-item-influence-marker\s*{[^}]*position: relative[^}]*top: auto[^}]*left: auto[^}]*width: min\(22%, 4rem\)[^}]*aspect-ratio: 1[^}]*transform: none/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card > strong\s*{[^}]*position: static[^}]*grid-area: name[^}]*justify-self: center[^}]*font-size: 1\.35rem[^}]*text-align: center[^}]*transform: none/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-status\s*{[^}]*position: static[^}]*grid-area: status[^}]*justify-self: end/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-empty-state\s*{[^}]*grid-area: visual|\.oling-lab-incubator-influence-empty-state\s*{[^}]*max-width: 18rem[^}]*text-align: center/s
  );
  assert.doesNotMatch(styles, /\.oling-lab-incubator-influence-marker/);
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-grid\[data-influence-slot-count='1'\]\s*{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*grid-auto-flow: row/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card\.has-item\s*{[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card:disabled\s*{[^}]*opacity: 1/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-influence-card:not\(:disabled\):hover\s*{[^}]*background: var\(--oling-lab-menu-secondary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
});

test('Incubator Egg tab fills its details area with complete Oling set builds', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'detail-panels.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-egg-info-panel\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\)[^}]*overflow: hidden[^}]*align-content: stretch/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-info-panel \.oling-lab-complete-set-preview-grid\s*{[^}]*min-height: 0[^}]*grid-template-columns: repeat\(auto-fill, minmax\(7\.25rem, 1fr\)\)[^}]*overflow-y: auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-egg-info-panel \.oling-lab-complete-set-preview\s*{[^}]*height: 100%[^}]*grid-template-rows: minmax\(0, 1fr\) 2\.8rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-complete-set-preview[\s\S]*\.oling-lab-set-build-art[\s\S]*> \.oling-lab-oling-layer\s*{[^}]*position: absolute[^}]*width: 88%[^}]*height: 88%[^}]*object-fit: contain/s
  );
});

test('Incubator Info tab uses a centered description and a filling two-by-two grid', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'detail-panels.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-incubator-info-panel\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\)[^}]*overflow: hidden[^}]*align-content: stretch/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-description-card\s*{[^}]*display: grid[^}]*justify-items: center[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-description-card > p\s*{[^}]*margin: 0[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-info-panel \.oling-lab-incubator-info-grid\s*{[^}]*height: 100%[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)[^}]*overflow: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-incubator-info-grid \.oling-lab-detail-row\s*{[^}]*min-height: 0[^}]*display: grid[^}]*place-content: center[^}]*justify-items: center[^}]*text-align: center/s
  );
});

test('Supply Shelf storage uses a paginated 4x2 inventory and description', () => {
  const shelf = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'furniture-and-storage', 'shelf-stage.css'),
    'utf8'
  );
  const selling = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'furniture-and-storage',
      'shelf-stack-and-selling.css'
    ),
    'utf8'
  );

  assert.match(
    shelf,
    /\.oling-lab-supply-storage-panel-content\s*{[^}]*display: grid[^}]*grid-template-rows:[^}]*min-height: 0[^}]*overflow: hidden/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-grid\s*{[^}]*display: grid[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)[^}]*aspect-ratio: 2 \/ 1/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-description\s*{[^}]*display: grid[^}]*min-height: 0[^}]*overflow: hidden/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-pagination\s*{[^}]*display: grid[^}]*grid-template-columns: 2\.5rem minmax\(3rem, 1fr\) 2\.5rem/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-units\s*{[^}]*display: grid[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-panel-content\s*{[^}]*grid-template-rows: minmax\(0, 1fr\) 21rem/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-details\s*{[^}]*overflow: hidden/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-units\s*{[^}]*grid-template-rows: repeat\(2, minmax\(0, 1fr\)\)[^}]*aspect-ratio: 2 \/ 1/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-selector\s*{[^}]*grid-template-columns: 2\.5rem minmax\(3rem, 1fr\) 2\.5rem/s
  );
  assert.match(
    selling,
    /\.oling-lab-supply-storage-quick-sell-value img\s*{[^}]*width: 1\.35rem[^}]*height: 1\.35rem/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-item\.is-selected\s*{[^}]*border-color: transparent[^}]*background: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-unit\s*{[^}]*border: 0[^}]*background: rgb\(255 255 255 \/ 8%\)/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-unit\.is-selected\s*{[^}]*background: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-item\.is-selected:hover\s*{[^}]*border-color: transparent[^}]*background: var\(--wall-decoration-panel-secondary\)/s
  );
  assert.match(
    shelf,
    /\.oling-lab-supply-storage-unit\.is-selected:hover\s*{[^}]*background: var\(--wall-decoration-panel-secondary\)/s
  );
  assert.doesNotMatch(shelf, /shelf-viewport|shelf-zoom-controls|is-panning/);
});

test('Oling lab stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(labEntryPath, 'utf8');
  const imports = [
    ...entry.matchAll(/@import url\('\.\/([^?']+)(?:\?v=[^']+)?'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, modules);
  assert.equal(
    entry
      .trim()
      .split('\n')
      .filter((line) => line.startsWith("@import url('./")).length,
    modules.length
  );
  assert.match(
    entry,
    /@import url\('\.\/core\/base-and-room\.css\?v=2026-09-04-01'\);/
  );

  const baseAndRoom = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'base-and-room.css'),
    'utf8'
  );
  assert.match(
    baseAndRoom,
    /@import url\('\.\/room-grid\.css\?v=2026-09-01-06'\);/
  );
  assert.match(
    baseAndRoom,
    /@import url\('\.\/room-furniture\.css\?v=2026-09-01-07'\);/
  );
  assert.match(
    baseAndRoom,
    /@import url\('\.\/room-wall-decorations\.css\?v=2026-09-01-06'\);/
  );

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'lab', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
  });
});

test('Oling lab wallpaper repeats at exactly one tile per grid cell', () => {
  const grid = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-grid.css'),
    'utf8'
  );
  const brickTile = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/images/olings/lab/wallpapers/brick/tile.svg'
    ),
    'utf8'
  );
  const prototypeTile = fs.readFileSync(
    path.join(
      __dirname,
      '../../public/images/olings/lab/wallpapers/prototype/tile.svg'
    ),
    'utf8'
  );

  assert.match(grid, /background-image: var\(--oling-lab-wallpaper-image\)/);
  assert.match(grid, /background-size: var\(--oling-lab-wallpaper-size\)/);
  assert.match(
    grid,
    /background-position: var\(--oling-lab-wallpaper-position\)/
  );
  assert.match(
    grid,
    /\.oling-lab-room\s*{[^}]*--oling-lab-customise-stroke-width: max\(\s*4px,\s*calc\(var\(--oling-lab-cell\) \* 0\.0078125\)/s
  );
  assert.match(
    grid,
    /\.oling-lab-room\s*{[^}]*--oling-lab-furniture-grid-border-width: max\(\s*3px,\s*calc\(var\(--oling-lab-cell\) \* 0\.0078125\)[^}]*--oling-lab-empty-grid-border-colour: #d9dee1/s
  );
  assert.match(
    grid,
    /\.is-customising-furniture \.oling-lab-cell::after\s*{[^}]*inset: 0[^}]*box-sizing: border-box[^}]*border: var\(--oling-lab-furniture-grid-border-width\) solid\s+var\(--oling-lab-empty-grid-border-colour\)/s
  );
  assert.match(
    grid,
    /\.is-customising-furniture \.oling-lab-cell\.is-furniture-occupied::after,\s*\.is-customising-furniture \.oling-lab-cell\.is-furniture-drag-target::after\s*{[^}]*border-color: var\(--furniture-primary-colour, #b7ebe8\)/s
  );
  assert.doesNotMatch(grid, /oling-lab-empty-grid-keyline-colour/);
  assert.match(
    grid,
    /\.oling-lab-plus\s*{[^}]*border: var\(--oling-lab-customise-stroke-width\) dashed/s
  );
  assert.match(
    grid,
    /\.is-customising-furniture \.oling-lab-plus\s*{[^}]*border-width: var\(--oling-lab-furniture-grid-border-width\)/s
  );
  assert.doesNotMatch(
    grid,
    /\.oling-lab-cell::after\s*{[^}]*var\(--oling-lab-grid-line\)/s
  );
  assert.match(brickTile, /viewBox="0 0 512 512"/);
  assert.match(brickTile, /var\(--wall-background, #d8d2c8\)/);
  assert.match(brickTile, /var\(--wall-dark, #b95e55\)/);
  assert.match(prototypeTile, /var\(--wall-background, #f7fafc\)/);
  assert.match(prototypeTile, /var\(--wall-primary, #2e86de\)/);
});

test('Oling lab furniture controls use non-overlapping cell-state borders', () => {
  const furniture = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-furniture.css'),
    'utf8'
  );
  const expansion = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'lab-expansion.css'),
    'utf8'
  );

  assert.match(
    furniture,
    /\.is-customising-furniture \.oling-lab-item\s*{[^}]*--furniture-border-width: var\(--oling-lab-furniture-grid-border-width\)[^}]*z-index: auto[^}]*border-radius: 0/s
  );
  assert.match(
    furniture,
    /\.oling-lab-item::before\s*{[^}]*background-size: var\(--oling-lab-cell\) var\(--oling-lab-cell\)[^}]*pointer-events: none/s
  );
  assert.match(
    furniture,
    /\.oling-lab-page:not\(\.is-editing\) \.oling-lab-item::after\s*{[^}]*z-index: 8[^}]*box-shadow: inset 0 0 0 var\(--oling-lab-furniture-grid-border-width\)[^}]*pointer-events: none/s
  );
  assert.match(
    furniture,
    /\.oling-lab-page:not\(\.is-editing\) \.oling-lab-item\.is-selected::before,[\s\S]*\.oling-lab-furniture-footprint-label\s*{[^}]*opacity: 1/s
  );
  assert.match(
    furniture,
    /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.oling-lab-item:hover\s*{[^}]*--furniture-footprint-colour: var\(\s*--furniture-footprint-secondary-colour/s
  );
  assert.match(
    furniture,
    /\.oling-lab-item:has\(> \.oling-lab-item-hit:focus-visible\)\s*{[^}]*--furniture-footprint-colour: var\(\s*--furniture-footprint-secondary-colour/s
  );
  assert.doesNotMatch(furniture, /\.oling-lab-item:focus-within/);
  assert.match(
    furniture,
    /\.oling-lab-furniture-footprint-label\s*{[^}]*top: 0[^}]*right: 0[^}]*gap: 0[^}]*background: transparent[^}]*pointer-events: none/s
  );
  assert.doesNotMatch(
    furniture,
    /\.oling-lab-furniture-footprint-label\s*{[^}]*border(?:-(?:top|right|bottom|left))?:/s
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-footprint-type\s*{[^}]*padding-top: calc\([^}]*var\(--oling-lab-furniture-grid-border-width\)[^}]*padding-right: calc\([^}]*var\(--oling-lab-furniture-grid-border-width\)[^}]*background: var\(--furniture-footprint-colour\)[^}]*color: var\(--backgroundcolour, #202020\)/s
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-footprint-name\s*{[^}]*padding-right: calc\([^}]*var\(--oling-lab-furniture-grid-border-width\)[^}]*background: var\(--backgroundcolour, #202020\)[^}]*color: var\(--furniture-footprint-colour\)/s
  );
  assert.match(
    furniture,
    /\.oling-lab-page\.is-editing \.oling-lab-item::before,\s*\.oling-lab-page\.is-editing \.oling-lab-furniture-footprint-label\s*{[^}]*display: none/s
  );
  assert.doesNotMatch(
    furniture,
    /\.is-customising-furniture \.oling-lab-item::after/
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-remove\s*{[^}]*top: 0[^}]*right: 0[^}]*border-radius: 0/s
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-drag-ghost\s*{[^}]*transition:\s*transform 120ms ease,\s*opacity 120ms ease/s
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-drag-preview\s*{[^}]*opacity: 0\.65/s
  );
  assert.match(
    furniture,
    /\.oling-lab-furniture-drag-ghost\s*{[^}]*background: transparent[^}]*opacity: 0\.65/s
  );
  assert.doesNotMatch(
    furniture,
    /\.oling-lab-furniture-drag-ghost\.is-invalid::after/
  );
  assert.doesNotMatch(
    furniture,
    /\.oling-lab-furniture-drag-ghost[^}]*filter:/s
  );
  assert.doesNotMatch(furniture, /drop-shadow\(0 0 0\.35rem/);
  assert.match(
    furniture,
    /\.oling-lab-furniture-drag-ghost\.is-over-storage\s*{[^}]*scale\(0\.55\)[^}]*opacity: 0\.65/s
  );
  assert.match(
    furniture,
    /\.oling-lab-item\.is-furniture-swap-target\s*{[^}]*opacity: 0/s
  );
  assert.doesNotMatch(furniture, /\.oling-lab-furniture-panel-header/);
  assert.doesNotMatch(furniture, /is-furniture-(?:drag-)?internal-edge/);
  assert.doesNotMatch(furniture, /--furniture-outline-/);
  assert.match(
    expansion,
    /\.oling-lab-expansion-purchase \.oling-lab-plus\.is-expansion\s*{[^}]*width: 44%[^}]*aspect-ratio: 1/s
  );
  assert.match(
    expansion,
    /\.oling-lab-cell\.is-purchasable\[data-oling-lab-row='0'\]::after\s*{[^}]*border-bottom: 0/s
  );
  assert.match(
    expansion,
    /\.oling-lab-cell\.is-purchasable\[data-oling-lab-row='1'\]::after\s*{[^}]*border-top: 0/s
  );
});

test('Oling lab wall decorations use a responsive drawer and drop target', () => {
  const decorations = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-wall-decorations.css'),
    'utf8'
  );

  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\s*{[^}]*position: fixed[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto[^}]*transform: translateX/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\s*{[^}]*right: 0[^}]*bottom: 0[^}]*border: 0/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel-toggle\s*{[^}]*writing-mode: vertical-rl/s
  );
  assert.doesNotMatch(
    decorations,
    /\.oling-lab-wall-decoration-panel-toggle\s*{[^}]*transform: rotate\(180deg\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-store-all\s*{[^}]*background: var\(--warningcolour, #ff3333\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-card\s*{[^}]*aspect-ratio: 3 \/ 4[^}]*border: 0[^}]*background: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel-header::after,\s*\.oling-lab-wall-decoration-panel-footer::before\s*{[^}]*right: 1rem[^}]*left: 1rem[^}]*height: 6px[^}]*border-radius: 999px[^}]*background: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel-toggle\s*{[^}]*border: 3px solid var\(--wall-decoration-panel-primary\)[^}]*background: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\s*{[^}]*transform: translateX\(calc\(100% \+ 1\.25rem\)\)[^}]*transition: transform 220ms ease-in-out/s
  );
  assert.match(
    decorations,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.oling-lab-wall-decoration-panel\s*{[^}]*transition: none/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel-footer\s*{[^}]*position: relative[^}]*padding-top: calc\(1rem \+ 6px\)[^}]*}\s*\.oling-lab-wall-decoration-panel-footer::before\s*{[^}]*top: 0/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-card > img\s*{[^}]*place-self: center[^}]*object-position: center/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-card\s*{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-card-copy\s*{[^}]*min-width: 0[^}]*overflow: hidden/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-card-copy > strong\s*{[^}]*overflow: hidden[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-store-all:disabled\s*{[^}]*background: var\(--disabledcolour, #777\)[^}]*opacity: 1/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\.is-drop-target::after\s*{[^}]*background: rgb\(54 118 58\)[^}]*content: 'Drop here to store'/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\.is-drop-target\s*{[^}]*outline: 0/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-panel\.is-drop-target\s+\.oling-lab-wall-decoration-panel-toggle\s*{[^}]*background: rgb\(54 118 58\)/s
  );
  assert.match(
    decorations,
    /\.is-customising-wall-decorations \.oling-lab-wall-decoration\s*{[^}]*--wall-decoration-border-width: var\(--oling-lab-customise-stroke-width\)[^}]*--wall-decoration-control-size: calc\([^}]*var\(--oling-lab-cell\) \* 0\.0546875[^}]*border-radius: var\(--wall-decoration-corner-radius\)/s
  );
  assert.doesNotMatch(
    decorations,
    /\.is-customising-wall-decorations \.oling-lab-wall-decoration\s*{[^}]*outline:/s
  );
  assert.match(
    decorations,
    /\.is-customising-wall-decorations \.oling-lab-wall-decoration::after\s*{[^}]*position: absolute[^}]*z-index: 1[^}]*inset: 0[^}]*box-sizing: border-box[^}]*border: var\(--wall-decoration-border-width\) solid\s+var\(--wall-decoration-outline-colour\)[^}]*pointer-events: none/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-remove\s*{[^}]*top: 0[^}]*right: 0[^}]*width: var\(--wall-decoration-control-size\)[^}]*height: var\(--wall-decoration-control-size\)[^}]*padding: 0[^}]*box-sizing: border-box[^}]*border: var\(--wall-decoration-border-width\) solid\s+var\(--wall-decoration-primary-colour, #c9beff\)[^}]*border-radius: 0 var\(--wall-decoration-control-radius\) 0\s+var\(--wall-decoration-control-radius\)[^}]*background: var\(--wall-decoration-primary-colour, #c9beff\)[^}]*color: var\(--backgroundcolour, #202020\)[^}]*font-size: var\(--wall-decoration-control-font-size\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration\.is-dragging\s*{[^}]*opacity: 0/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-drag-ghost\.is-over-storage\s*{[^}]*scale\(0\.55\)[^}]*opacity: 1/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-drag-ghost\s*{[^}]*opacity: 0\.9/s
  );
  assert.doesNotMatch(
    decorations,
    /\.oling-lab-wall-decoration-drag-ghost\.is-valid\s*{/
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-drag-ghost\.is-invalid > img\s*{[^}]*grayscale\(1\)[^}]*brightness\(0\.72\)/s
  );
  assert.match(
    decorations,
    /\.oling-lab-wall-decoration-drag-ghost\.is-invalid::after\s*{[^}]*background: color-mix\([^}]*var\(--warningcolour, #ff3333\) 80%[^}]*transparent[^}]*content: ''/s
  );
  assert.match(
    decorations,
    /@media \(max-width: 760px\)[\s\S]*\.oling-lab-wall-decoration-panel\s*{[^}]*transform: translateY/s
  );
  assert.match(
    decorations,
    /\.is-customising-wall-decorations \.oling-lab-item\s*{[^}]*pointer-events: none/s
  );
});

test('Oling lab shared menus use edge-to-edge content and rounded components', () => {
  const shell = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'shell.css'),
    'utf8'
  );
  const tabs = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'tabs.css'),
    'utf8'
  );
  const actions = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'action-cards.css'),
    'utf8'
  );
  const insertion = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'incubation',
      'egg-insertion-and-picker.css'
    ),
    'utf8'
  );
  const emptyStates = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'hatch-and-olings',
      'oling-actions-and-preview.css'
    ),
    'utf8'
  );
  const sidePanels = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'furniture-and-storage',
      'item-influence-panel.css'
    ),
    'utf8'
  );
  assert.match(
    actions,
    /\.oling-lab-panel-back\.is-close\s*{[^}]*font-size: 0\.68rem[^}]*font-weight: 900[^}]*text-transform: uppercase/s
  );
  assert.match(
    actions,
    /\.oling-lab-panel-back\.is-close::before\s*{[^}]*display: none[^}]*border: 0/s
  );
  const itemInfluences = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'furniture-and-storage',
      'item-influence.css'
    ),
    'utf8'
  );
  assert.match(
    itemInfluences,
    /\.oling-lab-panel-back\.is-close\s*{[^}]*width: 3rem[^}]*}[^}]*\.oling-lab-panel-back\.is-close::before\s*{[^}]*display: none[^}]*content: none[^}]*clip-path: none/s
  );
  const incubatorSidePanel = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'side-panel.css'),
    'utf8'
  );
  const fullStages = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'furniture-and-storage',
      'furniture-info-and-move.css'
    ),
    'utf8'
  );

  assert.match(
    shell,
    /\.oling-lab-menu\s*{[^}]*--oling-lab-menu-radius: 0\.65rem[^}]*--oling-lab-element-radius: 0\.5rem[^}]*border-radius: var\(--oling-lab-menu-radius\)/s
  );
  assert.match(
    shell,
    /\.oling-lab-menu-header\s*{[^}]*border-radius: var\(--oling-lab-menu-radius\) var\(--oling-lab-menu-radius\) 0 0/s
  );
  assert.match(
    shell,
    /\.oling-lab-menu-footer\s*{[^}]*border-radius: 0 0 var\(--oling-lab-menu-radius\)[^}]*var\(--oling-lab-menu-radius\)/s
  );
  assert.match(shell, /\.oling-lab-menu-content\s*{[^}]*padding: 1rem 0/s);
  assert.match(
    shell,
    /\.oling-lab-menu-tabs\s*{[^}]*padding-left: var\(--oling-lab-menu-radius\)/s
  );
  assert.match(tabs, /\.oling-lab-tab-panel\s*{[^}]*padding: 1rem 0/s);
  assert.match(
    actions,
    /\.oling-lab-menu-action\s*{[^}]*border-radius: var\(--oling-lab-element-radius\)/s
  );
  assert.match(
    insertion,
    /\.oling-lab-egg-insertion-stage\s*{[^}]*border-radius: 0/s
  );
  assert.match(
    insertion,
    /\.oling-lab-egg-insertion-slot\s*{[^}]*border-radius: inherit/s
  );
  assert.match(
    insertion,
    /\.oling-lab-square-marker:is\([^}]*\.oling-lab-egg-insertion-plus[^}]*\.oling-lab-item-influence-marker[^}]*\.oling-lab-furniture-slot-plus[^}]*\)\s*{[^}]*font-size: 0/s
  );
  assert.match(
    insertion,
    /\.oling-lab-square-marker:is\([^}]*\.oling-lab-egg-insertion-plus[^}]*\.oling-lab-furniture-slot-plus[^}]*\)\s*{[^}]*position: relative/s
  );
  assert.doesNotMatch(
    insertion,
    /\.oling-lab-square-marker:is\([^}]*\.oling-lab-item-influence-marker[^}]*\)\s*{[^}]*position:/s
  );
  assert.match(
    insertion,
    /\.oling-lab-square-marker:is\([^}]*\)::before,[^}]*\.oling-lab-square-marker:is\([^}]*\)::after\s*{[^}]*position: absolute[^}]*top: 50%[^}]*left: 50%[^}]*width: 26%[^}]*height: 8%[^}]*transform: translate\(-50%, -50%\)[^}]*background: currentColor/s
  );
  assert.match(
    insertion,
    /\.oling-lab-square-marker:is\([^}]*\)::after\s*{[^}]*transform: translate\(-50%, -50%\) rotate\(90deg\)/s
  );
  assert.match(
    emptyStates,
    /:is\([^}]*\.oling-lab-content-stage[^}]*\)\s*> \.oling-lab-menu-empty\s*{[^}]*width: 90%[^}]*height: 90%[^}]*place-self: center/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-side-panel\s*{[^}]*box-sizing: border-box[^}]*border-radius: 0/s
  );
  assert.match(
    fullStages,
    /\.oling-lab-tab-panel:has\([^}]*\.oling-lab-egg-insertion-stage[^}]*\.oling-lab-content-stage[^}]*\)\s*{[^}]*overflow: hidden[^}]*padding: 0/s
  );
  assert.match(
    insertion,
    /\.oling-lab-egg-picker-grid:has\(> \.oling-lab-menu-empty\)\s*{[^}]*grid-template-rows: minmax\(0, 1fr\)[^}]*align-content: stretch[^}]*overflow: hidden/s
  );
  assert.match(
    insertion,
    /\.oling-lab-egg-picker-grid \.oling-lab-menu-empty\s*{[^}]*box-sizing: border-box[^}]*width: 100%[^}]*height: auto[^}]*min-height: 0[^}]*align-self: stretch[^}]*margin: 0[^}]*border-radius: 0/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-grid:has\(> \.oling-lab-menu-empty\)\s*{[^}]*grid-template-rows: minmax\(0, 1fr\)[^}]*align-content: stretch[^}]*overflow: hidden/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-grid\s*{[^}]*overflow: hidden[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*grid-template-rows: repeat\(2, auto\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-panel\s*{[^}]*grid-template-rows: auto auto minmax\(0, 1fr\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-panel\.is-filled-single-slot\s*{[^}]*grid-template-rows: minmax\(0, 1fr\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-grid[\s\S]*?\.oling-lab-item-influence-inventory-card\s*{[^}]*width: 100%[^}]*min-height: 0[^}]*aspect-ratio: 1 \/ 1/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-card\.is-selected\s*{[^}]*outline: 0[^}]*background: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-description\s*{[^}]*display: grid[^}]*background: rgb\(255 255 255 \/ 8%\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-description\.is-expanded strong\s*{[^}]*font-size: clamp\(1\.05rem, 3vw, 1\.45rem\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-description\.is-guidance\s*{[^}]*overflow: hidden[^}]*align-content: center[^}]*justify-items: center[^}]*padding: 0\.45rem 0\.75rem/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-description\.is-guidance strong,[^{]*\.oling-lab-item-influence-description\.is-guidance p\s*{[^}]*width: 100%[^}]*min-width: 0[^}]*max-width: 28rem[^}]*overflow-wrap: anywhere/s
  );
  assert.match(
    incubatorSidePanel,
    /\.oling-lab-menu-action\.is-influence-action:disabled\s*{[^}]*background: #6e7478 !important[^}]*color: #d7dadd !important[^}]*opacity: 1/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-drag-ghost\s*{[^}]*position: fixed[^}]*width: 6\.5rem[^}]*aspect-ratio: 1[^}]*pointer-events: none[^}]*transform: translate\(-50%, -50%\)[^}]*transition: transform 160ms ease/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-drag-ghost\.is-over-influence-slot\s*{[^}]*scale\(0\.55\)/s
  );
  assert.match(
    itemInfluences,
    /\.oling-lab-item-influence-slot\.is-item-drop-target::after\s*{[^}]*display: grid[^}]*place-items: center[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*content: attr\(data-oling-item-drop-message\)/s
  );
  assert.match(
    sidePanels,
    /\.oling-lab-item-influence-inventory-panel \.oling-lab-menu-empty\s*{[^}]*box-sizing: border-box[^}]*width: 100%[^}]*height: auto[^}]*min-height: 0[^}]*align-self: stretch[^}]*margin: 0[^}]*border-radius: 0/s
  );
});

test('Oling Rest uses the shared collapsible side-panel layout', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'rest-panel.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-rest-side-panel\s*{[^}]*--wall-decoration-panel-primary: #ffe0c7[^}]*--wall-decoration-panel-surface: var\(--backgroundcolour\)[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto[^}]*width: min\(32rem, calc\(100vw - 5rem\)\)[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-panel-header\s*{[^}]*padding-left: 4\.5rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-panel-content\s*{[^}]*min-height: 0[^}]*overflow: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-stage\s*{[^}]*grid-template-rows: auto auto auto auto[^}]*gap: 0\.65rem[^}]*overflow-y: auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-preview-window\s*{[^}]*aspect-ratio: 16 \/ 9[^}]*grid-template-columns: 3rem minmax\(0, 1fr\) 3rem[^}]*overflow: hidden[^}]*url\('\/images\/olings\/lab\/gui\/egg-background\.jpg'\) center \/ cover no-repeat/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-arrow\s*{[^}]*display: grid !important[^}]*grid-template-rows: 1fr !important[^}]*place-items: center[^}]*align-self: center[^}]*justify-self: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-metric\s*{[^}]*display: grid[^}]*background: rgb\(255 255 255 \/ 7%\)[^}]*color: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-name-card > \.oling-lab-rest-oling-name\s*{[^}]*width: 100%[^}]*font-size: 1\.275rem[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-name-card,\s*\.oling-lab-rest-charge-card\s*{[^}]*min-height: 4\.25rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-rest-side-panel \.oling-lab-rest-toggle\s*{[^}]*width: 100%[^}]*min-height: 2\.75rem[^}]*place-items: center[^}]*justify-content: center[^}]*padding: 0\.55rem[^}]*background: var\(--oling-lab-menu-secondary-colour\)/s
  );
});

test('Explorer Gateway uses the shared tabbed side-panel layout', () => {
  const styles = fs.readFileSync(
    path.join(
      cssDirectory,
      'lab',
      'menu-and-adventures',
      'gateway-and-active-adventure.css'
    ),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-gateway-panel\s*{[^}]*--oling-lab-gateway-tab-height: 2\.15rem[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto[^}]*width: min\(32rem, calc\(100vw - 5rem\)\)[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-panel-tabs\s*{[^}]*position: absolute[^}]*top: calc\(-1 \* var\(--oling-lab-gateway-tab-height\)\)[^}]*width: calc\(100% - var\(--oling-lab-menu-radius, 0\.65rem\)\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-panel-content\s*{[^}]*min-width: 0[^}]*min-height: 0[^}]*padding: 1rem[^}]*overflow: hidden/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-panel-footer \.oling-lab-menu-action\s*{[^}]*width: 100%[^}]*min-height: 2\.75rem[^}]*place-items: center[^}]*justify-content: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-overview\s*{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-overview-preview\s*{[^}]*aspect-ratio: 16 \/ 9[^}]*url\('\/images\/olings\/lab\/gui\/egg-background\.jpg'\) center \/ cover no-repeat/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-overview-visual strong\s*{[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-gateway-overview-cards\s*{[^}]*grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)[^}]*min-height: 0/s
  );
});

test('Oling Lab Back and Close controls use shared rounded theme buttons', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'panel-controls.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-panel-back,\s*\.oling-lab-explorer-adventure-back\s*{[^}]*width: 3rem[^}]*height: 3rem[^}]*place-items: center[^}]*border-radius: var\(--oling-lab-element-radius, 0\.5rem\)[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-wall-decoration-panel \.oling-lab-panel-back\s*{[^}]*background: var\(--wall-decoration-panel-primary\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-panel-back::before\s*{[^}]*background-color: var\(--backgroundcolour\)/s
  );
});

test('Oling lab Wall Style uses a four-column gallery and 16:9 detail preview', () => {
  const actions = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'action-cards.css'),
    'utf8'
  );

  assert.match(
    actions,
    /\.oling-lab-wall-style-panel\s*{[^}]*--wall-decoration-panel-primary: #ffd0c2[^}]*--wall-decoration-panel-secondary: #ff9f80[^}]*width: min\(32rem, calc\(100vw - 5rem\)\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wall-style-panel-content\s*{[^}]*min-height: 0[^}]*overflow: hidden[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wall-style-panel-footer \.oling-lab-menu-action\s*{[^}]*min-height: 0[^}]*padding: 0\.75rem 1rem[^}]*background: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery\s*{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery\s*{[^}]*box-sizing: border-box[^}]*height: 100%[^}]*min-height: 0[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery-card\s*{[^}]*aspect-ratio: 1 \/ 1[^}]*background: rgb\(255 255 255 \/ 10%\)[^}]*text-align: center/s
  );
  assert.match(
    actions,
    /\.oling-lab-menu:has\(\.oling-lab-wallpaper-browser\)\s*{[^}]*--oling-lab-wallpaper-radius: 0\.5rem[^}]*--oling-lab-top-tab-height: 0rem[^}]*border-radius: 0\.65rem/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery-card\s*{[^}]*border-radius: var\(--oling-lab-wallpaper-radius\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery-card > img\s*{[^}]*width: 100%[^}]*height: 100%[^}]*border-radius: calc\(var\(--oling-lab-wallpaper-radius\) \* 0\.65\)[^}]*object-fit: cover/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery-card\.is-selected\s*{[^}]*background: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-gallery-card,[^}]*\.oling-lab-wallpaper-variant\s*{[^}]*touch-action: none/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-drag-ghost\s*{[^}]*position: fixed[^}]*z-index: 2000[^}]*pointer-events: none[^}]*transition:[^}]*transform 120ms ease,[^}]*opacity 120ms ease/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-drag-ghost\s*{[^}]*opacity: 0\.9/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-drag-ghost\.is-over-lab\s*{[^}]*scale\(0\.82\)[^}]*opacity: 1/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-drop-preview\s*{[^}]*position: absolute[^}]*inset: 0[^}]*background: #fff[^}]*pointer-events: none/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-drop-preview::after\s*{[^}]*position: absolute[^}]*inset: 0[^}]*background-image: var\(--oling-lab-wallpaper-image\)[^}]*content: ''[^}]*opacity: 0\.65/s
  );
  assert.doesNotMatch(
    actions,
    /\.oling-lab-wall-style-panel\.is-wallpaper-cancel-target/
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-lab-preview\s*{[^}]*aspect-ratio: 16 \/ 9[^}]*border-radius: 0/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-carousel\s*{[^}]*width: calc\(100% - 2rem\)[^}]*margin: 1rem 1rem 0/s
  );
  assert.doesNotMatch(actions, /\.oling-lab-wallpaper-carousel-arrow/);
  assert.match(
    actions,
    /\.oling-lab-menu-content:has\(\.oling-lab-wallpaper-browser\)\s*{[^}]*overflow-y: hidden[^}]*padding: 0[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-menu:has\(\.oling-lab-wallpaper-browser\) \.oling-lab-menu-footer\s*{[^}]*border-radius: 0 0 0\.65rem 0\.65rem[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-menu:has\(\.oling-lab-wallpaper-browser\) \.oling-lab-menu-header\s*{[^}]*border-radius: 0\.65rem 0\.65rem 0 0[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-actions\.are-actions-hidden\s*{[^}]*visibility: hidden[^}]*pointer-events: none/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-back::before\s*{[^}]*border-right: 1\.15rem solid currentColor/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-carousel-card figcaption\s*{[^}]*position: absolute[^}]*top: 0\.75rem[^}]*left: 50%[^}]*border-radius: 999px[^}]*background: var\(--oling-lab-menu-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(actions, /\.oling-lab-wallpaper-carousel-card/);
  assert.match(actions, /\.oling-lab-wallpaper-back/);
  assert.match(
    actions,
    /\.oling-lab-wallpaper-back\s*{[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variants\s*{[^}]*display: grid[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)[^}]*align-content: start/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant-section\s*{[^}]*align-content: start[^}]*overflow-y: auto[^}]*background: var\(--backgroundcolour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant\s*{[^}]*width: 100%[^}]*height: auto[^}]*aspect-ratio: 1 \/ 1[^}]*border-radius: var\(--oling-lab-wallpaper-radius\)[^}]*background: rgb\(255 255 255 \/ 10%\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant span\s*{[^}]*text-align: center/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant\.is-selected\s*{[^}]*background: var\(--oling-lab-menu-primary-colour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant:hover\s*{[^}]*background: var\(--oling-lab-menu-secondary-colour\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-variant img\s*{[^}]*border-radius: calc\(var\(--oling-lab-wallpaper-radius\) \* 0\.65\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-actions \.oling-lab-menu-action\s*{[^}]*border-radius: var\(--oling-lab-wallpaper-radius\)/s
  );
  assert.match(
    actions,
    /\.oling-lab-wallpaper-actions \[data-oling-lab-wallpaper-apply\]:disabled\s*{[^}]*background: var\(--disabledcolour\)[^}]*color: var\(--backgroundcolour\)[^}]*opacity: 1/s
  );
  assert.match(actions, /\.oling-lab-wallpaper-variant\.is-selected/);
  assert.match(
    actions,
    /@media \(max-width: 760px\)[\s\S]*\.oling-lab-wall-style-panel\s*{[^}]*height: min\(78dvh, 42rem\)/s
  );
});

test('Oling lab Customise categories have selected and mobile toolbar states', () => {
  const shell = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'page-shell.css'),
    'utf8'
  );
  const responsive = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'responsive.css'),
    'utf8'
  );
  const grid = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-grid.css'),
    'utf8'
  );

  assert.match(
    shell,
    /\.oling-lab-toolbar\s*{[^}]*left: 0\.75rem[^}]*display: flex/s
  );
  assert.match(shell, /\.oling-lab-customise-category\[aria-pressed='true'\]/);
  assert.match(
    shell,
    /\.oling-lab-customise-category\s*{[^}]*border-radius: 0\.5rem[^}]*--oling-lab-customise-secondary-colour/s
  );
  assert.match(
    shell,
    /\.oling-lab-customise-category\[aria-pressed='true'\]\s*{[^}]*--oling-lab-customise-primary-colour[^}]*margin-inline: var\(--oling-lab-button-growth-inline-space, 0px\)[^}]*transform: scale\(1\.25\)/s
  );
  assert.match(
    shell,
    /\.oling-lab-edit-toggle\s*{[^}]*border-radius: 0\.5rem[^}]*background: var\(--primarypagecolour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    shell,
    /\.oling-lab-edit-toggle\[aria-pressed='true'\]\s*{[^}]*background: var\(--secondarypagecolour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.doesNotMatch(
    shell,
    /\.oling-lab-customise-category\[aria-pressed='true'\]\s*{[^}]*box-shadow:/s
  );
  assert.doesNotMatch(
    shell,
    /\.oling-lab-edit-toggle\[aria-pressed='true'\]\s*{[^}]*transform: scale\(1\.25\)/s
  );
  assert.match(shell, /transform-origin: top center/);
  assert.match(shell, /transform 200ms ease/);
  assert.match(shell, /margin-inline 200ms ease/);
  assert.match(
    shell,
    /data-oling-lab-customise-transition='closed'[^}]*translateX\(var\(--oling-lab-customise-entry-x, 0px\)\) scale\(0\.85\)/s
  );
  assert.match(shell, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    responsive,
    /bottom: max\(0\.5rem, env\(safe-area-inset-bottom\)\)/
  );
  assert.match(responsive, /\.oling-lab-customise-category/);
  assert.match(grid, /\.is-customising-furniture \.oling-lab-cell::after/);
});

test('Oling lab carried Olings retain pointer control and neutral float motion', () => {
  const olings = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-olings.css'),
    'utf8'
  );

  assert.match(
    olings,
    /\.oling-lab-roamer\s*{[^}]*touch-action: none[^}]*user-select: none/s
  );
  assert.match(
    olings,
    /\.oling-lab-roamer\.is-carried\s*{[^}]*z-index: 20[^}]*cursor: grabbing/s
  );
  assert.match(
    olings,
    /animation: oling-lab-float var\(--oling-lab-float-duration, 2\.8s\)/s
  );
  assert.match(
    olings,
    /\.oling-lab-roamer\.is-carried \.oling-lab-oling-preview\.is-roaming\s*{[^}]*transform: none[^}]*animation: none/s
  );
  assert.match(
    olings,
    /@keyframes oling-lab-float\s*{\s*0%\s*{[^}]*transform: translateY\(0\)/s
  );
});

test('Oling lab Olings use themed room footprints outside Customise mode', () => {
  const olings = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-olings.css'),
    'utf8'
  );

  assert.match(
    olings,
    /\.oling-lab-roamer\s*\{[^}]*--furniture-footprint-colour: var\(\s*--oling-footprint-primary-colour,[^}]*border-radius: 0/s
  );
  assert.match(
    olings,
    /\.oling-lab-roamer::before\s*\{[^}]*inset: 0[^}]*background-size: var\(--oling-lab-cell\) var\(--oling-lab-cell\)[^}]*box-shadow: inset 0 0 0 var\(--oling-lab-furniture-grid-border-width\)[^}]*pointer-events: none/s
  );
  assert.match(
    olings,
    /\.oling-lab-page:not\(\.is-editing\) \.oling-lab-roamer::after\s*\{[^}]*z-index: 8[^}]*box-shadow: inset 0 0 0 var\(--oling-lab-furniture-grid-border-width\)[^}]*pointer-events: none/s
  );
  assert.match(
    olings,
    /\.oling-lab-roamer\.is-selected::before,[\s\S]*\.oling-lab-oling-footprint-label\s*\{[^}]*opacity: 1/s
  );
  assert.match(
    olings,
    /\.oling-lab-roamer:focus-visible\s*\{[^}]*--furniture-footprint-colour: var\(\s*--oling-footprint-secondary-colour/s
  );
  assert.match(
    olings,
    /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.oling-lab-roamer:hover\s*\{[^}]*--furniture-footprint-colour: var\(\s*--oling-footprint-secondary-colour/s
  );
  assert.match(
    olings,
    /\.oling-lab-page\.is-editing \.oling-lab-roamer::before,[\s\S]*\.oling-lab-roamer\.is-carried > \.oling-lab-oling-footprint-label\s*\{[^}]*display: none/s
  );
  assert.doesNotMatch(olings, /#b22626/);
});

test('Oling Pod inventory uses square artwork-led tiles and plain counts', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'oling-storage.css'),
    'utf8'
  );
  const sectionCount = styles.match(
    /\.oling-lab-storage-panel-section-count\s*\{([^}]*)\}/s
  );

  assert.ok(sectionCount);
  assert.match(sectionCount[1], /color: #fff/);
  assert.doesNotMatch(sectionCount[1], /background:/);
  assert.match(
    styles,
    /\.oling-lab-storage-panel-card\s*\{[^}]*aspect-ratio: 1[^}]*background: rgb\(255 255 255 \/ 10%\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-card > \.oling-lab-pod-artwork,[^{]+\{[^}]*width: 66%/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-section \+ \.oling-lab-storage-panel-section::before\s*{[^}]*right: 0[^}]*left: 0[^}]*height: 3px[^}]*border-radius: 999px[^}]*background: #fff/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-stack-count,[^{]+\{[^}]*color: var\(--wall-decoration-panel-primary\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-stack-count\s*\{[^}]*top: 0\.55rem[^}]*left: 0\.6rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-uses,[^{]+\.oling-lab-storage-panel-oling-name\s*\{[^}]*bottom: 0\.55rem[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel-oling-name\s*\{[^}]*overflow: hidden[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/s
  );
  assert.doesNotMatch(styles, /\.oling-lab-storage-panel-close/);
  assert.match(
    styles,
    /\.oling-lab-pod-drag-ghost\s*\{[^}]*aspect-ratio: 1[^}]*border: 0[^}]*background: transparent/s
  );
  assert.doesNotMatch(
    styles,
    /\.oling-lab-pod-drag-ghost \.oling-lab-pod-identity/
  );
  assert.match(
    styles,
    /\.oling-lab-storage-panel\.is-drop-target::after\s*{[^}]*padding: 1\.5rem[^}]*content: attr\(data-storage-drop-message\)[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-drag-ghost\.is-over-storage\s*{[^}]*scale\(0\.55\)[^}]*opacity: 1/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-artwork-layer\.is-back\s*\{[^}]*z-index: 0/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-artwork-layer\.is-front\s*\{[^}]*z-index: 2/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-artwork-layer\.is-base\s*\{[^}]*z-index: 3/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-drag-ghost\.has-live-capture-layers\s*\{[^}]*opacity: 0/s
  );
  assert.doesNotMatch(styles, /box-shadow|drop-shadow/);
});

test('Oling Pod release dialog uses reversed destructive and outlined keep actions', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'oling-storage.css'),
    'utf8'
  );

  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-title\s*{[^}]*background: var\(--oe-purchase-primary-colour\)[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-message\s*{[^}]*text-align: center/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-cancel\s*{[^}]*border: 2px solid var\(--oe-purchase-primary-colour\)[^}]*background: transparent[^}]*color: var\(--oe-purchase-primary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-confirm\s*{[^}]*border: 2px solid var\(--oe-purchase-primary-colour\)[^}]*background: var\(--oe-purchase-primary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-cancel:hover\s*{[^}]*border-color: var\(--oe-purchase-secondary-colour\)[^}]*color: var\(--oe-purchase-secondary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-confirm:hover\s*{[^}]*border-color: var\(--oe-purchase-secondary-colour\)[^}]*background: var\(--oe-purchase-secondary-colour\)/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog\s*\{[^}]*grid-template-rows: auto auto/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-content\s*\{[^}]*gap: 0[^}]*padding: 1\.25rem 1\.5rem 1rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-dialog \.oe-purchase-message,[\s\S]*?\.oling-lab-pod-release-dialog \.oling-lab-pod-release-cancel\s*\{[^}]*font-size: clamp\(0\.82rem, 3\.4vw, 0\.95rem\)[^}]*line-height: 1\.05/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-release-actions\s*\{[^}]*margin-top: 0\.75rem/s
  );
  assert.match(
    styles,
    /\.oling-lab-storage-dialog-status:empty\s*\{[^}]*display: none/s
  );
});

test('Oling Lab status and pod interactions do not use glow effects', () => {
  const storage = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'oling-storage.css'),
    'utf8'
  );
  const info = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'oling-info.css'),
    'utf8'
  );
  const rest = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'rest-visuals.css'),
    'utf8'
  );

  assert.doesNotMatch(storage, /box-shadow|drop-shadow/);
  assert.doesNotMatch(info, /box-shadow/);
  assert.doesNotMatch(rest, /text-shadow/);
});

test('Oling inspect drawer mounts its tabs above the panel body', () => {
  const info = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'oling-info.css'),
    'utf8'
  );

  assert.match(
    info,
    /\.oling-lab-inspect-panel\s*{[^}]*--oling-lab-inspect-tab-height: 2\.15rem[^}]*top: calc\([^}]*var\(--oling-lab-inspect-tab-height\)[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s
  );
  assert.match(
    info,
    /\.oling-lab-inspect-panel-tabs\s*{[^}]*position: absolute[^}]*top: calc\(-1 \* var\(--oling-lab-inspect-tab-height\)\)[^}]*left: var\(--oling-lab-menu-radius, 0\.65rem\)[^}]*height: var\(--oling-lab-inspect-tab-height\)/s
  );
  assert.match(
    info,
    /\.oling-lab-inspect-panel-tabs\[hidden\]\s*{[^}]*display: none/s
  );
  assert.doesNotMatch(info, /\.oling-lab-inspect-panel-close/);
  assert.match(
    info,
    /\.oling-lab-oling-info\s*{[^}]*height: 100%[^}]*grid-template-rows: auto minmax\(0, 1fr\)/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-overview-summary\s*{[^}]*grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-overview-row\s*{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-energy\.is-overview-energy\s*{[^}]*position: static[^}]*grid-template-columns: auto minmax\(0, 1fr\) auto/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-rarity-segments\s*{[^}]*display: flex[^}]*gap: 0\.4rem/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-rarity-segment\s*{[^}]*width: 1\.15rem[^}]*aspect-ratio: 1 \/ 1[^}]*border: 0[^}]*border-radius: 0\.28rem[^}]*background: var\([^}]*--oling-rarity-primary-colour/s
  );
  assert.match(
    info,
    /\.oling-lab-oling-rarity-segment:hover\s*{[^}]*background: var\([^}]*--oling-rarity-secondary-colour/s
  );
  assert.doesNotMatch(info, /\.oling-lab-oling-info-panel/);
  assert.doesNotMatch(info, /is-viewing-oling-info/);
});

test('Oling Build uses one-row rarity selectors below an assembled preview', () => {
  const build = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'hatch-build.css'),
    'utf8'
  );

  assert.match(
    build,
    /\.oling-lab-hatch-build-preview\s*{[^}]*width: 100%[^}]*aspect-ratio: 4 \/ 3[^}]*min-height: 0/s
  );
  assert.doesNotMatch(build, /general-background\.jpg/);
  assert.doesNotMatch(
    build,
    /\.oling-lab-hatch-build-preview \.oling-lab-oling-preview/
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-grid\s*{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s
  );
  assert.match(
    build,
    /\.oling-lab-inspect-panel\s+\.oling-lab-tab-panel:has\(\.oling-lab-hatch-build\)\s*{[^}]*overflow: hidden[^}]*padding: 0/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-stage\s*{[^}]*grid-template-rows: auto auto minmax\(0, 1fr\)[^}]*height: 100%/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-button\s*{[^}]*aspect-ratio: 1 \/ 1[^}]*background: rgb\(255 255 255 \/ 10%\)[^}]*color: #ffffff/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-button\[aria-pressed='true'\]\s*{[^}]*background: var\([^}]*--oling-rarity-primary-colour/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-button\[aria-pressed='true'\][^{]*\.oling-lab-set-preview-meta\s+strong\s*{[^}]*color: var\(--backgroundcolour\)/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-button:hover\s*{[^}]*background: var\([^}]*--oling-rarity-secondary-colour[^}]*transform: translateY\(-2px\)/s
  );
  assert.doesNotMatch(
    build,
    /\.oling-lab-hatch-build-part-button:not\(\[aria-pressed='true'\]\):hover/
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-button \.oling-lab-set-preview-meta strong\s*{[^}]*color: var\([^}]*--oling-rarity-primary-colour/s
  );
  assert.match(
    build,
    /\.oling-lab-hatch-build-part-details\s*{[^}]*align-self: stretch[^}]*min-height: 4rem[^}]*overflow-y: auto/s
  );
  assert.doesNotMatch(build, /is-viewing-hatch-build-info/);
});

test('Oling Pod capture has no target ring or lateral hover movement', () => {
  const styles = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'core', 'room-olings.css'),
    'utf8'
  );
  const hoverKeyframes = styles.match(
    /@keyframes oling-lab-pod-capture-hover\s*\{([\s\S]*?)\n\}/
  );

  assert.doesNotMatch(styles, /\.is-pod-hover-target::before/);
  assert.ok(hoverKeyframes);
  assert.match(hoverKeyframes[1], /translateY\(-1\.25%\)/);
  assert.doesNotMatch(hoverKeyframes[1], /translate\(/);
  assert.match(
    styles,
    /\.oling-lab-roamer\.has-pod-capture-layers\s*> \.oling-lab-oling-preview\.is-roaming\s*\{[^}]*z-index: 1/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-capture-layer\.is-back\s*\{[^}]*z-index: 0/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-capture-layer\.is-front\s*\{[^}]*z-index: 2/s
  );
  assert.match(
    styles,
    /\.oling-lab-pod-capture-layer\.is-base\s*\{[^}]*z-index: 3/s
  );
});

test('Oling lab furniture stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'furniture-and-storage', 'index.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/([^?']+)(?:\?v=[^']+)?'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, furnitureAndStorageModules);
  assert.equal(
    entry.trim().split('\n').length,
    furnitureAndStorageModules.length
  );

  furnitureAndStorageModules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'lab', 'furniture-and-storage', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
  });
});

test('Oling lab menu stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'menu-and-adventures', 'index.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/([^?']+)(?:\?v=[^']+)?'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, menuAndAdventureModules);
  assert.equal(entry.trim().split('\n').length, menuAndAdventureModules.length);

  menuAndAdventureModules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'lab', 'menu-and-adventures', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
  });
});

test('Oling lab incubation stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'incubation', 'index.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/([^?']+)(?:\?v=[^']+)?'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, incubationModules);
  assert.equal(entry.trim().split('\n').length, incubationModules.length);

  incubationModules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'lab', 'incubation', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
  });
});

test('Oling lab hatch and Olings stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'hatch-and-olings', 'index.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/([^?']+)(?:\?v=[^']+)?'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, hatchAndOlingModules);
  assert.equal(entry.trim().split('\n').length, hatchAndOlingModules.length);

  hatchAndOlingModules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'lab', 'hatch-and-olings', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
  });
});

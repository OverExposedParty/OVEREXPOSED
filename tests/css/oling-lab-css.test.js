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
  'menu-and-adventures/index.css',
  'furniture-and-storage/index.css',
  'incubation/index.css',
  'hatch-and-olings/index.css',
  'core/responsive.css'
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
  'tabs.css'
];
const incubationModules = [
  'inventory-actions.css',
  'hero-and-used.css',
  'dashboard-status.css',
  'egg-insertion-and-picker.css',
  'detail-panels.css',
  'detail-rows-and-previews.css'
];
const hatchAndOlingModules = [
  'hatch-reveal.css',
  'hatch-build.css',
  'hatch-influences.css',
  'oling-info.css',
  'oling-actions-and-preview.css',
  'side-panel-and-layout.css'
];

test('Oling lab stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(labEntryPath, 'utf8');
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

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

test('Oling lab furniture stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'lab', 'furniture-and-storage', 'index.css'),
    'utf8'
  );
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

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
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

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
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

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
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

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

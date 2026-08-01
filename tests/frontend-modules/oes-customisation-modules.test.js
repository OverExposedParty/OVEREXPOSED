const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const pagePath = path.join(root, 'public/pages/other/oes-customisation.html');
const modulePaths = [
  'public/scripts/other/oes-customisation/library-data.js',
  'public/scripts/other/oes-customisation/purchase-dialog.js',
  'public/scripts/other/oes-customisation/library-view.js'
];

test('OE Library support modules register their page factories', () => {
  const context = vm.createContext({ window: {} });

  modulePaths.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  });

  assert.equal(typeof context.window.createOeLibraryData, 'function');
  assert.equal(typeof context.window.createOeLibraryPurchaseDialog, 'function');
  assert.equal(typeof context.window.createOeLibraryView, 'function');
});

test('OE Library page loads support modules before its coordinator', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const coordinator = '/scripts/other/oes-customisation/oes-customisation.js';
  const coordinatorIndex = page.indexOf(coordinator);

  assert.ok(coordinatorIndex >= 0);
  modulePaths.forEach((relativePath) => {
    const publicPath = `/${relativePath.replace(/^public\//, '')}`;
    const moduleIndex = page.indexOf(publicPath);

    assert.ok(moduleIndex >= 0, `${publicPath} should be registered`);
    assert.ok(moduleIndex < coordinatorIndex, `${publicPath} should load before the coordinator`);
  });
});

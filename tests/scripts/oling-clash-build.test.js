const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const buildDirectory = path.join(root, 'public/build/olings/clash');

test('Clash pages load the minified production bundles', () => {
  const gamePage = fs.readFileSync(
    path.join(root, 'public/pages/olings/clash.html'),
    'utf8'
  );
  const settingsPage = fs.readFileSync(
    path.join(root, 'public/pages/olings/clash-settings.html'),
    'utf8'
  );

  assert.match(gamePage, /\/build\/olings\/clash\/clash-core\.js/);
  assert.match(gamePage, /\/build\/olings\/clash\/clash-online\.js/);
  assert.match(gamePage, /\/build\/olings\/clash\/clash-tutorial\.js/);
  assert.match(gamePage, /\/build\/olings\/clash\/clash\.css/);
  assert.match(settingsPage, /\/build\/olings\/clash\/clash\.css/);
  assert.match(settingsPage, /\/build\/olings\/clash\/clash-lobby\.js/);
  assert.doesNotMatch(settingsPage, /cdn\.socket\.io/);
  assert.doesNotMatch(gamePage, /'\/scripts\/olings\/clash\/game\/state\.js'/);
});

test('Clash build outputs are present and keep debug implementation separate', () => {
  const core = fs.readFileSync(
    path.join(buildDirectory, 'clash-core.js'),
    'utf8'
  );
  const online = fs.readFileSync(
    path.join(buildDirectory, 'clash-online.js'),
    'utf8'
  );
  const lobby = fs.readFileSync(
    path.join(buildDirectory, 'clash-lobby.js'),
    'utf8'
  );
  const lobbyOnline = fs.readFileSync(
    path.join(buildDirectory, 'clash-lobby-online.js'),
    'utf8'
  );
  const inspector = fs.readFileSync(
    path.join(buildDirectory, 'clash-inspector.js'),
    'utf8'
  );
  const tutorial = fs.readFileSync(
    path.join(buildDirectory, 'clash-tutorial.js'),
    'utf8'
  );
  const css = fs.readFileSync(path.join(buildDirectory, 'clash.css'), 'utf8');

  assert.ok(core.length < 220_000);
  assert.ok(online.length < 10_000);
  assert.ok(lobby.length < 100_000);
  assert.ok(lobbyOnline.length < 10_000);
  assert.ok(inspector.length < 30_000);
  assert.ok(tutorial.length < 70_000);
  assert.ok(css.length < 115_000);
  assert.doesNotMatch(core, /Oling Clash debug controller is ready/);
  assert.match(core, /OlingClashPerformance/);
});

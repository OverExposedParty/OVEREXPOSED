const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/oe-panel');
const panelEntryPath = path.join(cssDirectory, 'oe-panel.css');
const panelModules = [
  'shell.css',
  'shell-stats.css',
  'dashboard-widgets.css',
  'email-widgets.css',
  'email-template-editor.css',
  'pie-chart.css',
  'data-tables.css',
  'alerts-and-actions.css',
  'social-video.css',
  'social-editor-forms.css',
  'responsive.css'
];
const socialEditorModules = [
  'editor-layout-and-preview.css',
  'editor-panels-and-controls.css',
  'social-idea-fields.css',
  'game-pack-fields.css',
  'alignment-controls.css'
];
const alertsAndActionsModules = [
  'alert-list.css',
  'alert-detail.css',
  'action-list-and-player-lookup.css',
  'database-buttons.css'
];

function assertBalancedStylesheet(filePath, fileName) {
  const stylesheet = fs.readFileSync(filePath, 'utf8');
  assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
  assert.equal(
    (stylesheet.match(/{/g) || []).length,
    (stylesheet.match(/}/g) || []).length,
    `${fileName} should have balanced CSS blocks`
  );
}

test('OE Panel stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(panelEntryPath, 'utf8');
  const imports = [
    ...entry.matchAll(/@import url\("\.\/oe-panel\/([^"]+)"\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, panelModules);
  assert.equal(entry.trim().split('\n').length, panelModules.length);

  [
    'shell.css',
    'shell-stats.css',
    'email-widgets.css',
    'email-template-editor.css'
  ].forEach((fileName) => {
    assertBalancedStylesheet(
      path.join(cssDirectory, 'oe-panel', fileName),
      fileName
    );
  });

  const emailEditor = fs.readFileSync(
    path.join(cssDirectory, 'oe-panel', 'email-template-editor.css'),
    'utf8'
  );
  assert.match(
    emailEditor,
    /\.oe-panel-email-template-editor-inspector-title\s*\{[\s\S]*?text-align:\s*center;/
  );
  assert.match(
    emailEditor,
    /\.oe-panel-email-template-editor-stage\s*\{[\s\S]*?background-image:\s*url\('\/images\/background-tile\.png'\);/
  );
});

test('OE Panel social editor stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'oe-panel', 'social-editor-forms.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/social-editor-forms\/([^']+)'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, socialEditorModules);
  assert.equal(entry.trim().split('\n').length, socialEditorModules.length);

  socialEditorModules.forEach((fileName) => {
    assertBalancedStylesheet(
      path.join(cssDirectory, 'oe-panel', 'social-editor-forms', fileName),
      fileName
    );
  });
});

test('OE Panel alerts and actions stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(
    path.join(cssDirectory, 'oe-panel', 'alerts-and-actions.css'),
    'utf8'
  );
  const imports = [
    ...entry.matchAll(/@import url\('\.\/alerts-and-actions\/([^']+)'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, alertsAndActionsModules);
  assert.equal(entry.trim().split('\n').length, alertsAndActionsModules.length);

  alertsAndActionsModules.forEach((fileName) => {
    assertBalancedStylesheet(
      path.join(cssDirectory, 'oe-panel', 'alerts-and-actions', fileName),
      fileName
    );
  });
});

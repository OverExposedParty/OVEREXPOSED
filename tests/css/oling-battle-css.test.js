const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/olings');
const battleEntryPath = path.join(
  cssDirectory,
  'battle',
  'battle-olings.css'
);
const modules = [
  'base.css',
  'arena.css',
  'lobby-layout.css',
  'lobby-parties.css',
  'lobby-picker.css',
  'battlefield.css',
  'momentum.css',
  'lobby-controls.css'
];

test('Oling battle stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(battleEntryPath, 'utf8');
  const imports = [
    ...entry.matchAll(/@import url\('\.\/battle-olings\/([^']+)'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'battle', 'battle-olings', fileName),
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

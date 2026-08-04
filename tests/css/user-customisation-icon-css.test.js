const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/general/online');
const iconEntryPath = path.join(cssDirectory, 'user-customisation-icon.css');
const modules = [
  'icon-and-actions.css',
  'public-profile-account.css',
  'public-profile-modal.css',
  'presence-status.css',
  'stack-layouts.css',
  'responsive.css'
];

test('user customisation icon stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(iconEntryPath, 'utf8');
  const imports = [
    ...entry.matchAll(/@import url\('\.\/user-customisation-icon\/([^']+)'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'user-customisation-icon', fileName),
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

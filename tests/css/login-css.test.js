const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/auth');
const loginEntryPath = path.join(cssDirectory, 'login.css');
const modules = [
  'shell-and-modes.css',
  'forms-and-consent.css',
  'legal-dialog.css',
  'actions-social-status.css',
  'responsive.css'
];

test('login stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(loginEntryPath, 'utf8');
  const imports = [
    ...entry.matchAll(/@import url\('\.\/login\/([^']+)'\);/g)
  ].map((match) => match[1]);

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'login', fileName),
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

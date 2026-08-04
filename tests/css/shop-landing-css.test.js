const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/shop');
const landingEntryPath = path.join(
  cssDirectory,
  'landing-page',
  'landing-page.css'
);
const modules = [
  'base.css',
  'hero.css',
  'categories.css',
  'sections.css',
  'products.css',
  'purchase-dialog.css',
  'responsive.css'
];

test('shop landing stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(landingEntryPath, 'utf8');
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'landing-page', fileName),
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

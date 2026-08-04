const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/general');
const headerEntryPath = path.join(cssDirectory, 'header', 'header.css');
const modules = [
  'base.css',
  'interactions.css',
  'bar.css',
  'overlays.css',
  'splash.css',
  'extra-menu.css',
  'responsive.css'
];

test('header stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(headerEntryPath, 'utf8');
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'header', fileName),
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

test('portrait splash artwork fills from the centre while status stays anchored', () => {
  const stylesheet = fs.readFileSync(
    path.join(cssDirectory, 'header', 'splash.css'),
    'utf8'
  );
  const portraitStart = stylesheet.indexOf('@media (orientation: portrait)');
  const landscapeStart = stylesheet.indexOf('@media (orientation: landscape)');
  const portraitStyles = stylesheet.slice(portraitStart, landscapeStart);
  const imageStyles = stylesheet.match(
    /\.splash-screen-container img,\s*\.splash-screen-container-static img\s*\{([^}]*)\}/
  )?.[1];
  const statusStyles = stylesheet.match(
    /\.splash-screen-container p,\s*\.splash-screen-container-static p\s*\{([^}]*)\}/
  )?.[1];

  assert.ok(portraitStart >= 0, 'portrait splash styles should exist');
  assert.ok(
    landscapeStart > portraitStart,
    'portrait styles should be complete'
  );
  assert.match(imageStyles || '', /width:\s*100%;/);
  assert.match(imageStyles || '', /height:\s*100%;/);
  assert.match(portraitStyles, /object-fit:\s*cover;/);
  assert.match(portraitStyles, /object-position:\s*center;/);
  assert.match(statusStyles || '', /position:\s*absolute;/);
  assert.match(statusStyles || '', /bottom:\s*0;/);
});

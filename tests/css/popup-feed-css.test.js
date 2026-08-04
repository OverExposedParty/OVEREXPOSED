const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const cssDirectory = path.join(__dirname, '../../public/css/general');
const popupFeedEntryPath = path.join(
  cssDirectory,
  'popup-feed',
  'popup-feed.css'
);
const modules = [
  'base.css',
  'achievement.css',
  'opal-reward.css',
  'notifications.css',
  'account-prompt.css',
  'account-benefits-dialog.css',
  'opal-reward-dialog.css',
  'site-update.css',
  'responsive.css'
];

test('popup feed stylesheet imports feature modules in cascade order', () => {
  const entry = fs.readFileSync(popupFeedEntryPath, 'utf8');
  const imports = [...entry.matchAll(/@import url\('\.\/([^']+)'\);/g)].map(
    (match) => match[1]
  );

  assert.deepEqual(imports, modules);
  assert.equal(entry.trim().split('\n').length, modules.length);

  modules.forEach((fileName) => {
    const stylesheet = fs.readFileSync(
      path.join(cssDirectory, 'popup-feed', fileName),
      'utf8'
    );
    assert.ok(stylesheet.trim(), `${fileName} should contain styles`);
    assert.equal(
      (stylesheet.match(/{/g) || []).length,
      (stylesheet.match(/}/g) || []).length,
      `${fileName} should have balanced CSS blocks`
    );
    assert.doesNotMatch(
      stylesheet.trimEnd(),
      /,\s*$/,
      `${fileName} should not end with a dangling selector`
    );
  });
});

test('system notification actions and refresh use theme colours and feedback', () => {
  const stylesheet = fs.readFileSync(
    path.join(cssDirectory, 'popup-feed', 'notifications.css'),
    'utf8'
  );

  assert.match(
    stylesheet,
    /\.system-notification-popup-dismiss\s*\{\s*color:\s*var\(--warningcolour\);/
  );
  assert.match(
    stylesheet,
    /\.system-notification-popup-open-settings\s*\{\s*color:\s*var\(--primarypagecolour\);/
  );
  assert.match(
    stylesheet,
    /\.system-notification-popup-row\.is-refreshed\s*\{\s*animation:\s*oe-status-popup-refresh 220ms ease;/
  );
});

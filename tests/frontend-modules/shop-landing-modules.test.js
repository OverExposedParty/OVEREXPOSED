const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptsDirectory = path.join(
  __dirname,
  '../../public/scripts/shop/landing-page'
);
const featureScripts = [
  'core.js',
  'hatch-preview/product-data.js',
  'hatch-preview/hatch-ui.js',
  'hatch-preview/preview-runtime.js',
  'hatch-preview.js',
  'catalog.js',
  'sections.js',
  'purchase/account-purchase.js',
  'purchase/product-copy.js',
  'purchase/dialog-elements.js',
  'purchase/info-drawer.js',
  'purchase/receipt.js',
  'purchase/dialog.js',
  'purchase.js'
];

test('shop landing feature modules share cross-feature helpers', () => {
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../public/scripts/shop/landing-page/landing-page.js'
      ),
      'utf8'
    ),
    context,
    { filename: 'landing-page.js' }
  );

  featureScripts.forEach((fileName) => {
    vm.runInNewContext(
      fs.readFileSync(path.join(scriptsDirectory, fileName), 'utf8'),
      context,
      { filename: fileName }
    );
  });

  const shop = context.window.OE_SHOP_LANDING;
  assert.equal(
    shop.RARITY_PALETTE_ENDPOINT,
    '/json-files/olings/rarities.json'
  );
  assert.equal(typeof shop.createProductCard, 'function');
  assert.equal(typeof shop.openPreviewHatch, 'function');
  assert.equal(typeof shop.createPurchaseDialog, 'function');
  const colours = shop.resolvePurchaseColours({
    digitalEntitlement: { grants: [{ type: 'oling_egg', key: 'base' }] }
  });
  assert.equal(colours.primary, '#E8FFF1');
  assert.equal(colours.secondary, '#CFF4DC');

  const preview = shop.createPreviewHatchData(
    {
      digitalEntitlement: {
        grants: [{ type: 'oling_egg', key: 'base-egg' }]
      }
    },
    {
      key: 'base-egg',
      collection: 'base',
      rarityOdds: { common: 1 },
      sets: [
        {
          key: 'starter',
          name: 'Starter',
          rarity: 'common',
          traits: {
            flight: 'starter-flight',
            body: 'starter-body',
            eyes: 'starter-eyes',
            mouth: 'starter-mouth'
          },
          metadata: {
            layers: {
              flight: '/flight.svg',
              body: '/body.svg',
              eyes: '/eyes.svg',
              mouth: '/mouth.svg'
            }
          }
        }
      ]
    }
  );
  assert.equal(preview.oling.eggKey, 'base-egg');
  assert.deepEqual(Object.keys(preview.oling.traits), [
    'flight',
    'body',
    'eyes',
    'mouth'
  ]);
  assert.equal(preview.receipt.rolls.personality.personalityKey, 'curious');
});

test('shop landing modules load before the startup script', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/shop/landing-page.html'),
    'utf8'
  );
  const startupIndex = page.indexOf("'/scripts/shop/landing-page/start.js'");

  assert.ok(startupIndex > -1);
  featureScripts.forEach((fileName) => {
    const scriptIndex = page.indexOf(
      `'/scripts/shop/landing-page/${fileName}'`
    );
    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(scriptIndex < startupIndex, `${fileName} should load first`);
  });
  assert.match(page.slice(startupIndex, startupIndex + 130), /zIndex:\s*2/);
});

test('shop hatch preview support modules load before the compatibility facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/shop/landing-page.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf(
    "'/scripts/shop/landing-page/hatch-preview.js'"
  );

  assert.ok(facadeIndex > -1);
  [
    'hatch-preview/product-data.js',
    'hatch-preview/hatch-ui.js',
    'hatch-preview/preview-runtime.js'
  ].forEach((fileName) => {
    const scriptIndex = page.indexOf(
      `'/scripts/shop/landing-page/${fileName}'`
    );

    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(
      scriptIndex < facadeIndex,
      `${fileName} should load before the facade`
    );
  });
});

test('shop purchase support modules load before the compatibility facade', () => {
  const page = fs.readFileSync(
    path.join(__dirname, '../../public/pages/shop/landing-page.html'),
    'utf8'
  );
  const facadeIndex = page.indexOf("'/scripts/shop/landing-page/purchase.js'");

  assert.ok(facadeIndex > -1);
  [
    'purchase/account-purchase.js',
    'purchase/product-copy.js',
    'purchase/dialog-elements.js',
    'purchase/info-drawer.js',
    'purchase/receipt.js',
    'purchase/dialog.js'
  ].forEach((fileName) => {
    const scriptIndex = page.indexOf(
      `'/scripts/shop/landing-page/${fileName}'`
    );

    assert.ok(scriptIndex > -1, `${fileName} should be configured`);
    assert.ok(
      scriptIndex < facadeIndex,
      `${fileName} should load before the facade`
    );
  });
});

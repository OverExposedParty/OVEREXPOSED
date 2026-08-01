(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});
  const requiredHelpers = [
    'createPreviewHatchData',
    'formatProductPrice',
    'getShopHatchViews',
    'openPreviewHatch'
  ];

  const missingHelpers = requiredHelpers.filter(
    (helperName) => typeof shop[helperName] !== 'function'
  );

  if (missingHelpers.length) {
    console.error('Shop hatch preview modules did not load:', missingHelpers);
  }
})();

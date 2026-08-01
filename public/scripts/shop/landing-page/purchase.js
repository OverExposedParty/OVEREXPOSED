(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});
  const purchaseHelpers = [
    'getStoredAccount',
    'storeAccount',
    'getOpalBalance',
    'closePurchaseDialog',
    'getProductInfoSummary',
    'buyShopProduct',
    'createOpalValue',
    'attachPurchaseInfoDrawer',
    'renderPurchaseReceipt',
    'createPurchaseDialog'
  ];
  const missingPurchaseHelpers = purchaseHelpers.filter(
    (helper) => typeof shop[helper] !== 'function'
  );

  if (missingPurchaseHelpers.length > 0) {
    throw new Error(
      `Shop purchase modules failed to load: ${missingPurchaseHelpers.join(', ')}`
    );
  }
})();

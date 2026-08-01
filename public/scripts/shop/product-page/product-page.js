(function () {
  if (typeof window.SetScriptLoaded === 'function') {
    window.SetScriptLoaded('/scripts/shop/product-page/product-page.js');
  }

  if (window.Ready && typeof window.Ready.set === 'function') {
    window.Ready.set('shop-product-page', true);
  }
})();

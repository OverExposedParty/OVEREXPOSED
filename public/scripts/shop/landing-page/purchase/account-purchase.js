(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function getStoredAccount() {
      try {
        return JSON.parse(localStorage.getItem('oe-account')) || null;
      } catch {
        return null;
      }
    }

    function storeAccount(account) {
      if (!account) return;

      localStorage.setItem('oe-account', JSON.stringify(account));
      window.dispatchEvent(
        new CustomEvent('oe-account-state-changed', {
          detail: { account }
        })
      );
    }

    function getOpalBalance() {
      const account = getStoredAccount();
      return Math.max(
        0,
        Number(account?.gameData?.opals?.balance ?? account?.opals?.balance) ||
          0
      );
    }

    function closePurchaseDialog() {
      document
        .querySelectorAll('.oe-purchase-dialog')
        .forEach((dialog) => closeSharedPopup(dialog));
    }

    function buyShopProduct(product, button) {
      const account = getStoredAccount();

      if (!account) {
        window.location.href = `/sign-in?returnTo=${encodeURIComponent('/shop')}`;
        return Promise.resolve();
      }

      const productSlug = product.identity?.slug;
      if (!productSlug) {
        window.location.href = '/shop';
        return Promise.resolve();
      }

      button.disabled = true;

      return fetch('/api/shop/purchase-with-opals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug })
      })
        .then((response) => response.json())
        .then((payload) => {
          const data = payload?.data || payload;
          if (payload?.success === false) {
            throw new Error(
              payload.error?.message || payload.message || 'Failed to buy item'
            );
          }
          if (data.account) storeAccount(data.account);
          return Promise.resolve(window.renderAccountPreviewIcon?.()).then(
            () => data
          );
        })
        .catch((error) => {
          console.error('Failed to buy shop product:', error);
          button.disabled = false;
          throw error;
        });
    }

    Object.assign(shop, {
      getStoredAccount,
      storeAccount,
      getOpalBalance,
      closePurchaseDialog,
      buyShopProduct
    });
  }
})();

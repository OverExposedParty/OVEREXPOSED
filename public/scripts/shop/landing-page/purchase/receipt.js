(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function getPurchaseGrants(product, purchaseData = {}) {
      const purchaseGrants = Array.isArray(purchaseData.purchase?.grants)
        ? purchaseData.purchase.grants
        : [];
      return purchaseGrants.length ? purchaseGrants : getProductGrants(product);
    }

    function formatGrantReceiptText(grant) {
      const quantity = Number(grant?.quantity || 1);
      const type = String(grant?.type || 'item')
        .replace(/^oling_/, 'oling ')
        .replace(/_/g, ' ');
      const key = String(grant?.key || '').replace(/[-_]+/g, ' ');
      const label = [type, key].filter(Boolean).join(' · ');
      const title = label.replace(/\b\w/g, (letter) => letter.toUpperCase());
      return quantity > 1 ? `${title} x${quantity}` : title;
    }

    function renderPurchaseReceipt({
      dialog,
      media,
      product,
      purchaseData,
      price,
      balance,
      purchaseColours
    }) {
      const nextBalance =
        Number(purchaseData?.account?.gameData?.opals?.balance) ||
        Number(purchaseData?.account?.opals?.balance) ||
        Math.max(0, balance - price);

      dialog.setAttribute('aria-labelledby', 'shop-purchase-receipt-title');
      dialog.classList.add('is-receipt');

      const title = document.createElement('h2');
      title.id = 'shop-purchase-receipt-title';
      title.className = 'oe-purchase-title';
      title.textContent = 'Purchase complete';

      const content = document.createElement('div');
      content.className = 'oe-purchase-content';

      const name = document.createElement('p');
      name.className = 'oe-purchase-name';
      name.textContent = product.name;

      const detail = document.createElement('p');
      detail.className = 'oe-purchase-detail';
      detail.textContent = getProductDetailText(product);

      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createPurchaseRow('Paid', price),
        createPurchaseRow('New balance', nextBalance)
      );

      getPurchaseGrants(product, purchaseData).forEach((grant, index) => {
        rows.appendChild(
          createPurchaseRow(
            index === 0 ? 'Received' : '',
            formatGrantReceiptText(grant)
          )
        );
      });

      const message = document.createElement('p');
      message.className = 'oe-purchase-message';
      message.textContent = 'Your item has been added to your account.';

      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'oe-purchase-confirm';
      close.textContent = 'Close';
      close.style.backgroundColor = purchaseColours.secondary;
      close.addEventListener('click', closePurchaseDialog);
      actions.appendChild(close);

      content.append(name, detail, rows, message, actions);
      dialog.replaceChildren(title, media, content);
      attachPurchaseInfoDrawer(media, product);
    }

    Object.assign(shop, {
      getPurchaseGrants,
      formatGrantReceiptText,
      renderPurchaseReceipt
    });
  }
})();

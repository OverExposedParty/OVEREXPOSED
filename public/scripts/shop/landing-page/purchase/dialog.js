(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function createPurchaseDialog(product, sectionColours = {}) {
      const price = getProductOpalAmount(product);
      const balance = getOpalBalance();
      const remaining = balance - price;
      const canAfford = remaining >= 0;
      const purchaseColours = resolvePurchaseColours(product, sectionColours);

      closePurchaseDialog();

      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty(
        '--oe-purchase-primary-colour',
        purchaseColours.primary
      );
      dialog.style.setProperty(
        '--oe-purchase-secondary-colour',
        purchaseColours.secondary
      );
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'shop-purchase-title');

      const title = document.createElement('h2');
      title.id = 'shop-purchase-title';
      title.className = 'oe-purchase-title';
      title.textContent = canAfford ? 'Buy this item?' : 'Not enough Opals';

      const media = document.createElement('div');
      media.className = 'oe-purchase-media';

      media.appendChild(
        createProductMedia(
          product.mainMedia,
          'shop-purchase-preview',
          product.name
        )
      );

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

      [
        ['Cost', price],
        ['Current balance', balance],
        [
          canAfford ? 'Balance after' : 'More needed',
          canAfford ? remaining : Math.abs(remaining)
        ]
      ].forEach(([label, value]) =>
        rows.appendChild(createPurchaseRow(label, value))
      );

      const message = document.createElement('p');
      message.className = 'oe-purchase-message';
      message.textContent = getPurchaseMessage(product, canAfford, remaining);

      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';

      if (canAfford) {
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'oe-purchase-confirm';
        confirm.style.backgroundColor = purchaseColours.secondary;
        confirm.appendChild(createOpalValue(price));
        confirm.addEventListener('click', () => {
          buyShopProduct(product, confirm)
            .then((purchaseData) =>
              renderPurchaseReceipt({
                dialog,
                media,
                product,
                purchaseData,
                price,
                balance,
                purchaseColours
              })
            )
            .catch((error) => {
              message.textContent =
                error.message || 'Purchase failed. Please try again.';
            });
        });
        actions.appendChild(confirm);
      }

      content.append(name, detail, rows, message);
      if (actions.children.length) content.appendChild(actions);
      dialog.append(title, media, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      attachPurchaseInfoDrawer(media, product);
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }

    Object.assign(shop, { createPurchaseDialog });
  }
})();

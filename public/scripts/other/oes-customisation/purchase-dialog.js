(() => {
  function createOeLibraryPurchaseDialog({ state, data, render }) {
    let activePurchaseItem = null;

    function getOpalBalance() {
      return Math.max(
        0,
        Number(
          state.account?.gameData?.opals?.balance ?? state.account?.opals?.balance
        ) || 0
      );
    }

    function closePurchaseDialog() {
      activePurchaseItem = null;
      const dialogHost = document.querySelector('.oe-purchase-dialog-host');
      if (!dialogHost) return;
      if (typeof window.closeOeDialog === 'function') {
        window.closeOeDialog(dialogHost);
      } else if (dialogHost.open) {
        dialogHost.close();
      }
    }

    async function buyItem(item, button) {
      if (!state.account) {
        window.location.href = '/sign-in?returnTo=/oe-library';
        return;
      }
      if (!item.shop?.productSlug) {
        window.location.href = `/shop/${data.createShopSlug(item)}`;
        return;
      }

      button.disabled = true;
      try {
        const response = await fetch('/api/shop/purchase-with-opals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productSlug: item.shop.productSlug })
        });
        const payload = await response.json();
        const result = payload?.data || payload;
        if (payload?.success === false) {
          throw new Error(payload.message || 'Failed to buy OE');
        }
        if (result.account) data.storeAccount(result.account);
        await data.reloadLibrary();
        render();
      } catch (error) {
        console.error('Failed to buy OE:', error);
        button.disabled = false;
      }
    }

    function createPurchaseDialog(item) {
      const price = Number(item.shop?.opalPrice || 200);
      const balance = getOpalBalance();
      const remaining = balance - price;
      const canAfford = remaining >= 0;

      closePurchaseDialog();
      activePurchaseItem = item;

      const dialogHost = document.createElement('dialog');
      dialogHost.className = 'oe-purchase-dialog-host oe-dialog';
      dialogHost.setAttribute('aria-labelledby', 'oe-purchase-title');
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog';

      const media = document.createElement('div');
      media.className = 'oe-purchase-media';
      media.style.setProperty(
        '--pack-colour',
        item.pack.colour || 'var(--primarypagecolour)'
      );
      const image = document.createElement('img');
      image.src = item.filePath;
      image.alt = item.name;
      media.appendChild(image);

      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const title = document.createElement('h2');
      title.id = 'oe-purchase-title';
      title.textContent = canAfford ? 'Buy this OE?' : 'Not enough Opals';
      const name = document.createElement('p');
      name.className = 'oe-purchase-name';
      name.textContent = item.name;
      const detail = document.createElement('p');
      detail.className = 'oe-purchase-detail';
      detail.textContent = `${data.formatTitle(item.slot)} · ${data.formatTitle(item.packSlug)} · ${item.id}`;

      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      [
        ['Cost', price],
        ['Current balance', balance],
        [
          canAfford ? 'Balance after' : 'More needed',
          canAfford ? remaining : Math.abs(remaining)
        ]
      ].forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'oe-purchase-row';
        const labelNode = document.createElement('span');
        labelNode.textContent = label;
        const valueNode = document.createElement('span');
        valueNode.className = 'oe-purchase-opals';
        const icon = document.createElement('img');
        icon.src = '/images/icons/currency/opal.svg';
        icon.alt = '';
        icon.setAttribute('aria-hidden', 'true');
        const amount = document.createElement('span');
        amount.textContent = Number(value).toLocaleString();
        valueNode.append(icon, amount);
        row.append(labelNode, valueNode);
        rows.appendChild(row);
      });

      const message = document.createElement('p');
      message.className = 'oe-purchase-message';
      message.textContent = canAfford
        ? 'This will unlock the OE permanently for your account.'
        : `You need ${Math.abs(remaining).toLocaleString()} more Opals to buy this OE.`;
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'oe-purchase-cancel';
      cancel.textContent = canAfford ? 'Cancel' : 'Close';
      cancel.addEventListener('click', closePurchaseDialog);
      actions.appendChild(cancel);

      if (canAfford) {
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'oe-purchase-confirm';
        confirm.textContent = 'Buy';
        confirm.addEventListener('click', () => {
          const purchaseButton = document.querySelector(
            `[data-buy-oe="${activePurchaseItem?.id}"]`
          );
          confirm.disabled = true;
          buyItem(activePurchaseItem, purchaseButton || confirm).then(
            closePurchaseDialog
          );
        });
        actions.appendChild(confirm);
      }

      content.append(title, name, detail, rows, message, actions);
      dialog.append(media, content);
      dialogHost.appendChild(dialog);
      document.body.appendChild(dialogHost);
      window.OeDialog?.register(dialogHost, {
        onClose: () => {
          activePurchaseItem = null;
          dialogHost.remove();
        }
      });
      if (typeof window.openOeDialog === 'function') {
        window.openOeDialog(dialogHost, {
          initialFocus: canAfford
            ? '.oe-purchase-confirm'
            : '.oe-purchase-cancel'
        });
      } else {
        dialogHost.showModal();
      }
    }

    return { closePurchaseDialog, createPurchaseDialog };
  }

  window.createOeLibraryPurchaseDialog = createOeLibraryPurchaseDialog;
})();

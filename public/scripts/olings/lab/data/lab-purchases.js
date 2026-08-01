(function () {
  function createOlingLabPurchases({
    state,
    elements,
    labExpansionEndpoint,
    setStatus,
    parsePayload,
    getLabExpansionCell,
    createImage,
    openSharedPopup,
    closeSharedPopup,
    renderLab
  }) {
    function syncAccountPayload(payload) {
      if (!payload?.account) return;
      state.account = payload.account;
      localStorage.setItem('oe-account', JSON.stringify(payload.account));
      window.dispatchEvent(
        new CustomEvent('oe-account-state-changed', {
          detail: { account: payload.account }
        })
      );
    }

    function closeLabPurchaseDialog() {
      document
        .querySelectorAll('.oe-purchase-dialog')
        .forEach((dialog) => closeSharedPopup(dialog));
    }

    function createPurchaseOpalValue(value) {
      const valueNode = document.createElement('span');
      valueNode.className = 'oe-purchase-opals';
      valueNode.append(
        Object.assign(document.createElement('img'), {
          src: '/images/icons/currency/opal.svg',
          alt: '',
          ariaHidden: 'true'
        }),
        Object.assign(document.createElement('span'), {
          textContent: Number(value || 0).toLocaleString()
        })
      );
      return valueNode;
    }

    function createLabPurchaseRow(label, value) {
      const row = document.createElement('div');
      row.className = 'oe-purchase-row';
      row.appendChild(
        Object.assign(document.createElement('span'), { textContent: label })
      );
      row.appendChild(
        typeof value === 'number'
          ? createPurchaseOpalValue(value)
          : Object.assign(document.createElement('span'), {
              textContent: String(value || '-')
            })
      );
      return row;
    }

    function openQuickSellDialog(item, initialQuantity = 1) {
      const quantity = Math.max(
        1,
        Math.min(Number(initialQuantity || 1), item.quantity)
      );
      let quote = null;
      let saleComplete = false;
      closeLabPurchaseDialog();
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog oling-quick-sell-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty('--oe-purchase-primary-colour', '#FFC9B8');
      dialog.style.setProperty('--oe-purchase-secondary-colour', '#E8846B');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = Object.assign(document.createElement('h2'), {
        className: 'oe-purchase-title',
        textContent: 'Quick sell?'
      });
      const media = document.createElement('div');
      media.className = 'oe-purchase-media';
      if (item.image) media.appendChild(createImage(item.image, item.name));
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const name = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-name',
        textContent: item.name
      });
      const detail = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-detail',
        textContent: 'Quick sells return 35% of the current shop value.'
      });
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      const message = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-message',
        textContent: 'Checking the current shop value…'
      });
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      const confirm = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'oe-purchase-confirm',
        textContent: 'Quick sell',
        disabled: true
      });
      actions.append(confirm);

      const refreshQuote = () => {
        confirm.disabled = true;
        fetch('/api/olings/storage/quick-sell/quote', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            itemType: item.type,
            itemKey: item.key,
            quantity
          })
        })
          .then(parsePayload)
          .then((payload) => {
            quote = payload.quote;
            rows.replaceChildren(
              createLabPurchaseRow('Shop value', quote.shopValue),
              createLabPurchaseRow('Quick sell', quote.payout)
            );
            message.textContent = `Sell ${quantity} item${quantity === 1 ? '' : 's'} for ${quote.payout} Opals?`;
            confirm.replaceChildren(
              Object.assign(document.createElement('span'), {
                textContent: 'Quick sell for '
              }),
              createPurchaseOpalValue(quote.payout)
            );
            confirm.disabled = false;
          })
          .catch((error) => {
            rows.replaceChildren();
            message.textContent =
              error.message || 'This item cannot be quick sold right now.';
          });
      };
      confirm.addEventListener('click', () => {
        if (saleComplete) {
          closeLabPurchaseDialog();
          return;
        }
        if (!quote) return;
        confirm.disabled = true;
        fetch('/api/olings/storage/quick-sell', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            itemType: item.type,
            itemKey: item.key,
            quantity
          })
        })
          .then(parsePayload)
          .then((payload) => {
            state.ownedEggs = Array.isArray(payload.inventory?.eggs)
              ? payload.inventory.eggs
              : state.ownedEggs;
            state.ownedConsumables = Array.isArray(
              payload.inventory?.consumables
            )
              ? payload.inventory.consumables
              : state.ownedConsumables;
            syncAccountPayload(payload);
            renderLab();
            title.textContent = 'Quick sell complete';
            rows.replaceChildren(
              createLabPurchaseRow('Received', payload.quote.payout),
              createLabPurchaseRow('New balance', payload.quote.balanceAfter)
            );
            message.textContent = `${item.name} has been removed from your storage.`;
            confirm.replaceChildren('Close');
            confirm.disabled = false;
            saleComplete = true;
          })
          .catch((error) => {
            message.textContent =
              error.message || 'Quick sell failed. Please try again.';
            confirm.disabled = false;
          });
      });
      content.append(name, detail, rows, message, actions);
      dialog.append(title, media, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
      refreshQuote();
    }

    function createLabSpacePurchaseMedia(row, col) {
      const media = document.createElement('div');
      media.className = 'oe-purchase-media';
      const preview = document.createElement('div');
      preview.className = 'shop-purchase-preview oling-lab-purchase-preview';
      preview.append(
        Object.assign(document.createElement('span'), {
          className: 'oling-lab-purchase-preview-plus',
          textContent: '+'
        }),
        Object.assign(document.createElement('span'), {
          className: 'oling-lab-purchase-preview-label',
          textContent: `Row ${row + 1} · Column ${col + 1}`
        })
      );
      media.appendChild(preview);
      return media;
    }

    function renderLabPurchaseReceipt(dialog, media, payload) {
      const purchase = payload.purchase;
      dialog.setAttribute('aria-labelledby', 'shop-purchase-receipt-title');
      dialog.classList.add('is-receipt');

      const title = Object.assign(document.createElement('h2'), {
        id: 'shop-purchase-receipt-title',
        className: 'oe-purchase-title',
        textContent: 'Purchase complete'
      });
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const name = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-name',
        textContent: 'Olings Lab Space'
      });
      const detail = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-detail',
        textContent: `Row ${purchase.row + 1} · Column ${purchase.col + 1}`
      });
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createLabPurchaseRow('Paid', purchase.price),
        createLabPurchaseRow('New balance', purchase.balanceAfter),
        createLabPurchaseRow('Received', '1 Lab space')
      );
      const message = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-message',
        textContent: 'Your new lab space is ready to use.'
      });
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      const close = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'oe-purchase-confirm',
        textContent: 'Close'
      });
      close.addEventListener('click', closeLabPurchaseDialog);
      actions.appendChild(close);
      content.append(name, detail, rows, message, actions);
      dialog.replaceChildren(title, media, content);
    }

    function purchaseLabExpansion(cell, button, message, dialog, media) {
      if (state.expanding || !cell?.price) return;
      state.expanding = true;
      button.disabled = true;
      setStatus('Unlocking...');

      fetch(labExpansionEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ row: cell.row, col: cell.col })
      })
        .then(parsePayload)
        .then((payload) => {
          state.lab = payload.lab;
          state.expansion = payload.expansion || null;
          syncAccountPayload(payload);
          setStatus(payload.message || 'Lab space unlocked');
          renderLab();
          renderLabPurchaseReceipt(dialog, media, payload);
        })
        .catch((error) => {
          console.error('Failed to expand Olings Lab:', error);
          message.textContent =
            error.message || 'Purchase failed. Please try again.';
          setStatus(error.message || 'Could not unlock lab space');
          button.disabled = false;
        })
        .finally(() => {
          state.expanding = false;
        });
    }

    function openLabCellPurchaseDialog(row, col) {
      const cell = getLabExpansionCell(row, col);
      if (!cell || cell.unlocked) return;
      const remaining = state.expansion.balance - cell.price;
      const canAfford = remaining >= 0;

      closeLabPurchaseDialog();
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty('--oe-purchase-primary-colour', '#B8E1FF');
      dialog.style.setProperty('--oe-purchase-secondary-colour', '#84BEE8');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'shop-purchase-title');

      const title = Object.assign(document.createElement('h2'), {
        id: 'shop-purchase-title',
        className: 'oe-purchase-title',
        textContent: canAfford ? 'Buy this space?' : 'Not enough Opals'
      });
      const media = createLabSpacePurchaseMedia(row, col);
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const name = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-name',
        textContent: 'Olings Lab Space'
      });
      const detail = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-detail',
        textContent: `Row ${row + 1} · Column ${col + 1}`
      });
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createLabPurchaseRow('Cost', cell.price),
        createLabPurchaseRow('Current balance', state.expansion.balance),
        createLabPurchaseRow(
          canAfford ? 'Balance after' : 'More needed',
          canAfford ? remaining : Math.abs(remaining)
        )
      );
      const message = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-message',
        textContent: canAfford
          ? 'This permanently unlocks the selected square in your Olings Lab.'
          : `You need ${Math.abs(remaining).toLocaleString()} more Opals.`
      });
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      if (canAfford) {
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'oe-purchase-confirm';
        confirm.appendChild(createPurchaseOpalValue(cell.price));
        confirm.addEventListener('click', () =>
          purchaseLabExpansion(cell, confirm, message, dialog, media)
        );
        actions.appendChild(confirm);
      }
      content.append(name, detail, rows, message);
      if (actions.children.length) content.appendChild(actions);
      dialog.append(title, media, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }

    return {
      syncAccountPayload,
      openQuickSellDialog,
      openLabCellPurchaseDialog
    };
  }

  window.createOlingLabPurchases = createOlingLabPurchases;
})();

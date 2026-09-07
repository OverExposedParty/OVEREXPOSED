(function () {
  function createOlingLabQuickSell({
    state,
    parsePayload,
    createImage,
    openSharedPopup,
    renderLab,
    syncAccountPayload,
    dialogUi
  }) {
    const { closePurchaseDialogs, createOpalValue, createPurchaseRow } =
      dialogUi;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    function requestQuickSell(pathname, item, quantity) {
      return fetch(pathname, {
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
      }).then(parsePayload);
    }
    function getQuickSellQuote(item, quantity = 1) {
      const safeQuantity = Math.max(
        1,
        Math.min(Number(quantity || 1), Number(item.quantity || 1))
      );
      return requestQuickSell(
        '/api/olings/storage/quick-sell/quote',
        item,
        safeQuantity
      ).then((payload) => payload.quote);
    }
    function getQuickSellPrices(items = []) {
      const uniqueItems = [];
      const seen = new Set();
      items.forEach((item) => {
        const itemType = String(item?.type || '');
        const itemKey = String(item?.key || '');
        const identity = `${itemType}:${itemKey}`;
        if (!itemType || !itemKey || seen.has(identity)) return;
        seen.add(identity);
        uniqueItems.push({ itemType, itemKey });
      });
      if (!uniqueItems.length) return Promise.resolve([]);
      return fetch('/api/olings/storage/quick-sell/prices', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items: uniqueItems })
      })
        .then(parsePayload)
        .then((payload) =>
          Array.isArray(payload.prices) ? payload.prices : []
        );
    }
    function openQuickSellDialog(item, initialQuantity = 1, options = {}) {
      const quantity = Math.max(
        1,
        Math.min(Number(initialQuantity || 1), item.quantity)
      );
      let quote = null;
      let saleComplete = false;
      closePurchaseDialogs();
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
      confirm.dataset.soundIntent = 'confirm';
      actions.append(confirm);
      function refreshQuote() {
        confirm.disabled = true;
        getQuickSellQuote(item, quantity)
          .then((nextQuote) => {
            quote = nextQuote;
            rows.replaceChildren(
              createPurchaseRow('Shop value', quote.shopValue),
              createPurchaseRow('Quick sell', quote.payout)
            );
            message.textContent = `Sell ${quantity} item${quantity === 1 ? '' : 's'} for ${quote.payout} Opals?`;
            confirm.replaceChildren(
              Object.assign(document.createElement('span'), {
                textContent: 'Quick sell for '
              }),
              createOpalValue(quote.payout)
            );
            confirm.disabled = false;
          })
          .catch((error) => {
            rows.replaceChildren();
            message.textContent =
              error.message || 'This item cannot be quick sold right now.';
          });
      }
      confirm.addEventListener('click', () => {
        if (saleComplete) return closePurchaseDialogs();
        if (!quote) return;
        confirm.disabled = true;
        requestQuickSell('/api/olings/storage/quick-sell', item, quantity)
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
            options.onComplete?.(payload);
            title.textContent = 'Quick sell complete';
            rows.replaceChildren(
              createPurchaseRow('Received', payload.quote.payout),
              createPurchaseRow('New balance', payload.quote.balanceAfter)
            );
            message.textContent = `${item.name} has been removed from your storage.`;
            confirm.replaceChildren('Close');
            confirm.disabled = false;
            confirm.dataset.sound = 'none';
            delete confirm.dataset.soundIntent;
            saleComplete = true;
            playSound('economySell');
          })
          .catch((error) => {
            message.textContent =
              error.message || 'Quick sell failed. Please try again.';
            confirm.disabled = false;
            playSound('uiError');
          });
      });
      content.append(name, detail, rows, message, actions);
      dialog.append(title, media, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
      refreshQuote();
    }
    return { getQuickSellPrices, getQuickSellQuote, openQuickSellDialog };
  }
  window.createOlingLabQuickSell = createOlingLabQuickSell;
})();

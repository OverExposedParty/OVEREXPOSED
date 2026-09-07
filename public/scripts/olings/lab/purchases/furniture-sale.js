(function () {
  function createOlingLabFurnitureSale({
    state,
    parsePayload,
    createImage,
    openSharedPopup,
    renderLab,
    syncAccountPayload,
    closeActiveFurniturePanels = () => {},
    dialogUi
  }) {
    const { closePurchaseDialogs, createOpalValue, createPurchaseRow } =
      dialogUi;
    const buttons = [
      ...document.querySelectorAll('[data-oling-lab-furniture-sell]')
    ];
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    function request(pathname, placedId) {
      return fetch(pathname, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ placedId })
      }).then(parsePayload);
    }

    function findFurniture(placedId) {
      for (const parent of state.lab?.placedItems || []) {
        if (String(parent?.placedId) === String(placedId)) {
          return state.catalog?.get?.(parent.itemId) || null;
        }
        const slot = (parent?.containerSlots || []).find(
          (item) => String(item?.placedId) === String(placedId)
        );
        if (slot) return state.catalog?.get?.(slot.itemId) || null;
      }
      return null;
    }

    function setFurnitureSaleTarget(panelKey, placedId) {
      const locked = Boolean(
        (state.lab?.placedItems || []).find(
          (item) => String(item?.placedId) === String(placedId)
        )?.locked
      );
      buttons.forEach((button) => {
        const active =
          button.dataset.olingLabFurnitureSell === panelKey &&
          Boolean(placedId) &&
          !locked &&
          !state.visitorMode &&
          !state.tutorialMode;
        button.hidden = !active;
        if (!active) {
          delete button.dataset.placedId;
          return;
        }
        const furniture = findFurniture(placedId);
        button.dataset.placedId = String(placedId);
        button.disabled = false;
        button.setAttribute(
          'aria-label',
          `Sell ${furniture?.name || 'furniture'}`
        );
      });
    }

    function renderSaleReceipt(dialog, quote) {
      dialog.classList.add('is-receipt');
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createPurchaseRow('Received', quote.payout),
        createPurchaseRow('New balance', quote.balanceAfter)
      );
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      const close = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'oe-purchase-confirm',
        textContent: 'Close'
      });
      close.dataset.sound = 'none';
      close.addEventListener('click', closePurchaseDialogs);
      actions.appendChild(close);
      content.append(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-name',
          textContent: quote.furnitureName
        }),
        rows,
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-message',
          textContent: 'The furniture has been removed from your lab.'
        }),
        actions
      );
      dialog.replaceChildren(
        Object.assign(document.createElement('h2'), {
          className: 'oe-purchase-title',
          textContent: 'Furniture sold'
        }),
        content
      );
    }

    function openFurnitureSaleDialog(placedId) {
      if (!placedId || state.visitorMode || state.tutorialMode) return;
      const furniture = findFurniture(placedId);
      closePurchaseDialogs();
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog oling-furniture-sale-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty(
        '--oe-purchase-primary-colour',
        'var(--warningcolour, #ff3333)'
      );
      dialog.style.setProperty(
        '--oe-purchase-secondary-colour',
        'var(--warningcoloursecondary, #b22626)'
      );
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = Object.assign(document.createElement('h2'), {
        className: 'oe-purchase-title',
        textContent: 'Sell furniture?'
      });
      const media = document.createElement('div');
      media.className = 'oe-purchase-media';
      if (furniture?.image) {
        media.appendChild(createImage(furniture.image, furniture.name));
      }
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      const message = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-message',
        textContent: 'Checking the recorded purchase price…'
      });
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions oling-furniture-sale-actions';
      const cancel = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'oe-purchase-confirm is-cancel',
        textContent: 'Cancel'
      });
      cancel.dataset.soundIntent = 'close';
      cancel.addEventListener('click', closePurchaseDialogs);
      const confirm = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'oe-purchase-confirm is-warning',
        textContent: 'Sell',
        disabled: true
      });
      confirm.dataset.soundIntent = 'warning';
      actions.append(cancel, confirm);
      content.append(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-name',
          textContent: furniture?.name || 'Furniture'
        }),
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-detail',
          textContent: 'Furniture quick sells return 60% of the price paid.'
        }),
        rows,
        message,
        actions
      );
      dialog.append(title, media, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);

      request('/api/olings/lab/furniture-sale/quote', placedId)
        .then((payload) => {
          const quote = payload.quote;
          rows.replaceChildren(
            createPurchaseRow('Price paid', quote.paidPrice),
            createPurchaseRow('You receive', quote.payout)
          );
          message.textContent = `Sell ${quote.furnitureName} for ${quote.payout.toLocaleString()} Opals?`;
          confirm.replaceChildren(
            Object.assign(document.createElement('span'), {
              textContent: 'Sell for '
            }),
            createOpalValue(quote.payout)
          );
          confirm.disabled = false;
        })
        .catch((error) => {
          rows.replaceChildren();
          message.textContent =
            error.message || 'This furniture cannot be sold right now.';
          confirm.remove();
          cancel.textContent = 'Close';
          playSound('uiError');
        });

      confirm.addEventListener('click', () => {
        if (confirm.disabled) return;
        confirm.disabled = true;
        cancel.disabled = true;
        request('/api/olings/lab/furniture-sale', placedId)
          .then((payload) => {
            state.lab = payload.lab;
            if (Array.isArray(payload.inventory?.furniture)) {
              state.owned = new Set(
                payload.inventory.furniture.map((item) => item.key)
              );
            }
            syncAccountPayload(payload);
            closeActiveFurniturePanels();
            renderLab();
            renderSaleReceipt(dialog, payload.quote);
            playSound('economySell');
          })
          .catch((error) => {
            message.textContent =
              error.message || 'Could not sell that furniture.';
            confirm.disabled = false;
            cancel.disabled = false;
            playSound('uiError');
          });
      });
    }

    buttons.forEach((button) => {
      button.addEventListener('click', () =>
        openFurnitureSaleDialog(button.dataset.placedId)
      );
    });

    return { setFurnitureSaleTarget, openFurnitureSaleDialog };
  }

  window.createOlingLabFurnitureSale = createOlingLabFurnitureSale;
})();

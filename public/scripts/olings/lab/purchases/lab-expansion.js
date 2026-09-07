(function () {
  function createOlingLabExpansionPurchase({
    state,
    labExpansionEndpoint,
    setStatus,
    parsePayload,
    getLabExpansionColumn,
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
    function createMedia(col) {
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
          textContent: `Column ${col + 1}`
        })
      );
      media.appendChild(preview);
      return media;
    }
    function renderReceipt(dialog, media, payload) {
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
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createPurchaseRow('Paid', purchase.price),
        createPurchaseRow('New balance', purchase.balanceAfter),
        createPurchaseRow('Received', '1 Lab column')
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
          textContent: 'Olings Lab Column'
        }),
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-detail',
          textContent: `Column ${purchase.col + 1}`
        }),
        rows,
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-message',
          textContent: 'Your new lab column is ready to use.'
        }),
        actions
      );
      dialog.replaceChildren(title, media, content);
    }
    function purchase(column, button, message, dialog, media) {
      if (state.expanding || !column?.price) return;
      state.expanding = true;
      button.disabled = true;
      setStatus('Unlocking...');
      fetch(labExpansionEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ col: column.col })
      })
        .then(parsePayload)
        .then((payload) => {
          state.lab = payload.lab;
          state.expansion = payload.expansion || null;
          syncAccountPayload(payload);
          setStatus(payload.message || 'Lab column unlocked');
          renderLab();
          renderReceipt(dialog, media, payload);
          playSound('economyPurchase');
        })
        .catch((error) => {
          console.error('Failed to expand Olings Lab:', error);
          message.textContent =
            error.message || 'Purchase failed. Please try again.';
          setStatus(error.message || 'Could not unlock lab column');
          button.disabled = false;
          playSound('uiError');
        })
        .finally(() => {
          state.expanding = false;
        });
    }
    function openLabColumnPurchaseDialog(col) {
      const column = getLabExpansionColumn(col);
      if (!column || column.unlocked) return;
      const remaining = state.expansion.balance - column.price;
      const canAfford = remaining >= 0;
      closePurchaseDialogs();
      const dialog = document.createElement('section');
      dialog.className = 'oe-purchase-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty('--oe-purchase-primary-colour', '#B8E1FF');
      dialog.style.setProperty('--oe-purchase-secondary-colour', '#84BEE8');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'shop-purchase-title');
      const media = createMedia(col);
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      const rows = document.createElement('div');
      rows.className = 'oe-purchase-rows';
      rows.append(
        createPurchaseRow('Cost', column.price),
        createPurchaseRow('Current balance', state.expansion.balance),
        createPurchaseRow(
          canAfford ? 'Balance after' : 'More needed',
          canAfford ? remaining : Math.abs(remaining)
        )
      );
      const message = Object.assign(document.createElement('p'), {
        className: 'oe-purchase-message',
        textContent: canAfford
          ? 'This permanently unlocks the whole selected column in your Olings Lab.'
          : `You need ${Math.abs(remaining).toLocaleString()} more Opals.`
      });
      const actions = document.createElement('div');
      actions.className = 'oe-purchase-actions';
      if (canAfford) {
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'oe-purchase-confirm';
        confirm.dataset.soundIntent = 'confirm';
        confirm.appendChild(createOpalValue(column.price));
        confirm.addEventListener('click', () =>
          purchase(column, confirm, message, dialog, media)
        );
        actions.appendChild(confirm);
      }
      content.append(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-name',
          textContent: 'Olings Lab Column'
        }),
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-detail',
          textContent: `Column ${col + 1}`
        }),
        rows,
        message
      );
      if (actions.children.length) content.appendChild(actions);
      dialog.append(
        Object.assign(document.createElement('h2'), {
          id: 'shop-purchase-title',
          className: 'oe-purchase-title',
          textContent: canAfford ? 'Buy this column?' : 'Not enough Opals'
        }),
        media,
        content
      );
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }
    return { openLabColumnPurchaseDialog };
  }
  window.createOlingLabExpansionPurchase = createOlingLabExpansionPurchase;
})();

(function () {
  function createOlingLabPurchaseDialogUi({ closeSharedPopup }) {
    function closePurchaseDialogs() {
      document
        .querySelectorAll('.oe-purchase-dialog')
        .forEach((dialog) => closeSharedPopup(dialog));
    }
    function createOpalValue(value) {
      const node = document.createElement('span');
      node.className = 'oe-purchase-opals';
      const image = Object.assign(document.createElement('img'), {
        src: '/images/icons/currency/opal.svg',
        alt: ''
      });
      image.setAttribute('aria-hidden', 'true');
      node.append(
        image,
        Object.assign(document.createElement('span'), {
          textContent: Number(value || 0).toLocaleString()
        })
      );
      return node;
    }
    function createPurchaseRow(label, value) {
      const row = document.createElement('div');
      row.className = 'oe-purchase-row';
      row.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        typeof value === 'number'
          ? createOpalValue(value)
          : Object.assign(document.createElement('span'), {
              textContent: String(value || '-')
            })
      );
      return row;
    }
    return { closePurchaseDialogs, createOpalValue, createPurchaseRow };
  }
  window.createOlingLabPurchaseDialogUi = createOlingLabPurchaseDialogUi;
})();

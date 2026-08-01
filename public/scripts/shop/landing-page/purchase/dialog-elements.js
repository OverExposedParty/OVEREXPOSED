(function () {
  const shop = (window.OE_SHOP_LANDING = window.OE_SHOP_LANDING || {});

  with (shop) {
    function createOpalValue(value) {
      const valueNode = document.createElement('span');
      valueNode.className = 'oe-purchase-opals';

      const icon = document.createElement('img');
      icon.src = '/images/icons/currency/opal.svg';
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');

      const amount = document.createElement('span');
      amount.textContent = Number(value || 0).toLocaleString();

      valueNode.append(icon, amount);
      return valueNode;
    }

    function createPurchaseRow(label, value) {
      const row = document.createElement('div');
      row.className = 'oe-purchase-row';

      const labelNode = document.createElement('span');
      labelNode.textContent = label;

      const valueNode =
        typeof value === 'number'
          ? createOpalValue(value)
          : document.createElement('span');
      if (typeof value !== 'number')
        valueNode.textContent = String(value || '-');

      row.append(labelNode, valueNode);
      return row;
    }

    function createPurchaseInfoRow(label, value) {
      const row = document.createElement('div');
      row.className = 'oe-purchase-info-row';
      row.append(
        Object.assign(document.createElement('span'), { textContent: label }),
        Object.assign(document.createElement('strong'), {
          textContent: formatTitle(value)
        })
      );
      return row;
    }

    function createPurchaseInfoButton(label, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oe-purchase-info-toggle';
      button.setAttribute('aria-label', label);

      const icon = document.createElement('span');
      icon.className = 'oe-purchase-info-toggle-icon';
      icon.textContent = 'i';
      icon.setAttribute('aria-hidden', 'true');

      button.appendChild(icon);
      button.addEventListener('click', onClick);
      return button;
    }

    function createPurchaseEggPreviewButton(label, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className =
        'oe-purchase-info-toggle oe-purchase-egg-preview-toggle';
      button.setAttribute('aria-label', label);
      button.title = label;

      const icon = document.createElement('span');
      icon.className = 'oe-purchase-egg-preview-icon';
      icon.setAttribute('aria-hidden', 'true');

      button.appendChild(icon);
      button.addEventListener('click', onClick);
      return button;
    }

    function createPurchaseInfoBackButton(label, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oe-purchase-info-back';
      button.setAttribute('aria-label', label);
      button.addEventListener('click', onClick);
      return button;
    }

    function setPurchaseInfoPanelInteractivity(panel, isVisible) {
      if (!panel) return;
      panel.inert = !isVisible;
      panel.setAttribute('aria-hidden', String(!isVisible));
    }

    Object.assign(shop, {
      createOpalValue,
      createPurchaseRow,
      createPurchaseInfoRow,
      createPurchaseInfoButton,
      createPurchaseEggPreviewButton,
      createPurchaseInfoBackButton,
      setPurchaseInfoPanelInteractivity
    });
  }
})();

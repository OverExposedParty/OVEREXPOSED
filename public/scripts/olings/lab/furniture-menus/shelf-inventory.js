(function () {
  function createOlingLabShelfInventory(dependencies) {
    const {
      state,
      getEgg,
      getConsumable,
      getAvailableEggQuantity,
      getEggImage,
      createImage,
      createInlineAction,
      createPanelBackButton,
      openQuickSellDialog
    } = dependencies;

function getShelfItem(slot) {
      if (!slot?.itemKey) return null;
      if (slot.itemType === 'egg') {
        const egg = getEgg(slot.itemKey);
        return {
          key: slot.itemKey,
          type: 'egg',
          name: egg.name,
          image: getEggImage(egg)
        };
      }
      const consumable = getConsumable(slot.itemKey);
      return {
        key: slot.itemKey,
        type: 'consumable',
        name: consumable.name,
        image: consumable.assets?.icon || consumable.assets?.image || ''
      };
    }

    function getShelfInventoryItems() {
      const eggs = state.ownedEggs.map((owned) => {
        const egg = getEgg(owned.key);
        return {
          key: owned.key,
          type: 'egg',
          name: egg.name,
          image: getEggImage(egg),
          quantity: getAvailableEggQuantity(owned.key)
        };
      });
      const consumables = state.ownedConsumables.map((owned) => {
        const consumable = getConsumable(owned.key);
        return {
          key: owned.key,
          type: 'consumable',
          name: consumable.name,
          image: consumable.assets?.icon || consumable.assets?.image || '',
          quantity: Number(owned.quantity || 0)
        };
      });
      return [...eggs, ...consumables].filter((item) => item.quantity > 0);
    }

    function createShelfDetailsPanel(item, onClose) {
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-shelf-panel';
      panel.appendChild(createPanelBackButton('Back to shelf', onClose));
      panel.appendChild(
        Object.assign(document.createElement('h3'), { textContent: item.name })
      );
      const stackGrid = document.createElement('div');
      stackGrid.className = 'oling-lab-shelf-stack-grid';
      const maxSlots = Math.max(
        8,
        Math.ceil(Number(item.quantity || 0) / 8) * 8
      );
      stackGrid.style.setProperty(
        '--shelf-stack-columns',
        String(maxSlots <= 8 ? 2 : 4)
      );
      const selectedCells = new Set();
      const stackCells = Array.from({ length: maxSlots }, (_, index) => {
        const cell = document.createElement(
          index < item.quantity ? 'button' : 'span'
        );
        cell.className = 'oling-lab-shelf-stack-cell';
        if (index < item.quantity && item.image) {
          cell.classList.add('has-item');
          cell.type = 'button';
          cell.setAttribute(
            'aria-label',
            `Toggle ${item.name} ${index + 1} for quick sell`
          );
          cell.setAttribute('aria-pressed', 'false');
          cell.appendChild(createImage(item.image, item.name));
        }
        stackGrid.appendChild(cell);
        return cell;
      });
      panel.appendChild(stackGrid);
      const actions = document.createElement('div');
      actions.className =
        'oling-lab-item-influence-inventory-actions oling-lab-shelf-sell-actions';
      let quantity = 0;
      const quantityControl = document.createElement('div');
      quantityControl.className = 'oling-quick-sell-quantity';
      const decrement = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: '‹'
      });
      const amount = Object.assign(document.createElement('strong'), {
        textContent: '1'
      });
      const increment = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: '›'
      });
      const quickSell = createInlineAction(
        'Quick sell',
        () => openQuickSellDialog(item, quantity),
        {
          className: 'is-remove-action',
          disabled: true
        }
      );
      const syncQuantity = () => {
        quantity = selectedCells.size;
        amount.textContent = String(quantity);
        decrement.disabled = quantity <= 0;
        increment.disabled = quantity >= item.quantity;
        stackCells.forEach((cell, index) => {
          const selected = selectedCells.has(index);
          cell.classList.toggle('is-quick-selling', selected);
          if (cell instanceof HTMLButtonElement) {
            cell.setAttribute('aria-pressed', String(selected));
          }
        });
        quickSell.disabled = quantity < 1;
      };
      stackCells.forEach((cell, index) => {
        if (!(cell instanceof HTMLButtonElement)) return;
        cell.addEventListener('click', () => {
          if (selectedCells.has(index)) selectedCells.delete(index);
          else selectedCells.add(index);
          syncQuantity();
        });
      });
      decrement.addEventListener('click', () => {
        const selected = [...selectedCells].sort((a, b) => b - a)[0];
        if (selected !== undefined) selectedCells.delete(selected);
        syncQuantity();
      });
      increment.addEventListener('click', () => {
        const next = Array.from(
          { length: item.quantity },
          (_, index) => index
        ).find((index) => !selectedCells.has(index));
        if (next !== undefined) selectedCells.add(next);
        syncQuantity();
      });
      quantityControl.append(decrement, amount, increment);
      actions.appendChild(quickSell);
      actions.appendChild(quantityControl);
      syncQuantity();
      panel.appendChild(actions);
      return panel;
    }

    return { createShelfDetailsPanel, getShelfInventoryItems };
  }

  window.createOlingLabShelfInventory = createOlingLabShelfInventory;
})();

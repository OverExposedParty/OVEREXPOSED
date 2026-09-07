(function () {
  function createOlingLabShelfStorage(dependencies, shelfInventory) {
    const {
      state,
      elements = {},
      createImage,
      closeMenu,
      closeGatewayPanel = () => {},
      getOlingViews = () => null,
      getQuickSellPrices = () => Promise.resolve([]),
      openQuickSellDialog
    } = dependencies;
    const { getShelfInventoryItems } = shelfInventory;
    const inventoryPageSize = 8;
    let selectedStackKey = null;
    let selectedUnitIndexes = new Set();
    let inventoryPageIndex = 0;
    let priceRequestId = 0;
    let quickSellUnitPrices = new Map();
    let selectedPayout = null;

    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    const panelTransitions = window.OlingLabPanelTransitions;

    function getActiveShelf() {
      const placed = (state.lab?.placedItems || []).find(
        (candidate) =>
          String(candidate?.placedId || '') ===
          String(state.activeSupplyStoragePlacedId || '')
      );
      const definition = state.catalog?.get?.(placed?.itemId);
      const storageSlots = (definition?.inventorySlots || []).filter(
        (slot) => slot?.slotType === 'storage'
      );
      if (!placed || !definition || !storageSlots.length) return null;
      return { placed, definition, storageSlots };
    }

    function getShelfStacks(activeShelf) {
      const maxStack = Math.max(
        1,
        Number(activeShelf?.storageSlots?.[0]?.maxStack) || 8
      );
      const capacity = activeShelf?.storageSlots?.length || 16;
      const stacks = [];
      getShelfInventoryItems().forEach((item) => {
        let remaining = Math.max(0, Number(item.quantity) || 0);
        let stackIndex = 0;
        while (remaining > 0 && stacks.length < capacity) {
          const quantity = Math.min(maxStack, remaining);
          stacks.push({
            ...item,
            quantity,
            maxStack,
            stackIndex,
            stackKey: `${item.type}:${item.key}:${stackIndex}`
          });
          remaining -= quantity;
          stackIndex += 1;
        }
      });
      return { capacity, maxStack, stacks };
    }

    const getPriceKey = (item) => `${item?.type || ''}:${item?.key || ''}`;

    function setQuickSellState(stack) {
      if (!elements.supplyStorageQuickSell) return;
      const quantity = stack ? selectedUnitIndexes.size : 0;
      const unitPayout = Number(quickSellUnitPrices.get(getPriceKey(stack)));
      const hasPrice = Number.isFinite(unitPayout) && unitPayout > 0;
      const payout = hasPrice ? unitPayout * quantity : 0;
      selectedPayout = hasPrice && quantity > 0 ? payout : null;
      const label = Object.assign(document.createElement('span'), {
        className: 'oling-lab-supply-storage-quick-sell-label',
        textContent: 'Quick Sell'
      });
      const currency = document.createElement('span');
      currency.className = 'oling-lab-supply-storage-quick-sell-value';
      const icon = Object.assign(document.createElement('img'), {
        src: '/images/icons/currency/opal.svg',
        alt: ''
      });
      icon.setAttribute('aria-hidden', 'true');
      currency.append(
        icon,
        Object.assign(document.createElement('strong'), {
          textContent: String(payout)
        })
      );
      elements.supplyStorageQuickSell.replaceChildren(label, currency);
      elements.supplyStorageQuickSell.disabled =
        !stack || quantity < 1 || !hasPrice;
      elements.supplyStorageQuickSell.setAttribute(
        'aria-label',
        stack && quantity > 0
          ? hasPrice
            ? `Quick sell ${quantity} ${stack.name} for ${payout} Opals`
            : `Quick sell price is unavailable for ${stack.name}`
          : 'Select items from a stack to quick sell'
      );
    }

    function loadQuickSellPrices(stacks) {
      const requestId = (priceRequestId += 1);
      const uniqueItems = [
        ...new Map(stacks.map((stack) => [getPriceKey(stack), stack])).values()
      ];
      quickSellUnitPrices = new Map();
      setQuickSellState(null);
      getQuickSellPrices(uniqueItems)
        .then((prices) => {
          if (requestId !== priceRequestId) return;
          quickSellUnitPrices = new Map(
            prices
              .filter((price) => Number(price?.unitPayout) > 0)
              .map((price) => [
                `${price.itemType}:${price.itemKey}`,
                Number(price.unitPayout)
              ])
          );
          const activeShelf = getActiveShelf();
          const selected = activeShelf
            ? getShelfStacks(activeShelf).stacks.find(
                (stack) => stack.stackKey === selectedStackKey
              )
            : null;
          setQuickSellState(selected || null);
        })
        .catch(() => {
          if (requestId !== priceRequestId) return;
          quickSellUnitPrices = new Map();
          setQuickSellState(null);
        });
    }

    function createInventoryDescription(stack) {
      const description = document.createElement('div');
      description.className = 'oling-lab-supply-storage-description';
      description.classList.toggle('is-guidance', !stack);
      description.setAttribute('aria-live', 'polite');
      description.append(
        Object.assign(document.createElement('strong'), {
          textContent: stack?.name || 'Item Description'
        }),
        Object.assign(document.createElement('p'), {
          textContent: stack
            ? stack.description || 'No description is available for this item.'
            : 'Select an inventory item to view its description.'
        })
      );
      return description;
    }

    function createInventorySection(stacks, capacity, selectedStack) {
      const section = document.createElement('section');
      section.className = 'oling-lab-supply-storage-inventory';
      const heading = document.createElement('div');
      heading.className = 'oling-lab-supply-storage-heading';
      const count = Object.assign(document.createElement('span'), {
        textContent: `${stacks.length}/${capacity}`
      });
      count.setAttribute(
        'aria-label',
        `${stacks.length} of ${capacity} stack slots used`
      );
      heading.append(
        Object.assign(document.createElement('h3'), {
          textContent: 'Inventory'
        }),
        count
      );
      const pageCount = Math.max(
        1,
        Math.ceil(stacks.length / inventoryPageSize)
      );
      inventoryPageIndex = Math.min(
        Math.max(0, inventoryPageIndex),
        pageCount - 1
      );
      const visibleStacks = stacks.slice(
        inventoryPageIndex * inventoryPageSize,
        (inventoryPageIndex + 1) * inventoryPageSize
      );
      const browser = document.createElement('div');
      browser.className = 'oling-lab-supply-storage-browser';
      const grid = document.createElement('div');
      grid.className = 'oling-lab-supply-storage-grid';
      if (!stacks.length) {
        grid.appendChild(
          Object.assign(document.createElement('p'), {
            className: 'oling-lab-supply-storage-empty',
            textContent: 'No eggs or consumables are available.'
          })
        );
      }
      visibleStacks.forEach((stack) => {
        const button = document.createElement('button');
        button.className = 'oling-lab-supply-storage-item';
        button.type = 'button';
        button.dataset.soundIntent = 'select';
        button.classList.toggle(
          'is-selected',
          stack.stackKey === selectedStackKey
        );
        button.setAttribute(
          'aria-label',
          `${stack.name}, ${stack.quantity} in this stack`
        );
        button.setAttribute(
          'aria-pressed',
          String(stack.stackKey === selectedStackKey)
        );
        if (stack.image) button.appendChild(createImage(stack.image, ''));
        button.addEventListener('click', () => {
          if (selectedStackKey !== stack.stackKey) {
            selectedUnitIndexes = new Set();
          }
          selectedStackKey = stack.stackKey;
          renderShelfStoragePanel();
        });
        grid.appendChild(button);
      });
      browser.appendChild(grid);
      if (pageCount > 1) {
        const pagination = document.createElement('nav');
        pagination.className = 'oling-lab-supply-storage-pagination';
        pagination.setAttribute('aria-label', 'Supply Shelf inventory pages');
        const previous = Object.assign(document.createElement('button'), {
          type: 'button',
          textContent: '‹',
          disabled: inventoryPageIndex === 0
        });
        previous.dataset.soundIntent = 'previous';
        previous.setAttribute('aria-label', 'Previous inventory page');
        previous.addEventListener('click', () => {
          inventoryPageIndex -= 1;
          renderShelfStoragePanel();
        });
        const pageStatus = Object.assign(document.createElement('strong'), {
          textContent: `${inventoryPageIndex + 1} / ${pageCount}`
        });
        pageStatus.setAttribute('aria-live', 'polite');
        const next = Object.assign(document.createElement('button'), {
          type: 'button',
          textContent: '›',
          disabled: inventoryPageIndex >= pageCount - 1
        });
        next.dataset.soundIntent = 'next';
        next.setAttribute('aria-label', 'Next inventory page');
        next.addEventListener('click', () => {
          inventoryPageIndex += 1;
          renderShelfStoragePanel();
        });
        pagination.append(previous, pageStatus, next);
        browser.appendChild(pagination);
      }
      section.append(
        heading,
        browser,
        createInventoryDescription(selectedStack)
      );
      return section;
    }

    function createStackDetails(stack, maxStack) {
      const section = document.createElement('section');
      section.className = 'oling-lab-supply-storage-details';
      const heading = document.createElement('div');
      heading.className = 'oling-lab-supply-storage-heading';
      heading.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Selected Stack'
        })
      );
      section.appendChild(heading);
      if (!stack) {
        section.appendChild(
          Object.assign(document.createElement('p'), {
            className: 'oling-lab-supply-storage-empty',
            textContent: 'Select an item to view its stack.'
          })
        );
        return section;
      }
      const count = Object.assign(document.createElement('span'), {
        className: 'oling-lab-supply-storage-count',
        textContent: `${stack.quantity}/${maxStack}`
      });
      count.setAttribute(
        'aria-label',
        `${stack.quantity} of ${maxStack} items in this stack`
      );
      heading.appendChild(count);
      const summary = document.createElement('div');
      summary.className = 'oling-lab-supply-storage-summary';
      if (stack.image) summary.appendChild(createImage(stack.image, ''));
      const copy = document.createElement('div');
      copy.append(
        Object.assign(document.createElement('strong'), {
          textContent: stack.name
        }),
        Object.assign(document.createElement('span'), {
          textContent: 'Items in this stack'
        })
      );
      summary.append(copy);
      const units = document.createElement('div');
      units.className = 'oling-lab-supply-storage-units';
      Array.from({ length: stack.quantity }, (_, index) => {
        const button = document.createElement('button');
        const selected = selectedUnitIndexes.has(index);
        button.className = 'oling-lab-supply-storage-unit';
        button.classList.toggle('is-selected', selected);
        button.type = 'button';
        button.dataset.soundIntent = 'select';
        button.setAttribute(
          'aria-label',
          `${selected ? 'Unselect' : 'Select'} ${stack.name} ${index + 1}`
        );
        button.setAttribute('aria-pressed', String(selected));
        if (stack.image) button.appendChild(createImage(stack.image, ''));
        button.addEventListener('click', () => {
          if (selectedUnitIndexes.has(index)) selectedUnitIndexes.delete(index);
          else selectedUnitIndexes.add(index);
          renderShelfStoragePanel();
        });
        units.appendChild(button);
      });
      const selector = document.createElement('div');
      selector.className = 'oling-lab-supply-storage-selector';
      const decrement = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: '‹',
        disabled: selectedUnitIndexes.size < 1
      });
      decrement.dataset.soundIntent = 'decrease';
      decrement.setAttribute('aria-label', 'Select one fewer item');
      const selectedCount = Object.assign(document.createElement('strong'), {
        textContent: String(selectedUnitIndexes.size)
      });
      selectedCount.setAttribute(
        'aria-label',
        `${selectedUnitIndexes.size} selected`
      );
      const increment = Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: '›',
        disabled: selectedUnitIndexes.size >= stack.quantity
      });
      increment.dataset.soundIntent = 'increase';
      increment.setAttribute('aria-label', 'Select one more item');
      decrement.addEventListener('click', () => {
        const selected = [...selectedUnitIndexes].sort((a, b) => b - a)[0];
        if (selected !== undefined) selectedUnitIndexes.delete(selected);
        renderShelfStoragePanel();
      });
      increment.addEventListener('click', () => {
        const next = Array.from(
          { length: stack.quantity },
          (_, index) => index
        ).find((index) => !selectedUnitIndexes.has(index));
        if (next !== undefined) selectedUnitIndexes.add(next);
        renderShelfStoragePanel();
      });
      selector.append(decrement, selectedCount, increment);
      section.append(summary, units, selector);
      return section;
    }

    function renderShelfStoragePanel() {
      if (!elements.supplyStoragePanelContent) return;
      const activeShelf = getActiveShelf();
      if (!activeShelf) {
        closeShelfStoragePanel();
        return;
      }
      const { capacity, maxStack, stacks } = getShelfStacks(activeShelf);
      if (
        selectedStackKey &&
        !stacks.some((stack) => stack.stackKey === selectedStackKey)
      ) {
        selectedStackKey = null;
        selectedUnitIndexes = new Set();
      }
      const selected =
        stacks.find((stack) => stack.stackKey === selectedStackKey) || null;
      selectedUnitIndexes = new Set(
        [...selectedUnitIndexes].filter(
          (index) => selected && index >= 0 && index < selected.quantity
        )
      );
      if (elements.supplyStoragePanelTitle) {
        elements.supplyStoragePanelTitle.textContent =
          activeShelf.definition.name || 'Supply Shelf';
      }
      elements.supplyStoragePanelContent.replaceChildren(
        createInventorySection(stacks, capacity, selected),
        createStackDetails(selected, maxStack)
      );
      setQuickSellState(selected);
    }

    function openShelfStoragePanel(placedId) {
      const placed = (state.lab?.placedItems || []).find(
        (candidate) => String(candidate?.placedId || '') === String(placedId)
      );
      const definition = state.catalog?.get?.(placed?.itemId);
      if (
        !placed ||
        !(definition?.inventorySlots || []).some(
          (slot) => slot?.slotType === 'storage'
        ) ||
        !elements.supplyStoragePanel
      ) {
        return;
      }
      const wasExpanded =
        state.supplyStoragePanelOpen && !state.supplyStoragePanelCollapsed;
      getOlingViews()?.closeStoragePanel?.({ sound: false });
      closeGatewayPanel({ sound: false });
      closeMenu?.();
      state.activeSupplyStoragePlacedId = placed.placedId;
      state.supplyStoragePanelOpen = true;
      state.supplyStoragePanelCollapsed = false;
      selectedStackKey = null;
      selectedUnitIndexes = new Set();
      inventoryPageIndex = 0;
      elements.supplyStoragePanelToggle?.setAttribute('aria-expanded', 'true');
      if (elements.supplyStoragePanelToggle) {
        elements.supplyStoragePanelToggle.textContent = 'Hide';
      }
      renderShelfStoragePanel();
      loadQuickSellPrices(getShelfStacks(getActiveShelf()).stacks);
      const show = () => {
        if (!state.supplyStoragePanelOpen) return;
        if (!wasExpanded) playSound('sidePanelOpen');
      };
      if (panelTransitions) {
        void panelTransitions.open(elements.supplyStoragePanel, {
          afterOpen: show
        });
      } else if (typeof window.requestAnimationFrame === 'function') {
        elements.supplyStoragePanel.hidden = false;
        window.requestAnimationFrame(() => {
          elements.supplyStoragePanel.classList.add('is-open');
          show();
        });
      } else {
        elements.supplyStoragePanel.hidden = false;
        elements.supplyStoragePanel.classList.add('is-open');
        show();
      }
    }

    function closeShelfStoragePanel(options = {}) {
      if (!elements.supplyStoragePanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.supplyStoragePanel
      );
      if (!state.supplyStoragePanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasVisible = Boolean(
        state.supplyStoragePanelOpen && !elements.supplyStoragePanel.hidden
      );
      state.supplyStoragePanelOpen = false;
      state.supplyStoragePanelCollapsed = false;
      state.activeSupplyStoragePlacedId = null;
      selectedStackKey = null;
      selectedUnitIndexes = new Set();
      inventoryPageIndex = 0;
      priceRequestId += 1;
      quickSellUnitPrices = new Map();
      selectedPayout = null;
      elements.supplyStoragePanelToggle?.setAttribute('aria-expanded', 'false');
      const playCloseSound = () => {
        if (wasVisible && options.sound !== false) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.supplyStoragePanel.classList.remove(
          'is-open',
          'is-collapsed'
        );
        setQuickSellState(null);
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.supplyStoragePanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.supplyStoragePanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    function toggleShelfStoragePanel() {
      if (!state.supplyStoragePanelOpen || !elements.supplyStoragePanel) return;
      state.supplyStoragePanelCollapsed = !state.supplyStoragePanelCollapsed;
      elements.supplyStoragePanel.classList.toggle(
        'is-collapsed',
        state.supplyStoragePanelCollapsed
      );
      elements.supplyStoragePanelToggle?.setAttribute(
        'aria-expanded',
        String(!state.supplyStoragePanelCollapsed)
      );
      if (elements.supplyStoragePanelToggle) {
        elements.supplyStoragePanelToggle.textContent =
          state.supplyStoragePanelCollapsed ? 'Show' : 'Hide';
      }
      playSound(
        state.supplyStoragePanelCollapsed ? 'sidePanelClose' : 'sidePanelOpen'
      );
    }

    elements.supplyStoragePanelToggle?.addEventListener(
      'click',
      toggleShelfStoragePanel
    );
    elements.supplyStoragePanelBack?.addEventListener('click', () => {
      closeShelfStoragePanel();
      elements.actionPanel
        ?.querySelector('.oling-lab-action-panel-button.is-interact')
        ?.focus();
    });
    elements.supplyStorageQuickSell?.addEventListener('click', () => {
      const activeShelf = getActiveShelf();
      if (!activeShelf) return;
      const selected = getShelfStacks(activeShelf).stacks.find(
        (stack) => stack.stackKey === selectedStackKey
      );
      const quantity = selectedUnitIndexes.size;
      if (!selected || quantity < 1 || selectedPayout === null) return;
      openQuickSellDialog(selected, quantity, {
        onComplete: () => {
          selectedUnitIndexes = new Set();
          renderShelfStoragePanel();
        }
      });
    });

    return {
      closeShelfStoragePanel,
      openShelfStoragePanel,
      renderShelfStoragePanel
    };
  }

  window.createOlingLabShelfStorage = createOlingLabShelfStorage;
})();

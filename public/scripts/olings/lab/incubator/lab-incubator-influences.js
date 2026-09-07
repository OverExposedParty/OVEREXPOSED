(function () {
  function createOlingLabIncubatorInfluences(dependencies) {
    const {
      state,
      elements,
      labEndpoint,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      getAvailableConsumableQuantity = (consumableKey) =>
        Number(
          state.ownedConsumables.find((item) => item.key === consumableKey)
            ?.quantity || 0
        ),
      createImage,
      getEggImage,
      createItemButton,
      createInlineAction,
      createHatchEggAction,
      syncIncubatorHatchActions,
      createStatsToggleButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
      formatOdds,
      formatInfluenceEffect,
      formatDuration,
      getHatchProgress,
      createTabMenu,
      openMenu,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab
    } = dependencies;
    const {
      getActiveItemInfluenceSlot,
      getOwnedConsumablesForInfluenceSlot,
      getItemInfluenceSlots,
      getPendingItemInfluenceKey,
      getSelectedItemInfluenceKey,
      isIncubatorActivelyHatching,
      placeEggInIncubator,
      createIncubatorInfoStage,
      setActiveItemInfluenceSlot,
      setPendingItemInfluenceKey,
      setSelectedItemInfluenceKey
    } = dependencies;
    let influenceItemDrag = null;
    let activeInfluenceDropArea = null;

    function isPointerInside(element, event) {
      if (!element?.getBoundingClientRect) return false;
      const rect = element.getBoundingClientRect();
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function createInfluenceItemDragGhost(consumable) {
      const ghost = document.createElement('div');
      ghost.className = 'oling-lab-item-influence-drag-ghost';
      const itemName = consumable.name || consumable.key;
      const image = consumable.assets?.icon || consumable.assets?.image;
      ghost.appendChild(
        image
          ? createImage(image, itemName)
          : createSquareMarker(
              String(itemName).charAt(0),
              'oling-lab-item-influence-drag-placeholder'
            )
      );
      document.body.appendChild(ghost);
      return ghost;
    }

    function getInfluenceDropSlot(event) {
      if (!activeInfluenceDropArea?.element?.isConnected) return null;
      return (
        [
          ...activeInfluenceDropArea.element.querySelectorAll(
            '.oling-lab-item-influence-slot:not(:disabled)'
          )
        ].find((slot) => isPointerInside(slot, event)) || null
      );
    }

    function setInfluenceDropTarget(slot) {
      if (!influenceItemDrag) return;
      if (influenceItemDrag.dropSlot !== slot) {
        influenceItemDrag.dropSlot?.classList.remove('is-item-drop-target');
        slot?.classList.add('is-item-drop-target');
        influenceItemDrag.dropSlot = slot;
      }
      influenceItemDrag.ghost?.classList.toggle(
        'is-over-influence-slot',
        Boolean(slot)
      );
    }

    function moveInfluenceItemDrag(event) {
      if (
        !influenceItemDrag ||
        event.pointerId !== influenceItemDrag.pointerId
      ) {
        return;
      }
      const distance = Math.hypot(
        event.clientX - influenceItemDrag.startX,
        event.clientY - influenceItemDrag.startY
      );
      if (!influenceItemDrag.active && distance < 6) return;
      if (!influenceItemDrag.active) {
        influenceItemDrag.active = true;
        influenceItemDrag.source.dataset.dragged = 'true';
        influenceItemDrag.ghost = createInfluenceItemDragGhost(
          influenceItemDrag.consumable
        );
      }
      influenceItemDrag.ghost.style.left = `${event.clientX}px`;
      influenceItemDrag.ghost.style.top = `${event.clientY}px`;
      setInfluenceDropTarget(getInfluenceDropSlot(event));
      event.preventDefault();
    }

    function clearInfluenceItemDrag() {
      if (!influenceItemDrag) return;
      influenceItemDrag.dropSlot?.classList.remove('is-item-drop-target');
      influenceItemDrag.ghost?.remove();
      influenceItemDrag = null;
    }

    function finishInfluenceItemDrag(event, cancelled = false) {
      if (
        !influenceItemDrag ||
        event.pointerId !== influenceItemDrag.pointerId
      ) {
        return;
      }
      const completed = influenceItemDrag;
      const dropArea = activeInfluenceDropArea;
      const slotKey = completed.dropSlot?.dataset.olingInfluenceSlot || '';
      const shouldSelect = Boolean(
        completed.active && slotKey && dropArea && !cancelled
      );
      clearInfluenceItemDrag();
      if (completed.active) {
        window.setTimeout?.(() => {
          completed.source.dataset.dragged = 'false';
        }, 0);
      }
      if (shouldSelect) dropArea.onDrop(slotKey, completed.consumableKey);
      if (completed.active) event.preventDefault();
    }

    function beginInfluenceItemDrag(
      event,
      context,
      consumableKey,
      consumable,
      source
    ) {
      if (
        event.isPrimary === false ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        influenceItemDrag
      ) {
        return;
      }
      influenceItemDrag = {
        context,
        consumable,
        consumableKey,
        pointerId: event.pointerId,
        source,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        dropSlot: null,
        ghost: null
      };
      source.setPointerCapture?.(event.pointerId);
    }

    function createItemInfluenceSlotButton(
      context,
      slotDefinition,
      options = {}
    ) {
      const selectedItemKey = getSelectedItemInfluenceKey(
        context,
        slotDefinition.key
      );
      const selectedItem = selectedItemKey
        ? getConsumable(selectedItemKey)
        : null;
      const slotElement = document.createElement('button');
      slotElement.className = 'oling-lab-item-influence-slot';
      slotElement.classList.toggle('is-active', Boolean(options.active));
      slotElement.classList.toggle('is-disabled', Boolean(options.disabled));
      slotElement.type = 'button';
      slotElement.disabled = Boolean(options.disabled);
      slotElement.dataset.olingInfluenceSlot = slotDefinition.key;
      slotElement.dataset.olingItemDropMessage = selectedItem
        ? 'Drop to replace item'
        : 'Drop to add item';
      slotElement.dataset.soundIntent = 'select';
      slotElement.setAttribute('aria-pressed', String(Boolean(options.active)));
      slotElement.setAttribute(
        'aria-label',
        `${options.active ? 'Selected' : 'Select'} ${slotDefinition.label}`
      );
      if (selectedItem?.assets?.icon || selectedItem?.assets?.image) {
        slotElement.appendChild(
          createImage(
            selectedItem.assets.icon || selectedItem.assets.image,
            selectedItem.name
          )
        );
      } else {
        slotElement.appendChild(
          createSquareMarker('+', 'oling-lab-item-influence-marker')
        );
      }
      slotElement.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent:
            selectedItem?.name ||
            (getItemInfluenceSlots(context).length === 1
              ? 'Add Influence'
              : slotDefinition.label)
        })
      );
      if (typeof options.onClick === 'function') {
        slotElement.addEventListener('click', options.onClick);
      }
      return slotElement;
    }

    function createItemInfluenceInventory(
      context,
      slotDefinition,
      options = {}
    ) {
      const pendingItemKey = getPendingItemInfluenceKey(
        context,
        slotDefinition.key
      );
      const insertedItemKey = getSelectedItemInfluenceKey(
        context,
        slotDefinition.key
      );
      const hidesInventory = Boolean(
        getItemInfluenceSlots(context).length === 1 && insertedItemKey
      );
      const panel = document.createElement('section');
      panel.className = 'oling-lab-item-influence-inventory-panel';
      panel.classList.toggle('is-filled-single-slot', hidesInventory);
      panel.setAttribute(
        'aria-label',
        `${slotDefinition.label} influence inventory`
      );
      if (!hidesInventory) {
        panel.appendChild(
          Object.assign(document.createElement('h3'), {
            textContent: 'Influence Inventory'
          })
        );

        const inventory = document.createElement('div');
        inventory.className = 'oling-lab-item-influence-inventory-browser';
        const grid = document.createElement('div');
        grid.className = 'oling-lab-item-influence-inventory-grid';
        const ownedItems = getOwnedConsumablesForInfluenceSlot(
          context,
          slotDefinition
        );
        const pageSize = 8;
        const pageCount = Math.max(1, Math.ceil(ownedItems.length / pageSize));
        const pageIndex = Math.min(
          Math.max(0, Number(options.pageIndex) || 0),
          pageCount - 1
        );
        const visibleItems = ownedItems.slice(
          pageIndex * pageSize,
          (pageIndex + 1) * pageSize
        );
        visibleItems.forEach((ownedItem) => {
          const consumable = getConsumable(ownedItem.key);
          const isSelected = pendingItemKey === ownedItem.key;
          const quantity = getAvailableConsumableQuantity(ownedItem.key);
          const itemName = consumable.name || ownedItem.key;
          let button = null;
          button = createItemButton(
            {
              name: itemName,
              image: consumable.assets?.icon || consumable.assets?.image || ''
            },
            {
              onClick: () => {
                if (button.dataset.dragged === 'true') return;
                options.onSelect?.(isSelected ? null : ownedItem.key);
              }
            }
          );
          button.classList.add('oling-lab-item-influence-inventory-card');
          button.setAttribute(
            'aria-label',
            `${itemName}, ${quantity} available${isSelected ? ', selected' : ''}`
          );
          button.setAttribute('aria-pressed', String(isSelected));
          button.appendChild(
            Object.assign(document.createElement('span'), {
              className: 'oling-lab-item-influence-quantity',
              textContent: String(quantity)
            })
          );
          if (isSelected) {
            button.classList.add('is-selected');
          }
          button.draggable = false;
          button.addEventListener('dragstart', (event) =>
            event.preventDefault()
          );
          button.addEventListener('pointerdown', (event) =>
            beginInfluenceItemDrag(
              event,
              context,
              ownedItem.key,
              consumable,
              button
            )
          );
          grid.appendChild(button);
        });

        if (!visibleItems.length) {
          grid.appendChild(createEmptyMessage('No influence items available.'));
        } else {
          for (let index = visibleItems.length; index < pageSize; index += 1) {
            const emptyCell = document.createElement('span');
            emptyCell.className = 'oling-lab-item-influence-empty-cell';
            emptyCell.setAttribute('aria-hidden', 'true');
            grid.appendChild(emptyCell);
          }
        }
        inventory.appendChild(grid);

        if (pageCount > 1) {
          const pagination = document.createElement('nav');
          pagination.className = 'oling-lab-item-influence-pagination';
          pagination.setAttribute('aria-label', 'Influence inventory pages');
          const previous = Object.assign(document.createElement('button'), {
            type: 'button',
            textContent: '‹',
            disabled: pageIndex === 0
          });
          previous.setAttribute('aria-label', 'Previous influence page');
          previous.dataset.soundIntent = 'previous';
          previous.addEventListener('click', () =>
            options.onPageChange?.(pageIndex - 1)
          );
          const pageStatus = Object.assign(document.createElement('strong'), {
            textContent: `${pageIndex + 1} / ${pageCount}`
          });
          pageStatus.setAttribute('aria-live', 'polite');
          const next = Object.assign(document.createElement('button'), {
            type: 'button',
            textContent: '›',
            disabled: pageIndex >= pageCount - 1
          });
          next.setAttribute('aria-label', 'Next influence page');
          next.dataset.soundIntent = 'next';
          next.addEventListener('click', () =>
            options.onPageChange?.(pageIndex + 1)
          );
          pagination.append(previous, pageStatus, next);
          inventory.appendChild(pagination);
        }
        panel.appendChild(inventory);
      }

      const describedItemKey = hidesInventory
        ? insertedItemKey
        : pendingItemKey || insertedItemKey;
      const describedItem = describedItemKey
        ? getConsumable(describedItemKey)
        : null;
      const description = document.createElement('div');
      description.className = 'oling-lab-item-influence-description';
      description.classList.toggle('is-expanded', hidesInventory);
      description.classList.toggle('is-guidance', !describedItem);
      description.setAttribute('aria-live', 'polite');
      if (describedItem) {
        const itemName = describedItem.name || describedItem.key;
        const targetLabel =
          describedItem.target === 'egg'
            ? 'Egg hatching'
            : formatTitle(describedItem.target || 'Hatching');
        const effectLabel =
          formatInfluenceEffect(describedItem) ||
          formatTitle(describedItem.effect?.type || 'Influence');
        description.appendChild(
          Object.assign(document.createElement('strong'), {
            textContent: itemName
          })
        );
        if (hidesInventory) {
          description.appendChild(
            Object.assign(document.createElement('p'), {
              textContent:
                describedItem.description ||
                `${itemName} is an influence used while hatching an egg.`
            })
          );
        }
        description.appendChild(
          Object.assign(document.createElement('span'), {
            textContent: `Affects: ${targetLabel} · ${effectLabel}`
          })
        );
      } else {
        description.append(
          Object.assign(document.createElement('strong'), {
            textContent: 'Discover Your Influences'
          }),
          Object.assign(document.createElement('p'), {
            textContent:
              'Choose an item above to discover how it can shape your Oling.'
          })
        );
      }
      panel.appendChild(description);
      return panel;
    }

    function createItemsStage(context, options = {}) {
      const isLocked = isIncubatorActivelyHatching(context);
      const influenceSlots = getItemInfluenceSlots(context);
      if (isLocked) setActiveItemInfluenceSlot(context, null);
      let activeSlotKey = isLocked ? '' : getActiveItemInfluenceSlot(context);
      if (
        !isLocked &&
        !influenceSlots.some((slot) => slot.key === activeSlotKey)
      ) {
        activeSlotKey = influenceSlots[0]?.key || '';
        setActiveItemInfluenceSlot(context, activeSlotKey || null);
      }
      const stage = document.createElement('section');
      stage.className = 'oling-lab-items-stage';
      stage.classList.toggle('is-locked', isLocked);
      activeInfluenceDropArea = null;

      const slots = document.createElement('div');
      slots.className = 'oling-lab-item-slot-row';
      slots.dataset.influenceSlotCount = String(influenceSlots.length);
      const preview = document.createElement('div');
      preview.className = 'oling-lab-incubator-preview-frame';
      preview.appendChild(slots);
      function renderSlots() {
        slots.replaceChildren();
        influenceSlots.forEach((slotDefinition) => {
          slots.appendChild(
            createItemInfluenceSlotButton(context, slotDefinition, {
              active: !isLocked && slotDefinition.key === activeSlotKey,
              disabled: isLocked,
              onClick: () => selectSlot(slotDefinition)
            })
          );
        });
      }

      const inventoryHost = document.createElement('div');
      inventoryHost.className = 'oling-lab-item-influence-inventory-host';
      const inventoryPages = new Map();

      function getActiveSlot() {
        return (
          influenceSlots.find((slot) => slot.key === activeSlotKey) || null
        );
      }

      function renderInventory() {
        const activeSlot = getActiveSlot();
        inventoryHost.replaceChildren(
          ...(activeSlot
            ? [
                createItemInfluenceInventory(context, activeSlot, {
                  pageIndex: inventoryPages.get(activeSlot.key) || 0,
                  onPageChange: (pageIndex) => {
                    inventoryPages.set(activeSlot.key, pageIndex);
                    renderInventory();
                  },
                  onSelect: (consumableKey) =>
                    selectItem(activeSlot, consumableKey)
                })
              ]
            : [])
        );
      }

      function selectItem(slotDefinition, consumableKey) {
        if (isLocked) return;
        setPendingItemInfluenceKey(context, slotDefinition.key, consumableKey);
        renderSlots();
        renderInventory();
        options.onChange?.();
      }

      function selectSlot(slotDefinition) {
        if (isLocked) return;
        activeSlotKey = slotDefinition.key;
        setActiveItemInfluenceSlot(context, slotDefinition.key);
        renderSlots();
        renderInventory();
        options.onChange?.();
      }

      function dropItem(slotKey, consumableKey) {
        if (isLocked) return;
        const slotDefinition = influenceSlots.find(
          (slot) => slot.key === slotKey
        );
        if (!slotDefinition) return;
        activeSlotKey = slotDefinition.key;
        setActiveItemInfluenceSlot(context, slotDefinition.key);
        setSelectedItemInfluenceKey(context, slotDefinition.key, consumableKey);
        setPendingItemInfluenceKey(context, slotDefinition.key, null);
        renderSlots();
        renderInventory();
        options.onChange?.();
      }

      if (!influenceSlots.length) {
        stage.appendChild(
          createEmptyMessage('This incubator has no influence slots.')
        );
        return stage;
      }

      renderSlots();
      stage.appendChild(preview);
      if (!isLocked) {
        activeInfluenceDropArea = {
          element: slots,
          onDrop: dropItem
        };
        renderInventory();
        stage.appendChild(inventoryHost);
      }
      return stage;
    }

    function createItemsTab(context, options = {}) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      section.appendChild(createItemsStage(context, options));
      return [section];
    }

    function createInfluenceFooterActions(context, onChange = () => {}) {
      const activeSlotKey = getActiveItemInfluenceSlot(context);
      const isLocked = isIncubatorActivelyHatching(context);
      const insertedItemKey = activeSlotKey
        ? getSelectedItemInfluenceKey(context, activeSlotKey)
        : null;
      const pendingItemKey = activeSlotKey
        ? getPendingItemInfluenceKey(context, activeSlotKey)
        : null;
      const canRemove = Boolean(!isLocked && activeSlotKey && insertedItemKey);
      const canInsert = Boolean(
        !isLocked &&
        activeSlotKey &&
        pendingItemKey &&
        pendingItemKey !== insertedItemKey
      );

      const hasInsertedInfluence = Boolean(insertedItemKey);
      const action = hasInsertedInfluence
        ? createInlineAction(
            'Remove Influence',
            () => {
              if (!canRemove) return;
              setSelectedItemInfluenceKey(context, activeSlotKey, null);
              setPendingItemInfluenceKey(context, activeSlotKey, null);
              onChange();
            },
            {
              className: 'is-remove-action',
              disabled: !canRemove,
              soundIntent: 'deselect'
            }
          )
        : createInlineAction(
            'Insert Influence',
            () => {
              if (!canInsert) return;
              setSelectedItemInfluenceKey(
                context,
                activeSlotKey,
                pendingItemKey
              );
              setPendingItemInfluenceKey(context, activeSlotKey, null);
              onChange();
            },
            {
              className: 'is-hatch-action',
              disabled: !canInsert,
              soundIntent: 'confirm'
            }
          );
      action.classList.add('is-influence-action');
      return [action];
    }

    function createIncubatorInfoTab(context) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      section.appendChild(createIncubatorInfoStage(context));
      return [section];
    }

    function openInsertEggTab(context) {
      const grid = document.createElement('div');
      grid.className = 'oling-lab-menu-grid';
      state.ownedEggs.forEach((ownedEgg) => {
        const available = getAvailableEggQuantity(ownedEgg.key);
        if (available < 1) return;
        const egg = getEgg(ownedEgg.key);
        grid.appendChild(
          createItemButton(
            {
              name: `${egg.name || ownedEgg.key} x${available}`,
              image: getEggImage(egg)
            },
            {
              onClick: () => placeEggInIncubator(context, ownedEgg.key)
            }
          )
        );
      });

      openMenu(
        'Insert Egg',
        [
          grid.children.length ? grid : createEmptyMessage('No eggs available.')
        ],
        {
          theme: 'egg-shop'
        }
      );
    }

    if (typeof document !== 'undefined') {
      document.addEventListener?.('pointermove', moveInfluenceItemDrag);
      document.addEventListener?.('pointerup', (event) =>
        finishInfluenceItemDrag(event)
      );
      document.addEventListener?.('pointercancel', (event) =>
        finishInfluenceItemDrag(event, true)
      );
      document.addEventListener?.('keydown', (event) => {
        if (event.key === 'Escape') clearInfluenceItemDrag();
      });
    }

    return {
      createItemInfluenceSlotButton,
      createInfluenceFooterActions,
      createItemsTab
    };
  }

  window.createOlingLabIncubatorInfluences = createOlingLabIncubatorInfluences;
})();

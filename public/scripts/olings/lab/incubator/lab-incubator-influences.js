(function () {
  function createOlingLabIncubatorInfluences(dependencies) {
    const {
      state,
      elements,
      itemInfluenceSlots,
      labEndpoint,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      createImage,
      getEggImage,
      createItemButton,
      createInlineAction,
      createHatchEggAction,
      syncIncubatorHatchActions,
      createStatsToggleButton,
      createPanelBackButton,
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
      closeStagePanel,
      getActiveItemInfluenceSlot,
      getOwnedConsumablesForInfluenceSlot,
      getSelectedItemInfluenceKey,
      isIncubatorActivelyHatching,
      openStagePanel,
      placeEggInIncubator,
      setActiveItemInfluenceSlot,
      setPanelInteractivity,
      setSelectedItemInfluenceKey
    } = dependencies;

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
      const isExpanded = Boolean(options.expanded);
      const slotElement = document.createElement(isExpanded ? 'div' : 'button');
      slotElement.className = 'oling-lab-item-influence-slot';
      slotElement.classList.toggle('is-expanded', isExpanded);
      slotElement.classList.toggle('is-disabled', Boolean(options.disabled));
      if (!isExpanded) {
        slotElement.type = 'button';
        slotElement.disabled = Boolean(options.disabled);
      }
      slotElement.setAttribute(
        'aria-label',
        isExpanded
          ? `${slotDefinition.label} slot`
          : `Open ${slotDefinition.label}`
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
          textContent: selectedItem?.name || slotDefinition.label
        })
      );
      if (isExpanded) {
        const backButton = Object.assign(document.createElement('button'), {
          className: 'oling-lab-item-influence-back',
          type: 'button'
        });
        backButton.setAttribute(
          'aria-label',
          `Back from ${slotDefinition.label}`
        );
        backButton.addEventListener('click', (event) => {
          event.stopPropagation();
          if (typeof options.onBack === 'function') options.onBack();
        });
        slotElement.appendChild(backButton);
      }
      if (!isExpanded && typeof options.onClick === 'function') {
        slotElement.addEventListener('click', options.onClick);
      }
      return slotElement;
    }

    function createItemInfluenceInventory(
      context,
      slotDefinition,
      onSelect,
      onRemove
    ) {
      const selectedItemKey = getSelectedItemInfluenceKey(
        context,
        slotDefinition.key
      );
      const panel = document.createElement('aside');
      panel.className =
        'oling-lab-side-panel oling-lab-item-influence-inventory-panel';
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Item Inventory'
        })
      );

      const grid = document.createElement('div');
      grid.className = 'oling-lab-item-influence-inventory-grid';
      getOwnedConsumablesForInfluenceSlot(slotDefinition).forEach(
        (ownedItem) => {
          const consumable = getConsumable(ownedItem.key);
          const isSelected =
            getSelectedItemInfluenceKey(context, slotDefinition.key) ===
            ownedItem.key;
          const button = createItemButton(
            {
              name: `${consumable.name || ownedItem.key} x${Number(ownedItem.quantity || 0)}`,
              image: consumable.assets?.icon || consumable.assets?.image || ''
            },
            {
              badge: isSelected ? 'Selected' : '',
              onClick: () => onSelect(ownedItem.key)
            }
          );
          if (isSelected) {
            button.classList.add('is-selected');
            button.setAttribute('aria-pressed', 'true');
          }
          grid.appendChild(button);
        }
      );

      panel.appendChild(
        grid.children.length
          ? grid
          : createEmptyMessage(
              `No ${slotDefinition.label.toLowerCase()} items available.`
            )
      );
      const actions = document.createElement('div');
      actions.className = 'oling-lab-item-influence-inventory-actions';
      actions.appendChild(
        createInlineAction('Remove Item', onRemove, {
          className: 'is-remove-action',
          disabled: !selectedItemKey
        })
      );
      panel.appendChild(actions);
      return panel;
    }

    function createItemsStage(context) {
      const isLocked = isIncubatorActivelyHatching(context);
      if (isLocked) setActiveItemInfluenceSlot(context, null);
      const activeSlotKey = isLocked ? '' : getActiveItemInfluenceSlot(context);
      const activeSlot =
        itemInfluenceSlots.find((slot) => slot.key === activeSlotKey) || null;
      const stage = document.createElement('section');
      stage.className = 'oling-lab-egg-insertion-stage oling-lab-items-stage';
      stage.classList.toggle('is-locked', isLocked);
      let isExpanded = Boolean(activeSlot);
      let inventoryPanel = null;
      let expandedSlotButton = null;

      const slots = document.createElement('div');
      slots.className = 'oling-lab-item-slot-row';
      function renderCollapsedSlots() {
        slots.replaceChildren();
        itemInfluenceSlots.forEach((slotDefinition) => {
          slots.appendChild(
            createItemInfluenceSlotButton(context, slotDefinition, {
              disabled: isLocked,
              onClick: () => openSlot(slotDefinition)
            })
          );
        });
      }
      renderCollapsedSlots();

      const expandedLayer = document.createElement('div');
      expandedLayer.className = 'oling-lab-item-influence-expanded-layer';

      function closeSlot() {
        isExpanded = false;
        setActiveItemInfluenceSlot(context, null);
        if (inventoryPanel) {
          closeStagePanel(
            stage,
            inventoryPanel,
            'is-selecting-item-influence',
            () => expandedLayer.replaceChildren()
          );
        } else {
          stage.classList.remove('is-selecting-item-influence');
          window.setTimeout(() => {
            expandedLayer.replaceChildren();
          }, EGG_PICKER_TRANSITION_MS);
        }
      }

      function selectItem(slotDefinition, consumableKey) {
        if (isLocked) return;
        setSelectedItemInfluenceKey(context, slotDefinition.key, consumableKey);
        renderCollapsedSlots();
        closeSlot();
      }

      function removeItem(slotDefinition) {
        if (isLocked) return;
        setSelectedItemInfluenceKey(context, slotDefinition.key, null);
        renderCollapsedSlots();
        closeSlot();
      }

      function renderExpandedSlot(slotDefinition) {
        expandedSlotButton = createItemInfluenceSlotButton(
          context,
          slotDefinition,
          {
            expanded: true,
            onBack: closeSlot
          }
        );
        expandedLayer.replaceChildren(expandedSlotButton);
        inventoryPanel = createItemInfluenceInventory(
          context,
          slotDefinition,
          (consumableKey) => selectItem(slotDefinition, consumableKey),
          () => removeItem(slotDefinition)
        );
        setPanelInteractivity(inventoryPanel, true);
        stage.appendChild(inventoryPanel);
      }

      function openSlot(slotDefinition) {
        if (isLocked) return;
        if (isExpanded && activeSlotKey === slotDefinition.key) {
          closeSlot();
          return;
        }
        isExpanded = true;
        setActiveItemInfluenceSlot(context, slotDefinition.key);
        if (inventoryPanel) inventoryPanel.remove();
        renderExpandedSlot(slotDefinition);
        openStagePanel(stage, inventoryPanel, 'is-selecting-item-influence');
      }

      stage.append(slots, expandedLayer);
      if (activeSlot) {
        renderExpandedSlot(activeSlot);
        if (inventoryPanel) {
          applyInitialStagePanel(
            stage,
            inventoryPanel,
            'is-selecting-item-influence',
            true,
            false
          );
        } else {
          stage.classList.add('is-selecting-item-influence');
        }
      }
      return stage;
    }

    function createItemsTab(context) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section';
      section.appendChild(createItemsStage(context));
      return [section];
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


    return {
      createItemsTab
    };
  }

  window.createOlingLabIncubatorInfluences = createOlingLabIncubatorInfluences;
})();

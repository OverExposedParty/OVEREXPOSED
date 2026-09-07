(function () {
  function createOlingLabRenderer(dependencies) {
    const {
      rows,
      isLabCellUnlocked,
      getLabExpansionColumn,
      state,
      openLabColumnPurchaseDialog,
      getItem,
      toggleSelectedTarget,
      interactWithFurniture = () => {},
      isTargetSelected,
      createFurnitureArt,
      getShelfInventoryItems,
      getOlingViews = () => null,
      createImage,
      getEgg,
      getEggImage,
      getDisplayedLabColumns,
      getOccupiedMap,
      elements = {},
      createActionPanel,
      applyWallpaper,
      getFurnitureInteractionAction = () => ({ theme: 'furniture' }),
      resolveMenuConfig = (config) => config || {},
      getRoaming,
      resetCameraIfNeeded,
      renderWallDecorations,
      beginFurnitureDrag = () => {},
      consumeFurnitureDragClick = () => false,
      isFurnitureBeingDragged = () => false,
      syncFurnitureDragAfterRender = () => {},
      storeFurnitureFromCustomise = () => {},
      canUseLabInteraction = () => true,
      shouldRenderOlings = () => true
    } = dependencies;
    const CUSTOMISE_TOOLS_TRANSITION_MS = 240;
    let customiseToolsTransitionId = 0;
    const playInteraction = (intent) => {
      if (!intent || typeof window.playInteractionSound !== 'function') return;
      Promise.resolve(window.playInteractionSound(intent)).catch(() => {});
    };
    const formatFurnitureType = (value) =>
      String(value || 'furniture')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    function renderCells(displayColumns, occupied) {
      const fragment = document.createDocumentFragment();
      const editingFurniture =
        state.editMode && state.customiseCategory === 'furniture';

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < displayColumns; col += 1) {
          const cell = document.createElement('div');
          const locked = !isLabCellUnlocked(row, col);
          const occupiedItem = occupied.get(`${row}:${col}`);
          const expansionColumn = locked ? getLabExpansionColumn(col) : null;
          const canPurchase = Boolean(expansionColumn);
          cell.className = 'oling-lab-cell';
          cell.dataset.olingLabRow = String(row);
          cell.dataset.olingLabCol = String(col);
          cell.classList.toggle('is-locked', locked);
          cell.classList.toggle('is-purchasable', canPurchase);
          cell.classList.toggle(
            'is-furniture-occupied',
            editingFurniture && Boolean(occupiedItem)
          );
          cell.style.gridRow = String(row + 1);
          cell.style.gridColumn = String(col + 1);

          if (editingFurniture && locked) {
            if (canPurchase && row === 0) {
              const purchase = document.createElement('button');
              purchase.className = 'oling-lab-expansion-purchase';
              purchase.type = 'button';
              purchase.dataset.soundIntent = 'warning';
              purchase.setAttribute(
                'aria-label',
                `Unlock lab column ${col + 1} for ${expansionColumn.price} Opals`
              );
              const plus = Object.assign(document.createElement('span'), {
                className: 'oling-lab-plus is-expansion',
                textContent: '+'
              });
              const price = document.createElement('span');
              price.className = 'oling-lab-expansion-price';
              price.append(
                Object.assign(document.createElement('img'), {
                  src: '/images/icons/currency/opal.svg',
                  alt: ''
                }),
                Object.assign(document.createElement('span'), {
                  textContent: Number(expansionColumn.price).toLocaleString()
                })
              );
              purchase.append(plus, price);
              purchase.addEventListener('click', (event) => {
                event.stopPropagation();
                openLabColumnPurchaseDialog(col);
              });
              cell.appendChild(purchase);
            } else if (!canPurchase) {
              cell.appendChild(
                Object.assign(document.createElement('span'), {
                  className: 'oling-lab-plus',
                  textContent: '×'
                })
              );
            }
          } else if (editingFurniture && occupiedItem) {
            const hit = document.createElement('button');
            hit.className = 'oling-lab-cell-hit';
            hit.type = 'button';
            hit.setAttribute(
              'aria-label',
              `Open ${getItem(occupiedItem.itemId)?.name || 'item'}`
            );
            hit.addEventListener('click', (event) => {
              event.stopPropagation();
              if (!canUseLabInteraction('furnitureMenus')) return;
              interactWithFurniture(occupiedItem.placedId);
              playInteraction('open');
            });
            cell.appendChild(hit);
          } else if (editingFurniture) {
            const plus = document.createElement('span');
            plus.className = 'oling-lab-plus';
            plus.textContent = '+';
            plus.setAttribute('aria-hidden', 'true');
            cell.appendChild(plus);
          }

          fragment.appendChild(cell);
        }
      }

      return fragment;
    }

    function renderItems() {
      const fragment = document.createDocumentFragment();

      state.lab.placedItems.forEach((placed) => {
        const item = getItem(placed.itemId);
        if (!item) return;

        const element = document.createElement('div');
        element.className = 'oling-lab-item';
        element.classList.toggle(
          'is-furniture-dragging',
          isFurnitureBeingDragged(placed.placedId)
        );
        element.dataset.olingLabItemId = item.id;
        element.dataset.olingLabPlacedId = placed.placedId;
        element.inert =
          !canUseLabInteraction('furnitureMenus') &&
          !canUseLabInteraction('furnitureDragging');
        element.classList.toggle(
          'is-selected',
          isTargetSelected('furniture', placed.placedId) ||
            String(elements.room?.dataset.olingLabSelectedFurnitureId || '') ===
              String(placed.placedId)
        );
        element.style.setProperty('--item-row', placed.row);
        element.style.setProperty('--item-col', placed.col);
        element.style.setProperty('--item-width', placed.width);
        element.style.setProperty('--item-height', placed.height);
        const footprintTheme = resolveMenuConfig(
          getFurnitureInteractionAction(placed, item)
        );
        if (footprintTheme.primaryColour) {
          element.style.setProperty(
            '--furniture-footprint-primary-colour',
            footprintTheme.primaryColour
          );
        }
        if (footprintTheme.secondaryColour) {
          element.style.setProperty(
            '--furniture-footprint-secondary-colour',
            footprintTheme.secondaryColour
          );
        }
        const furnitureArt = createFurnitureArt(item);
        element.appendChild(furnitureArt);

        const footprintLabel = document.createElement('span');
        footprintLabel.className = 'oling-lab-furniture-footprint-label';
        footprintLabel.setAttribute('aria-hidden', 'true');
        footprintLabel.append(
          Object.assign(document.createElement('span'), {
            className: 'oling-lab-furniture-footprint-type',
            textContent: formatFurnitureType(item.type || item.category)
          }),
          Object.assign(document.createElement('strong'), {
            className: 'oling-lab-furniture-footprint-name',
            textContent: item.name || 'Furniture'
          })
        );
        element.appendChild(footprintLabel);

        const shelfItems = (item.inventorySlots || []).some(
          (slot) => slot.slotType === 'storage'
        )
          ? getShelfInventoryItems()
          : [];
        (item.inventorySlots || []).forEach((slotDefinition, index) => {
          if (slotDefinition.slotType !== 'storage') return;
          const storedItem = shelfItems[index];
          if (!storedItem?.image) return;
          const marker = document.createElement('span');
          marker.className = 'oling-lab-shelf-room-item';
          marker.style.setProperty(
            '--shelf-item-x',
            Number(slotDefinition?.x || 256)
          );
          marker.style.setProperty(
            '--shelf-item-y',
            Number(slotDefinition?.y || 256)
          );
          marker.style.setProperty(
            '--shelf-item-width',
            Number(slotDefinition?.width || 48)
          );
          marker.style.setProperty(
            '--shelf-item-height',
            Number(slotDefinition?.height || 48)
          );
          marker.title = storedItem.name;
          marker.appendChild(createImage(storedItem.image, storedItem.name));
          // Storage maps use the furniture's full 512 × 512 cell coordinates.
          // Appending to the art rectangle would apply the regular grid-placement
          // inset a second time.
          element.appendChild(marker);
        });

        if (item.podStorage) {
          const olingViews = getOlingViews();
          const storedOlings =
            olingViews?.getStoredOlings?.(placed.placedId) || [];
          (item.inventorySlots || []).forEach((slotDefinition, index) => {
            const storedOling = storedOlings[index];
            if (!storedOling) return;
            const podDefinition = state.podDefinitions?.get?.(
              storedOling?.residency?.pod?.key
            );
            const marker = document.createElement('span');
            marker.className = 'oling-lab-pod-rack-room-pod';
            marker.style.setProperty(
              '--pod-rack-slot-x',
              Number(slotDefinition?.x || 256)
            );
            marker.style.setProperty(
              '--pod-rack-slot-y',
              Number(slotDefinition?.y || 256)
            );
            marker.style.setProperty(
              '--pod-rack-slot-width',
              Number(slotDefinition?.width || 96)
            );
            marker.style.setProperty(
              '--pod-rack-slot-height',
              Number(slotDefinition?.height || 96)
            );
            marker.title = storedOling?.name || 'Stored Oling';
            marker.appendChild(
              olingViews.createPodArtwork(podDefinition, storedOling)
            );
            element.appendChild(marker);
          });
        }

        const hit = document.createElement('button');
        hit.className = 'oling-lab-item-hit';
        hit.type = 'button';
        hit.setAttribute('aria-label', `Open ${item.name} actions`);
        hit.setAttribute(
          'aria-expanded',
          String(isTargetSelected('furniture', placed.placedId))
        );
        hit.addEventListener('click', (event) => {
          if (consumeFurnitureDragClick(placed.placedId)) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          event.stopPropagation();
          if (!canUseLabInteraction('furnitureMenus')) return;
          interactWithFurniture(placed.placedId);
          playInteraction('open');
        });
        if (
          state.editMode &&
          state.customiseCategory === 'furniture' &&
          !placed.locked
        ) {
          hit.classList.add('oling-lab-furniture-handle');
          hit.setAttribute('aria-label', `Move ${item.name}`);
          hit.addEventListener('pointerdown', (event) =>
            beginFurnitureDrag(event, placed, element)
          );
          const remove = document.createElement('button');
          remove.className = 'oling-lab-furniture-remove';
          remove.type = 'button';
          remove.textContent = '×';
          remove.setAttribute('aria-label', `Store ${item.name}`);
          remove.addEventListener('pointerdown', (event) =>
            event.stopPropagation()
          );
          remove.addEventListener('click', (event) => {
            event.stopPropagation();
            storeFurnitureFromCustomise(placed.placedId);
          });
          element.appendChild(remove);
        }
        element.appendChild(hit);

        (placed.containerSlots || []).forEach((slot) => {
          if (!slot.itemId) return;
          const child = getItem(slot.itemId);
          if (!child) return;
          const childElement = document.createElement('div');
          childElement.className = 'oling-lab-contained-item';
          childElement.dataset.olingLabItemId = child.id;
          childElement.dataset.olingLabPlacedId = slot.placedId || '';
          const childArt = createFurnitureArt(child);
          childElement.appendChild(childArt);
          (slot.inventorySlots || []).forEach((inventorySlot) => {
            if (inventorySlot.itemType !== 'egg' || !inventorySlot.itemKey)
              return;
            const slotDefinition = (child.inventorySlots || []).find(
              (itemSlot) => itemSlot.slotId === inventorySlot.slotId
            );
            const egg = getEgg(inventorySlot.itemKey);
            const marker = document.createElement('span');
            marker.className = 'oling-lab-egg-marker';
            marker.style.setProperty(
              '--egg-x',
              Number(slotDefinition?.x || 256)
            );
            marker.style.setProperty(
              '--egg-y',
              Number(slotDefinition?.y || 256)
            );
            marker.title = egg.name || egg.key || 'Egg';
            const eggImage = getEggImage(egg);
            if (eggImage) {
              marker.appendChild(
                createImage(eggImage, egg.name || egg.key || 'Egg')
              );
            } else {
              marker.textContent = String(egg.name || egg.key || 'Egg')
                .trim()
                .charAt(0)
                .toUpperCase();
            }
            childArt.appendChild(marker);
          });
          element.appendChild(childElement);
        });

        fragment.appendChild(element);
      });

      return fragment;
    }

    function syncCustomiseButtonSize(button) {
      if (!button?.style) return;
      const width = Number(button.offsetWidth);
      const height = Number(button.offsetHeight);
      if (width > 0) {
        button.style.setProperty(
          '--oling-lab-button-growth-inline-space',
          `${width * 0.125}px`
        );
      }
      if (height > 0) {
        button.style.setProperty(
          '--oling-lab-button-growth-block-space',
          `${height * 0.25}px`
        );
      }
    }

    function setCustomiseButtonEntryOffsets() {
      const editRect = elements.editToggle?.getBoundingClientRect?.();
      if (!editRect) return;
      const editCenterX = editRect.left + editRect.width / 2;
      [...(elements.customiseCategoryButtons || [])].forEach((button) => {
        const buttonRect = button.getBoundingClientRect?.();
        if (!buttonRect) return;
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        button.style?.setProperty(
          '--oling-lab-customise-entry-x',
          `${editCenterX - buttonCenterX}px`
        );
      });
    }

    function syncCustomiseToolsTransition(opening = false) {
      const tools = elements.customiseTools;
      if (!tools) return;
      const transitionId = (customiseToolsTransitionId += 1);
      const reducedMotion = Boolean(
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      );

      if (state.editMode) {
        tools.dataset.olingLabCustomiseTransition = 'measuring';
        setCustomiseButtonEntryOffsets();
        if (!opening) {
          tools.dataset.olingLabCustomiseTransition = 'open';
          return;
        }
        tools.dataset.olingLabCustomiseTransition = 'closed';
        tools.getBoundingClientRect?.();
        const openTools = () => {
          if (transitionId !== customiseToolsTransitionId || !state.editMode) {
            return;
          }
          tools.dataset.olingLabCustomiseTransition = 'open';
        };
        if (reducedMotion) {
          openTools();
        } else if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(openTools);
        } else {
          window.setTimeout(openTools, 0);
        }
        return;
      }

      if (tools.hidden) return;
      tools.dataset.olingLabCustomiseTransition = 'measuring';
      setCustomiseButtonEntryOffsets();
      tools.dataset.olingLabCustomiseTransition = 'closed';
      const hideTools = () => {
        if (transitionId !== customiseToolsTransitionId || state.editMode) {
          return;
        }
        tools.hidden = true;
      };
      if (reducedMotion) {
        hideTools();
      } else {
        window.setTimeout(hideTools, CUSTOMISE_TOOLS_TRANSITION_MS);
      }
    }

    function renderLab() {
      if (!state.lab) return;

      applyWallpaper();
      const displayColumns = getDisplayedLabColumns();
      const occupied = getOccupiedMap();
      elements.page.classList.toggle('is-editing', state.editMode);
      elements.page.classList.toggle(
        'is-customising-furniture',
        state.editMode && state.customiseCategory === 'furniture'
      );
      elements.page.classList.toggle(
        'is-customising-wall-decorations',
        state.editMode && state.customiseCategory === 'wall-decorations'
      );
      elements.room.style.setProperty('--lab-columns', displayColumns);
      elements.editToggle.setAttribute('aria-pressed', String(state.editMode));
      elements.editToggle.textContent = state.editMode ? 'Done' : 'Customise';
      syncCustomiseButtonSize(elements.editToggle);
      const openingCustomiseTools = Boolean(
        state.editMode && elements.customiseTools?.hidden
      );
      if (openingCustomiseTools) elements.customiseTools.hidden = false;
      [...(elements.customiseCategoryButtons || [])].forEach((button) => {
        syncCustomiseButtonSize(button);
        const selected =
          state.editMode &&
          button.dataset.olingLabCustomiseCategory === state.customiseCategory;
        button.setAttribute('aria-pressed', String(selected));
      });
      syncCustomiseToolsTransition(openingCustomiseTools);
      const canOpenFurniture = canUseLabInteraction('furnitureMenus');
      const actionPanel = canOpenFurniture ? createActionPanel() : null;
      elements.room.replaceChildren(
        renderCells(displayColumns, occupied),
        renderWallDecorations(),
        renderItems(),
        ...(shouldRenderOlings() ? [getRoaming().renderOlings()] : []),
        ...(actionPanel && canOpenFurniture ? [actionPanel] : [])
      );
      elements.actionPanel = actionPanel;
      syncFurnitureDragAfterRender();
      resetCameraIfNeeded();
    }

    return {
      renderCells,
      renderItems,
      renderLab
    };
  }

  window.createOlingLabRenderer = createOlingLabRenderer;
})();

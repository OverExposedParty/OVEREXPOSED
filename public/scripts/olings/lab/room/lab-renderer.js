(function () {
  function createOlingLabRenderer(dependencies) {
    const {
      rows,
      isLabCellUnlocked,
      getLabExpansionCell,
      state,
      openLabCellPurchaseDialog,
      getItem,
      toggleSelectedTarget,
      openSlotMenu,
      isTargetSelected,
      createFurnitureArt,
      getShelfInventoryItems,
      createImage,
      getEgg,
      getEggImage,
      getDisplayedLabColumns,
      getOccupiedMap,
      elements,
      createActionPanel,
      getRoaming,
      resetCameraIfNeeded
    } = dependencies;

    function renderCells(displayColumns, occupied) {
      const fragment = document.createDocumentFragment();

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < displayColumns; col += 1) {
          const cell = document.createElement('div');
          const locked = !isLabCellUnlocked(row, col);
          const occupiedItem = occupied.get(`${row}:${col}`);
          const expansionCell = locked ? getLabExpansionCell(row, col) : null;
          const canPurchase = Boolean(expansionCell);
          cell.className = 'oling-lab-cell';
          cell.classList.toggle('is-locked', locked);
          cell.classList.toggle('is-purchasable', canPurchase);
          cell.style.gridRow = String(row + 1);
          cell.style.gridColumn = String(col + 1);

          if (state.editMode && locked) {
            if (canPurchase) {
              const purchase = document.createElement('button');
              purchase.className = 'oling-lab-expansion-purchase';
              purchase.type = 'button';
              purchase.setAttribute(
                'aria-label',
                `Unlock this lab space for ${expansionCell.price} Opals`
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
                  textContent: Number(expansionCell.price).toLocaleString()
                })
              );
              purchase.append(plus, price);
              purchase.addEventListener('click', (event) => {
                event.stopPropagation();
                openLabCellPurchaseDialog(row, col);
              });
              cell.appendChild(purchase);
            } else {
              cell.appendChild(
                Object.assign(document.createElement('span'), {
                  className: 'oling-lab-plus',
                  textContent: '×'
                })
              );
            }
          } else if (state.editMode && occupiedItem) {
            const hit = document.createElement('button');
            hit.className = 'oling-lab-cell-hit';
            hit.type = 'button';
            hit.setAttribute(
              'aria-label',
              `Open ${getItem(occupiedItem.itemId)?.name || 'item'}`
            );
            hit.addEventListener('click', (event) => {
              event.stopPropagation();
              toggleSelectedTarget('furniture', occupiedItem.placedId);
            });
            cell.appendChild(hit);
          } else if (state.editMode) {
            const plus = document.createElement('button');
            plus.className = 'oling-lab-plus';
            plus.type = 'button';
            plus.textContent = '+';
            plus.setAttribute('aria-label', 'Place lab item');
            plus.addEventListener('click', (event) => {
              event.stopPropagation();
              openSlotMenu(row, col);
            });
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
          'is-selected',
          isTargetSelected('furniture', placed.placedId)
        );
        element.style.setProperty('--item-row', placed.row);
        element.style.setProperty('--item-col', placed.col);
        element.style.setProperty('--item-width', placed.width);
        element.style.setProperty('--item-height', placed.height);
        const furnitureArt = createFurnitureArt(item);
        element.appendChild(furnitureArt);

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

        const hit = document.createElement('button');
        hit.className = 'oling-lab-item-hit';
        hit.type = 'button';
        hit.setAttribute('aria-label', `Open ${item.name} actions`);
        hit.setAttribute(
          'aria-expanded',
          String(isTargetSelected('furniture', placed.placedId))
        );
        hit.addEventListener('click', (event) => {
          event.stopPropagation();
          toggleSelectedTarget('furniture', placed.placedId);
        });
        element.appendChild(hit);

        (placed.containerSlots || []).forEach((slot) => {
          if (!slot.itemId) return;
          const child = getItem(slot.itemId);
          if (!child) return;
          const childElement = document.createElement('div');
          childElement.className = 'oling-lab-contained-item';
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

    function renderLab() {
      if (!state.lab) return;

      const displayColumns = getDisplayedLabColumns();
      const occupied = getOccupiedMap();
      elements.page.classList.toggle('is-editing', state.editMode);
      elements.room.style.setProperty('--lab-columns', displayColumns);
      elements.editToggle.setAttribute('aria-pressed', String(state.editMode));
      elements.editToggle.textContent = state.editMode ? 'Done' : 'Edit';
      const actionPanel = createActionPanel();
      elements.room.replaceChildren(
        renderCells(displayColumns, occupied),
        renderItems(),
        getRoaming().renderOlings(),
        ...(actionPanel ? [actionPanel] : [])
      );
      elements.actionPanel = actionPanel;
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

(function () {
  function createOlingLabFurnitureSlotTabs(dependencies) {
    const {
      getItem,
      isPlaced,
      createItemButton,
      createImage,
      createSquareMarker,
      createStatsToggleButton,
      createPanelBackButton,
      createDetailRow,
      createInlineAction,
      createEmptyMessage,
      createConstrainedEmptyTab,
      formatTitle,
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      getContainerItemsForSlot,
      placeContainerItem,
      storeContainerItem
    } = dependencies;

function createFurnitureSlotInventoryPanel(placed, slotDefinition) {
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-furniture-slot-panel';
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: 'Inventory'
        })
      );
      const grid = document.createElement('div');
      grid.className = 'oling-lab-furniture-slot-inventory-grid';
      getContainerItemsForSlot(slotDefinition).forEach((child) => {
        if (isPlaced(child.id)) {
          grid.appendChild(
            createItemButton(child, { disabled: true, badge: 'Placed' })
          );
          return;
        }
        grid.appendChild(
          createItemButton(child, {
            onClick: () =>
              placeContainerItem(
                placed.placedId,
                slotDefinition.slotId,
                child.id
              )
          })
        );
      });
      panel.appendChild(
        grid.children.length
          ? grid
          : createEmptyMessage('No owned items fit this slot.')
      );
      return panel;
    }

    function createFurnitureSlotDetailsPanel(
      placed,
      slotDefinition,
      child,
      onClose
    ) {
      const panel = document.createElement('aside');
      panel.className = 'oling-lab-side-panel oling-lab-furniture-slot-panel';
      panel.appendChild(
        createPanelBackButton('Back from slot details', onClose)
      );
      panel.appendChild(
        Object.assign(document.createElement('h3'), {
          textContent: slotDefinition.label || slotDefinition.slotId
        })
      );
      const details = document.createElement('div');
      details.className = 'oling-lab-detail-list';
      details.append(
        createDetailRow('Item', child?.name || child?.id || '-'),
        createDetailRow(
          'Type',
          formatTitle(child?.category || child?.type || 'Item')
        )
      );
      panel.appendChild(details);
      const actions = document.createElement('div');
      actions.className = 'oling-lab-item-influence-inventory-actions';
      actions.appendChild(
        createInlineAction(
          child ? `Store ${child.name}` : 'Store',
          () => storeContainerItem(placed.placedId, slotDefinition.slotId),
          { className: 'is-remove-action', disabled: !child }
        )
      );
      panel.appendChild(actions);
      return panel;
    }

    function createFurnitureSlotStage(placed, slotDefinition) {
      const slot = (placed.containerSlots || []).find(
        (itemSlot) => itemSlot.slotId === slotDefinition.slotId
      );
      const child = slot?.itemId ? getItem(slot.itemId) : null;
      const stage = document.createElement('section');
      stage.className =
        'oling-lab-egg-insertion-stage oling-lab-furniture-slot-stage';
      const slotButton = document.createElement('button');
      slotButton.className = 'oling-lab-furniture-slot-hero';
      slotButton.classList.toggle('has-item', Boolean(child));
      slotButton.type = 'button';
      slotButton.setAttribute(
        'aria-label',
        child
          ? `${child.name} on ${slotDefinition.label}`
          : `Add item to ${slotDefinition.label}`
      );

      if (child?.image) {
        slotButton.appendChild(createImage(child.image, child.name));
      } else {
        slotButton.appendChild(
          createSquareMarker('+', 'oling-lab-furniture-slot-plus')
        );
      }
      slotButton.appendChild(
        Object.assign(document.createElement('strong'), {
          textContent:
            child?.name || slotDefinition.label || slotDefinition.slotId
        })
      );

      let panel = null;
      const closePanel = () => {
        if (!panel) return;
        closeStagePanel(stage, panel, 'is-viewing-furniture-slot', () => {
          panel = null;
        });
      };
      const openInventory = () => {
        if (panel) closePanel();
        panel = createFurnitureSlotInventoryPanel(placed, slotDefinition);
        setPanelInteractivity(panel, true);
        stage.appendChild(panel);
        openStagePanel(stage, panel, 'is-viewing-furniture-slot');
      };
      const openDetails = () => {
        if (!child) return;
        if (panel) closePanel();
        panel = createFurnitureSlotDetailsPanel(
          placed,
          slotDefinition,
          child,
          closePanel
        );
        setPanelInteractivity(panel, true);
        stage.appendChild(panel);
        openStagePanel(stage, panel, 'is-viewing-furniture-slot');
      };

      slotButton.addEventListener('click', () => {
        if (child) return;
        openInventory();
      });
      if (child) {
        slotButton.appendChild(
          createStatsToggleButton('View slot details', (event) => {
            event.stopPropagation();
            openDetails();
          })
        );
      }
      stage.appendChild(slotButton);
      return stage;
    }

    function createFurnitureSlotsTab(placed, item) {
      const sections = (item.containerSlots || []).map((slotDefinition) => {
        const section = document.createElement('section');
        section.className =
          'oling-lab-menu-section oling-lab-furniture-slot-section';
        section.appendChild(createFurnitureSlotStage(placed, slotDefinition));
        return section;
      });
      return sections.length
        ? sections
        : createConstrainedEmptyTab('This furniture has no slots.');
    }

    return { createFurnitureSlotsTab };
  }

  window.createOlingLabFurnitureSlotTabs = createOlingLabFurnitureSlotTabs;
})();

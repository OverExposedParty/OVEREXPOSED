(function () {
  function createOlingLabFurnitureMenus(dependencies) {
    const {
      state,
      elements = {},
      getItem,
      formatTitle,
      createTabMenu,
      openMenu,
      closeMenu,
      getOlingViews = () => null,
      closeGatewayPanel = () => {},
      closeRestPanel = () => {},
      closeIncubatorPanel = () => {},
      setFurnitureSaleTarget = () => {}
    } = dependencies;
    const actionPanels =
      window.createOlingLabFurnitureActionPanels(dependencies);
    const placementMenu =
      window.createOlingLabFurniturePlacementMenu(dependencies);
    const slotTabs = window.createOlingLabFurnitureSlotTabs(dependencies);
    const shelfInventory = window.createOlingLabShelfInventory(dependencies);
    const shelfStorage = window.createOlingLabShelfStorage(
      dependencies,
      shelfInventory
    );
    const panelTransitions = window.OlingLabPanelTransitions;

    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    function setFurnitureDetailPanelCollapsed(collapsed) {
      if (!state.furnitureDetailPanelOpen || !elements.furnitureDetailPanel) {
        return;
      }
      state.furnitureDetailPanelCollapsed = collapsed;
      elements.furnitureDetailPanel.classList.toggle('is-collapsed', collapsed);
      elements.furnitureDetailPanelToggle.textContent = collapsed
        ? 'Show'
        : 'Hide';
      elements.furnitureDetailPanelToggle.setAttribute(
        'aria-expanded',
        String(!collapsed)
      );
      playSound(collapsed ? 'sidePanelClose' : 'sidePanelOpen');
    }

    function closeFurnitureSlotsPanel({ sound = true } = {}) {
      if (!elements.furnitureDetailPanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.furnitureDetailPanel
      );
      if (!state.furnitureDetailPanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasExpanded = Boolean(
        state.furnitureDetailPanelOpen &&
          !state.furnitureDetailPanelCollapsed &&
          !elements.furnitureDetailPanel.hidden
      );
      state.furnitureDetailPanelOpen = false;
      state.furnitureDetailPanelCollapsed = false;
      state.activeFurnitureDetailPlacedId = null;
      elements.furnitureDetailPanelToggle?.setAttribute(
        'aria-expanded',
        'false'
      );
      const playCloseSound = () => {
        if (sound && wasExpanded) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.furnitureDetailPanel.classList.remove(
          'is-open',
          'is-collapsed'
        );
        elements.furnitureDetailPanelContent?.replaceChildren();
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.furnitureDetailPanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.furnitureDetailPanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    function openFurnitureSlotsMenu(placedId) {
      if (state.editMode) return;
      const placed = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      const item = getItem(placed?.itemId);
      if (!placed || !item || !(item.containerSlots || []).length) return;

      const slotTabLabel =
        item.containerSlots.length === 1
          ? item.containerSlots[0].label ||
            formatTitle(item.containerSlots[0].slotId)
          : 'Slots';
      const tabs = [
        {
          label: slotTabLabel,
          content: () => slotTabs.createFurnitureSlotsTab(placed, item)
        }
      ];
      if (
        (item.type === 'door' || item.id === 'standard_door') &&
        !state.visitorMode &&
        !state.tutorialMode
      ) {
        tabs.push({
          label: 'Access',
          content: () => {
            const panel = document.createElement('div');
            panel.className = 'oling-lab-side-panel';
            panel.appendChild(actionPanels.createLabAccessButton());
            return panel;
          }
        });
      }
      if (
        elements.furnitureDetailPanel &&
        elements.furnitureDetailPanelContent
      ) {
        const wasExpanded = Boolean(
          state.furnitureDetailPanelOpen &&
            !state.furnitureDetailPanelCollapsed
        );
        closeMenu?.();
        getOlingViews()?.closeOlingPanel?.({ sound: false });
        getOlingViews()?.closeStoragePanel?.({ sound: false });
        shelfStorage.closeShelfStoragePanel?.({ sound: false });
        closeGatewayPanel({ sound: false });
        closeRestPanel({ sound: false });
        closeIncubatorPanel({ sound: false });
        state.furnitureDetailPanelOpen = true;
        state.furnitureDetailPanelCollapsed = false;
        state.activeFurnitureDetailPlacedId = placedId;
        elements.furnitureDetailPanelTitle.textContent = item.name;
        elements.furnitureDetailPanelContent.replaceChildren(
          createTabMenu(tabs)
        );
        elements.furnitureDetailPanelToggle.textContent = 'Hide';
        elements.furnitureDetailPanelToggle.setAttribute(
          'aria-expanded',
          'true'
        );
        setFurnitureSaleTarget('furniture', placedId);
        const show = () => {
          if (!state.furnitureDetailPanelOpen) return;
          if (!wasExpanded) playSound('sidePanelOpen');
        };
        if (panelTransitions) {
          void panelTransitions.open(elements.furnitureDetailPanel, {
            afterOpen: show
          });
        } else if (typeof window.requestAnimationFrame === 'function') {
          elements.furnitureDetailPanel.hidden = false;
          window.requestAnimationFrame(() => {
            elements.furnitureDetailPanel.classList.add('is-open');
            show();
          });
        } else {
          elements.furnitureDetailPanel.hidden = false;
          elements.furnitureDetailPanel.classList.add('is-open');
          show();
        }
        return;
      }
      openMenu(`${item.name} Slots`, [createTabMenu(tabs)], {
        theme: 'furniture'
      });
    }

    elements.furnitureDetailPanelToggle?.addEventListener('click', () =>
      setFurnitureDetailPanelCollapsed(!state.furnitureDetailPanelCollapsed)
    );
    elements.furnitureDetailPanelClose?.addEventListener('click', () => {
      const placedId = state.activeFurnitureDetailPlacedId;
      closeFurnitureSlotsPanel();
      elements.room
        ?.querySelector(`[data-oling-lab-placed-id="${placedId}"]`)
        ?.focus();
    });

    return {
      ...actionPanels,
      ...placementMenu,
      getShelfInventoryItems: shelfInventory.getShelfInventoryItems,
      ...shelfStorage,
      openFurnitureSlotsMenu,
      closeFurnitureSlotsPanel
    };
  }

  window.createOlingLabFurnitureMenus = createOlingLabFurnitureMenus;
})();

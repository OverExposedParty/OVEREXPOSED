(function () {
  function createOlingLabIncubatorCore(dependencies) {
    const {
      state,
      elements,
      itemInfluenceSlots,
      setStatus,
      parsePayload,
      getItem,
      getConsumable,
      getAvailableEggQuantity,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab,
      openIncubatorMenu
    } = dependencies;

    function getContainerSlot(parentPlacedId, slotId) {
      const parent = state.lab.placedItems.find(
        (item) => item.placedId === parentPlacedId
      );
      const slot = parent?.containerSlots?.find(
        (item) => item.slotId === slotId
      );
      return slot || null;
    }

    function placeEggInContainerSlot(
      parentPlacedId,
      slotId,
      inventorySlotId,
      eggKey,
      options = {}
    ) {
      const containerSlot = getContainerSlot(parentPlacedId, slotId);
      const inventorySlot = containerSlot?.inventorySlots?.find(
        (slot) => slot.slotId === inventorySlotId
      );

      if (!inventorySlot || getAvailableEggQuantity(eggKey) < 1) return;

      inventorySlot.itemKey = eggKey;
      inventorySlot.itemType = 'egg';
      inventorySlot.placedAt = new Date().toISOString();
      inventorySlot.influenceSlots = Array.isArray(options.influenceSlots)
        ? options.influenceSlots
        : [];
      closeSelectedTarget();
      if (options.closeMenu !== false) closeMenu();
      renderLab();
      if (typeof options.afterChange === 'function') options.afterChange();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
    }

    function storeEggFromContainerSlot(
      parentPlacedId,
      slotId,
      inventorySlotId,
      options = {}
    ) {
      const containerSlot = getContainerSlot(parentPlacedId, slotId);
      const inventorySlot = containerSlot?.inventorySlots?.find(
        (slot) => slot.slotId === inventorySlotId
      );

      if (!inventorySlot) return;

      inventorySlot.itemKey = null;
      inventorySlot.itemType = null;
      inventorySlot.placedAt = null;
      inventorySlot.influenceSlots = [];
      closeSelectedTarget();
      if (options.closeMenu !== false) closeMenu();
      renderLab();
      if (typeof options.afterChange === 'function') options.afterChange();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
    }

    function getIncubatorContext(placedId) {
      const parent = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      if (!parent) return null;

      const parentItem = getItem(parent.itemId);
      if (
        parentItem?.type === 'incubator' ||
        parentItem?.category === 'incubator'
      ) {
        return {
          parentPlacedId: placedId,
          slotId: null,
          slot: parent,
          incubator: parentItem,
          inventorySlots: parent.inventorySlots || []
        };
      }

      for (const slot of parent.containerSlots || []) {
        if (!slot.itemId) continue;
        const child = getItem(slot.itemId);
        if (child?.type === 'incubator' || child?.category === 'incubator') {
          return {
            parentPlacedId: placedId,
            slotId: slot.slotId,
            slot,
            incubator: child,
            inventorySlots: slot.inventorySlots || []
          };
        }
      }

      return null;
    }

    function getIncubatorEggSlot(context) {
      return (context?.inventorySlots || []).find(
        (slot) => slot.slotType === 'egg' || slot.slotId === 'egg'
      );
    }

    function getIncubatorSelectionKey(context) {
      if (!context?.parentPlacedId || !context?.slotId) return '';
      return `${context.parentPlacedId}:${context.slotId}`;
    }

    function getIncubatorPanelTarget(context, panelName, detailKey = '') {
      const selectionKey = getIncubatorSelectionKey(context);
      if (!selectionKey || !panelName) return '';
      return [selectionKey, panelName, detailKey].filter(Boolean).join(':');
    }

    function getIncubatorPanelTargetPrefix(context, panelName) {
      return getIncubatorPanelTarget(context, panelName);
    }

    function isIncubatorPanelOpen(context, panelName) {
      return (
        state.incubatorPanelTargets[panelName] ===
        getIncubatorPanelTarget(context, panelName)
      );
    }

    function setIncubatorPanelOpen(context, panelName, isOpen, options = {}) {
      const target = getIncubatorPanelTarget(context, panelName);
      state.incubatorPanelTargets[panelName] = isOpen ? target : null;
      state.animatingIncubatorPanelTarget =
        isOpen && options.animate ? target : null;
    }

    function setPanelInteractivity(panel, isVisible) {
      if (!panel) return;
      panel.inert = !isVisible;
      panel.setAttribute('aria-hidden', String(!isVisible));
    }

    function openStagePanel(stage, panel, openClassName) {
      setPanelInteractivity(panel, true);
      window.requestAnimationFrame(() => {
        stage.classList.add(openClassName);
        panel.classList.add('is-open');
      });
    }

    function closeStagePanel(stage, panel, openClassName, afterClose) {
      stage.classList.remove(openClassName);
      if (panel) panel.classList.remove('is-open');
      setPanelInteractivity(panel, false);
      window.setTimeout(() => {
        if (!elements.backdrop.hidden && typeof afterClose === 'function')
          afterClose();
      }, EGG_PICKER_TRANSITION_MS);
    }

    function applyInitialStagePanel(
      stage,
      panel,
      openClassName,
      isOpen,
      shouldAnimate
    ) {
      setPanelInteractivity(panel, isOpen);
      if (!isOpen) return;
      if (shouldAnimate) {
        window.requestAnimationFrame(() => {
          stage.classList.add(openClassName);
          panel.classList.add('is-open');
        });
      } else {
        stage.classList.add(openClassName);
        panel.classList.add('is-open');
      }
    }

    function isSelectingIncubatorEgg(context) {
      return isIncubatorPanelOpen(context, 'egg-selection');
    }

    function setIncubatorEggSelection(context, isSelecting) {
      setIncubatorPanelOpen(context, 'egg-selection', isSelecting);
    }

    function isViewingIncubatorHatchDetails(context) {
      return isIncubatorPanelOpen(context, 'hatch-details');
    }

    function setIncubatorHatchDetails(context, isViewing, options = {}) {
      setIncubatorPanelOpen(context, 'hatch-details', isViewing, options);
    }

    function isViewingIncubatorInfo(context) {
      return isIncubatorPanelOpen(context, 'incubator-info');
    }

    function setIncubatorInfo(context, isViewing, options = {}) {
      setIncubatorPanelOpen(context, 'incubator-info', isViewing, options);
    }

    function isViewingIncubatorEggInfo(context) {
      return isIncubatorPanelOpen(context, 'egg-info');
    }

    function setIncubatorEggInfo(context, isViewing, options = {}) {
      setIncubatorPanelOpen(context, 'egg-info', isViewing, options);
    }

    function getItemInfluenceSelectionKey(context, slotKey) {
      const incubatorKey = getIncubatorSelectionKey(context);
      return incubatorKey && slotKey ? `${incubatorKey}:${slotKey}` : '';
    }

    function getActiveItemInfluenceSlot(context) {
      const prefix = `${getIncubatorPanelTargetPrefix(context, 'item-influence')}:`;
      const activeKey = state.incubatorPanelTargets['item-influence'] || '';
      return activeKey.startsWith(prefix) ? activeKey.slice(prefix.length) : '';
    }

    function setActiveItemInfluenceSlot(context, slotKey) {
      state.incubatorPanelTargets['item-influence'] = slotKey
        ? getIncubatorPanelTarget(context, 'item-influence', slotKey)
        : null;
    }

    function getSelectedItemInfluenceKey(context, slotKey) {
      const eggSlot = getIncubatorEggSlot(context);
      const persistedInfluence = (eggSlot?.influenceSlots || []).find(
        (item) => item.slotKey === slotKey
      );
      if (persistedInfluence?.itemKey) return persistedInfluence.itemKey;
      return (
        state.incubatorItemInfluenceSelections[
          getItemInfluenceSelectionKey(context, slotKey)
        ] || null
      );
    }

    function setSelectedItemInfluenceKey(context, slotKey, consumableKey) {
      const selectionKey = getItemInfluenceSelectionKey(context, slotKey);
      if (!selectionKey) return;
      if (consumableKey) {
        state.incubatorItemInfluenceSelections[selectionKey] = consumableKey;
      } else {
        delete state.incubatorItemInfluenceSelections[selectionKey];
      }
    }

    function consumableMatchesInfluenceSlot(consumable, slotDefinition) {
      if (!consumable || !slotDefinition) return false;
      const effectType = consumable.effect?.type || '';
      return (
        consumable.category === slotDefinition.category &&
        (consumable.subcategory === slotDefinition.subcategory ||
          slotDefinition.effectTypes.includes(effectType))
      );
    }

    function getOwnedConsumablesForInfluenceSlot(slotDefinition) {
      return state.ownedConsumables.filter((ownedItem) => {
        const quantity = Number(ownedItem.quantity || 0);
        if (quantity < 1) return false;
        return consumableMatchesInfluenceSlot(
          getConsumable(ownedItem.key),
          slotDefinition
        );
      });
    }

    function isIncubatorActivelyHatching(context) {
      const eggSlot = getIncubatorEggSlot(context);
      return Boolean(eggSlot?.itemKey && eggSlot?.placedAt);
    }

    function getPendingItemInfluenceSlots(context) {
      return itemInfluenceSlots
        .map((slotDefinition) => {
          const itemKey =
            state.incubatorItemInfluenceSelections[
              getItemInfluenceSelectionKey(context, slotDefinition.key)
            ] || null;
          return itemKey
            ? {
                slotKey: slotDefinition.key,
                itemKey,
                itemType: 'consumable'
              }
            : null;
        })
        .filter(Boolean);
    }

    function clearPendingItemInfluences(context) {
      itemInfluenceSlots.forEach((slotDefinition) => {
        setSelectedItemInfluenceKey(context, slotDefinition.key, null);
      });
    }

    function placeEggInIncubator(context, eggKey) {
      const eggSlot = getIncubatorEggSlot(context);
      if (!context?.slotId || !eggSlot) return;
      setIncubatorEggSelection(context, false);
      setIncubatorHatchDetails(context, false);
      placeEggInContainerSlot(
        context.parentPlacedId,
        context.slotId,
        eggSlot.slotId,
        eggKey,
        {
          influenceSlots: getPendingItemInfluenceSlots(context),
          closeMenu: false,
          preserveLocalLabOnSave: true,
          afterChange: () => {
            clearPendingItemInfluences(context);
            const nextContext = getIncubatorContext(context.parentPlacedId);
            openIncubatorMenu(nextContext || context);
          }
        }
      );
    }

    function removeEggFromIncubator(context) {
      const eggSlot = getIncubatorEggSlot(context);
      if (!context?.slotId || !eggSlot) return;
      setIncubatorEggSelection(context, false);
      setIncubatorHatchDetails(context, false);
      storeEggFromContainerSlot(
        context.parentPlacedId,
        context.slotId,
        eggSlot.slotId,
        {
          closeMenu: false,
          preserveLocalLabOnSave: true,
          afterChange: () => {
            const nextContext = getIncubatorContext(context.parentPlacedId);
            openIncubatorMenu(nextContext || context);
          }
        }
      );
    }

    function updateAccountFromPayload(payload) {
      if (!payload?.account) return;
      localStorage.setItem('oe-account', JSON.stringify(payload.account));
      window.dispatchEvent(
        new CustomEvent('oe-account-state-changed', {
          detail: { account: payload.account }
        })
      );
    }

    function updateInventoryFromAccountPayload(payload) {
      const inventory =
        payload?.account?.olings || payload?.account?.gameData?.olingInventory;
      state.ownedEggs = Array.isArray(inventory?.eggs)
        ? inventory.eggs.filter((egg) => Number(egg.quantity || 0) > 0)
        : state.ownedEggs;
      state.ownedConsumables = Array.isArray(inventory?.consumables)
        ? inventory.consumables.filter((item) => Number(item.quantity || 0) > 0)
        : state.ownedConsumables;
    }

    function upsertOling(oling) {
      const id = roaming.getOlingId(oling);
      if (!id) return;
      const existingIndex = state.olings.findIndex(
        (item) => roaming.getOlingId(item) === id
      );
      if (existingIndex >= 0) {
        state.olings[existingIndex] = oling;
      } else {
        state.olings.unshift(oling);
      }
      roaming.ensureRoamStates();
    }

    function hatchEggFromIncubator(context) {
      const eggSlot = getIncubatorEggSlot(context);
      const eggKey = eggSlot?.itemKey;
      if (!context?.slotId || !eggSlot || !eggKey || state.hatching) return;

      setIncubatorEggSelection(context, false);
      setIncubatorHatchDetails(context, false);
      state.hatching = true;
      setStatus('Hatching...');

      fetch(HATCH_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eggKey,
          hatchContext: {
            parentPlacedId: context.parentPlacedId,
            slotId: context.slotId
          }
        })
      })
        .then(parsePayload)
        .then((payload) => {
          eggSlot.itemKey = null;
          eggSlot.itemType = null;
          eggSlot.placedAt = null;
          eggSlot.influenceSlots = [];
          updateAccountFromPayload(payload);
          updateInventoryFromAccountPayload(payload);
          upsertOling(payload.oling);
          roaming.start();
          closeSelectedTarget();
          renderLab();
          saveLab({
            preserveLocalLab: true
          });
          openMenu(
            'Egg Hatched',
            [olingViews.createRevealMenu(payload.oling, payload.receipt)],
            {
              theme: 'oling-collection'
            }
          );
          setStatus('Oling hatched');
        })
        .catch((error) => {
          console.error('Failed to hatch Oling egg:', error);
          setStatus(error.message || 'Could not hatch egg');
          const nextContext = getIncubatorContext(context.parentPlacedId);
          openIncubatorMenu(nextContext || context);
        })
        .finally(() => {
          state.hatching = false;
        });
    }


    return {
      applyInitialStagePanel,
      closeStagePanel,
      getActiveItemInfluenceSlot,
      getIncubatorContext,
      getIncubatorEggSlot,
      getIncubatorSelectionKey,
      getOwnedConsumablesForInfluenceSlot,
      getSelectedItemInfluenceKey,
      hatchEggFromIncubator,
      isIncubatorActivelyHatching,
      isSelectingIncubatorEgg,
      isViewingIncubatorEggInfo,
      isViewingIncubatorHatchDetails,
      isViewingIncubatorInfo,
      openStagePanel,
      placeEggInIncubator,
      removeEggFromIncubator,
      setActiveItemInfluenceSlot,
      setIncubatorEggInfo,
      setIncubatorEggSelection,
      setIncubatorHatchDetails,
      setIncubatorInfo,
      setPanelInteractivity,
      setSelectedItemInfluenceKey
    };
  }

  window.createOlingLabIncubatorCore = createOlingLabIncubatorCore;
})();

(function () {
  function createOlingLabIncubatorCore(dependencies) {
    const {
      state,
      elements,
      hatchEndpoint,
      eggPickerTransitionMs,
      setStatus,
      parsePayload,
      getItem,
      getConsumable,
      getAvailableEggQuantity,
      getAvailableConsumableQuantity = (consumableKey) =>
        Number(
          state.ownedConsumables.find((item) => item.key === consumableKey)
            ?.quantity || 0
        ),
      closeMenu,
      closeSelectedTarget,
      getRoaming,
      getOlingViews,
      closeIncubatorPanel,
      renderLab,
      saveLab,
      openIncubatorMenu
    } = dependencies;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

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

      if (
        !inventorySlot ||
        inventorySlot.itemKey ||
        getAvailableEggQuantity(eggKey) < 1
      ) {
        return false;
      }

      inventorySlot.itemKey = eggKey;
      inventorySlot.itemType = 'egg';
      inventorySlot.placedAt = options.startHatching
        ? new Date().toISOString()
        : null;
      inventorySlot.influenceSlots = Array.isArray(options.influenceSlots)
        ? options.influenceSlots
        : Array.isArray(inventorySlot.influenceSlots)
          ? inventorySlot.influenceSlots
          : [];
      closeSelectedTarget();
      if (options.closeMenu !== false) closeMenu();
      renderLab();
      if (typeof options.afterChange === 'function') options.afterChange();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
      return true;
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
      if (options.clearInfluences) inventorySlot.influenceSlots = [];
      closeSelectedTarget();
      if (options.closeMenu !== false) closeMenu();
      renderLab();
      if (typeof options.afterChange === 'function') options.afterChange();
      saveLab({
        preserveLocalLab: Boolean(options.preserveLocalLabOnSave)
      });
      return true;
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

    function getStagedIncubatorEggKey(context) {
      const selectionKey = getIncubatorSelectionKey(context);
      return selectionKey
        ? state.incubatorEggSelections?.[selectionKey] || null
        : null;
    }

    function setStagedIncubatorEggKey(context, eggKey) {
      const selectionKey = getIncubatorSelectionKey(context);
      if (!selectionKey) return;
      state.incubatorEggSelections ||= {};
      if (eggKey) state.incubatorEggSelections[selectionKey] = eggKey;
      else delete state.incubatorEggSelections[selectionKey];
    }

    function stageEggForIncubator(context, eggKey) {
      if (
        isIncubatorActivelyHatching(context) ||
        getIncubatorEggSlot(context)?.itemKey
      ) {
        return false;
      }
      if (eggKey && getAvailableEggQuantity(eggKey) < 1) return false;
      setStagedIncubatorEggKey(context, eggKey || null);
      setIncubatorEggSelection(context, false);
      openIncubatorMenu(context);
      return true;
    }

    function getItemInfluenceSlots(context) {
      const requested = Number(context?.incubator?.influenceSlotCount || 0);
      const count = Number.isFinite(requested)
        ? Math.max(0, Math.min(8, Math.floor(requested)))
        : 0;
      return Array.from({ length: count }, (_, index) => ({
        key: `influence-${index + 1}`,
        label: count === 1 ? 'Influence Slot' : `Influence Slot ${index + 1}`
      }));
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
      }, eggPickerTransitionMs);
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

    function getPendingItemInfluenceKey(context, slotKey) {
      return (
        state.incubatorPendingInfluenceSelections?.[
          getItemInfluenceSelectionKey(context, slotKey)
        ] || null
      );
    }

    function setPendingItemInfluenceKey(context, slotKey, consumableKey) {
      state.incubatorPendingInfluenceSelections ||= {};
      const selectionKey = getItemInfluenceSelectionKey(context, slotKey);
      if (!selectionKey) return;
      if (consumableKey) {
        getItemInfluenceSlots(context).forEach((slotDefinition) => {
          if (slotDefinition.key === slotKey) return;
          const otherSelectionKey = getItemInfluenceSelectionKey(
            context,
            slotDefinition.key
          );
          if (
            state.incubatorPendingInfluenceSelections[otherSelectionKey] ===
            consumableKey
          ) {
            delete state.incubatorPendingInfluenceSelections[otherSelectionKey];
          }
        });
        state.incubatorPendingInfluenceSelections[selectionKey] = consumableKey;
      } else {
        delete state.incubatorPendingInfluenceSelections[selectionKey];
      }
    }

    function setSelectedItemInfluenceKey(context, slotKey, consumableKey) {
      const selectionKey = getItemInfluenceSelectionKey(context, slotKey);
      const eggSlot = getIncubatorEggSlot(context);
      const slotExists = getItemInfluenceSlots(context).some(
        (slotDefinition) => slotDefinition.key === slotKey
      );
      if (
        !selectionKey ||
        !eggSlot ||
        !slotExists ||
        isIncubatorActivelyHatching(context)
      ) {
        return false;
      }

      const influenceSlots = Array.isArray(eggSlot.influenceSlots)
        ? eggSlot.influenceSlots
        : [];
      const current = influenceSlots.find((item) => item.slotKey === slotKey);
      if (current?.itemKey === consumableKey) return true;
      if (
        consumableKey &&
        (getAvailableConsumableQuantity(consumableKey) < 1 ||
          influenceSlots.some(
            (item) => item.slotKey !== slotKey && item.itemKey === consumableKey
          ))
      ) {
        return false;
      }

      eggSlot.influenceSlots = influenceSlots.filter(
        (item) => item.slotKey !== slotKey
      );
      if (consumableKey) {
        eggSlot.influenceSlots.push({
          slotKey,
          itemKey: consumableKey,
          itemType: 'consumable',
          reservedAt: new Date().toISOString(),
          consumedAt: null
        });
      }
      delete state.incubatorItemInfluenceSelections[selectionKey];
      setPendingItemInfluenceKey(context, slotKey, null);
      renderLab();
      saveLab({ preserveLocalLab: true });
      return true;
    }

    function consumableMatchesInfluenceSlot(consumable) {
      if (!consumable) return false;
      return (
        consumable.category === 'hatching' &&
        consumable.target === 'egg' &&
        Boolean(consumable.effect?.type)
      );
    }

    function getOwnedConsumablesForInfluenceSlot(context, slotDefinition) {
      return state.ownedConsumables.filter((ownedItem) => {
        const quantity = getAvailableConsumableQuantity(ownedItem.key);
        if (quantity < 1) return false;
        const selectedElsewhere = getItemInfluenceSlots(context).some(
          (candidateSlot) =>
            candidateSlot.key !== slotDefinition.key &&
            (getSelectedItemInfluenceKey(context, candidateSlot.key) ===
              ownedItem.key ||
              getPendingItemInfluenceKey(context, candidateSlot.key) ===
                ownedItem.key)
        );
        return (
          !selectedElsewhere &&
          consumableMatchesInfluenceSlot(getConsumable(ownedItem.key))
        );
      });
    }

    function isIncubatorActivelyHatching(context) {
      const eggSlot = getIncubatorEggSlot(context);
      return Boolean(eggSlot?.itemKey && eggSlot?.placedAt);
    }

    function getPendingItemInfluenceSlots(context) {
      return getItemInfluenceSlots(context)
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
      getItemInfluenceSlots(context).forEach((slotDefinition) => {
        delete state.incubatorItemInfluenceSelections[
          getItemInfluenceSelectionKey(context, slotDefinition.key)
        ];
        setPendingItemInfluenceKey(context, slotDefinition.key, null);
      });
    }

    function placeEggInIncubator(context, eggKey) {
      const eggSlot = getIncubatorEggSlot(context);
      if (!context?.slotId || !eggSlot || eggSlot.itemKey) return false;
      setIncubatorEggSelection(context, false);
      setIncubatorHatchDetails(context, false);
      const inserted = placeEggInContainerSlot(
        context.parentPlacedId,
        context.slotId,
        eggSlot.slotId,
        eggKey,
        {
          closeMenu: false,
          preserveLocalLabOnSave: true,
          afterChange: () => {
            setStagedIncubatorEggKey(context, null);
            clearPendingItemInfluences(context);
            const nextContext = getIncubatorContext(context.parentPlacedId);
            openIncubatorMenu(nextContext || context);
          }
        }
      );
      if (!inserted) return false;
      window.dispatchEvent(new CustomEvent('oling-lab:tutorial-egg-inserted'));
      return true;
    }

    function startHatchingStagedEgg(context) {
      const eggSlot = getIncubatorEggSlot(context);
      if (!eggSlot?.itemKey || eggSlot.placedAt) return false;
      eggSlot.placedAt = new Date().toISOString();
      eggSlot.readyNotificationDeliveredAt = null;
      setStagedIncubatorEggKey(context, null);
      clearPendingItemInfluences(context);
      setIncubatorEggSelection(context, false);
      setIncubatorHatchDetails(context, false);
      renderLab();
      saveLab({ preserveLocalLab: true });
      const nextContext = getIncubatorContext(context.parentPlacedId);
      openIncubatorMenu(nextContext || context);
      return true;
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
      const roaming = getRoaming?.();
      if (!roaming) return;
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

      fetch(hatchEndpoint, {
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
          const roaming = getRoaming?.();
          const olingViews = getOlingViews?.();
          if (!roaming || !olingViews) {
            throw new Error('Oling Lab services are not ready.');
          }
          eggSlot.itemKey = null;
          eggSlot.itemType = null;
          eggSlot.placedAt = null;
          eggSlot.influenceSlots = [];
          updateAccountFromPayload(payload);
          updateInventoryFromAccountPayload(payload);
          upsertOling(payload.oling);
          roaming.start();
          closeSelectedTarget();
          closeIncubatorPanel?.({ sound: false, release: false });
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
          playSound('uiSuccess');
        })
        .catch((error) => {
          console.error('Failed to hatch Oling egg:', error);
          setStatus(error.message || 'Could not hatch egg');
          playSound('uiError');
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
      getStagedIncubatorEggKey,
      getItemInfluenceSlots,
      getOwnedConsumablesForInfluenceSlot,
      getPendingItemInfluenceKey,
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
      setPendingItemInfluenceKey,
      setSelectedItemInfluenceKey,
      setStagedIncubatorEggKey,
      stageEggForIncubator,
      startHatchingStagedEgg
    };
  }

  window.createOlingLabIncubatorCore = createOlingLabIncubatorCore;
})();

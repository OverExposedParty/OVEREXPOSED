(function () {
  function createOlingLabRestAndInteractionTools(dependencies) {
    const {
      state,
      setStatus,
      renderLab,
      elements,
      getRoaming,
      getItem,
      openExplorerGateway,
      OLING_REST_DURATION_MS,
      openMenu,
      closeMenu,
      resolveMenuConfig,
      createEmptyMessage,
      createInlineAction,
      getOlingViews,
      closeSelectedTarget,
      formatDuration,
      clearRestTimer,
      getIncubatorContext,
      openIncubatorMenu,
      closeIncubatorPanel = () => {},
      openShelfStoragePanel,
      closeShelfStoragePanel = () => {},
      closeGatewayPanel = () => {},
      openFurnitureSlotsMenu,
      closeFurnitureSlotsPanel = () => {},
      setFurnitureSaleTarget = () => {}
    } = dependencies;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    const panelTransitions = window.OlingLabPanelTransitions;
    let furnitureInteractionRequestId = 0;

    function selectFurnitureFootprint(placedId) {
      if (!elements.room || state.editMode) return;
      const selectedId = String(placedId || '');
      elements.room.dataset.olingLabSelectedFurnitureId = selectedId;
      elements.room
        .querySelectorAll('.oling-lab-item[data-oling-lab-placed-id]')
        .forEach((item) => {
          item.classList.toggle(
            'is-selected',
            item.dataset.olingLabPlacedId === selectedId
          );
        });
    }

    function replaceOlingFromPayload(oling) {
      const updatedId = String(oling?.id || oling?._id || '');
      const currentIndex = state.olings.findIndex(
        (item) => String(item?.id || item?._id || '') === updatedId
      );
      if (currentIndex >= 0) state.olings[currentIndex] = oling;
    }

    async function requestOlingSleepState(olingId, isSleeping, placedId) {
      const response = await fetch(
        `/api/olings/${encodeURIComponent(olingId)}/sleep`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({ isSleeping, placedId })
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(
          payload.error?.message || 'Could not update this Oling’s rest state.'
        );
      }
      replaceOlingFromPayload(payload.oling);
      return payload;
    }

    async function completeOlingBedJourney(olingId, placedId) {
      try {
        const payload = await requestOlingSleepState(olingId, true, placedId);
        setStatus(payload.message);
        renderLab();
        if (state.restPanelOpen || !elements.backdrop?.hidden) {
          openBedRestMenu(placedId);
        }
        playSound('uiSuccess');
        return true;
      } catch (error) {
        getRoaming()?.cancelBedJourney?.(olingId);
        setStatus(error.message);
        renderLab();
        if (state.restPanelOpen || !elements.backdrop?.hidden) {
          openBedRestMenu(placedId);
        }
        playSound('uiError');
        return false;
      }
    }

    async function wakeOlingFromCarry(olingId, placedId) {
      const currentIndex = state.olings.findIndex(
        (item) => String(item?.id || item?._id || '') === String(olingId)
      );
      const currentOling = state.olings[currentIndex];
      if (!currentOling?.care?.isSleeping) return true;

      const previousCare = { ...currentOling.care };
      currentOling.care = {
        ...currentOling.care,
        isSleeping: false,
        sleepBedSlotId: null
      };
      try {
        const payload = await requestOlingSleepState(olingId, false, placedId);
        setStatus(payload.message);
        return true;
      } catch (error) {
        const latestOling = state.olings[currentIndex];
        if (latestOling) latestOling.care = previousCare;
        setStatus(error.message);
        return false;
      }
    }

    function getAdventureDoorPlacedId() {
      return (
        state.lab?.placedItems?.find((placed) => {
          const item = getItem(placed.itemId);
          return item?.type === 'door' && item.exitPlacement;
        })?.placedId || null
      );
    }

    async function beginOlingAdventure(olingId, journey) {
      try {
        const response = await fetch('/api/olings/adventures/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            adventureKey: journey.adventure.key,
            olingId,
            doorPlacedId: journey.placedId
          })
        });
        const payload = await response.json();
        if (!response.ok || payload.success === false)
          throw new Error(
            payload.error?.message || 'Could not start adventure.'
          );
        state.activeAdventure = payload.active;
        setStatus(payload.message);
        renderLab();
        if (state.gatewayPanelOpen || !elements.backdrop.hidden) {
          openExplorerGateway('Active Adventure');
        }
        playSound('uiSuccess');
      } catch (error) {
        getRoaming()?.cancelAdventureDeparture?.(olingId);
        setStatus(error.message);
        renderLab();
        playSound('uiError');
      }
    }

    function setRestPanelCollapsed(collapsed) {
      if (!state.restPanelOpen || !elements.restPanel) return;
      const changed = state.restPanelCollapsed !== collapsed;
      state.restPanelCollapsed = collapsed;
      elements.restPanel.classList.toggle('is-collapsed', collapsed);
      elements.restPanelToggle.textContent = collapsed ? 'Show' : 'Hide';
      elements.restPanelToggle.setAttribute(
        'aria-expanded',
        String(!collapsed)
      );
      if (changed) playSound(collapsed ? 'sidePanelClose' : 'sidePanelOpen');
    }

    function closeRestPanel({ sound = true } = {}) {
      if (!elements.restPanel) return;
      const pendingClose = panelTransitions?.getPendingClose?.(
        elements.restPanel
      );
      if (!state.restPanelOpen) {
        return pendingClose || Promise.resolve(false);
      }
      const wasExpanded = Boolean(
        state.restPanelOpen &&
        !state.restPanelCollapsed &&
        !elements.restPanel.hidden
      );
      clearRestTimer();
      state.restPanelOpen = false;
      state.restPanelCollapsed = false;
      state.activeRestBedPlacedId = null;
      elements.restPanelToggle?.setAttribute('aria-expanded', 'false');
      const playCloseSound = () => {
        if (sound && wasExpanded) playSound('sidePanelClose');
      };
      const cleanup = () => {
        elements.restPanel.classList.remove('is-open', 'is-collapsed');
        elements.restPanelContent?.replaceChildren();
        elements.restPanelFooter?.replaceChildren();
      };
      if (panelTransitions) {
        return panelTransitions.close(elements.restPanel, {
          beforeExit: playCloseSound,
          afterClose: cleanup
        });
      }
      playCloseSound();
      elements.restPanel.hidden = true;
      cleanup();
      return Promise.resolve(true);
    }

    function prepareRestSidePanel(placedId) {
      const wasExpanded = Boolean(
        state.restPanelOpen &&
        !state.restPanelCollapsed &&
        state.activeRestBedPlacedId === placedId
      );
      closeMenu?.();
      getOlingViews()?.closeOlingPanel?.({ sound: false });
      getOlingViews()?.closeStoragePanel?.({ sound: false });
      closeShelfStoragePanel({ sound: false });
      closeIncubatorPanel({ sound: false });
      closeGatewayPanel({ sound: false });
      state.restPanelOpen = true;
      state.restPanelCollapsed = false;
      state.activeRestBedPlacedId = placedId;
      const theme = resolveMenuConfig?.({ theme: 'care-mood' }) || {};
      for (const [property, value] of [
        ['--wall-decoration-panel-primary', theme.primaryColour],
        ['--wall-decoration-panel-secondary', theme.secondaryColour]
      ]) {
        if (value) elements.restPanel.style.setProperty(property, value);
      }
      if (elements.restPanelTitle) {
        elements.restPanelTitle.textContent = 'Rest';
      }
      elements.restPanelToggle?.setAttribute('aria-expanded', 'true');
      if (elements.restPanelToggle) {
        elements.restPanelToggle.textContent = 'Hide';
      }
      return wasExpanded;
    }

    function finishRestSidePanelOpen(wasExpanded) {
      const show = () => {
        if (!state.restPanelOpen) return;
        if (!wasExpanded) playSound('sidePanelOpen');
      };
      if (panelTransitions) {
        void panelTransitions.open(elements.restPanel, { afterOpen: show });
      } else if (typeof window.requestAnimationFrame === 'function') {
        elements.restPanel.hidden = false;
        window.requestAnimationFrame(() => {
          elements.restPanel.classList.add('is-open');
          show();
        });
      } else {
        elements.restPanel.hidden = false;
        elements.restPanel.classList.add('is-open');
        show();
      }
    }

    function openBedRestMenu(placedId) {
      clearRestTimer();
      const olings = state.olings || [];
      const placedBed = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      const bed = getItem(placedBed?.itemId);
      const usesSidePanel = Boolean(
        elements.restPanel &&
        elements.restPanelContent &&
        elements.restPanelFooter
      );
      const wasExpanded = usesSidePanel
        ? prepareRestSidePanel(placedId)
        : false;
      const baseBedRestDurationMs =
        OLING_REST_DURATION_MS[String(bed?.rarity || 'common').toLowerCase()] ||
        OLING_REST_DURATION_MS.common;
      if (!olings.length) {
        if (usesSidePanel) {
          elements.restPanelContent.replaceChildren(
            createEmptyMessage('You need an Oling before anyone can rest here.')
          );
          elements.restPanelFooter.replaceChildren();
          finishRestSidePanelOpen(wasExpanded);
          return;
        }
        openMenu(
          'Oling Bed',
          [
            createEmptyMessage('You need an Oling before anyone can rest here.')
          ],
          {
            theme: 'care-mood'
          }
        );
        return;
      }

      const index = Math.max(
        0,
        Math.min(state.restOlingIndex, olings.length - 1)
      );
      const oling = olings[index];
      const olingId = String(oling?.id || oling?._id || '');
      const isSleeping = Boolean(oling?.care?.isSleeping);
      const isOnAdventure =
        String(state.activeAdventure?.olingId || '') === olingId;
      const isComingToBed = Boolean(
        getRoaming()?.isHeadingToBed?.(olingId, placedId)
      );
      const bedRestDurationMs = baseBedRestDurationMs;
      const panel = document.createElement('section');
      panel.className = 'oling-lab-rest-panel';

      const stage = document.createElement('div');
      stage.className = 'oling-lab-rest-stage';
      const previous = createInlineAction(
        'Previous Oling',
        () => {
          state.restOlingIndex = (index - 1 + olings.length) % olings.length;
          openBedRestMenu(placedId);
        },
        { soundIntent: 'previous' }
      );
      previous.classList.add('oling-lab-rest-arrow', 'is-previous');
      previous.disabled = olings.length < 2;

      const next = createInlineAction(
        'Next Oling',
        () => {
          state.restOlingIndex = (index + 1) % olings.length;
          openBedRestMenu(placedId);
        },
        { soundIntent: 'next' }
      );
      next.classList.add('oling-lab-rest-arrow', 'is-next');
      next.disabled = olings.length < 2;

      const preview = getOlingViews().createPreview(oling);
      preview.classList.add('oling-lab-rest-oling-preview');
      const previewWindow = document.createElement('div');
      previewWindow.className = 'oling-lab-rest-preview-window';
      previewWindow.append(previous, preview, next);

      const energyMeter = getOlingViews().createEnergyMeter(oling);
      energyMeter.classList.add('oling-lab-rest-energy');
      const name = Object.assign(document.createElement('strong'), {
        className: 'oling-lab-rest-oling-name',
        textContent: oling?.name || 'Oling'
      });
      const nameCard = document.createElement('article');
      nameCard.className = 'oling-lab-rest-metric oling-lab-rest-name-card';
      nameCard.append(
        Object.assign(document.createElement('h3'), {
          textContent: 'Oling'
        }),
        name
      );
      const energyCard = document.createElement('article');
      energyCard.className = 'oling-lab-rest-metric oling-lab-rest-energy-card';
      energyCard.append(
        Object.assign(document.createElement('h3'), {
          textContent: 'Energy'
        }),
        energyMeter
      );
      const chargeTime = Object.assign(document.createElement('strong'), {
        className: 'oling-lab-rest-charge-time'
      });
      chargeTime.setAttribute('aria-live', 'polite');
      const chargeCard = document.createElement('article');
      chargeCard.className = 'oling-lab-rest-metric oling-lab-rest-charge-card';
      chargeCard.append(
        Object.assign(document.createElement('h3'), {
          textContent: 'Fully Charged In'
        }),
        chargeTime
      );
      stage.append(previewWindow, nameCard, energyCard, chargeCard);

      const actionArea = document.createElement('footer');
      actionArea.className = 'oling-lab-rest-action-area';
      const sleepButton = createInlineAction(
        isOnAdventure
          ? 'On adventure'
          : isSleeping
            ? 'Wake up'
            : isComingToBed
              ? 'Cancel coming to bed'
              : 'Sleep',
        async () => {
          if (isComingToBed) {
            getRoaming().cancelBedJourney(olingId);
            setStatus(`${oling?.name || 'Your Oling'} stopped coming to bed.`);
            renderLab();
            openBedRestMenu(placedId);
            return;
          }
          if (!isSleeping) {
            closeSelectedTarget();
            if (!getRoaming()?.sendToBed?.(olingId, placedId)) {
              setStatus('Could not find that Oling bed.');
              playSound('uiError');
              return;
            }
            setStatus(`${oling?.name || 'Your Oling'} is coming to bed.`);
            renderLab();
            openBedRestMenu(placedId);
            return;
          }

          sleepButton.disabled = true;
          try {
            const payload = await requestOlingSleepState(
              olingId,
              false,
              placedId
            );
            setStatus(payload.message);
            renderLab();
            openBedRestMenu(placedId);
          } catch (error) {
            sleepButton.disabled = false;
            setStatus(error.message);
            playSound('uiError');
          }
        },
        {
          soundIntent: isComingToBed
            ? 'close'
            : isSleeping
              ? 'disabled'
              : 'enabled'
        }
      );
      sleepButton.classList.add('oling-lab-rest-toggle');
      sleepButton.disabled = isOnAdventure;
      sleepButton.title = isOnAdventure
        ? 'This Oling is currently on an adventure.'
        : '';
      actionArea.appendChild(sleepButton);
      panel.appendChild(stage);
      if (usesSidePanel) {
        elements.restPanelContent.replaceChildren(panel);
        elements.restPanelFooter.replaceChildren(sleepButton);
        finishRestSidePanelOpen(wasExpanded);
      } else {
        openMenu('Rest', [panel], {
          theme: 'care-mood',
          footer: actionArea,
          selectedTarget: { type: 'furniture', id: placedId }
        });
      }

      const syncRestStatus = () => {
        const care = oling?.care || {};
        const maxEnergy = Math.max(1, Number(care.maxEnergy) || 100);
        const currentEnergy = Math.max(
          0,
          Math.min(maxEnergy, Number(care.energy ?? maxEnergy))
        );
        const durationMs = Number(care.sleepDurationMs) || bedRestDurationMs;
        const initialRemainingMs = Number(care.restRemainingMs);
        const readyAt = care.restReadyAt
          ? new Date(care.restReadyAt).getTime()
          : null;
        const remainingMs =
          currentEnergy >= maxEnergy
            ? 0
            : isSleeping && Number.isFinite(readyAt)
              ? Math.max(0, readyAt - Date.now())
              : Number.isFinite(initialRemainingMs) && isSleeping
                ? Math.max(0, initialRemainingMs)
                : (durationMs * (maxEnergy - currentEnergy)) / maxEnergy;
        chargeTime.textContent =
          remainingMs > 0 ? formatDuration(remainingMs) : 'Fully Charged';

        if (isSleeping) {
          const recoveredEnergy = Math.max(
            0,
            maxEnergy - (remainingMs / durationMs) * maxEnergy
          );
          const percentage = Math.round((recoveredEnergy / maxEnergy) * 100);
          energyMeter
            .querySelector('.oling-lab-oling-energy-fill')
            ?.style.setProperty('--oling-energy-level', `${percentage}%`);
          const value = energyMeter.querySelector(
            '.oling-lab-oling-energy-value'
          );
          if (value) value.textContent = String(Math.floor(recoveredEnergy));
        }

        if (remainingMs <= 0) clearRestTimer();
      };
      syncRestStatus();
      if (
        isSleeping &&
        Number(oling?.care?.energy ?? 100) <
          Number(oling?.care?.maxEnergy || 100)
      ) {
        state.restTimerInterval = window.setInterval(syncRestStatus, 1000);
      }
    }

    elements.restPanelToggle?.addEventListener('click', () =>
      setRestPanelCollapsed(!state.restPanelCollapsed)
    );
    elements.restPanelClose?.addEventListener('click', () => {
      const placedId = state.activeRestBedPlacedId;
      closeRestPanel();
      elements.room
        ?.querySelector(`[data-oling-lab-placed-id="${placedId}"]`)
        ?.focus();
    });

    async function interactWithFurniture(placedId) {
      const requestId = (furnitureInteractionRequestId += 1);
      const placed = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      const item = getItem(placed?.itemId);
      const incubatorContext = getIncubatorContext(placedId);

      if (!placed || !item) return;

      const gatewayPlaced =
        item?.id === 'explorer_gateway' ||
        (placed?.containerSlots || []).some(
          (slot) => slot.itemId === 'explorer_gateway'
        );

      const olingViews = getOlingViews();
      const exits = [
        closeFurnitureSlotsPanel({ sound: false }),
        closeRestPanel({ sound: false }),
        closeGatewayPanel({ sound: false }),
        closeIncubatorPanel({ sound: false }),
        closeShelfStoragePanel({ sound: false }),
        olingViews?.closeStoragePanel?.({ sound: false }),
        olingViews?.closeOlingPanel?.({ sound: false, release: false })
      ].filter((result) => typeof result?.then === 'function');
      closeSelectedTarget();
      if (exits.length) await Promise.allSettled(exits);
      if (requestId !== furnitureInteractionRequestId) return;

      if (incubatorContext) {
        selectFurnitureFootprint(placedId);
        setFurnitureSaleTarget(
          'incubator',
          incubatorContext.slot?.placedId || incubatorContext.parentPlacedId
        );
        openIncubatorMenu(incubatorContext);
        return;
      }

      if (gatewayPlaced) {
        selectFurnitureFootprint(placedId);
        const gatewaySlot = (placed?.containerSlots || []).find(
          (slot) => slot?.itemId === 'explorer_gateway'
        );
        setFurnitureSaleTarget(
          'gateway',
          gatewaySlot?.placedId || placed?.placedId
        );
        openExplorerGateway(state.explorerTabLabel || 'Overview', {
          shouldOpen: () => requestId === furnitureInteractionRequestId
        });
        return;
      }

      if (item?.type === 'bed' || item?.category === 'bed') {
        selectFurnitureFootprint(placedId);
        setFurnitureSaleTarget('rest', placedId);
        openBedRestMenu(placedId);
        return;
      }

      if (item?.podStorage) {
        selectFurnitureFootprint(placedId);
        setFurnitureSaleTarget('storage', placedId);
        olingViews?.openStoredOlingsMenu?.(placedId);
        return;
      }

      if (
        (item?.inventorySlots || []).some((slot) => slot.slotType === 'storage')
      ) {
        selectFurnitureFootprint(placedId);
        setFurnitureSaleTarget('supply-storage', placedId);
        openShelfStoragePanel(placedId);
        return;
      }

      if ((item?.containerSlots || []).length) {
        selectFurnitureFootprint(placedId);
        openFurnitureSlotsMenu(placedId);
        return;
      }

      setStatus(
        `${item?.name || 'That item'} has nothing to interact with yet.`
      );
      playSound('uiError');
      renderLab();
    }

    function getFurnitureInteractionAction(placed, item) {
      if (getIncubatorContext(placed?.placedId)) {
        return {
          label: 'Check incubator',
          theme: 'incubation'
        };
      }

      if (
        item?.id === 'explorer_gateway' ||
        (placed?.containerSlots || []).some(
          (slot) => slot.itemId === 'explorer_gateway'
        )
      ) {
        return { label: 'Use gateway', theme: 'quests-adventures' };
      }

      if (item?.type === 'bed' || item?.category === 'bed') {
        return { label: 'Rest Oling', theme: 'care-mood' };
      }

      if (item?.podStorage) {
        return {
          label: 'Open Pod Rack',
          theme: 'inventory'
        };
      }

      if (
        (item?.inventorySlots || []).some((slot) => slot.slotType === 'storage')
      ) {
        return {
          label: 'Open storage',
          theme: 'inventory'
        };
      }

      if ((item?.containerSlots || []).length) {
        return {
          label: 'Manage slots',
          theme: 'olings-lab'
        };
      }

      return {
        label: 'No interaction',
        theme: 'locked-disabled',
        disabled: true
      };
    }

    return {
      replaceOlingFromPayload,
      requestOlingSleepState,
      completeOlingBedJourney,
      wakeOlingFromCarry,
      getAdventureDoorPlacedId,
      beginOlingAdventure,
      openBedRestMenu,
      closeRestPanel,
      interactWithFurniture,
      getFurnitureInteractionAction
    };
  }

  window.createOlingLabRestAndInteractionTools =
    createOlingLabRestAndInteractionTools;
})();

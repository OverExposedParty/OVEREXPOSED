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
      createEmptyMessage,
      createInlineAction,
      getOlingViews,
      closeSelectedTarget,
      formatDuration,
      clearRestTimer,
      getIncubatorContext,
      openIncubatorMenu,
      createShelfStorageTab,
      openPlacedItemMenu
    } = dependencies;

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
        if (!elements.backdrop.hidden) openBedRestMenu(placedId);
      } catch (error) {
        getRoaming()?.cancelBedJourney?.(olingId);
        setStatus(error.message);
        renderLab();
        if (!elements.backdrop.hidden) openBedRestMenu(placedId);
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
        if (!elements.backdrop.hidden) openExplorerGateway('Active Adventure');
      } catch (error) {
        getRoaming()?.cancelAdventureDeparture?.(olingId);
        setStatus(error.message);
        renderLab();
      }
    }

    function openBedRestMenu(placedId) {
      const olings = state.olings || [];
      const placedBed = state.lab?.placedItems?.find(
        (placed) => String(placed?.placedId || '') === String(placedId || '')
      );
      const bed = getItem(placedBed?.itemId);
      const baseBedRestDurationMs =
        OLING_REST_DURATION_MS[String(bed?.rarity || 'common').toLowerCase()] ||
        OLING_REST_DURATION_MS.common;
      if (!olings.length) {
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
      const bedRestDurationMs =
        String(oling?.personalityKey || '').toLowerCase() === 'lazy'
          ? baseBedRestDurationMs * 0.85
          : baseBedRestDurationMs;
      const panel = document.createElement('section');
      panel.className = 'oling-lab-rest-panel';

      const stage = document.createElement('div');
      stage.className = 'oling-lab-rest-stage';
      const previous = createInlineAction('Previous Oling', () => {
        state.restOlingIndex = (index - 1 + olings.length) % olings.length;
        openBedRestMenu(placedId);
      });
      previous.classList.add('oling-lab-rest-arrow', 'is-previous');
      previous.disabled = olings.length < 2;

      const next = createInlineAction('Next Oling', () => {
        state.restOlingIndex = (index + 1) % olings.length;
        openBedRestMenu(placedId);
      });
      next.classList.add('oling-lab-rest-arrow', 'is-next');
      next.disabled = olings.length < 2;

      const preview = getOlingViews().createPreview(oling);
      preview.classList.add('oling-lab-rest-oling-preview');
      const energyMeter = getOlingViews().createEnergyMeter(oling);
      energyMeter.classList.add('oling-lab-rest-energy');
      const name = Object.assign(document.createElement('strong'), {
        className: 'oling-lab-rest-oling-name',
        textContent: oling?.name || 'Oling'
      });
      const status = Object.assign(document.createElement('p'), {
        className: 'oling-lab-rest-status'
      });
      stage.append(energyMeter, previous, preview, next, name, status);

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
          }
        }
      );
      sleepButton.classList.add('oling-lab-rest-toggle');
      sleepButton.disabled = isOnAdventure;
      sleepButton.title = isOnAdventure
        ? 'This Oling is currently on an adventure.'
        : '';
      actionArea.appendChild(sleepButton);
      panel.appendChild(stage);
      openMenu('Rest', [panel], {
        theme: 'care-mood',
        footer: actionArea,
        selectedTarget: { type: 'furniture', id: placedId }
      });

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
        const restCopy =
          remainingMs > 0
            ? `Full reset in ${formatDuration(remainingMs)}`
            : 'Fully reset';
        const currentJourney = getRoaming()?.isHeadingToBed?.(
          olingId,
          placedId
        );
        const stateCopy = isOnAdventure
          ? 'Currently on an adventure'
          : isSleeping
            ? 'Resting peacefully'
            : currentJourney
              ? 'Coming to bed'
              : 'Ready for a snooze';
        status.textContent = `${stateCopy} · ${restCopy}`;

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

    function interactWithFurniture(placedId) {
      const placed = state.lab.placedItems.find(
        (item) => item.placedId === placedId
      );
      const item = getItem(placed?.itemId);
      const incubatorContext = getIncubatorContext(placedId);

      const gatewayPlaced =
        item?.id === 'explorer_gateway' ||
        (placed?.containerSlots || []).some(
          (slot) => slot.itemId === 'explorer_gateway'
        );

      if (incubatorContext) {
        openIncubatorMenu(incubatorContext);
        return;
      }

      if (gatewayPlaced) {
        closeSelectedTarget();
        openExplorerGateway();
        return;
      }

      if (item?.type === 'bed' || item?.category === 'bed') {
        closeSelectedTarget();
        openBedRestMenu(placedId);
        return;
      }

      if (
        (item?.inventorySlots || []).some((slot) => slot.slotType === 'storage')
      ) {
        closeSelectedTarget();
        openMenu(`${item.name} Storage`, createShelfStorageTab(placed, item), {
          theme: 'inventory'
        });
        return;
      }

      if ((item?.containerSlots || []).length) {
        closeSelectedTarget();
        openPlacedItemMenu(placedId);
        return;
      }

      closeSelectedTarget();
      setStatus(
        `${item?.name || 'That item'} has nothing to interact with yet.`
      );
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
      getAdventureDoorPlacedId,
      beginOlingAdventure,
      openBedRestMenu,
      interactWithFurniture,
      getFurnitureInteractionAction
    };
  }

  window.createOlingLabRestAndInteractionTools =
    createOlingLabRestAndInteractionTools;
})();

(function () {
  function createOlingLabData(dependencies) {
    const { state, defaultHatchDurationMs } = dependencies;

    function getItem(itemId) {
      return state.catalog.get(itemId) || null;
    }

    function isPlaced(itemId) {
      return state.lab.placedItems.some((item) => {
        if (item.itemId === itemId) return true;
        return (item.containerSlots || []).some(
          (slot) => slot.itemId === itemId
        );
      });
    }

    function getEgg(eggKey) {
      return state.eggs.get(eggKey) || { key: eggKey, name: eggKey };
    }

    function getConsumable(consumableKey) {
      return (
        state.consumables.get(consumableKey) || {
          key: consumableKey,
          name: consumableKey,
          description: ''
        }
      );
    }

    function getRarityTheme(rarity) {
      const key = String(rarity || '')
        .trim()
        .toLowerCase();
      return state.rarityPalette[key] || null;
    }

    function applyRarityTheme(element, rarity) {
      const theme = getRarityTheme(rarity);
      if (!element || !theme) return;
      element.dataset.rarity = String(rarity || '')
        .trim()
        .toLowerCase();
      if (theme.primaryColour) {
        element.style.setProperty(
          '--oling-rarity-primary-colour',
          theme.primaryColour
        );
      }
      if (theme.secondaryColour) {
        element.style.setProperty(
          '--oling-rarity-secondary-colour',
          theme.secondaryColour
        );
      }
      if (theme.textColour) {
        element.style.setProperty(
          '--oling-rarity-text-colour',
          theme.textColour
        );
      }
    }

    function getUsedEggQuantity(eggKey) {
      let count = 0;

      state.lab.placedItems.forEach((item) => {
        (item.inventorySlots || []).forEach((slot) => {
          if (slot.itemType === 'egg' && slot.itemKey === eggKey) {
            count += Number(slot.quantity || 1);
          }
        });
        (item.containerSlots || []).forEach((containerSlot) => {
          (containerSlot.inventorySlots || []).forEach((slot) => {
            if (slot.itemType === 'egg' && slot.itemKey === eggKey) {
              count += Number(slot.quantity || 1);
            }
          });
        });
      });

      return count;
    }

    function getAvailableEggQuantity(eggKey) {
      const owned = state.ownedEggs.find((egg) => egg.key === eggKey);
      return Math.max(
        0,
        Number(owned?.quantity || 0) - getUsedEggQuantity(eggKey)
      );
    }

    function getUsedConsumableQuantity(consumableKey) {
      let count = 0;
      state.lab.placedItems.forEach((item) => {
        (item.inventorySlots || []).forEach((slot) => {
          if (
            slot.itemType === 'consumable' &&
            slot.itemKey === consumableKey
          ) {
            count += Number(slot.quantity || 1);
          }
        });
      });
      return count;
    }

    function getAvailableConsumableQuantity(consumableKey) {
      const owned = state.ownedConsumables.find(
        (item) => item.key === consumableKey
      );
      return Math.max(
        0,
        Number(owned?.quantity || 0) - getUsedConsumableQuantity(consumableKey)
      );
    }

    function getEggImage(egg) {
      if (egg?.assets?.image) return egg.assets.image;
      const setName = egg?.collection || egg?.key;
      return setName ? `/images/olings/eggs/${setName}/egg.svg` : '';
    }

    function getConfiguredHatchDurationMs(context, egg) {
      const values = [
        egg?.metadata?.hatchMilliseconds,
        egg?.metadata?.hatchMs,
        Number(egg?.metadata?.hatchSeconds) * 1000,
        Number(egg?.metadata?.hatchMinutes) * 60 * 1000,
        context?.incubator?.hatchMilliseconds,
        context?.incubator?.hatchMs,
        Number(context?.incubator?.hatchSeconds) * 1000,
        Number(context?.incubator?.hatchMinutes) * 60 * 1000
      ];
      const duration = values.find(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0
      );
      return Number(duration) || defaultHatchDurationMs;
    }

    function getHatchProgress(context, eggSlot, egg) {
      if (!egg || !eggSlot?.placedAt) {
        return {
          isReady: false,
          remainingMs: 0,
          durationMs: getConfiguredHatchDurationMs(context, egg),
          startedAt: null,
          readyAt: null
        };
      }

      const startedAt = new Date(eggSlot.placedAt).getTime();
      const durationMs = getConfiguredHatchDurationMs(context, egg);
      const readyAt = Number.isFinite(startedAt)
        ? startedAt + durationMs
        : Date.now();
      const remainingMs = Math.max(0, readyAt - Date.now());

      return {
        isReady: remainingMs <= 0,
        remainingMs,
        durationMs,
        startedAt,
        readyAt
      };
    }

    return {
      getItem,
      isPlaced,
      getEgg,
      getConsumable,
      getRarityTheme,
      applyRarityTheme,
      getUsedEggQuantity,
      getAvailableEggQuantity,
      getUsedConsumableQuantity,
      getAvailableConsumableQuantity,
      getEggImage,
      getConfiguredHatchDurationMs,
      getHatchProgress
    };
  }

  window.createOlingLabData = createOlingLabData;
})();

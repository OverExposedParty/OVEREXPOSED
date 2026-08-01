(function () {
  function createOlingLabDataFlow(dependencies) {
    const {
      state,
      setStatus,
      LAB_ENDPOINT,
      parsePayload,
      syncAccountPayload,
      renderLab,
      loadFurnitureGridPlacements,
      RARITY_PALETTE_ENDPOINT,
      MY_OLINGS_ENDPOINT,
      getRoaming
    } = dependencies;

    function saveLab(options = {}) {
      state.saving = true;
      setStatus('Saving...');

      fetch(LAB_ENDPOINT, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ lab: state.lab })
      })
        .then(parsePayload)
        .then((payload) => {
          if (!options.preserveLocalLab) {
            state.lab = payload.lab;
          }
          state.expansion = payload.expansion || state.expansion;
          if (payload.eggs) {
            state.eggs = new Map(payload.eggs.map((egg) => [egg.key, egg]));
          }
          if (payload.consumables) {
            state.consumables = new Map(
              payload.consumables.map((item) => [item.key, item])
            );
          }
          state.ownedEggs = Array.isArray(payload.inventory?.eggs)
            ? payload.inventory.eggs.filter(
                (egg) => Number(egg.quantity || 0) > 0
              )
            : state.ownedEggs;
          state.ownedConsumables = Array.isArray(payload.inventory?.consumables)
            ? payload.inventory.consumables.filter(
                (item) => Number(item.quantity || 0) > 0
              )
            : state.ownedConsumables;
          syncAccountPayload(payload);
          setStatus('Saved');
          renderLab();
        })
        .catch((error) => {
          console.error('Failed to save Olings Lab:', error);
          setStatus(error.message || 'Could not save lab');
        })
        .finally(() => {
          state.saving = false;
        });
    }

    function loadLab() {
      fetch(LAB_ENDPOINT, { headers: { Accept: 'application/json' } })
        .then(parsePayload)
        .then(async (payload) => {
          const catalog = await loadFurnitureGridPlacements(
            payload.catalog || []
          );
          state.catalog = new Map(catalog.map((item) => [item.id, item]));
          state.eggs = new Map(
            (payload.eggs || []).map((egg) => [egg.key, egg])
          );
          state.consumables = new Map(
            (payload.consumables || []).map((item) => [item.key, item])
          );
          state.owned = new Set(
            (payload.inventory?.furniture || []).map((item) => item.key)
          );
          state.ownedEggs = Array.isArray(payload.inventory?.eggs)
            ? payload.inventory.eggs.filter(
                (egg) => Number(egg.quantity || 0) > 0
              )
            : [];
          state.ownedConsumables = Array.isArray(payload.inventory?.consumables)
            ? payload.inventory.consumables.filter(
                (item) => Number(item.quantity || 0) > 0
              )
            : [];
          state.lab = payload.lab;
          state.expansion = payload.expansion || null;
          syncAccountPayload(payload);
          setStatus('Ready');
          renderLab();
          loadPlayerOlings();
        })
        .catch((error) => {
          console.error('Failed to load Olings Lab:', error);
          if (
            String(error.message || '')
              .toLowerCase()
              .includes('sign in')
          ) {
            window.location.href = `/sign-in?returnTo=${encodeURIComponent('/olings/lab')}`;
            return;
          }
          setStatus('Could not load lab');
        });
    }

    function loadRarityPalette() {
      return fetch(RARITY_PALETTE_ENDPOINT, {
        headers: { Accept: 'application/json' }
      })
        .then((response) => {
          if (!response.ok) throw new Error('Rarity palette request failed');
          return response.json();
        })
        .then((rarities) => {
          state.rarityPalette =
            rarities && typeof rarities === 'object' ? rarities : {};
        })
        .catch((error) => {
          console.error('Failed to load rarity palette:', error);
        });
    }

    function loadPlayerOlings() {
      fetch(MY_OLINGS_ENDPOINT, { headers: { Accept: 'application/json' } })
        .then(parsePayload)
        .then((payload) => {
          state.olings = Array.isArray(payload.olings) ? payload.olings : [];
          state.activeAdventure =
            payload.activeAdventure ||
            payload.account?.olings?.adventures?.active ||
            null;
          getRoaming().ensureRoamStates();
          if (payload.account) {
            localStorage.setItem('oe-account', JSON.stringify(payload.account));
          }
          renderLab();
          getRoaming().start();
        })
        .catch((error) => {
          console.error('Failed to load player Olings:', error);
        });
    }

    return {
      saveLab,
      loadLab,
      loadRarityPalette,
      loadPlayerOlings
    };
  }

  window.createOlingLabDataFlow = createOlingLabDataFlow;
})();

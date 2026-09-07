(function () {
  function createOlingLabDataFlow(dependencies) {
    const { state, setStatus, renderLab, getRoaming } = dependencies;
    const api = window.createOlingLabApi(dependencies);
    const hydrator = window.createOlingLabStateHydrator(dependencies);
    let saveTail = Promise.resolve();
    let latestSaveSequence = 0;

    function cloneLabForSave(lab) {
      return JSON.parse(JSON.stringify(lab));
    }

    function saveLab(options = {}) {
      if (state.visitorMode) return Promise.resolve();
      if (state.tutorialMode) {
        setStatus('Tutorial preview · changes are not saved');
        renderLab();
        return Promise.resolve();
      }
      const sequence = ++latestSaveSequence;
      const labSnapshot = cloneLabForSave(state.lab);
      state.saving = true;
      setStatus('Saving...');
      const performSave = () =>
        api
          .saveLab(labSnapshot)
          .then((payload) => {
            const isLatestSave = sequence === latestSaveSequence;
            hydrator.hydrateSavedLab(payload, {
              ...options,
              preserveLocalLab:
                Boolean(options.preserveLocalLab) || !isLatestSave
            });
            if (isLatestSave) {
              setStatus('Saved');
              renderLab();
            }
          })
          .catch((error) => {
            console.error('Failed to save Olings Lab:', error);
            if (sequence === latestSaveSequence) {
              setStatus(error.message || 'Could not save lab');
            }
          })
          .finally(() => {
            if (sequence === latestSaveSequence) state.saving = false;
          });
      const queuedSave = saveTail.then(performSave, performSave);
      saveTail = queuedSave.catch(() => {});
      return queuedSave;
    }

    function loadPlayerOlings() {
      return api
        .loadPlayerOlings()
        .then((payload) => {
          hydrator.hydratePlayerOlings(payload);
          getRoaming().ensureRoamStates();
          renderLab();
          getRoaming().start();
        })
        .catch((error) =>
          console.error('Failed to load player Olings:', error)
        );
    }

    function loadLab() {
      return api
        .loadLab()
        .then(async (payload) => {
          if (state.visitorMode && payload.viewer?.isOwner) {
            window.location.replace(payload.canonicalUrl || '/olings/lab');
            return;
          }
          await hydrator.hydrateLoadedLab(payload);
          setStatus(
            state.visitorMode && payload.owner?.username
              ? `Viewing ${payload.owner.username}'s lab`
              : 'Ready'
          );
          renderLab();
          if (state.tutorialMode || state.visitorMode) {
            state.olings = Array.isArray(payload.olings) ? payload.olings : [];
            getRoaming().ensureRoamStates();
            renderLab();
            getRoaming().start();
          } else {
            loadPlayerOlings();
          }
          window.dispatchEvent(
            new CustomEvent('oling-lab:ready', {
              detail: {
                tutorialMode: state.tutorialMode,
                visitorMode: state.visitorMode
              }
            })
          );
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
      return api
        .loadRarityPalette()
        .then((rarities) => {
          state.rarityPalette =
            rarities && typeof rarities === 'object' ? rarities : {};
        })
        .catch((error) =>
          console.error('Failed to load rarity palette:', error)
        );
    }

    async function runStorageMutation(request) {
      try {
        const payload = await request();
        hydrator.hydrateOlingStorageMutation(payload);
        getRoaming().ensureRoamStates();
        renderLab();
        setStatus(payload.message || 'Oling storage updated.');
        return payload;
      } catch (error) {
        setStatus(error.message || 'Could not update Oling storage.');
        throw error;
      }
    }

    function storeOling(olingId, podKey, containerPlacedId) {
      return runStorageMutation(() =>
        api.storeOling(olingId, podKey, containerPlacedId)
      );
    }

    function transferStoredOling(olingId, containerPlacedId) {
      return runStorageMutation(() =>
        api.transferStoredOling(olingId, containerPlacedId)
      );
    }

    function releaseOling(olingId) {
      return runStorageMutation(() => api.releaseOling(olingId));
    }

    return {
      saveLab,
      loadLab,
      loadRarityPalette,
      loadPlayerOlings,
      storeOling,
      transferStoredOling,
      releaseOling
    };
  }
  window.createOlingLabDataFlow = createOlingLabDataFlow;
})();

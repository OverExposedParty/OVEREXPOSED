(function () {
  function createOlingLabStateHydrator({
    state,
    syncAccountPayload,
    loadFurnitureGridPlacements
  }) {
    const positiveQuantity = (item) => Number(item.quantity || 0) > 0;
    function hydrateInventory(payload, fallbacks = {}) {
      state.ownedWallDecorations = new Map(
        Array.isArray(payload.inventory?.wallDecorations)
          ? payload.inventory.wallDecorations
              .filter(positiveQuantity)
              .map((item) => [item.key, Number(item.quantity || 0)])
          : fallbacks.wallDecorations ||
              (state.ownedWallDecorations instanceof Map
                ? [...state.ownedWallDecorations]
                : [])
      );
      state.ownedWallpapers = new Set(
        Array.isArray(payload.inventory?.wallpapers)
          ? payload.inventory.wallpapers.map((item) => item.key).filter(Boolean)
          : fallbacks.wallpapers ||
              (state.ownedWallpapers instanceof Set
                ? [...state.ownedWallpapers]
                : [])
      );
      state.ownedWallpaperVariants = new Set(
        Array.isArray(payload.inventory?.wallpaperVariants)
          ? payload.inventory.wallpaperVariants
              .map((item) => item.key)
              .filter(Boolean)
          : fallbacks.wallpaperVariants ||
              (state.ownedWallpaperVariants instanceof Set
                ? [...state.ownedWallpaperVariants]
                : [])
      );
      state.ownedEggs = Array.isArray(payload.inventory?.eggs)
        ? payload.inventory.eggs.filter(positiveQuantity)
        : fallbacks.eggs || state.ownedEggs || [];
      state.ownedConsumables = Array.isArray(payload.inventory?.consumables)
        ? payload.inventory.consumables.filter(positiveQuantity)
        : fallbacks.consumables || state.ownedConsumables || [];
      state.ownedPods = Array.isArray(payload.inventory?.pods)
        ? payload.inventory.pods.filter(positiveQuantity)
        : fallbacks.pods || state.ownedPods || [];
    }
    function hydrateDefinitions(payload) {
      if (payload.wallDecorations)
        state.wallDecorations = new Map(
          payload.wallDecorations.map((item) => [item.id, item])
        );
      if (payload.wallpapers)
        state.wallpapers = new Map(
          payload.wallpapers.map((wallpaper) => [wallpaper.key, wallpaper])
        );
      if (payload.eggs)
        state.eggs = new Map(payload.eggs.map((egg) => [egg.key, egg]));
      if (payload.consumables)
        state.consumables = new Map(
          payload.consumables.map((item) => [item.key, item])
        );
      if (payload.podDefinitions)
        state.podDefinitions = new Map(
          payload.podDefinitions.map((item) => [item.key, item])
        );
    }
    function hydrateSavedLab(payload, { preserveLocalLab = false } = {}) {
      if (!preserveLocalLab) state.lab = payload.lab;
      if (Array.isArray(payload.olings)) state.olings = payload.olings;
      state.expansion = payload.expansion || state.expansion;
      hydrateDefinitions(payload);
      hydrateInventory(payload, {
        wallpapers:
          state.ownedWallpapers instanceof Set
            ? [...state.ownedWallpapers]
            : [],
        wallpaperVariants:
          state.ownedWallpaperVariants instanceof Set
            ? [...state.ownedWallpaperVariants]
            : [],
        wallDecorations:
          state.ownedWallDecorations instanceof Map
            ? [...state.ownedWallDecorations]
            : [],
        eggs: state.ownedEggs,
        consumables: state.ownedConsumables,
        pods: state.ownedPods
      });
      syncAccountPayload(payload);
    }
    async function hydrateLoadedLab(payload) {
      const catalog = await loadFurnitureGridPlacements(payload.catalog || []);
      state.catalog = new Map(catalog.map((item) => [item.id, item]));
      hydrateDefinitions(payload);
      state.owned = new Set(
        (payload.inventory?.furniture || []).map((item) => item.key)
      );
      hydrateInventory(payload);
      state.lab = payload.lab;
      state.labOwner = payload.owner || null;
      state.labPrivacy = payload.privacy || state.labPrivacy;
      state.expansion = payload.expansion || null;
      syncAccountPayload(payload);
    }
    function hydratePlayerOlings(payload) {
      state.olings = Array.isArray(payload.olings) ? payload.olings : [];
      hydrateDefinitions(payload);
      hydrateInventory(payload, { pods: state.ownedPods });
      state.activeAdventure =
        payload.activeAdventure ||
        payload.account?.olings?.adventures?.active ||
        null;
      syncAccountPayload(payload);
    }
    function hydrateOlingStorageMutation(payload) {
      if (payload.oling) {
        const olingId = String(payload.oling._id || payload.oling.id || '');
        const index = state.olings.findIndex(
          (item) => String(item?._id || item?.id || '') === olingId
        );
        if (index === -1) state.olings.push(payload.oling);
        else state.olings[index] = payload.oling;
      }
      hydrateDefinitions(payload);
      hydrateInventory(payload, { pods: state.ownedPods });
      state.olingRoster = payload.roster || state.olingRoster;
      syncAccountPayload(payload);
    }
    return {
      hydrateSavedLab,
      hydrateLoadedLab,
      hydratePlayerOlings,
      hydrateOlingStorageMutation
    };
  }
  window.createOlingLabStateHydrator = createOlingLabStateHydrator;
})();

(function () {
  window.createOlingLabStartup = () => {
    const {
      constants,
      state,
      elements,
      getLabImageAssetUrl,
      setStatus,
      clearHatchTimer,
      clearRestTimer,
      clearAdventureTimer,
      parsePayload,
      getTargetKey,
      isTargetSelected,
      closeSelectedTarget,
      createSelectionTools,
      bindEvents
    } = window.createOlingLabRuntime();
    const {
      LAB_ENDPOINT,
      LAB_EXPANSION_ENDPOINT,
      MY_OLINGS_ENDPOINT,
      RARITY_PALETTE_ENDPOINT,
      FURNITURE_GRID_SIZE,
      DEFAULT_HATCH_DURATION_MS,
      OLING_REST_DURATION_MS,
      ROWS,
      OLING_ROAM_MIN_Y,
      OLING_ROAM_MAX_Y,
      OLING_ROAM_SPEED_MIN,
      OLING_ROAM_SPEED_MAX,
      OLING_REST_VISUAL_CONFIG,
      OLING_CONTAINER_THEMES,
      ITEM_INFLUENCE_SLOTS
    } = constants;

    let incubatorTools = null;
    let purchaseTools = null;
    let furnitureMenuTools = null;
    let rendererTools = null;
    let olingViews = null;
    let roaming = null;
    let explorerTools = null;

    const renderLab = (...args) => rendererTools?.renderLab(...args);
    const getRoaming = () => roaming;
    const getOlingViews = () => olingViews;
    const openPlacedItemMenu = (...args) =>
      furnitureMenuTools?.openPlacedItemMenu(...args);
    const createShelfStorageTab = (...args) =>
      furnitureMenuTools?.createShelfStorageTab(...args);
    const updateSelectedOlingPanel = (...args) =>
      furnitureMenuTools?.updateSelectedOlingPanel(...args);
    const syncAccountPayload = (...args) =>
      purchaseTools?.syncAccountPayload(...args);
    const openExplorerGateway = (...args) =>
      explorerTools?.openExplorerGateway(...args);
    const getIncubatorContext = (...args) =>
      incubatorTools?.getIncubatorContext(...args);
    const getIncubatorEggSlot = (...args) =>
      incubatorTools?.getIncubatorEggSlot(...args);
    const hatchEggFromIncubator = (...args) =>
      incubatorTools?.hatchEggFromIncubator(...args);
    const removeEggFromIncubator = (...args) =>
      incubatorTools?.removeEggFromIncubator(...args);
    const { toggleSelectedTarget, openFurnitureEditor } = createSelectionTools({
      renderLab,
      openPlacedItemMenu
    });

    const {
      getDisplayedLabColumns,
      clampCameraTarget,
      ensureCameraFrame,
      resetCameraIfNeeded,
      zoomLabAt,
      panLabBy
    } = window.createOlingLabCamera({
      state,
      elements,
      rows: ROWS,
      getRoaming
    });

    const {
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
    } = window.createOlingLabData({
      state,
      defaultHatchDurationMs: DEFAULT_HATCH_DURATION_MS
    });

    const {
      resolveMenuConfig,
      applyMenuConfig,
      applyActionPanelTheme,
      openSharedPopup,
      closeSharedPopup,
      openMenu,
      closeMenu
    } = window.createOlingLabMenuShell({
      state,
      elements,
      containerThemes: OLING_CONTAINER_THEMES,
      clearHatchTimer,
      clearRestTimer,
      clearAdventureTimer,
      closeSelectedTarget,
      getTargetKey,
      renderLab
    });

    const dataFlow = window.createOlingLabDataFlow({
      state,
      LAB_ENDPOINT,
      RARITY_PALETTE_ENDPOINT,
      MY_OLINGS_ENDPOINT,
      setStatus,
      parsePayload,
      renderLab,
      syncAccountPayload,
      getRoaming,
      loadFurnitureGridPlacements: (...args) =>
        furniturePlacementTools.loadFurnitureGridPlacements(...args)
    });
    const { saveLab, loadLab, loadRarityPalette, loadPlayerOlings } = dataFlow;

    const furniturePlacementTools = window.createOlingLabFurniturePlacement({
      state,
      rows: ROWS,
      furnitureGridSize: FURNITURE_GRID_SIZE,
      getLabImageAssetUrl,
      getItem,
      isPlaced,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab
    });
    const {
      getOccupiedMap,
      isLabCellUnlocked,
      getLabExpansionCell,
      canMoveRoomItem,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      getContainerItemsForSlot,
      placeRoomItem,
      moveRoomItem,
      placeContainerItem,
      storeRoomItem,
      storeContainerItem,
      createImage,
      getFurniturePlacement,
      createFurnitureArt,
      loadFurnitureGridPlacements
    } = furniturePlacementTools;

    const {
      createItemButton,
      createInlineAction,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
      formatOdds,
      formatInfluenceEffect,
      formatDuration,
      createTabMenu
    } = window.createOlingLabUi({
      createImage,
      applyRarityTheme,
      clearHatchTimer,
      clearAdventureTimer
    });

    const hatchControls = window.createOlingLabHatchControls({
      state,
      elements,
      clearHatchTimer,
      getIncubatorContext,
      getIncubatorEggSlot,
      getEgg,
      getHatchProgress,
      formatDuration,
      createInlineAction,
      hatchEggFromIncubator,
      removeEggFromIncubator
    });
    const {
      updateIncubatorCountdown,
      startIncubatorCountdown,
      createHatchEggAction,
      syncIncubatorHatchActions
    } = hatchControls;

    incubatorTools = window.createOlingLabIncubator({
      state,
      elements,
      itemInfluenceSlots: ITEM_INFLUENCE_SLOTS,
      labEndpoint: LAB_ENDPOINT,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      createImage,
      getEggImage,
      createItemButton,
      createInlineAction,
      createHatchEggAction,
      syncIncubatorHatchActions,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      createCompactDetailPair,
      formatTitle,
      formatOdds,
      formatInfluenceEffect,
      formatDuration,
      getHatchProgress,
      createTabMenu,
      openMenu,
      closeMenu,
      closeSelectedTarget,
      renderLab,
      saveLab
    });
    const {
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      openIncubatorMenu
    } = incubatorTools;

    const restAndInteractionTools = window.createOlingLabRestAndInteractionTools({
      state,
      elements,
      OLING_REST_DURATION_MS,
      setStatus,
      getRoaming,
      getOlingViews,
      getItem,
      getIncubatorContext,
      openIncubatorMenu,
      openExplorerGateway,
      openMenu,
      createEmptyMessage,
      createInlineAction,
      formatDuration,
      clearRestTimer,
      createShelfStorageTab,
      openPlacedItemMenu,
      closeSelectedTarget,
      renderLab
    });
    const {
      completeOlingBedJourney,
      beginOlingAdventure,
      interactWithFurniture,
      getFurnitureInteractionAction
    } = restAndInteractionTools;

    explorerTools = window.createOlingLabExplorerGateway({
      state,
      elements,
      getRoaming,
      getItem,
      getAdventureDoorPlacedId: restAndInteractionTools.getAdventureDoorPlacedId,
      closeSelectedTarget,
      setStatus,
      renderLab,
      openMenu,
      createImage,
      createDetailRow,
      createInlineAction,
      formatTitle,
      createTabMenu,
      clearAdventureTimer
    });

    purchaseTools = window.createOlingLabPurchases({
      state,
      elements,
      labExpansionEndpoint: LAB_EXPANSION_ENDPOINT,
      setStatus,
      parsePayload,
      getLabExpansionCell,
      createImage,
      openSharedPopup,
      closeSharedPopup,
      renderLab
    });
    const { openQuickSellDialog, openLabCellPurchaseDialog } = purchaseTools;

    furnitureMenuTools = window.createOlingLabFurnitureMenus({
      state,
      elements,
      rows: ROWS,
      furnitureGridSize: FURNITURE_GRID_SIZE,
      getRoaming,
      getOlingViews,
      getItem,
      isPlaced,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      getEggImage,
      createItemButton,
      createImage,
      createInlineAction,
      createStatsToggleButton,
      createPanelBackButton,
      createSquareMarker,
      createEmptyMessage,
      createConstrainedEmptyTab,
      createDetailRow,
      formatTitle,
      createTabMenu,
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      resolveMenuConfig,
      applyActionPanelTheme,
      openMenu,
      getTargetKey,
      closeSelectedTarget,
      openFurnitureEditor,
      interactWithFurniture,
      getFurnitureInteractionAction,
      getOccupiedMap,
      canMoveRoomItem,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      getContainerItemsForSlot,
      placeRoomItem,
      moveRoomItem,
      placeContainerItem,
      storeRoomItem,
      storeContainerItem,
      getFurniturePlacement,
      openQuickSellDialog,
      renderLab
    });

    rendererTools = window.createOlingLabRenderer({
      state,
      elements,
      rows: ROWS,
      getDisplayedLabColumns,
      getOccupiedMap,
      isLabCellUnlocked,
      getLabExpansionCell,
      getItem,
      isTargetSelected,
      toggleSelectedTarget,
      openLabCellPurchaseDialog,
      openSlotMenu: (...args) => furnitureMenuTools.openSlotMenu(...args),
      createActionPanel: (...args) =>
        furnitureMenuTools.createActionPanel(...args),
      getShelfInventoryItems: (...args) =>
        furnitureMenuTools.getShelfInventoryItems(...args),
      createFurnitureArt,
      createImage,
      getEgg,
      getEggImage,
      getRoaming,
      resetCameraIfNeeded
    });

    olingViews = window.OlingLabOlings.create({
      state,
      helpers: {
        closeMenu,
        createDetailRow,
        createImage,
        createInlineAction,
        createPanelBackButton,
        createStatsToggleButton,
        createTabMenu,
        applyRarityTheme,
        formatTitle,
        openMenu,
        closeStagePanel,
        openStagePanel,
        setPanelInteractivity,
        setStatus
      }
    });

    roaming = window.OlingLabRoaming.create({
      state,
      elements,
      helpers: {
        createOlingPreview: olingViews.createPreview,
        isTargetSelected,
        toggleSelectedTarget
      },
      callbacks: {
        onBedArrival: completeOlingBedJourney,
        onAdventureDeparture: beginOlingAdventure,
        updateSelectedOlingPanel
      },
      constants: {
        rows: ROWS,
        minYRatio: OLING_ROAM_MIN_Y,
        maxYRatio: OLING_ROAM_MAX_Y,
        minSpeed: OLING_ROAM_SPEED_MIN,
        maxSpeed: OLING_ROAM_SPEED_MAX,
        restVisuals: OLING_REST_VISUAL_CONFIG
      }
    });

    bindEvents({
      ensureCameraFrame,
      panLabBy,
      zoomLabAt,
      clampCameraTarget,
      closeMenu,
      renderLab
    });
    loadRarityPalette().finally(loadLab);
  };
})();

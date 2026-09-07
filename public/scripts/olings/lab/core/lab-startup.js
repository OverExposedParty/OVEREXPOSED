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
      HATCH_ENDPOINT,
      MY_OLINGS_ENDPOINT,
      OLING_STORAGE_ENDPOINT,
      RARITY_PALETTE_ENDPOINT,
      FURNITURE_GRID_SIZE,
      LAB_DRAG_HOLD_DELAY_MS,
      DEFAULT_WALLPAPER_KEY,
      DEFAULT_HATCH_DURATION_MS,
      EGG_PICKER_TRANSITION_MS,
      OLING_REST_DURATION_MS,
      ROWS,
      OLING_ROAM_MIN_Y,
      OLING_ROAM_MAX_Y,
      OLING_ROAM_SPEED_MIN,
      OLING_ROAM_SPEED_MAX,
      OLING_CARRY_FOLLOW_LAG_MS,
      OLING_RELEASE_GLIDE_CONFIG,
      OLING_REST_VISUAL_CONFIG,
      OLING_CONTAINER_THEMES
    } = constants;

    [...(elements.customiseCategoryButtons || [])].forEach((button) => {
      const category = button.dataset.olingLabCustomiseCategory;
      const theme = OLING_CONTAINER_THEMES[category];
      if (!theme) return;
      button.style?.setProperty(
        '--oling-lab-customise-primary-colour',
        theme.primaryColour
      );
      button.style?.setProperty(
        '--oling-lab-customise-secondary-colour',
        theme.secondaryColour
      );
    });
    const presentation = window.createOlingLabPresentation({
      state,
      constants
    });
    const privacyTools = window.createOlingLabPrivacySettings?.({
      state,
      elements,
      endpoint: constants.LAB_PRIVACY_ENDPOINT,
      parsePayload,
      setStatus
    }) || {
      cycleVisibility: async () => 'private',
      getVisibility: () => 'private',
      getVisibilityLabel: () => 'Private',
      isUpdating: () => false
    };
    const {
      canUseLabInteraction,
      shouldRenderOlings,
      syncCustomisePresentation
    } = presentation;

    let incubatorTools = null;
    let purchaseTools = null;
    let furnitureMenuTools = null;
    let rendererTools = null;
    let olingViews = null;
    let roaming = null;
    let explorerTools = null;
    let wallDecorationTools = null;
    let furniturePanelTools = null;

    const renderLab = (...args) => rendererTools?.renderLab(...args);
    const getRoaming = () => roaming;
    const getOlingViews = () => olingViews;
    const openFurnitureSlotsMenu = (...args) =>
      furnitureMenuTools?.openFurnitureSlotsMenu(...args);
    const openShelfStoragePanel = (...args) =>
      furnitureMenuTools?.openShelfStoragePanel(...args);
    const closeFurnitureSlotsPanel = (...args) =>
      furnitureMenuTools?.closeFurnitureSlotsPanel?.(...args);
    const updateSelectedOlingPanel = (...args) =>
      furnitureMenuTools?.updateSelectedOlingPanel(...args);
    const syncAccountPayload = (...args) =>
      purchaseTools?.syncAccountPayload(...args);
    const openExplorerGateway = (...args) =>
      explorerTools?.openExplorerGateway(...args);
    const closeGatewayPanel = (...args) =>
      explorerTools?.closeGatewayPanel(...args);
    const setFurnitureSaleTarget = (...args) =>
      purchaseTools?.setFurnitureSaleTarget(...args);
    const getIncubatorContext = (...args) =>
      incubatorTools?.getIncubatorContext(...args);
    const getIncubatorEggSlot = (...args) =>
      incubatorTools?.getIncubatorEggSlot(...args);
    const hatchEggFromIncubator = (...args) =>
      incubatorTools?.hatchEggFromIncubator(...args);
    const removeEggFromIncubator = (...args) =>
      incubatorTools?.removeEggFromIncubator(...args);
    const startHatchingStagedEgg = (...args) =>
      incubatorTools?.startHatchingStagedEgg(...args);
    const { toggleSelectedTarget } = createSelectionTools({
      renderLab,
      onCloseSelection: () => {
        olingViews?.closeOlingPanel?.({ sound: false, release: false });
        incubatorTools?.closeIncubatorPanel?.({
          sound: false,
          release: false
        });
      }
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
      OLING_STORAGE_ENDPOINT,
      setStatus,
      parsePayload,
      renderLab,
      syncAccountPayload,
      getRoaming,
      loadFurnitureGridPlacements: (...args) =>
        furniturePlacementTools.loadFurnitureGridPlacements(...args)
    });
    const {
      saveLab,
      loadLab,
      loadRarityPalette,
      loadPlayerOlings,
      storeOling,
      transferStoredOling,
      releaseOling
    } = dataFlow;

    const furniturePlacementTools = window.createOlingLabFurniturePlacement({
      state,
      rows: ROWS,
      furnitureGridSize: FURNITURE_GRID_SIZE,
      getLabImageAssetUrl,
      getItem,
      isPlaced,
      closeMenu,
      closeSelectedTarget,
      setStatus,
      renderLab,
      saveLab
    });
    const {
      getOccupiedMap,
      isLabCellUnlocked,
      getLabExpansionColumn,
      getAnchorRow,
      canPlaceRoomItem,
      canMoveRoomItem,
      getRoomItemSwap,
      getRoomPlacementBlockReason,
      getRoomItemsForSlot,
      getContainerItemsForSlot,
      placeRoomItem,
      moveRoomItem,
      swapRoomItems,
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

    const { applyWallpaper, openWallpaperMenu, closeWallpaperPanel } =
      window.createOlingLabWallpapers({
        state,
        elements,
        defaultWallpaperKey: DEFAULT_WALLPAPER_KEY,
        dragHoldDelay: LAB_DRAG_HOLD_DELAY_MS,
        wallpaperTheme: OLING_CONTAINER_THEMES['wall-style'],
        createItemButton,
        createInlineAction,
        createEmptyMessage,
        openMenu,
        closeMenu,
        renderLab,
        saveLab
      });

    wallDecorationTools = window.createOlingLabWallDecorations
      ? window.createOlingLabWallDecorations({
          state,
          elements,
          rows: ROWS,
          dragHoldDelay: 0,
          wallDecorationTheme: OLING_CONTAINER_THEMES['wall-decorations'],
          isLabCellUnlocked,
          createImage,
          createItemButton,
          createEmptyMessage,
          createInlineAction,
          openSharedPopup,
          closeSharedPopup,
          setStatus,
          renderLab,
          saveLab
        })
      : {
          openWallDecorationsMenu: () => {},
          closeWallDecorationsPanel: () => {},
          renderWallDecorations: () => document.createDocumentFragment()
        };
    const { openWallDecorationsMenu, closeWallDecorationsPanel } =
      wallDecorationTools;

    furniturePanelTools = window.createOlingLabFurniturePanel
      ? window.createOlingLabFurniturePanel({
          state,
          elements,
          rows: ROWS,
          dragHoldDelay: 0,
          furnitureTheme: OLING_CONTAINER_THEMES.furniture,
          getItem,
          isPlaced,
          getAnchorRow,
          canPlaceRoomItem,
          canMoveRoomItem,
          getOccupiedMap,
          getRoomItemSwap,
          placeRoomItem,
          moveRoomItem,
          swapRoomItems,
          storeRoomItem,
          createImage,
          createFurnitureArt,
          setStatus
        })
      : {
          openFurniturePanel: () => {},
          closeFurniturePanel: () => {},
          beginFurnitureDrag: () => {},
          consumeFurnitureDragClick: () => false,
          isFurnitureBeingDragged: () => false,
          syncFurnitureDragAfterRender: () => {},
          storeFurnitureFromCustomise: () => {}
        };
    const { openFurniturePanel, closeFurniturePanel } = furniturePanelTools;

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
      removeEggFromIncubator,
      startHatchingStagedEgg
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
      labEndpoint: LAB_ENDPOINT,
      hatchEndpoint: HATCH_ENDPOINT,
      eggPickerTransitionMs: EGG_PICKER_TRANSITION_MS,
      setStatus,
      startIncubatorCountdown,
      parsePayload,
      getItem,
      getEgg,
      getConsumable,
      applyRarityTheme,
      getAvailableEggQuantity,
      getAvailableConsumableQuantity,
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
      closeGatewayPanel,
      resolveMenuConfig,
      openMenu,
      closeMenu,
      closeSelectedTarget,
      getRoaming,
      getOlingViews,
      renderLab,
      saveLab
    });
    const {
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      openIncubatorMenu
    } = incubatorTools;

    const restAndInteractionTools =
      window.createOlingLabRestAndInteractionTools({
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
        closeMenu,
        resolveMenuConfig,
        createEmptyMessage,
        createInlineAction,
        formatDuration,
        clearRestTimer,
        openShelfStoragePanel,
        closeShelfStoragePanel: (options) =>
          furnitureMenuTools?.closeShelfStoragePanel?.(options),
        closeIncubatorPanel: (options) =>
          incubatorTools?.closeIncubatorPanel?.(options),
        closeGatewayPanel,
        openFurnitureSlotsMenu,
        closeFurnitureSlotsPanel,
        setFurnitureSaleTarget,
        closeSelectedTarget,
        renderLab
      });
    const {
      completeOlingBedJourney,
      wakeOlingFromCarry,
      beginOlingAdventure,
      closeRestPanel = () => {},
      interactWithFurniture,
      getFurnitureInteractionAction
    } = restAndInteractionTools;

    explorerTools = window.createOlingLabExplorerGateway({
      state,
      elements,
      getRoaming,
      getItem,
      getAdventureDoorPlacedId:
        restAndInteractionTools.getAdventureDoorPlacedId,
      closeSelectedTarget,
      setStatus,
      renderLab,
      openMenu,
      createImage,
      createDetailRow,
      createInlineAction,
      formatTitle,
      createTabMenu,
      clearAdventureTimer,
      closeMenu,
      resolveMenuConfig,
      getOlingViews,
      closeRestPanel,
      closeIncubatorPanel: (options) =>
        incubatorTools?.closeIncubatorPanel?.(options),
      closeShelfStoragePanel: (options) =>
        furnitureMenuTools?.closeShelfStoragePanel?.(options)
    });

    purchaseTools = window.createOlingLabPurchases({
      state,
      elements,
      labExpansionEndpoint: LAB_EXPANSION_ENDPOINT,
      setStatus,
      parsePayload,
      getLabExpansionColumn,
      createImage,
      openSharedPopup,
      closeSharedPopup,
      closeActiveFurniturePanels: () => {
        incubatorTools?.closeIncubatorPanel?.({ sound: false });
        restAndInteractionTools?.closeRestPanel?.({ sound: false });
        explorerTools?.closeGatewayPanel?.({ sound: false });
        furnitureMenuTools?.closeShelfStoragePanel?.({ sound: false });
        furnitureMenuTools?.closeFurnitureSlotsPanel?.({ sound: false });
        olingViews?.closeStoragePanel?.({ sound: false });
        closeMenu?.({ force: true });
        setFurnitureSaleTarget(null, null);
      },
      renderLab
    });
    const {
      getQuickSellPrices,
      getQuickSellQuote,
      openQuickSellDialog,
      openLabColumnPurchaseDialog
    } = purchaseTools;

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
      getAvailableConsumableQuantity,
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
      closeGatewayPanel,
      closeRestPanel,
      closeIncubatorPanel: (options) =>
        incubatorTools?.closeIncubatorPanel?.(options),
      setFurnitureSaleTarget,
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      resolveMenuConfig,
      applyActionPanelTheme,
      openMenu,
      getTargetKey,
      closeSelectedTarget,
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
      getQuickSellPrices,
      openQuickSellDialog,
      cycleLabVisibility: privacyTools.cycleVisibility,
      getLabVisibility: privacyTools.getVisibility,
      getLabVisibilityLabel: privacyTools.getVisibilityLabel,
      isLabPrivacyUpdating: privacyTools.isUpdating,
      renderLab
    });

    rendererTools = window.createOlingLabRenderer({
      state,
      elements,
      rows: ROWS,
      getDisplayedLabColumns,
      getOccupiedMap,
      isLabCellUnlocked,
      getLabExpansionColumn,
      getItem,
      isTargetSelected,
      toggleSelectedTarget,
      openLabColumnPurchaseDialog,
      createActionPanel: (...args) =>
        furnitureMenuTools.createActionPanel(...args),
      interactWithFurniture,
      getFurnitureInteractionAction,
      resolveMenuConfig,
      applyWallpaper,
      getShelfInventoryItems: (...args) =>
        furnitureMenuTools.getShelfInventoryItems(...args),
      getOlingViews,
      createFurnitureArt,
      createImage,
      getEgg,
      getEggImage,
      getRoaming,
      resetCameraIfNeeded,
      renderWallDecorations: () => wallDecorationTools.renderWallDecorations(),
      beginFurnitureDrag: (...args) =>
        furniturePanelTools.beginFurnitureDrag(...args),
      consumeFurnitureDragClick: (...args) =>
        furniturePanelTools.consumeFurnitureDragClick(...args),
      isFurnitureBeingDragged: (...args) =>
        furniturePanelTools.isFurnitureBeingDragged(...args),
      syncFurnitureDragAfterRender: (...args) =>
        furniturePanelTools.syncFurnitureDragAfterRender(...args),
      storeFurnitureFromCustomise: (...args) =>
        furniturePanelTools.storeFurnitureFromCustomise(...args),
      canUseLabInteraction,
      shouldRenderOlings
    });

    olingViews = window.OlingLabOlings.create({
      state,
      elements,
      helpers: {
        closeMenu,
        closeSelectedTarget,
        resolveMenuConfig,
        closeStoragePanel: (options) => {
          olingViews?.closeStoragePanel?.(options);
          furnitureMenuTools?.closeShelfStoragePanel?.(options);
        },
        closeRestPanel,
        closeGatewayPanel,
        closeShelfStoragePanel: (options) =>
          furnitureMenuTools?.closeShelfStoragePanel?.(options),
        createDetailRow,
        createEmptyMessage,
        createImage,
        createInlineAction,
        createPanelBackButton,
        createStatsToggleButton,
        createTabMenu,
        applyRarityTheme,
        formatTitle,
        openMenu,
        closeIncubatorPanel: (options) =>
          incubatorTools?.closeIncubatorPanel?.(options),
        closeStagePanel,
        openStagePanel,
        setPanelInteractivity,
        setStatus,
        storeOling,
        transferStoredOling,
        releaseOling,
        getRoaming,
        renderLab,
        openSharedPopup,
        closeSharedPopup
      }
    });

    roaming = window.OlingLabRoaming.create({
      state,
      elements,
      helpers: {
        createOlingPreview: olingViews.createPreview,
        closeSelectedTarget,
        isTargetSelected,
        toggleSelectedTarget,
        openOlingMenu: (id) => olingViews.openOlingMenu(id),
        resolveMenuConfig,
        canUseLabInteraction,
        shouldRenderOlings
      },
      callbacks: {
        onBedArrival: completeOlingBedJourney,
        onCarryWake: wakeOlingFromCarry,
        onAdventureDeparture: beginOlingAdventure,
        onOlingDragMove: (oling, event) =>
          olingViews?.updateOlingPodDropTarget?.(oling, event),
        getOlingStorageDropTarget: (oling, event) =>
          olingViews?.getOlingStorageDropTarget?.(oling, event),
        onOlingStorageDrop: (oling, target) =>
          olingViews?.captureDraggedOling?.(oling, target),
        onOlingDragEnd: () => olingViews?.clearOlingPodDropTarget?.(),
        updateSelectedOlingPanel
      },
      constants: {
        rows: ROWS,
        dragHoldDelayMs: LAB_DRAG_HOLD_DELAY_MS,
        minYRatio: OLING_ROAM_MIN_Y,
        maxYRatio: OLING_ROAM_MAX_Y,
        minSpeed: OLING_ROAM_SPEED_MIN,
        maxSpeed: OLING_ROAM_SPEED_MAX,
        carryFollowLagMs: OLING_CARRY_FOLLOW_LAG_MS,
        releaseGlide: OLING_RELEASE_GLIDE_CONFIG,
        restVisuals: OLING_REST_VISUAL_CONFIG
      }
    });

    bindEvents({
      ensureCameraFrame,
      panLabBy,
      zoomLabAt,
      clampCameraTarget,
      closeMenu,
      openWallpaperMenu,
      closeWallpaperPanel,
      openWallDecorationsMenu,
      closeWallDecorationsPanel,
      openFurniturePanel,
      closeFurniturePanel,
      closeFurnitureDetailPanel: (options) =>
        furnitureMenuTools?.closeFurnitureSlotsPanel?.(options),
      closeStoragePanel: (options) => {
        olingViews?.closeStoragePanel?.(options);
        furnitureMenuTools?.closeShelfStoragePanel?.(options);
      },
      closeRestPanel,
      closeGatewayPanel,
      closeIncubatorPanel: (options) =>
        incubatorTools?.closeIncubatorPanel?.(options),
      canUseLabInteraction,
      onCustomiseModeChange: () => {
        syncCustomisePresentation();
        if (!shouldRenderOlings()) roaming?.cancelActiveInteractions();
      },
      renderLab
    });
    window.addEventListener('oling-lab:tutorial-close-menu', () => {
      closeMenu({ force: true });
      renderLab();
    });
    window.addEventListener('oling-lab:tutorial-exit-edit-mode', () => {
      if (!state.editMode) return;
      state.editMode = false;
      state.customiseCategory = null;
      closeWallpaperPanel();
      closeWallDecorationsPanel();
      closeFurniturePanel();
      olingViews?.closeStoragePanel?.();
      furnitureMenuTools?.closeShelfStoragePanel?.();
      incubatorTools?.closeIncubatorPanel?.();
      closeRestPanel();
      closeGatewayPanel();
      syncCustomisePresentation();
      closeSelectedTarget();
      renderLab();
    });
    loadRarityPalette().finally(loadLab);
  };
})();

(function () {
  function bindOlingLabEvents({
    state,
    elements,
    closeSelectedTarget,
    ensureCameraFrame,
    panLabBy,
    zoomLabAt,
    clampCameraTarget,
    closeMenu,
    openWallpaperMenu,
    closeWallpaperPanel = () => {},
    openWallDecorationsMenu,
    closeWallDecorationsPanel = () => {},
    openFurniturePanel = () => {},
    closeFurniturePanel = () => {},
    closeFurnitureDetailPanel = () => {},
    closeStoragePanel = () => {},
    closeIncubatorPanel = () => {},
    closeRestPanel = () => {},
    closeGatewayPanel = () => {},
    onCustomiseModeChange = () => {},
    canUseLabInteraction = () => true,
    renderLab
  }) {
    ensureCameraFrame();
    let customisePanelRequestId = 0;
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };

    function requestCustomisePanel(category) {
      const requestId = (customisePanelRequestId += 1);
      const closeOptions = { sound: !category };
      const closingPanels = [
        closeStoragePanel(closeOptions),
        closeWallpaperPanel(closeOptions),
        closeWallDecorationsPanel(closeOptions),
        closeFurniturePanel(closeOptions),
        closeFurnitureDetailPanel(closeOptions),
        closeIncubatorPanel(closeOptions),
        closeRestPanel(closeOptions),
        closeGatewayPanel(closeOptions)
      ].filter((result) => typeof result?.then === 'function');
      const openRequestedPanel = () => {
        if (
          requestId !== customisePanelRequestId ||
          !state.editMode ||
          state.customiseCategory !== category
        ) {
          return;
        }
        if (category === 'wall-style') openWallpaperMenu();
        else if (category === 'wall-decorations') openWallDecorationsMenu();
        else if (category === 'furniture') openFurniturePanel();
      };
      if (closingPanels.length) {
        Promise.allSettled(closingPanels).then(openRequestedPanel);
      } else {
        openRequestedPanel();
      }
    }

    elements.editToggle.addEventListener('click', () => {
      state.editMode = !state.editMode;
      state.customiseCategory = state.editMode ? 'furniture' : null;
      closeMenu({ force: true });
      requestCustomisePanel(state.customiseCategory);
      closeSelectedTarget();
      onCustomiseModeChange();
      renderLab();
      window.dispatchEvent(
        new CustomEvent('oling-lab:tutorial-edit-mode', {
          detail: { enabled: state.editMode }
        })
      );
    });
    [...(elements.customiseCategoryButtons || [])].forEach((button) => {
      button.addEventListener('click', () => {
        if (!state.editMode) return;
        const category = button.dataset.olingLabCustomiseCategory;
        if (
          !['wall-style', 'wall-decorations', 'furniture'].includes(category)
        ) {
          return;
        }
        const selectedPanelIsOpen =
          (category === 'wall-style' &&
            state.wallStylePanelOpen &&
            !state.wallStylePanelCollapsed) ||
          (category === 'wall-decorations' &&
            state.wallDecorationPanelOpen &&
            !state.wallDecorationPanelCollapsed) ||
          (category === 'furniture' &&
            state.furniturePanelOpen &&
            !state.furniturePanelCollapsed);
        if (state.customiseCategory === category && selectedPanelIsOpen) return;
        state.customiseCategory = category;
        closeSelectedTarget();
        onCustomiseModeChange();
        closeMenu({ force: true });
        requestCustomisePanel(category);
        renderLab();
      });
    });
    const tutorialPan = () =>
      window.dispatchEvent(new CustomEvent('oling-lab:tutorial-pan'));
    elements.scrollLeft.addEventListener('click', () => {
      panLabBy(420, 0);
      tutorialPan();
    });
    elements.scrollRight.addEventListener('click', () => {
      panLabBy(-420, 0);
      tutorialPan();
    });
    elements.viewport.addEventListener('pointerdown', (event) => {
      if (
        !canUseLabInteraction('camera') ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button > 1) ||
        event.target.closest('.oling-lab-roamer')
      )
        return;
      Object.assign(state.camera, {
        dragging: true,
        dragMoved: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY
      });
    });
    elements.viewport.addEventListener('pointermove', (event) => {
      if (!state.camera.dragging || event.pointerId !== state.camera.pointerId)
        return;
      if (
        !state.camera.dragMoved &&
        Math.hypot(
          event.clientX - state.camera.startX,
          event.clientY - state.camera.startY
        ) < 5
      )
        return;
      state.camera.dragMoved = true;
      elements.viewport.setPointerCapture?.(event.pointerId);
      elements.viewport.classList.add('is-panning');
      panLabBy(
        event.clientX - state.camera.lastX,
        event.clientY - state.camera.lastY
      );
      state.camera.lastX = event.clientX;
      state.camera.lastY = event.clientY;
      event.preventDefault();
    });
    const finishCameraDrag = (event) => {
      if (!state.camera.dragging || event.pointerId !== state.camera.pointerId)
        return;
      const didPan = state.camera.dragMoved;
      state.camera.dragging = false;
      state.camera.pointerId = null;
      elements.viewport.classList.remove('is-panning');
      if (didPan) tutorialPan();
    };
    elements.viewport.addEventListener('pointerup', finishCameraDrag);
    elements.viewport.addEventListener('pointercancel', finishCameraDrag);
    elements.viewport.addEventListener(
      'click',
      (event) => {
        if (!state.camera.dragMoved) return;
        state.camera.dragMoved = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );
    elements.viewport.addEventListener(
      'wheel',
      (event) => {
        if (!canUseLabInteraction('camera')) return;
        event.preventDefault();
        zoomLabAt(
          event.clientX,
          event.clientY,
          state.camera.targetScale * Math.exp(-event.deltaY * 0.0015)
        );
      },
      { passive: false }
    );
    elements.viewport.addEventListener('contextmenu', (event) => {
      if (state.camera.dragging) event.preventDefault();
    });
    window.addEventListener('resize', clampCameraTarget);
    if (elements.menuClose)
      elements.menuClose.addEventListener('click', closeMenu);
    elements.room.addEventListener('click', (event) => {
      if (
        !event.target.closest('.oling-lab-item') &&
        !event.target.closest('.oling-lab-roamer') &&
        !event.target.closest('.oling-lab-action-panel')
      ) {
        const hadSelection = Boolean(state.selectedTarget);
        const selectedSidePanelWasOpen =
          Boolean(state.olingPanelOpen) || Boolean(state.incubatorPanelOpen);
        closeSelectedTarget();
        renderLab();
        if (hadSelection) {
          playSound(
            selectedSidePanelWasOpen ? 'sidePanelClose' : 'containerClose'
          );
        }
      }
    });
    elements.backdrop.addEventListener('click', (event) => {
      if (event.target !== elements.backdrop) return;
      closeMenu();
    });
    elements.menu?.addEventListener('click', (event) =>
      event.stopPropagation()
    );
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const hadSelection = Boolean(state.selectedTarget);
      const selectedSidePanelWasOpen =
        Boolean(state.olingPanelOpen) || Boolean(state.incubatorPanelOpen);
      const transitionOwnsCloseSound =
        !elements.backdrop.hidden ||
        Boolean(state.storagePanelOpen) ||
        Boolean(state.supplyStoragePanelOpen) ||
        Boolean(state.wallStylePanelOpen) ||
        Boolean(state.incubatorPanelOpen) ||
        Boolean(state.restPanelOpen) ||
        Boolean(state.gatewayPanelOpen) ||
        Boolean(state.furnitureDetailPanelOpen) ||
        selectedSidePanelWasOpen;
      closeSelectedTarget();
      closeMenu();
      closeStoragePanel();
      closeWallpaperPanel();
      closeIncubatorPanel();
      closeRestPanel();
      closeGatewayPanel();
      closeFurnitureDetailPanel();
      renderLab();
      if (hadSelection) {
        if (selectedSidePanelWasOpen) playSound('sidePanelClose');
        else if (!transitionOwnsCloseSound) playSound('containerClose');
      }
    });
  }
  window.bindOlingLabEvents = bindOlingLabEvents;
})();

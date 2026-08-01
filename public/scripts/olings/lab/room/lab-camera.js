(function () {
  function createOlingLabCamera({ state, elements, rows, getRoaming }) {
    function getBaseLabCellSize() {
      const viewportHeight = Number(elements.viewport?.clientHeight || 0);
      const viewportWidth = Number(
        elements.viewport?.clientWidth || window.innerWidth || 0
      );
      const viewportConstrainedCell = viewportHeight / rows;
      const widthConstrainedCell = window.matchMedia('(min-width: 1180px)')
        .matches
        ? 512
        : viewportWidth *
          (window.matchMedia('(max-width: 760px)').matches ? 0.72 : 0.42);
      const cell = Math.min(512, widthConstrainedCell, viewportConstrainedCell);
      return Number.isFinite(cell) && cell > 0 ? cell : 0;
    }

    function getDisplayedLabColumns() {
      const expansionCellColumns = Array.isArray(state.expansion?.cells)
        ? state.expansion.cells.reduce(
            (maximum, cell) => Math.max(maximum, Number(cell?.col) + 1 || 0),
            0
          )
        : 0;
      return Math.max(
        Number(state.lab?.columns) || 1,
        Number(state.expansion?.maximumColumns) || 0,
        Number(state.expansion?.visibleColumns) || 0,
        expansionCellColumns
      );
    }

    function getScrollableLabColumns() {
      return Math.max(
        Number(state.lab?.columns) || 1,
        Number(state.expansion?.visibleColumns) || 0
      );
    }

    function getCameraBounds() {
      const viewportWidth = Number(elements.viewport?.clientWidth || 0);
      const viewportHeight = Number(elements.viewport?.clientHeight || 0);
      const cell = getBaseLabCellSize();
      const scale = state.camera.targetScale;
      const scaledCell = cell * scale;
      const scaledWidth = Math.max(
        scaledCell,
        getScrollableLabColumns() * scaledCell
      );
      const scaledHeight = scaledCell * rows;
      const minX =
        scaledWidth <= viewportWidth
          ? (viewportWidth - scaledWidth) / 2
          : viewportWidth - scaledWidth;
      const maxX = scaledWidth <= viewportWidth ? minX : 0;
      const minY =
        scaledHeight <= viewportHeight
          ? (viewportHeight - scaledHeight) / 2
          : viewportHeight - scaledHeight;
      const maxY = scaledHeight <= viewportHeight ? minY : 0;

      return {
        minX,
        maxX,
        minY,
        maxY
      };
    }

    function getMinimumCameraScale() {
      return 1;
    }

    function clampCameraScale(scale) {
      return Math.max(getMinimumCameraScale(), Math.min(3, Number(scale) || 1));
    }

    function clampCameraTarget() {
      state.camera.targetScale = clampCameraScale(state.camera.targetScale);
      const bounds = getCameraBounds();
      state.camera.targetX = Math.min(
        Math.max(state.camera.targetX, bounds.minX),
        bounds.maxX
      );
      state.camera.targetY = Math.min(
        Math.max(state.camera.targetY, bounds.minY),
        bounds.maxY
      );
    }

    function applyCameraTransform() {
      const cell = getBaseLabCellSize() * state.camera.scale;
      if (cell > 0) {
        elements.room.style.setProperty('--oling-lab-cell', `${cell}px`);
      }
      elements.room.style.transform = `translate3d(${state.camera.x}px, ${state.camera.y}px, 0)`;
      getRoaming()?.syncRoamStatesToRoomMetrics?.();
    }

    function tickCamera() {
      state.camera.x += (state.camera.targetX - state.camera.x) * 0.18;
      state.camera.y += (state.camera.targetY - state.camera.y) * 0.18;
      state.camera.scale +=
        (state.camera.targetScale - state.camera.scale) * 0.18;
      applyCameraTransform();
      state.camera.frame = window.requestAnimationFrame(tickCamera);
    }

    function ensureCameraFrame() {
      if (state.camera.frame) return;
      state.camera.frame = window.requestAnimationFrame(tickCamera);
    }

    function resetCameraIfNeeded() {
      const bounds = getCameraBounds();
      if (state.camera.initialized) {
        clampCameraTarget();
        return;
      }
      state.camera.x = bounds.maxX;
      state.camera.y = bounds.maxY;
      state.camera.targetX = bounds.maxX;
      state.camera.targetY = bounds.maxY;
      state.camera.initialized = true;
      applyCameraTransform();
    }

    function screenToLabWorld(clientX, clientY) {
      const rect = elements.viewport.getBoundingClientRect();
      return {
        x:
          (clientX - rect.left - state.camera.targetX) /
          state.camera.targetScale,
        y:
          (clientY - rect.top - state.camera.targetY) / state.camera.targetScale
      };
    }

    function zoomLabAt(clientX, clientY, scale) {
      const before = screenToLabWorld(clientX, clientY);
      state.camera.targetScale = clampCameraScale(scale);
      const rect = elements.viewport.getBoundingClientRect();
      state.camera.targetX =
        clientX - rect.left - before.x * state.camera.targetScale;
      state.camera.targetY =
        clientY - rect.top - before.y * state.camera.targetScale;
      clampCameraTarget();
    }

    function panLabBy(deltaX, deltaY) {
      state.camera.targetX += deltaX;
      state.camera.targetY += deltaY;
      clampCameraTarget();
    }

    return {
      getBaseLabCellSize,
      getDisplayedLabColumns,
      getScrollableLabColumns,
      getCameraBounds,
      getMinimumCameraScale,
      clampCameraScale,
      clampCameraTarget,
      applyCameraTransform,
      tickCamera,
      ensureCameraFrame,
      resetCameraIfNeeded,
      screenToLabWorld,
      zoomLabAt,
      panLabBy
    };
  }

  window.createOlingLabCamera = createOlingLabCamera;
})();

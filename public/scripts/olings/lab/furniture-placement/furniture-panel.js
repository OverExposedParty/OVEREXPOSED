(function () {
  function createOlingLabFurniturePanel({
    state,
    elements,
    rows,
    dragHoldDelay = 220,
    furnitureTheme = {},
    getItem,
    isPlaced,
    getAnchorRow,
    canPlaceRoomItem,
    canMoveRoomItem,
    getOccupiedMap = () => new Map(),
    getRoomItemSwap = () => null,
    placeRoomItem,
    moveRoomItem,
    swapRoomItems = () => false,
    storeRoomItem,
    createImage,
    createFurnitureArt,
    setStatus
  }) {
    let drag = null;
    let pendingDrag = null;
    let suppressInventoryClick = false;
    let panelTransitionId = 0;
    const suppressedPlacedClicks = new Set();
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    const panelTransitions = window.OlingLabPanelTransitions;

    if (furnitureTheme.primaryColour) {
      elements.furniturePanel?.style.setProperty(
        '--wall-decoration-panel-primary',
        furnitureTheme.primaryColour
      );
      elements.room?.style.setProperty(
        '--furniture-primary-colour',
        furnitureTheme.primaryColour
      );
    }
    if (furnitureTheme.secondaryColour) {
      elements.furniturePanel?.style.setProperty(
        '--wall-decoration-panel-secondary',
        furnitureTheme.secondaryColour
      );
      elements.room?.style.setProperty(
        '--furniture-secondary-colour',
        furnitureTheme.secondaryColour
      );
    }

    function getFurnitureItems() {
      return [...state.owned]
        .map(getItem)
        .filter((item) => item?.layer === 'room' && !item.locked);
    }

    function setPanelCollapsed(collapsed, options = {}) {
      const wasCollapsed = Boolean(state.furniturePanelCollapsed);
      state.furniturePanelCollapsed = Boolean(collapsed);
      elements.furniturePanel?.classList.toggle(
        'is-collapsed',
        state.furniturePanelCollapsed
      );
      elements.furniturePanelToggle?.setAttribute(
        'aria-expanded',
        String(!state.furniturePanelCollapsed)
      );
      if (elements.furniturePanelToggle) {
        elements.furniturePanelToggle.dataset.sound = 'none';
        delete elements.furniturePanelToggle.dataset.soundIntent;
        elements.furniturePanelToggle.textContent =
          state.furniturePanelCollapsed ? 'Show' : 'Hide';
        elements.furniturePanelToggle.setAttribute(
          'aria-label',
          state.furniturePanelCollapsed
            ? 'Show furniture panel'
            : 'Hide furniture panel'
        );
      }
      if (
        wasCollapsed !== state.furniturePanelCollapsed &&
        state.furniturePanelOpen &&
        options.sound !== false
      ) {
        playSound(
          state.furniturePanelCollapsed ? 'sidePanelClose' : 'sidePanelOpen'
        );
      }
    }

    function openFurniturePanel() {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.furniturePanel;
      const wasOpen = Boolean(
        state.furniturePanelOpen &&
        panel &&
        !panel.hidden &&
        panel.classList.contains('is-open') &&
        !state.furniturePanelCollapsed
      );
      state.furniturePanelOpen = true;
      state.furniturePanelCollapsed = false;
      if (panel) {
        panel.hidden = false;
        panel.classList.remove('is-open', 'is-collapsed');
      }
      setPanelCollapsed(false, { sound: false });
      renderPanelInventory();
      if (!panel) return;
      panel.getBoundingClientRect();
      const showPanel = () => {
        if (transitionId !== panelTransitionId || !state.furniturePanelOpen)
          return;
        panel.classList.add('is-open');
        if (!wasOpen) playSound('sidePanelOpen');
      };
      const reducedMotion = Boolean(
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      );
      if (reducedMotion || typeof window.requestAnimationFrame !== 'function') {
        showPanel();
      } else {
        window.requestAnimationFrame(showPanel);
      }
    }

    function closeFurniturePanel(options = {}) {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.furniturePanel;
      const wasVisible = Boolean(
        state.furniturePanelOpen && panel && !panel.hidden
      );
      state.furniturePanelOpen = false;
      cancelDrag();
      if (!panel) return undefined;
      panel.classList.remove('is-drop-target');
      const playCloseSound = () => {
        if (wasVisible && options.sound !== false) playSound('sidePanelClose');
      };
      const finishClose = () => {
        if (transitionId === panelTransitionId && !state.furniturePanelOpen) {
          panel.hidden = true;
        }
      };
      if (panelTransitions) {
        return panelTransitions.close(panel, {
          beforeExit: playCloseSound,
          afterClose: finishClose
        });
      }
      panel.classList.remove('is-open', 'is-collapsed');
      playCloseSound();
      const reducedMotion = Boolean(
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      );
      if (!wasVisible || reducedMotion || !window.setTimeout) {
        finishClose();
        return undefined;
      }
      return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          panel.removeEventListener('transitionend', onTransitionEnd);
          finishClose();
          resolve();
        };
        const onTransitionEnd = (event) => {
          if (event.target === panel && event.propertyName === 'transform') {
            finish();
          }
        };
        panel.addEventListener('transitionend', onTransitionEnd);
        window.setTimeout(finish, 220);
      });
    }

    function placeFromKeyboard(item) {
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < state.lab.columns; col += 1) {
          if (!canPlaceRoomItem(item, row, col)) continue;
          placeRoomItem(item.id, row, col);
          renderPanelInventory();
          return;
        }
      }
      setStatus('No free furniture space for that item');
      playSound('uiError');
    }

    function createInventoryCard(item) {
      const card = document.createElement('button');
      const placed = isPlaced(item.id);
      card.className =
        'oling-lab-wall-decoration-card oling-lab-furniture-card';
      card.type = 'button';
      card.disabled = placed;
      card.dataset.olingLabFurnitureInventoryId = item.id;
      card.appendChild(createImage(item.image, item.name));
      const copy = document.createElement('span');
      copy.className =
        'oling-lab-wall-decoration-card-copy oling-lab-furniture-card-copy';
      const name = Object.assign(document.createElement('strong'), {
        textContent: item.name,
        title: item.name
      });
      const nameLength = String(item.name || '').trim().length;
      name.classList.toggle('is-long-name', nameLength > 18);
      name.classList.toggle('is-very-long-name', nameLength > 28);
      copy.append(
        name,
        Object.assign(document.createElement('span'), {
          textContent: placed ? 'Placed' : 'Available'
        })
      );
      card.appendChild(copy);
      card.addEventListener('pointerdown', (event) => {
        if (!card.disabled) beginInventoryDrag(event, item, card);
      });
      card.addEventListener('click', (event) => {
        if (suppressInventoryClick) {
          suppressInventoryClick = false;
          event.preventDefault();
          return;
        }
        if (event.detail === 0 && !card.disabled) placeFromKeyboard(item);
      });
      return card;
    }

    function renderPanelInventory() {
      if (!elements.furniturePanelInventory) return;
      const cards = getFurnitureItems().map(createInventoryCard);
      elements.furniturePanelInventory.replaceChildren(
        ...(cards.length
          ? cards
          : [
              Object.assign(document.createElement('p'), {
                className:
                  'oling-lab-wall-decoration-panel-empty oling-lab-furniture-panel-empty',
                textContent: 'You do not own any furniture yet.'
              })
            ])
      );
    }

    function getRoomPoint(event) {
      const firstCell = elements.room?.querySelector('.oling-lab-cell');
      const bounds = firstCell?.getBoundingClientRect();
      if (!bounds?.width || !bounds?.height) return null;
      return {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
        cellWidth: bounds.width,
        cellHeight: bounds.height
      };
    }

    function isPointerOverPanel(event) {
      if (
        !elements.furniturePanel ||
        !state.furniturePanelOpen ||
        state.furniturePanelCollapsed
      )
        return false;
      const bounds = elements.furniturePanel.getBoundingClientRect();
      return (
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
    }

    function setPanelDropTarget(active) {
      elements.furniturePanel?.classList.toggle(
        'is-drop-target',
        Boolean(active)
      );
    }

    function getCandidate(event, current) {
      const point = getRoomPoint(event);
      const overLab = Boolean(
        point &&
        point.x >= 0 &&
        point.y >= 0 &&
        point.x < state.lab.columns &&
        point.y < rows
      );
      if (!overLab) return { point, overLab, row: null, col: null };
      const rawRow = Math.floor(point.y) - current.grabRowOffset;
      const col = Math.floor(point.x) - current.grabColOffset;
      return {
        point,
        overLab,
        row: getAnchorRow(current.item, rawRow),
        col
      };
    }

    function createFloatingGhost(item) {
      const ghost = document.createElement('div');
      ghost.className = 'oling-lab-furniture-drag-ghost';
      ghost.appendChild(createFurnitureArt(item));
      return ghost;
    }

    function createSnappedPreview(item) {
      const preview = document.createElement('div');
      preview.className = 'oling-lab-item oling-lab-furniture-drag-preview';
      preview.appendChild(createFurnitureArt(item));
      return preview;
    }

    function clearTargetCells() {
      elements.room
        ?.querySelectorAll('.oling-lab-cell.is-furniture-drag-target')
        .forEach((cell) => cell.classList.remove('is-furniture-drag-target'));
    }

    function getPlacedElement(placedId) {
      return [
        ...(elements.room?.querySelectorAll(
          '.oling-lab-item[data-oling-lab-placed-id]'
        ) || [])
      ].find(
        (element) => element.dataset.olingLabPlacedId === String(placedId)
      );
    }

    function clearSwapPreview(current = drag) {
      current?.swapPreview?.remove();
      current?.swapTargetElement?.classList.remove('is-furniture-swap-target');
      if (!current) return;
      current.swapPreview = null;
      current.swapPreviewPlacedId = null;
      current.swapTargetElement = null;
    }

    function clearSnappedPreview(current = drag) {
      current?.preview?.remove();
      clearSwapPreview(current);
      clearTargetCells();
    }

    function markTargetCells(row, col, item) {
      const height = Number(item.height || 1);
      const width = Number(item.width || 1);
      for (let cellRow = row; cellRow < row + height; cellRow += 1) {
        for (let cellCol = col; cellCol < col + width; cellCol += 1) {
          const cell = elements.room.querySelector(
            `.oling-lab-cell[data-oling-lab-row="${cellRow}"][data-oling-lab-col="${cellCol}"]`
          );
          cell?.classList.add('is-furniture-drag-target');
        }
      }
    }

    function showSwapPreview(current) {
      const target = current.swap?.target;
      const placement = current.swap?.second;
      const targetItem = getItem(target?.itemId);
      if (!target || !placement || !targetItem) {
        clearSwapPreview(current);
        return;
      }

      if (current.swapPreviewPlacedId !== target.placedId) {
        clearSwapPreview(current);
        current.swapPreview = createSnappedPreview(targetItem);
        current.swapPreview.classList.add('is-furniture-swap-preview');
        current.swapPreviewPlacedId = target.placedId;
        current.swapTargetElement = getPlacedElement(target.placedId);
        current.swapTargetElement?.classList.add('is-furniture-swap-target');
      }

      current.swapPreview.style.setProperty('--item-row', placement.row);
      current.swapPreview.style.setProperty('--item-col', placement.col);
      current.swapPreview.style.setProperty('--item-width', targetItem.width);
      current.swapPreview.style.setProperty('--item-height', targetItem.height);
      if (!current.swapPreview.isConnected)
        elements.room.appendChild(current.swapPreview);
      markTargetCells(placement.row, placement.col, targetItem);
    }

    function showSnappedPreview(current) {
      const { item, row, col, preview } = current;
      preview.style.setProperty('--item-row', row);
      preview.style.setProperty('--item-col', col);
      preview.style.setProperty('--item-width', item.width);
      preview.style.setProperty('--item-height', item.height);
      if (!preview.isConnected) elements.room.appendChild(preview);
      clearTargetCells();
      markTargetCells(row, col, item);
      if (current.swap) showSwapPreview(current);
      else clearSwapPreview(current);
    }

    function getSwapCandidate(current, point) {
      if (current.sourceType !== 'placed' || !point) return null;
      const target = getOccupiedMap().get(
        `${Math.floor(point.y)}:${Math.floor(point.x)}`
      );
      if (!target || target.placedId === current.placed.placedId) return null;
      const positions = getRoomItemSwap(current.placed, target);
      return positions ? { ...positions, target } : null;
    }

    function updateFloatingGhost(current, event, point) {
      const cellWidth = point?.cellWidth || 120;
      const cellHeight = point?.cellHeight || 120;
      current.ghost.style.left = `${event.clientX}px`;
      current.ghost.style.top = `${event.clientY}px`;
      current.ghost.style.width = `${Math.max(48, cellWidth * current.item.width)}px`;
      current.ghost.style.height = `${Math.max(48, cellHeight * current.item.height)}px`;
      current.ghost.classList.toggle(
        'is-snapped',
        current.valid && current.overLab
      );
      current.ghost.classList.toggle(
        'is-invalid',
        current.overLab && !current.valid
      );
      current.ghost.classList.toggle('is-over-storage', current.overPanel);
      if (!current.ghost.isConnected) document.body.appendChild(current.ghost);
    }

    function updateDrag(event) {
      if (!drag) return;
      drag.moved ||=
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >
        5;
      drag.overPanel =
        drag.sourceType === 'placed' && isPointerOverPanel(event);
      const candidate = getCandidate(event, drag);
      drag.overLab = !drag.overPanel && candidate.overLab;
      drag.swap = drag.overLab ? getSwapCandidate(drag, candidate.point) : null;
      drag.row = drag.swap?.first.row ?? candidate.row;
      drag.col = drag.swap?.first.col ?? candidate.col;
      drag.valid = Boolean(
        drag.overLab &&
        (drag.swap ||
          (drag.sourceType === 'placed'
            ? canMoveRoomItem(
                drag.placed,
                drag.item,
                candidate.row,
                candidate.col
              )
            : canPlaceRoomItem(drag.item, candidate.row, candidate.col)))
      );
      setPanelDropTarget(drag.overPanel);
      if (drag.valid) showSnappedPreview(drag);
      else clearSnappedPreview(drag);
      updateFloatingGhost(drag, event, candidate.point);
    }

    function startInventoryDrag(event, item, source) {
      if (
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        drag
      )
        return;
      drag = {
        sourceType: 'inventory',
        pointerId: event.pointerId,
        item,
        source,
        ghost: createFloatingGhost(item),
        preview: createSnappedPreview(item),
        grabRowOffset: 0,
        grabColOffset: 0,
        valid: false,
        overLab: false,
        overPanel: true,
        moved: false,
        startX: event.dragStartX ?? event.clientX,
        startY: event.dragStartY ?? event.clientY
      };
      source.setPointerCapture?.(event.pointerId);
      source.classList.add('is-drag-source');
      playSound('uiDragPickup');
      updateDrag(event);
      event.preventDefault();
      event.stopPropagation();
    }

    function startFurnitureDrag(event, placed, element) {
      if (
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !state.editMode ||
        state.customiseCategory !== 'furniture' ||
        placed.locked ||
        drag
      )
        return;
      const item = getItem(placed.itemId);
      const point = getRoomPoint({
        clientX: event.dragOriginClientX ?? event.clientX,
        clientY: event.dragOriginClientY ?? event.clientY
      });
      if (!item || !point) return;
      drag = {
        sourceType: 'placed',
        pointerId: event.pointerId,
        item,
        placed: { ...placed },
        element,
        ghost: createFloatingGhost(item),
        preview: createSnappedPreview(item),
        grabRowOffset: Math.max(0, Math.floor(point.y) - placed.row),
        grabColOffset: Math.max(0, Math.floor(point.x) - placed.col),
        valid: true,
        overLab: true,
        overPanel: false,
        moved: false,
        startX: event.dragStartX ?? event.clientX,
        startY: event.dragStartY ?? event.clientY,
        row: placed.row,
        col: placed.col
      };
      element.classList.add('is-furniture-dragging');
      event.currentTarget?.setPointerCapture?.(event.pointerId);
      playSound('uiDragPickup');
      updateDrag(event);
      event.preventDefault();
      event.stopPropagation();
    }

    function releasePendingPointer(current) {
      try {
        current?.pointerTarget?.releasePointerCapture?.(current.pointerId);
      } catch {
        // Pointer capture may already have ended with the gesture.
      }
    }

    function createPendingEvent(current) {
      return {
        isPrimary: true,
        pointerId: current.pointerId,
        pointerType: current.pointerType,
        button: current.button,
        clientX: current.clientX,
        clientY: current.clientY,
        dragStartX: current.startX,
        dragStartY: current.startY,
        dragOriginClientX: current.startX,
        dragOriginClientY: current.startY,
        currentTarget: current.pointerTarget,
        preventDefault() {},
        stopPropagation() {}
      };
    }

    function activatePendingDrag() {
      if (!pendingDrag) return;
      const current = pendingDrag;
      pendingDrag = null;
      const event = createPendingEvent(current);
      if (current.sourceType === 'inventory') {
        startInventoryDrag(event, current.item, current.source);
        return;
      }
      const element =
        getPlacedElement(current.placed.placedId) || current.element;
      startFurnitureDrag(event, current.placed, element);
    }

    function clearPendingDrag(suppressClick = false) {
      if (!pendingDrag) return;
      const current = pendingDrag;
      pendingDrag = null;
      window.clearTimeout?.(current.holdTimer);
      releasePendingPointer(current);
      if (!suppressClick) return;
      if (current.sourceType === 'inventory') suppressInventoryClick = true;
      else suppressedPlacedClicks.add(current.placed.placedId);
    }

    function queueDrag(event, pending) {
      const delay = Number.isFinite(Number(dragHoldDelay))
        ? Math.max(0, Number(dragHoldDelay))
        : 220;
      pendingDrag = {
        ...pending,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        button: event.button,
        pointerTarget: event.currentTarget || pending.source || pending.element,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        moved: false,
        holdTimer: null
      };
      pendingDrag.pointerTarget?.setPointerCapture?.(event.pointerId);
      if (delay === 0 || typeof window.setTimeout !== 'function') {
        activatePendingDrag();
      } else {
        pendingDrag.holdTimer = window.setTimeout(activatePendingDrag, delay);
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function beginInventoryDrag(event, item, source) {
      if (
        pendingDrag ||
        drag ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return;
      queueDrag(event, { sourceType: 'inventory', item, source });
    }

    function beginFurnitureDrag(event, placed, element) {
      if (
        pendingDrag ||
        drag ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !state.editMode ||
        state.customiseCategory !== 'furniture' ||
        placed.locked
      )
        return;
      queueDrag(event, {
        sourceType: 'placed',
        placed: { ...placed },
        element
      });
    }

    function cleanUpDrag(current) {
      current.ghost?.remove();
      current.preview?.remove();
      clearSwapPreview(current);
      current.source?.classList.remove('is-drag-source');
      current.element?.classList.remove('is-furniture-dragging');
      if (current.sourceType === 'placed') {
        getPlacedElement(current.placed.placedId)?.classList.remove(
          'is-furniture-dragging'
        );
      }
      setPanelDropTarget(false);
      clearTargetCells();
    }

    function finishDrag(event, cancelled = false) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!cancelled) updateDrag(event);
      const current = drag;
      drag = null;
      cleanUpDrag(current);
      if (current.sourceType === 'inventory') {
        suppressInventoryClick = current.moved;
        if (!cancelled && current.moved && current.valid) {
          placeRoomItem(current.item.id, current.row, current.col);
          renderPanelInventory();
        } else if (!cancelled && current.moved && current.overLab) {
          setStatus('Choose a free insertion space for that furniture');
          playSound('uiError');
        }
        return;
      }
      if (!current.moved && cancelled) return;
      suppressedPlacedClicks.add(current.placed.placedId);
      if (!cancelled && current.overPanel) {
        const stored = storeRoomItem(current.placed.placedId);
        renderPanelInventory();
        if (stored !== false) {
          setStatus('Furniture stored');
          playSound('uiDragStore');
        } else {
          playSound('uiError');
        }
      } else if (!cancelled && current.swap) {
        const swapped = swapRoomItems(
          current.placed.placedId,
          current.swap.target.placedId
        );
        setStatus(
          swapped
            ? 'Furniture swapped'
            : 'Those furniture positions cannot be swapped'
        );
        if (!swapped) playSound('uiError');
      } else if (!cancelled && current.valid) {
        moveRoomItem(current.placed.placedId, current.row, current.col);
      } else if (!cancelled) {
        setStatus('Choose a free insertion space for that furniture');
        playSound('uiError');
      }
    }

    function moveDrag(event) {
      if (pendingDrag && event.pointerId === pendingDrag.pointerId) {
        pendingDrag.clientX = event.clientX;
        pendingDrag.clientY = event.clientY;
        pendingDrag.moved ||=
          Math.hypot(
            event.clientX - pendingDrag.startX,
            event.clientY - pendingDrag.startY
          ) > 5;
        return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;
      updateDrag(event);
      event.preventDefault();
    }

    function cancelDrag() {
      clearPendingDrag();
      if (!drag) return;
      const current = drag;
      drag = null;
      cleanUpDrag(current);
    }

    function consumeFurnitureDragClick(placedId) {
      if (!suppressedPlacedClicks.has(placedId)) return false;
      suppressedPlacedClicks.delete(placedId);
      return true;
    }

    function isFurnitureBeingDragged(placedId) {
      return Boolean(
        drag?.sourceType === 'placed' &&
        String(drag.placed.placedId) === String(placedId)
      );
    }

    function syncFurnitureDragAfterRender() {
      if (!drag) return;
      if (drag.sourceType === 'placed') {
        drag.element = getPlacedElement(drag.placed.placedId) || drag.element;
        drag.element?.classList.add('is-furniture-dragging');
      }
      if (drag.valid) showSnappedPreview(drag);
      else clearSnappedPreview(drag);
    }

    function storeFurnitureFromCustomise(placedId) {
      const stored = storeRoomItem(placedId);
      renderPanelInventory();
      if (stored !== false) {
        setStatus('Furniture stored');
        playSound('uiDragStore');
      } else {
        playSound('uiError');
      }
    }

    elements.furniturePanelToggle?.addEventListener('click', () =>
      setPanelCollapsed(!state.furniturePanelCollapsed)
    );
    elements.furniturePanel?.addEventListener('pointerdown', (event) =>
      event.stopPropagation()
    );
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', (event) => {
      if (pendingDrag && event.pointerId === pendingDrag.pointerId) {
        clearPendingDrag(pendingDrag.moved);
        return;
      }
      finishDrag(event);
    });
    window.addEventListener('pointercancel', (event) => {
      if (pendingDrag && event.pointerId === pendingDrag.pointerId) {
        clearPendingDrag();
        return;
      }
      finishDrag(event, true);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') cancelDrag();
    });

    return {
      openFurniturePanel,
      closeFurniturePanel,
      renderPanelInventory,
      beginFurnitureDrag,
      consumeFurnitureDragClick,
      isFurnitureBeingDragged,
      syncFurnitureDragAfterRender,
      storeFurnitureFromCustomise
    };
  }

  window.createOlingLabFurniturePanel = createOlingLabFurniturePanel;
})();

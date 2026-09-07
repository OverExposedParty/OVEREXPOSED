(function () {
  function createOlingLabWallDecorations({
    state,
    elements,
    rows,
    dragHoldDelay = 220,
    wallDecorationTheme = {},
    isLabCellUnlocked,
    createImage,
    openSharedPopup,
    closeSharedPopup,
    setStatus,
    renderLab,
    saveLab
  }) {
    const EPSILON = 0.000001;
    let drag = null;
    let pendingDrag = null;
    let suppressInventoryClick = false;
    let panelTransitionId = 0;
    const placedSoundByType = Object.freeze({
      poster: 'olingLabWallDecorationPosterPlaced',
      sign: 'olingLabWallDecorationSignPlaced',
      clock: 'olingLabWallDecorationClockPlaced',
      shelf: 'olingLabWallDecorationShelfPlaced'
    });
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    const panelTransitions = window.OlingLabPanelTransitions;
    if (wallDecorationTheme.primaryColour) {
      elements.wallDecorationPanel?.style.setProperty(
        '--wall-decoration-panel-primary',
        wallDecorationTheme.primaryColour
      );
      elements.room?.style.setProperty(
        '--wall-decoration-primary-colour',
        wallDecorationTheme.primaryColour
      );
    }
    if (wallDecorationTheme.secondaryColour) {
      elements.wallDecorationPanel?.style.setProperty(
        '--wall-decoration-panel-secondary',
        wallDecorationTheme.secondaryColour
      );
    }
    const getDefinition = (itemId) => state.wallDecorations.get(itemId) || null;
    const getPlacedSound = (itemId) => {
      const type = String(getDefinition(itemId)?.type || '')
        .trim()
        .toLowerCase();
      return placedSoundByType[type] || 'uiDragPlace';
    };
    const getCenter = (placed) => ({
      x: Number(placed.anchorCol || 0) + Number(placed.offsetX || 0),
      y: Number(placed.anchorRow || 0) + Number(placed.offsetY || 0)
    });
    const overlaps = (left, right) =>
      left.x < right.x + right.width - EPSILON &&
      left.x + left.width > right.x + EPSILON &&
      left.y < right.y + right.height - EPSILON &&
      left.y + left.height > right.y + EPSILON;

    function getBounds(definition, center) {
      const mask = definition.collisionBounds || {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      };
      const left = center.x - Number(definition.width || 0) / 2;
      const top = center.y - Number(definition.height || 0) / 2;
      return {
        x: left + Number(mask.x || 0) * definition.width,
        y: top + Number(mask.y || 0) * definition.height,
        width: Number(mask.width || 1) * definition.width,
        height: Number(mask.height || 1) * definition.height
      };
    }

    function getMajorityCell(definition, center) {
      const visual = {
        x: center.x - definition.width / 2,
        y: center.y - definition.height / 2,
        width: definition.width,
        height: definition.height
      };
      let best = null;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < state.lab.columns; col += 1) {
          const width = Math.max(
            0,
            Math.min(visual.x + visual.width, col + 1) - Math.max(visual.x, col)
          );
          const height = Math.max(
            0,
            Math.min(visual.y + visual.height, row + 1) -
              Math.max(visual.y, row)
          );
          const area = width * height;
          if (!best || area > best.area) best = { row, col, area };
        }
      }
      return best;
    }

    function getBlockingFurnitureBounds() {
      const blocked = [];
      const append = (definition, placed) => {
        const mask = definition?.wallCollisionBounds;
        if (!definition?.blocksWallDecorations || !mask) return;
        blocked.push({
          x: placed.col + mask.x * placed.width,
          y: placed.row + mask.y * placed.height,
          width: mask.width * placed.width,
          height: mask.height * placed.height
        });
      };
      (state.lab.placedItems || []).forEach((placed) => {
        append(state.catalog.get(placed.itemId), placed);
        (placed.containerSlots || []).forEach((slot) => {
          if (slot.itemId) append(state.catalog.get(slot.itemId), placed);
        });
      });
      return blocked;
    }

    function canUsePosition(placed, center) {
      const definition = getDefinition(placed.itemId);
      if (!definition) return false;
      const left = center.x - definition.width / 2;
      const top = center.y - definition.height / 2;
      if (
        left < 0 ||
        top < 0 ||
        left + definition.width > state.lab.columns ||
        top + definition.height > rows
      )
        return false;
      const majority = getMajorityCell(definition, center);
      if (!majority || !isLabCellUnlocked(majority.row, majority.col))
        return false;
      const bounds = getBounds(definition, center);
      if (getBlockingFurnitureBounds().some((item) => overlaps(bounds, item)))
        return false;
      return !(state.lab.placedWallDecorations || []).some((other) => {
        if (other.placedId === placed.placedId) return false;
        const otherDefinition = getDefinition(other.itemId);
        return (
          otherDefinition &&
          overlaps(bounds, getBounds(otherDefinition, getCenter(other)))
        );
      });
    }

    function applyCenter(placed, center) {
      const majority = getMajorityCell(getDefinition(placed.itemId), center);
      placed.anchorRow = majority.row;
      placed.anchorCol = majority.col;
      placed.offsetX = center.x - majority.col;
      placed.offsetY = center.y - majority.row;
    }

    function createPlacedId(itemId) {
      if (window.crypto?.randomUUID)
        return `${itemId}_${window.crypto.randomUUID()}`;
      return `${itemId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    }

    function getPlacedQuantity(itemId) {
      return (state.lab.placedWallDecorations || []).filter(
        (item) => item.itemId === itemId
      ).length;
    }

    function createInventoryPlacement(itemId) {
      return {
        placedId: createPlacedId(itemId),
        itemId,
        anchorRow: 0,
        anchorCol: 0,
        offsetX: 0.5,
        offsetY: 0.5,
        placedAt: new Date().toISOString()
      };
    }

    function findInitialCenter(placed) {
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < state.lab.columns; col += 1) {
          const center = { x: col + 0.5, y: row + 0.5 };
          if (canUsePosition(placed, center)) return center;
        }
      }
      return null;
    }

    function placeFromKeyboard(itemId) {
      const owned = state.ownedWallDecorations.get(itemId) || 0;
      if (getPlacedQuantity(itemId) >= owned) return;
      const placed = createInventoryPlacement(itemId);
      const center = findInitialCenter(placed);
      if (!center) {
        setStatus('No free wall space for that decoration');
        playSound('uiError');
        return;
      }
      applyCenter(placed, center);
      state.lab.placedWallDecorations ||= [];
      state.lab.placedWallDecorations.push(placed);
      renderPanelInventory();
      renderLab();
      saveLab();
      playSound(getPlacedSound(itemId));
    }

    function removeDecoration(placedId, options = {}) {
      state.lab.placedWallDecorations = (
        state.lab.placedWallDecorations || []
      ).filter((item) => item.placedId !== placedId);
      renderPanelInventory();
      renderLab();
      if (options.save !== false) saveLab();
      if (options.sound !== false) playSound('uiDragStore');
    }

    function setPanelCollapsed(collapsed, options = {}) {
      const wasCollapsed = Boolean(state.wallDecorationPanelCollapsed);
      state.wallDecorationPanelCollapsed = Boolean(collapsed);
      elements.wallDecorationPanel?.classList.toggle(
        'is-collapsed',
        state.wallDecorationPanelCollapsed
      );
      elements.wallDecorationPanelToggle?.setAttribute(
        'aria-expanded',
        String(!state.wallDecorationPanelCollapsed)
      );
      if (elements.wallDecorationPanelToggle) {
        elements.wallDecorationPanelToggle.dataset.sound = 'none';
        delete elements.wallDecorationPanelToggle.dataset.soundIntent;
        elements.wallDecorationPanelToggle.textContent =
          state.wallDecorationPanelCollapsed ? 'Show' : 'Hide';
        elements.wallDecorationPanelToggle.setAttribute(
          'aria-label',
          state.wallDecorationPanelCollapsed
            ? 'Show wall decorations panel'
            : 'Hide wall decorations panel'
        );
      }
      if (
        wasCollapsed !== state.wallDecorationPanelCollapsed &&
        state.wallDecorationPanelOpen &&
        options.sound !== false
      ) {
        playSound(
          state.wallDecorationPanelCollapsed
            ? 'sidePanelClose'
            : 'sidePanelOpen'
        );
      }
    }

    function openWallDecorationsMenu() {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.wallDecorationPanel;
      const wasOpen = Boolean(
        state.wallDecorationPanelOpen &&
        panel &&
        !panel.hidden &&
        panel.classList.contains('is-open') &&
        !state.wallDecorationPanelCollapsed
      );
      state.wallDecorationPanelOpen = true;
      state.wallDecorationPanelCollapsed = false;
      if (panel) {
        panel.hidden = false;
        panel.classList.remove('is-open', 'is-collapsed');
      }
      setPanelCollapsed(false, { sound: false });
      renderPanelInventory();
      if (!panel) return;
      panel.getBoundingClientRect();
      const showPanel = () => {
        if (
          transitionId !== panelTransitionId ||
          !state.wallDecorationPanelOpen
        ) {
          return;
        }
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

    function closeWallDecorationsPanel(options = {}) {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.wallDecorationPanel;
      const wasVisible = Boolean(
        state.wallDecorationPanelOpen && panel && !panel.hidden
      );
      state.wallDecorationPanelOpen = false;
      cancelDrag();
      if (!panel) return undefined;
      panel.classList.remove('is-drop-target');
      const playCloseSound = () => {
        if (wasVisible && options.sound !== false) playSound('sidePanelClose');
      };
      const finishClose = () => {
        if (
          transitionId === panelTransitionId &&
          !state.wallDecorationPanelOpen
        ) {
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

    function createInventoryCard(definition, quantity, available) {
      const card = document.createElement('button');
      card.className = 'oling-lab-wall-decoration-card';
      card.type = 'button';
      card.disabled = available <= 0;
      card.dataset.olingLabWallDecorationInventoryId = definition.id;
      card.appendChild(createImage(definition.image, definition.name));
      const copy = document.createElement('span');
      copy.className = 'oling-lab-wall-decoration-card-copy';
      const name = Object.assign(document.createElement('strong'), {
        textContent: definition.name,
        title: definition.name
      });
      const nameLength = String(definition.name || '').trim().length;
      name.classList.toggle('is-long-name', nameLength > 18);
      name.classList.toggle('is-very-long-name', nameLength > 28);
      copy.append(
        name,
        Object.assign(document.createElement('span'), {
          textContent:
            available > 0
              ? `${available} of ${quantity} available`
              : `All ${quantity} placed`
        })
      );
      card.appendChild(copy);
      card.addEventListener('pointerdown', (event) => {
        if (!card.disabled) beginInventoryDrag(event, definition.id, card);
      });
      card.addEventListener('click', (event) => {
        if (suppressInventoryClick) {
          suppressInventoryClick = false;
          event.preventDefault();
          return;
        }
        if (event.detail === 0) placeFromKeyboard(definition.id);
      });
      return card;
    }

    function renderPanelInventory() {
      if (!elements.wallDecorationPanelInventory || !state.lab) return;
      const cards = [...state.ownedWallDecorations]
        .map(([key, quantity]) => {
          const definition = getDefinition(key);
          if (!definition || quantity <= 0) return null;
          return createInventoryCard(
            definition,
            quantity,
            quantity - getPlacedQuantity(key)
          );
        })
        .filter(Boolean);
      elements.wallDecorationPanelInventory.replaceChildren(
        ...(cards.length
          ? cards
          : [
              Object.assign(document.createElement('p'), {
                className: 'oling-lab-wall-decoration-panel-empty',
                textContent: 'You do not own any wall decorations yet.'
              })
            ])
      );
      if (elements.wallDecorationStoreAll) {
        elements.wallDecorationStoreAll.disabled = !(
          state.lab.placedWallDecorations || []
        ).length;
      }
    }

    function roomPoint(event) {
      const firstCell = elements.room.querySelector('.oling-lab-cell');
      const bounds = firstCell?.getBoundingClientRect();
      if (!bounds?.width || !bounds?.height) return null;
      return {
        x: (event.clientX - bounds.left) / bounds.width,
        y: (event.clientY - bounds.top) / bounds.height,
        cellWidth: bounds.width,
        cellHeight: bounds.height
      };
    }

    function isPointInsideLab(point) {
      return Boolean(
        point &&
        point.x >= 0 &&
        point.y >= 0 &&
        point.x <= state.lab.columns &&
        point.y <= rows
      );
    }

    function isPointerOverPanel(event) {
      if (
        !elements.wallDecorationPanel ||
        !state.wallDecorationPanelOpen ||
        state.wallDecorationPanelCollapsed
      )
        return false;
      const bounds = elements.wallDecorationPanel.getBoundingClientRect();
      return (
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
    }

    function updateElementPosition(element, definition, center) {
      element.style.setProperty('--wall-decoration-x', center.x);
      element.style.setProperty('--wall-decoration-y', center.y);
      element.style.setProperty('--wall-decoration-width', definition.width);
      element.style.setProperty('--wall-decoration-height', definition.height);
    }

    function createDragGhost(definition) {
      const ghost = document.createElement('div');
      ghost.className = 'oling-lab-wall-decoration-drag-ghost';
      ghost.appendChild(createImage(definition.image, ''));
      document.body.appendChild(ghost);
      return ghost;
    }

    function updateGhost(ghost, definition, event, point) {
      const width = Math.max(48, (point?.cellWidth || 120) * definition.width);
      const height = Math.max(
        48,
        (point?.cellHeight || 120) * definition.height
      );
      ghost.style.left = `${event.clientX}px`;
      ghost.style.top = `${event.clientY}px`;
      ghost.style.width = `${width}px`;
      ghost.style.height = `${height}px`;
    }

    function startInventoryDrag(event, itemId, source) {
      if (
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        drag
      )
        return;
      const placed = createInventoryPlacement(itemId);
      const definition = getDefinition(itemId);
      drag = {
        sourceType: 'inventory',
        pointerId: event.pointerId,
        placed,
        source,
        ghost: createDragGhost(definition),
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
      updateInventoryDrag(event);
      event.preventDefault();
      event.stopPropagation();
    }

    function startPlacedDrag(event, placed, element) {
      if (
        !event.isPrimary ||
        !state.editMode ||
        state.customiseCategory !== 'wall-decorations' ||
        drag
      )
        return;
      const point = roomPoint({
        clientX: event.dragOriginClientX ?? event.clientX,
        clientY: event.dragOriginClientY ?? event.clientY
      });
      if (!point) return;
      const center = getCenter(placed);
      const definition = getDefinition(placed.itemId);
      drag = {
        sourceType: 'placed',
        pointerId: event.pointerId,
        placed: { ...placed },
        element,
        ghost: createDragGhost(definition),
        offsetX: center.x - point.x,
        offsetY: center.y - point.y,
        valid: true,
        overLab: true,
        overPanel: false
      };
      element.setPointerCapture?.(event.pointerId);
      element.classList.add('is-dragging');
      playSound('uiDragPickup');
      updatePlacedDrag(event);
      event.preventDefault();
      event.stopPropagation();
    }

    function getPlacedElement(placedId) {
      return [
        ...(elements.room?.querySelectorAll(
          '.oling-lab-wall-decoration[data-oling-lab-wall-decoration-id]'
        ) || [])
      ].find(
        (element) =>
          element.dataset.olingLabWallDecorationId === String(placedId)
      );
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
        startInventoryDrag(event, current.itemId, current.source);
        return;
      }
      startPlacedDrag(
        event,
        current.placed,
        getPlacedElement(current.placed.placedId) || current.element
      );
    }

    function clearPendingDrag(suppressClick = false) {
      if (!pendingDrag) return;
      const current = pendingDrag;
      pendingDrag = null;
      window.clearTimeout?.(current.holdTimer);
      releasePendingPointer(current);
      if (suppressClick && current.sourceType === 'inventory') {
        suppressInventoryClick = true;
      }
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

    function beginInventoryDrag(event, itemId, source) {
      if (
        pendingDrag ||
        drag ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return;
      queueDrag(event, { sourceType: 'inventory', itemId, source });
    }

    function beginPlacedDrag(event, placed, element) {
      if (
        pendingDrag ||
        drag ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !state.editMode ||
        state.customiseCategory !== 'wall-decorations'
      )
        return;
      queueDrag(event, {
        sourceType: 'placed',
        placed: { ...placed },
        element
      });
    }

    function updatePlacedGhost(event, point = roomPoint(event)) {
      const definition = getDefinition(drag.placed.itemId);
      const cellWidth = point?.cellWidth || 120;
      const cellHeight = point?.cellHeight || 120;
      const ghostClientX = drag.overPanel
        ? event.clientX
        : event.clientX + drag.offsetX * cellWidth;
      const ghostClientY = drag.overPanel
        ? event.clientY
        : event.clientY + drag.offsetY * cellHeight;
      updateGhost(
        drag.ghost,
        definition,
        {
          clientX: ghostClientX,
          clientY: ghostClientY
        },
        point
      );
      drag.ghost.classList.toggle('is-over-storage', drag.overPanel);
      drag.ghost.classList.toggle('is-valid', drag.valid || drag.overPanel);
      drag.ghost.classList.toggle(
        'is-invalid',
        drag.overLab && !drag.valid && !drag.overPanel
      );
    }

    function updateInventoryDrag(event) {
      const point = roomPoint(event);
      const definition = getDefinition(drag.placed.itemId);
      drag.moved ||=
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >
        5;
      drag.overPanel = isPointerOverPanel(event);
      drag.overLab = !drag.overPanel && isPointInsideLab(point);
      drag.valid = drag.overLab && canUsePosition(drag.placed, point);
      if (drag.overLab) applyCenter(drag.placed, point);
      elements.wallDecorationPanel?.classList.add('is-drop-target');
      updateGhost(drag.ghost, definition, event, point);
      drag.ghost.classList.toggle('is-over-storage', drag.overPanel);
      drag.ghost.classList.toggle('is-valid', drag.valid);
      drag.ghost.classList.toggle('is-invalid', drag.overLab && !drag.valid);
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
      if (drag.sourceType === 'inventory') {
        updateInventoryDrag(event);
        event.preventDefault();
        return;
      }
      updatePlacedDrag(event);
      event.preventDefault();
    }

    function updatePlacedDrag(event) {
      drag.overPanel = isPointerOverPanel(event);
      elements.wallDecorationPanel?.classList.toggle(
        'is-drop-target',
        drag.overPanel
      );
      const point = roomPoint(event);
      drag.overLab = isPointInsideLab(point);
      if (!drag.overPanel && drag.overLab) {
        const center = {
          x: point.x + drag.offsetX,
          y: point.y + drag.offsetY
        };
        drag.valid = canUsePosition(drag.placed, center);
        applyCenter(drag.placed, center);
      } else {
        drag.valid = false;
      }
      updatePlacedGhost(event, point);
    }

    function applyCandidateToCurrentPlacement(candidate) {
      const currentPlacement = (state.lab.placedWallDecorations || []).find(
        (placed) => placed.placedId === candidate.placedId
      );
      if (!currentPlacement) return false;
      currentPlacement.anchorRow = candidate.anchorRow;
      currentPlacement.anchorCol = candidate.anchorCol;
      currentPlacement.offsetX = candidate.offsetX;
      currentPlacement.offsetY = candidate.offsetY;
      return true;
    }

    function cleanUpDrag(current) {
      current.ghost?.remove();
      current.source?.classList.remove('is-drag-source');
      current.element?.classList.remove('is-dragging', 'is-invalid');
      elements.wallDecorationPanel?.classList.remove('is-drop-target');
    }

    function finishDrag(event, cancelled = false) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!cancelled) {
        if (drag.sourceType === 'inventory') updateInventoryDrag(event);
        else updatePlacedDrag(event);
      }
      const current = drag;
      drag = null;
      cleanUpDrag(current);
      if (current.sourceType === 'inventory') {
        suppressInventoryClick = current.moved;
        if (!cancelled && current.valid && current.overLab) {
          state.lab.placedWallDecorations ||= [];
          state.lab.placedWallDecorations.push(current.placed);
          renderPanelInventory();
          renderLab();
          saveLab();
          playSound(getPlacedSound(current.placed.itemId));
        } else if (!cancelled && current.moved && current.overLab) {
          playSound('uiError');
        }
        return;
      }
      if (!cancelled && current.overPanel) {
        removeDecoration(current.placed.placedId);
        setStatus('Wall decoration stored');
        return;
      }
      if (cancelled || !current.valid || !current.overLab) {
        if (!cancelled) {
          setStatus('Choose a free position inside the lab wall');
          playSound('uiError');
        }
      } else if (!applyCandidateToCurrentPlacement(current.placed)) {
        setStatus('That wall decoration is no longer available');
        playSound('uiError');
      } else {
        saveLab();
        playSound(getPlacedSound(current.placed.itemId));
      }
      renderLab();
    }

    function cancelDrag() {
      clearPendingDrag();
      if (!drag) return;
      const current = drag;
      drag = null;
      cleanUpDrag(current);
      renderLab();
    }

    function openStoreAllConfirmation() {
      const count = (state.lab.placedWallDecorations || []).length;
      if (!count) return;
      const dialog = document.createElement('section');
      dialog.className =
        'oe-purchase-dialog oling-lab-store-decorations-dialog';
      dialog.dataset.removeOnContainerClose = 'true';
      dialog.style.setProperty('--oe-purchase-primary-colour', '#ffc9b8');
      dialog.style.setProperty('--oe-purchase-secondary-colour', '#e8846b');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      const title = Object.assign(document.createElement('h2'), {
        className: 'oe-purchase-title',
        textContent: 'Store all decorations?'
      });
      const content = document.createElement('div');
      content.className = 'oe-purchase-content';
      content.appendChild(
        Object.assign(document.createElement('p'), {
          className: 'oe-purchase-message',
          textContent: `This will return ${count} decoration${count === 1 ? '' : 's'} to your inventory. You can place them again at any time.`
        })
      );
      const actions = document.createElement('div');
      actions.className = 'oling-lab-store-decorations-actions';
      const cancel = Object.assign(document.createElement('button'), {
        className: 'oling-lab-store-decorations-cancel',
        type: 'button',
        textContent: 'Keep decorations'
      });
      cancel.dataset.sound = 'none';
      const confirm = Object.assign(document.createElement('button'), {
        className: 'oe-purchase-confirm',
        type: 'button',
        textContent: 'Store everything'
      });
      confirm.dataset.soundIntent = 'confirm';
      cancel.addEventListener('click', () => closeSharedPopup(dialog));
      confirm.addEventListener('click', () => {
        state.lab.placedWallDecorations = [];
        closeSharedPopup(dialog);
        renderPanelInventory();
        renderLab();
        saveLab();
        playSound('uiDragStore');
      });
      actions.append(cancel, confirm);
      content.appendChild(actions);
      dialog.append(title, content);
      dialog.addEventListener('click', (event) => event.stopPropagation());
      document.body.appendChild(dialog);
      openSharedPopup(dialog);
    }

    function renderWallDecorations() {
      const fragment = document.createDocumentFragment();
      (state.lab.placedWallDecorations || []).forEach((placed) => {
        if (
          drag?.sourceType === 'placed' &&
          drag.placed.placedId === placed.placedId
        ) {
          return;
        }
        const definition = getDefinition(placed.itemId);
        if (!definition) return;
        const element = document.createElement('div');
        const center = getCenter(placed);
        element.className = 'oling-lab-wall-decoration';
        element.dataset.olingLabWallDecorationId = placed.placedId;
        element.dataset.collisionAsset =
          definition.collisionMask || definition.image;
        updateElementPosition(element, definition, center);
        element.appendChild(createImage(definition.image, definition.name));
        if (state.editMode && state.customiseCategory === 'wall-decorations') {
          const handle = document.createElement('button');
          handle.className = 'oling-lab-wall-decoration-handle';
          handle.type = 'button';
          handle.setAttribute('aria-label', `Move ${definition.name}`);
          handle.addEventListener('pointerdown', (event) =>
            beginPlacedDrag(event, placed, element)
          );
          const remove = document.createElement('button');
          remove.className = 'oling-lab-wall-decoration-remove';
          remove.type = 'button';
          remove.dataset.sound = 'none';
          remove.textContent = '×';
          remove.setAttribute('aria-label', `Store ${definition.name}`);
          remove.addEventListener('click', (event) => {
            event.stopPropagation();
            removeDecoration(placed.placedId);
          });
          element.append(handle, remove);
        }
        fragment.appendChild(element);
      });
      return fragment;
    }

    elements.wallDecorationPanelToggle?.addEventListener('click', () =>
      setPanelCollapsed(!state.wallDecorationPanelCollapsed)
    );
    elements.wallDecorationStoreAll?.addEventListener(
      'click',
      openStoreAllConfirmation
    );
    elements.wallDecorationPanel?.addEventListener('pointerdown', (event) =>
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
      openWallDecorationsMenu,
      closeWallDecorationsPanel,
      renderPanelInventory,
      renderWallDecorations
    };
  }

  window.createOlingLabWallDecorations = createOlingLabWallDecorations;
})();

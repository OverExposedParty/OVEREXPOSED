(function () {
  function createOlingLabWallpapers(dependencies) {
    const {
      state,
      elements,
      defaultWallpaperKey,
      dragHoldDelay = 220,
      wallpaperTheme = {},
      createInlineAction,
      renderLab,
      saveLab
    } = dependencies;
    const sourceSvgPromises = new Map();
    const variantImagePromises = new Map();
    const generatedObjectUrls = new Set();
    let previewWallpaperKey = null;
    let previewWallpaperVariantKey = null;
    let originalWallpaperKey = null;
    let originalWallpaperVariantKey = null;
    let activeHeaderBackButton = null;
    let panelTransitionId = 0;
    let pendingWallpaperDrag = null;
    let wallpaperDrag = null;
    let refreshWallpaperDetail = null;
    const suppressedWallpaperClicks = new WeakSet();
    const playSound = (key) => {
      if (!key || typeof window.playSoundEffect !== 'function') return;
      Promise.resolve(window.playSoundEffect(key)).catch(() => {});
    };
    const panelTransitions = window.OlingLabPanelTransitions;

    if (
      !state.wallpaperVariantSelections ||
      typeof state.wallpaperVariantSelections.get !== 'function' ||
      typeof state.wallpaperVariantSelections.set !== 'function'
    ) {
      state.wallpaperVariantSelections = new Map();
    }

    if (wallpaperTheme.primaryColour) {
      elements.wallStylePanel?.style.setProperty(
        '--wall-decoration-panel-primary',
        wallpaperTheme.primaryColour
      );
    }
    if (wallpaperTheme.secondaryColour) {
      elements.wallStylePanel?.style.setProperty(
        '--wall-decoration-panel-secondary',
        wallpaperTheme.secondaryColour
      );
    }

    function normalizeKey(value) {
      return String(value || '')
        .trim()
        .toLowerCase();
    }

    function getVariantEntitlementKey(wallpaperKey, variantKey) {
      return `${wallpaperKey}:${variantKey}`;
    }

    function getWallpaperVariant(wallpaper, variantKey) {
      const key = normalizeKey(variantKey);
      if (!wallpaper || !key) return null;
      return Object.hasOwn(wallpaper.variants || {}, key)
        ? wallpaper.variants[key]
        : null;
    }

    function getCommittedSelection() {
      return {
        wallpaperKey: normalizeKey(
          state.lab?.appearance?.wallpaperKey ||
            state.lab?.wallpaperKey ||
            defaultWallpaperKey
        ),
        variantKey:
          normalizeKey(state.lab?.appearance?.wallpaperVariantKey) || null
      };
    }

    function getSelectedSelection() {
      if (previewWallpaperKey !== null) {
        return {
          wallpaperKey: previewWallpaperKey,
          variantKey: previewWallpaperVariantKey
        };
      }
      return getCommittedSelection();
    }

    function getSelectedWallpaper() {
      const selection = getSelectedSelection();
      return (
        state.wallpapers.get(selection.wallpaperKey) ||
        state.wallpapers.get(defaultWallpaperKey) ||
        null
      );
    }

    function getSelectedWallpaperVariant() {
      const selection = getSelectedSelection();
      return getWallpaperVariant(
        state.wallpapers.get(selection.wallpaperKey),
        selection.variantKey
      );
    }

    function getOwnedWallpaperChoices(wallpaper) {
      if (!wallpaper?.key) return [];
      const choices = [];
      if (state.ownedWallpapers.has(wallpaper.key)) {
        choices.push({ variantKey: null, name: 'Original', definition: null });
      }
      Object.entries(wallpaper.variants || {}).forEach(
        ([variantKey, definition]) => {
          if (
            state.ownedWallpaperVariants?.has(
              getVariantEntitlementKey(wallpaper.key, variantKey)
            )
          ) {
            choices.push({
              variantKey,
              name: definition.name || variantKey,
              definition
            });
          }
        }
      );
      return choices;
    }

    function rememberWallpaperChoice(wallpaperKey, variantKey) {
      state.wallpaperVariantSelections.set(
        normalizeKey(wallpaperKey),
        normalizeKey(variantKey) || null
      );
    }

    function isOwnedSelection(wallpaperKey, variantKey) {
      if (!state.wallpapers.has(wallpaperKey)) return false;
      if (!variantKey) return state.ownedWallpapers.has(wallpaperKey);
      const wallpaper = state.wallpapers.get(wallpaperKey);
      return Boolean(
        getWallpaperVariant(wallpaper, variantKey) &&
        state.ownedWallpaperVariants?.has(
          getVariantEntitlementKey(wallpaperKey, variantKey)
        )
      );
    }

    function getResolvedWallpaper(selection = getSelectedSelection()) {
      const wallpaper =
        state.wallpapers.get(selection.wallpaperKey) ||
        state.wallpapers.get(defaultWallpaperKey) ||
        null;
      if (!wallpaper) return null;
      const variant = getWallpaperVariant(wallpaper, selection.variantKey);
      return {
        wallpaper,
        variant,
        image: String(variant?.image || wallpaper.image || '').trim(),
        preview: String(
          variant?.preview ||
            variant?.image ||
            wallpaper.preview ||
            wallpaper.image ||
            ''
        ).trim(),
        render: { ...(wallpaper.render || {}), ...(variant?.render || {}) },
        backgroundColour:
          variant?.backgroundColour ||
          variant?.colours?.background ||
          variant?.render?.backgroundColour ||
          wallpaper.render?.backgroundColour ||
          '#e8f1ed'
      };
    }

    function isSafePaletteEntry(slot, colour) {
      return (
        /^[a-z][a-z0-9-]{0,63}$/.test(slot) &&
        (/^#[0-9a-f]{3,8}$/i.test(colour) ||
          /^(?:rgb|rgba|hsl|hsla)\([\d\s.,/%+-]+\)$/i.test(colour))
      );
    }

    function loadSvgSource(sourceUrl) {
      if (!sourceSvgPromises.has(sourceUrl)) {
        sourceSvgPromises.set(
          sourceUrl,
          fetch(sourceUrl, { headers: { Accept: 'image/svg+xml' } }).then(
            (response) => {
              if (!response.ok) throw new Error('Wallpaper SVG request failed');
              return response.text();
            }
          )
        );
      }
      return sourceSvgPromises.get(sourceUrl);
    }

    function getVariantImageUrl(wallpaper, variantKey, sourceUrl) {
      const variant = getWallpaperVariant(wallpaper, variantKey);
      const colours = variant?.colours;
      if (!variant || !colours || !Object.keys(colours).length) {
        return Promise.resolve(sourceUrl);
      }
      if (
        typeof fetch !== 'function' ||
        typeof DOMParser !== 'function' ||
        typeof XMLSerializer !== 'function' ||
        typeof Blob !== 'function' ||
        typeof URL === 'undefined' ||
        typeof URL.createObjectURL !== 'function'
      ) {
        return Promise.resolve(sourceUrl);
      }

      const cacheKey = `${wallpaper.key}:${variantKey}:${sourceUrl}:${JSON.stringify(
        colours
      )}`;
      if (!variantImagePromises.has(cacheKey)) {
        const imagePromise = loadSvgSource(sourceUrl).then((source) => {
          const svgDocument = new DOMParser().parseFromString(
            source,
            'image/svg+xml'
          );
          if (
            svgDocument.querySelector('parsererror') ||
            svgDocument.documentElement?.localName !== 'svg'
          ) {
            throw new Error('Wallpaper SVG could not be parsed');
          }
          const svg = svgDocument.documentElement;
          Object.entries(colours).forEach(([slot, value]) => {
            const colour = String(value || '').trim();
            if (isSafePaletteEntry(slot, colour)) {
              svg.style.setProperty(`--wall-${slot}`, colour);
            }
          });
          const serialized = new XMLSerializer().serializeToString(svg);
          const objectUrl = URL.createObjectURL(
            new Blob([serialized], { type: 'image/svg+xml' })
          );
          generatedObjectUrls.add(objectUrl);
          return objectUrl;
        });
        variantImagePromises.set(cacheKey, imagePromise);
      }
      return variantImagePromises.get(cacheKey);
    }

    function selectionIdentity(selection) {
      return `${selection.wallpaperKey}:${selection.variantKey || ''}`;
    }

    function setWallpaperImage(target, image) {
      if (!image) {
        target.style.removeProperty('--oling-lab-wallpaper-image');
        return;
      }
      target.style.setProperty(
        '--oling-lab-wallpaper-image',
        `url(${JSON.stringify(image)})`
      );
    }

    function applyWallpaperToTarget(
      target,
      selection,
      { miniature = false, columns = 1 } = {}
    ) {
      const resolved = getResolvedWallpaper(selection);
      if (!resolved?.image) {
        setWallpaperImage(target, '');
        return;
      }
      const render = resolved.render;
      const widthCells = Math.min(
        8,
        Math.max(0.25, Number(render.widthCells) || 1)
      );
      const heightCells = Math.min(
        8,
        Math.max(0.25, Number(render.heightCells) || 1)
      );
      const cover = render.mode === 'cover';
      const expectedSelection = selectionIdentity(selection);
      if (target.dataset) {
        target.dataset.olingLabWallpaperSelection = expectedSelection;
      }
      setWallpaperImage(target, resolved.image);
      target.style.setProperty(
        '--oling-lab-wallpaper-colour',
        String(resolved.backgroundColour)
      );
      target.style.setProperty(
        '--oling-lab-wallpaper-repeat',
        cover ? 'no-repeat' : 'repeat'
      );
      target.style.setProperty(
        '--oling-lab-wallpaper-position',
        String(render.position || 'left bottom')
      );
      target.style.setProperty(
        '--oling-lab-wallpaper-size',
        cover
          ? 'cover'
          : miniature
            ? `${(widthCells / Math.max(1, columns)) * 100}% ${(heightCells / 2) * 100}%`
            : `calc(var(--oling-lab-cell) * ${widthCells}) calc(var(--oling-lab-cell) * ${heightCells})`
      );

      if (resolved.variant?.colours) {
        getVariantImageUrl(
          resolved.wallpaper,
          selection.variantKey,
          resolved.image
        )
          .then((image) => {
            if (
              (target.dataset?.olingLabWallpaperSelection ||
                (target === elements.room
                  ? selectionIdentity(getSelectedSelection())
                  : '')) === expectedSelection
            ) {
              setWallpaperImage(target, image);
            }
          })
          .catch((error) =>
            console.error('Failed to render wallpaper variant:', error)
          );
      }
    }

    function applyWallpaper() {
      applyWallpaperToTarget(elements.room, getCommittedSelection());
    }

    function updateApplyButton() {
      const applyButton = elements.wallStylePanelFooter?.querySelector(
        '[data-oling-lab-wallpaper-apply]'
      );
      if (!applyButton) return;
      applyButton.disabled =
        previewWallpaperKey === originalWallpaperKey &&
        previewWallpaperVariantKey === originalWallpaperVariantKey;
    }

    function selectWallpaper(wallpaperKey, variantKey = null) {
      const normalizedWallpaperKey = normalizeKey(wallpaperKey);
      const normalizedVariantKey = normalizeKey(variantKey) || null;
      if (
        !state.lab ||
        !isOwnedSelection(normalizedWallpaperKey, normalizedVariantKey)
      ) {
        return;
      }
      previewWallpaperKey = normalizedWallpaperKey;
      previewWallpaperVariantKey = normalizedVariantKey;
      rememberWallpaperChoice(normalizedWallpaperKey, normalizedVariantKey);
      updateApplyButton();
    }

    function isPointInside(element, event) {
      const bounds = element?.getBoundingClientRect?.();
      return Boolean(
        bounds &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
    }

    function isPointerOverPanel(event) {
      return Boolean(
        state.wallStylePanelOpen &&
        !state.wallStylePanelCollapsed &&
        isPointInside(elements.wallStylePanel, event)
      );
    }

    function isPointerOverLab(event) {
      if (isPointerOverPanel(event)) return false;
      return isPointInside(elements.viewport || elements.room, event);
    }

    function createWallpaperDragGhost(source) {
      const bounds = source.getBoundingClientRect();
      const ghost = source.cloneNode(true);
      ghost.classList.add('oling-lab-wallpaper-drag-ghost');
      ghost.removeAttribute('id');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${Math.max(72, bounds.width || 96)}px`;
      ghost.style.height = `${Math.max(72, bounds.height || 96)}px`;
      document.body.appendChild(ghost);
      return ghost;
    }

    function showWallpaperDropPreview(current) {
      if (!current.overlay) {
        current.overlay = document.createElement('div');
        current.overlay.className = 'oling-lab-wallpaper-drop-preview';
        current.overlay.dataset.olingLabPreviewExclude = '';
        current.overlay.setAttribute('aria-hidden', 'true');
        applyWallpaperToTarget(current.overlay, current.selection);
      }
      if (!current.overlay.isConnected)
        elements.room?.appendChild(current.overlay);
      elements.room?.classList.add('is-wallpaper-drop-target');
    }

    function clearWallpaperDropPreview(current = wallpaperDrag) {
      current?.overlay?.remove();
      if (current) current.overlay = null;
      elements.room?.classList.remove('is-wallpaper-drop-target');
    }

    function updateWallpaperDrag(event) {
      if (!wallpaperDrag) return;
      wallpaperDrag.moved ||=
        Math.hypot(
          event.clientX - wallpaperDrag.startX,
          event.clientY - wallpaperDrag.startY
        ) > 5;
      wallpaperDrag.overPanel = isPointerOverPanel(event);
      wallpaperDrag.overLab =
        wallpaperDrag.moved &&
        !wallpaperDrag.overPanel &&
        isPointerOverLab(event);
      wallpaperDrag.ghost.style.left = `${event.clientX}px`;
      wallpaperDrag.ghost.style.top = `${event.clientY}px`;
      wallpaperDrag.ghost.classList.toggle(
        'is-over-lab',
        wallpaperDrag.overLab
      );
      wallpaperDrag.ghost.classList.toggle(
        'is-over-panel',
        wallpaperDrag.moved && wallpaperDrag.overPanel
      );
      if (wallpaperDrag.overLab) showWallpaperDropPreview(wallpaperDrag);
      else clearWallpaperDropPreview(wallpaperDrag);
    }

    function releaseWallpaperPointer(source, pointerId) {
      try {
        source?.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already have ended with the pointer gesture.
      }
    }

    function activatePendingWallpaperDrag() {
      if (!pendingWallpaperDrag) return;
      const pending = pendingWallpaperDrag;
      pendingWallpaperDrag = null;
      applyWallpaper();
      wallpaperDrag = {
        pointerId: pending.pointerId,
        selection: pending.selection,
        source: pending.source,
        ghost: createWallpaperDragGhost(pending.source),
        overlay: null,
        moved: false,
        overLab: false,
        overPanel: true,
        startX: pending.startX,
        startY: pending.startY
      };
      pending.source.classList.add('is-drag-source');
      playSound('uiDragPickup');
      updateWallpaperDrag({
        clientX: pending.clientX,
        clientY: pending.clientY
      });
    }

    function clearPendingWallpaperDrag(suppressClick = false) {
      if (!pendingWallpaperDrag) return;
      const pending = pendingWallpaperDrag;
      pendingWallpaperDrag = null;
      window.clearTimeout?.(pending.holdTimer);
      releaseWallpaperPointer(pending.source, pending.pointerId);
      if (suppressClick) suppressedWallpaperClicks.add(pending.source);
    }

    function beginWallpaperDrag(event, selection, source) {
      if (
        pendingWallpaperDrag ||
        wallpaperDrag ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        !isOwnedSelection(selection.wallpaperKey, selection.variantKey)
      )
        return;
      const delay = Number.isFinite(Number(dragHoldDelay))
        ? Math.max(0, Number(dragHoldDelay))
        : 220;
      pendingWallpaperDrag = {
        pointerId: event.pointerId,
        selection: { ...selection },
        source,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
        holdTimer: null
      };
      source.setPointerCapture?.(event.pointerId);
      if (delay === 0 || typeof window.setTimeout !== 'function') {
        activatePendingWallpaperDrag();
      } else {
        pendingWallpaperDrag.holdTimer = window.setTimeout(
          activatePendingWallpaperDrag,
          delay
        );
      }
      event.preventDefault();
      event.stopPropagation();
    }

    function syncWallpaperSelectionControls(selection) {
      elements.wallStylePanelContent
        ?.querySelectorAll('.oling-lab-wallpaper-gallery-card')
        .forEach((button) => {
          const selected =
            button.dataset.olingLabWallpaperKey === selection.wallpaperKey;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
      elements.wallStylePanelContent
        ?.querySelectorAll('.oling-lab-wallpaper-variant')
        .forEach((button) => {
          const selected =
            button.dataset.olingLabWallpaperKey === selection.wallpaperKey &&
            (button.dataset.olingLabWallpaperVariantKey || null) ===
              selection.variantKey;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
    }

    function commitDroppedWallpaper(selection) {
      if (!isOwnedSelection(selection.wallpaperKey, selection.variantKey))
        return false;
      const committed = getCommittedSelection();
      state.lab.appearance ||= {};
      state.lab.appearance.wallpaperKey = selection.wallpaperKey;
      state.lab.appearance.wallpaperVariantKey = selection.variantKey;
      delete state.lab.wallpaperKey;
      previewWallpaperKey = selection.wallpaperKey;
      previewWallpaperVariantKey = selection.variantKey;
      originalWallpaperKey = selection.wallpaperKey;
      originalWallpaperVariantKey = selection.variantKey;
      rememberWallpaperChoice(selection.wallpaperKey, selection.variantKey);
      applyWallpaper();
      updateApplyButton();
      syncWallpaperSelectionControls(selection);
      refreshWallpaperDetail?.();
      if (selectionIdentity(committed) !== selectionIdentity(selection)) {
        renderLab();
        saveLab();
      }
      return true;
    }

    function cleanUpWallpaperDrag(current) {
      clearWallpaperDropPreview(current);
      current.ghost?.remove();
      current.source?.classList.remove('is-drag-source');
      releaseWallpaperPointer(current.source, current.pointerId);
    }

    function finishWallpaperDrag(event, cancelled = false) {
      if (!wallpaperDrag || event.pointerId !== wallpaperDrag.pointerId) return;
      if (!cancelled) updateWallpaperDrag(event);
      const current = wallpaperDrag;
      wallpaperDrag = null;
      cleanUpWallpaperDrag(current);
      suppressedWallpaperClicks.add(current.source);
      if (!current.moved) {
        applyWallpaper();
        return;
      }
      if (!cancelled && current.overLab) {
        if (commitDroppedWallpaper(current.selection)) {
          playSound('uiDragPlace');
        } else {
          playSound('uiError');
        }
      } else {
        applyWallpaper();
      }
    }

    function cancelWallpaperDrag() {
      clearPendingWallpaperDrag();
      if (!wallpaperDrag) return;
      const current = wallpaperDrag;
      wallpaperDrag = null;
      cleanUpWallpaperDrag(current);
      applyWallpaper();
    }

    function consumeWallpaperDragClick(event, source) {
      if (!suppressedWallpaperClicks.has(source)) return false;
      suppressedWallpaperClicks.delete(source);
      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    function enableWallpaperDrag(button, selection) {
      button.addEventListener('pointerdown', (event) =>
        beginWallpaperDrag(event, selection, button)
      );
    }

    function cancelWallpaperPreview() {
      activeHeaderBackButton?.remove();
      activeHeaderBackButton = null;
      if (previewWallpaperKey === null && originalWallpaperKey === null) return;
      previewWallpaperKey = null;
      previewWallpaperVariantKey = null;
      originalWallpaperKey = null;
      originalWallpaperVariantKey = null;
    }

    function applyWallpaperSelection() {
      const selection = getSelectedSelection();
      if (!isOwnedSelection(selection.wallpaperKey, selection.variantKey)) {
        return;
      }
      state.lab.appearance ||= {};
      state.lab.appearance.wallpaperKey = selection.wallpaperKey;
      state.lab.appearance.wallpaperVariantKey = selection.variantKey;
      delete state.lab.wallpaperKey;
      rememberWallpaperChoice(selection.wallpaperKey, selection.variantKey);
      previewWallpaperKey = selection.wallpaperKey;
      previewWallpaperVariantKey = selection.variantKey;
      originalWallpaperKey = selection.wallpaperKey;
      originalWallpaperVariantKey = selection.variantKey;
      renderLab();
      applyWallpaper();
      syncWallpaperSelectionControls(selection);
      refreshWallpaperDetail?.();
      updateApplyButton();
      saveLab();
    }

    function setPreviewImage(image, wallpaper, variantKey, sourceUrl) {
      image.src = sourceUrl;
      const variant = getWallpaperVariant(wallpaper, variantKey);
      if (!variant?.colours) return;
      const expectedIdentity = getVariantEntitlementKey(
        wallpaper.key,
        variantKey
      );
      image.dataset.olingLabWallpaperSelection = expectedIdentity;
      getVariantImageUrl(wallpaper, variantKey, sourceUrl)
        .then((generatedUrl) => {
          if (image.dataset.olingLabWallpaperSelection === expectedIdentity) {
            image.src = generatedUrl;
          }
        })
        .catch((error) =>
          console.error('Failed to render wallpaper preview:', error)
        );
    }

    function createMiniatureLab(selection, label) {
      const frame = document.createElement('div');
      frame.className = 'oling-lab-wallpaper-lab-preview';
      frame.setAttribute('aria-label', label);

      const room = elements.room.cloneNode(true);
      room.removeAttribute('id');
      room.classList.add('oling-lab-wallpaper-room-snapshot');
      room.setAttribute('aria-hidden', 'true');
      room.setAttribute('inert', '');
      room
        .querySelectorAll(
          '.oling-lab-cell, .oling-lab-roamer, .oling-lab-action-panel, .oling-lab-item-hit, [data-oling-lab-preview-exclude]'
        )
        .forEach((element) => element.remove());
      room
        .querySelectorAll('.is-selected')
        .forEach((element) => element.classList.remove('is-selected'));

      const placedColumns = (state.lab?.placedItems || []).reduce(
        (maximum, placed) =>
          Math.max(
            maximum,
            Number(placed?.col || 0) + Number(placed?.width || 1)
          ),
        0
      );
      const unlockedColumns = (state.lab?.unlockedCells || []).reduce(
        (maximum, key) => {
          const column = Number(String(key).split(':')[1]);
          return Number.isFinite(column)
            ? Math.max(maximum, column + 1)
            : maximum;
        },
        0
      );
      const actualLabColumns = Math.max(
        0,
        Number(state.lab?.columns) || 0,
        placedColumns,
        unlockedColumns
      );
      const previewColumns = Math.max(
        1,
        actualLabColumns ||
          Number(room.style.getPropertyValue('--lab-columns')) ||
          1
      );
      const previewAspectRatio = 16 / 9;
      const roomAspectRatio = previewColumns / 2;
      const roomWidth = (roomAspectRatio / previewAspectRatio) * 100;
      const roomHeight = 100;
      room.style.left = `${(100 - roomWidth) / 2}%`;
      room.style.top = `${(100 - roomHeight) / 2}%`;
      room.style.width = `${roomWidth}%`;
      room.style.height = `${roomHeight}%`;
      room.style.setProperty('--lab-columns', previewColumns);
      room.querySelectorAll('.oling-lab-item').forEach((item) => {
        const row = Number(item.style.getPropertyValue('--item-row')) || 0;
        const col = Number(item.style.getPropertyValue('--item-col')) || 0;
        const width = Number(item.style.getPropertyValue('--item-width')) || 1;
        const height =
          Number(item.style.getPropertyValue('--item-height')) || 1;
        item.style.left = `${(col / previewColumns) * 100}%`;
        item.style.top = `${(row / 2) * 100}%`;
        item.style.width = `${(width / previewColumns) * 100}%`;
        item.style.height = `${(height / 2) * 100}%`;
      });
      room.querySelectorAll('.oling-lab-wall-decoration').forEach((item) => {
        const x =
          Number(item.style.getPropertyValue('--wall-decoration-x')) || 0;
        const y =
          Number(item.style.getPropertyValue('--wall-decoration-y')) || 0;
        const width =
          Number(item.style.getPropertyValue('--wall-decoration-width')) || 0;
        const height =
          Number(item.style.getPropertyValue('--wall-decoration-height')) || 0;
        item.style.left = `${((x - width / 2) / previewColumns) * 100}%`;
        item.style.top = `${((y - height / 2) / 2) * 100}%`;
        item.style.width = `${(width / previewColumns) * 100}%`;
        item.style.height = `${(height / 2) * 100}%`;
      });
      applyWallpaperToTarget(room, selection, {
        miniature: true,
        columns: previewColumns
      });
      frame.append(room);
      return frame;
    }

    function getChoiceForWallpaper(wallpaper, selection) {
      const choices = getOwnedWallpaperChoices(wallpaper);
      const selectedChoice =
        selection.wallpaperKey === wallpaper.key
          ? choices.find((choice) => choice.variantKey === selection.variantKey)
          : null;
      if (selectedChoice) return selectedChoice;
      if (state.wallpaperVariantSelections.has(wallpaper.key)) {
        const rememberedVariantKey = state.wallpaperVariantSelections.get(
          wallpaper.key
        );
        const rememberedChoice = choices.find(
          (choice) => choice.variantKey === rememberedVariantKey
        );
        if (rememberedChoice) return rememberedChoice;
      }
      return choices[0] || null;
    }

    function getMenuHeader() {
      return elements.wallStylePanelHeader || null;
    }

    function removeHeaderBackButton() {
      activeHeaderBackButton?.remove();
      activeHeaderBackButton = null;
    }

    function showHeaderBackButton(onBack) {
      removeHeaderBackButton();
      const header = getMenuHeader();
      if (!header) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'oling-lab-panel-back oling-lab-wallpaper-back';
      button.dataset.soundIntent = 'previous';
      button.dataset.olingLabWallpaperBack = '';
      button.setAttribute('aria-label', 'Back to wallpaper styles');
      button.textContent = 'Back';
      button.addEventListener('click', onBack);
      header.insertBefore(
        button,
        elements.wallStylePanelTitle || header.firstChild
      );
      activeHeaderBackButton = button;
    }

    function setPanelCollapsed(collapsed, options = {}) {
      const wasCollapsed = Boolean(state.wallStylePanelCollapsed);
      state.wallStylePanelCollapsed = Boolean(collapsed);
      elements.wallStylePanel?.classList.toggle(
        'is-collapsed',
        state.wallStylePanelCollapsed
      );
      elements.wallStylePanelToggle?.setAttribute(
        'aria-expanded',
        String(!state.wallStylePanelCollapsed)
      );
      if (elements.wallStylePanelToggle) {
        elements.wallStylePanelToggle.dataset.sound = 'none';
        delete elements.wallStylePanelToggle.dataset.soundIntent;
        elements.wallStylePanelToggle.textContent =
          state.wallStylePanelCollapsed ? 'Show' : 'Hide';
        elements.wallStylePanelToggle.setAttribute(
          'aria-label',
          state.wallStylePanelCollapsed
            ? 'Show Wall Style panel'
            : 'Hide Wall Style panel'
        );
      }
      if (
        wasCollapsed !== state.wallStylePanelCollapsed &&
        state.wallStylePanelOpen &&
        options.sound !== false
      ) {
        playSound(
          state.wallStylePanelCollapsed ? 'sidePanelClose' : 'sidePanelOpen'
        );
      }
    }

    function openWallpaperPanel() {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.wallStylePanel;
      const wasOpen = Boolean(
        state.wallStylePanelOpen &&
        panel &&
        !panel.hidden &&
        panel.classList.contains('is-open') &&
        !state.wallStylePanelCollapsed
      );
      state.wallStylePanelOpen = true;
      state.wallStylePanelCollapsed = false;
      if (!panel) return;
      panel.hidden = false;
      panel.classList.remove('is-open', 'is-collapsed');
      setPanelCollapsed(false, { sound: false });
      panel.getBoundingClientRect();
      const showPanel = () => {
        if (transitionId !== panelTransitionId || !state.wallStylePanelOpen)
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

    function closeWallpaperPanel(options = {}) {
      const transitionId = (panelTransitionId += 1);
      const panel = elements.wallStylePanel;
      const wasVisible = Boolean(
        state.wallStylePanelOpen && panel && !panel.hidden
      );
      state.wallStylePanelOpen = false;
      cancelWallpaperDrag();
      applyWallpaper();
      const playCloseSound = () => {
        if (wasVisible && options.sound !== false) playSound('sidePanelClose');
      };
      const finishClose = () => {
        if (transitionId !== panelTransitionId || state.wallStylePanelOpen)
          return;
        cancelWallpaperPreview();
        removeHeaderBackButton();
        if (elements.wallStylePanelTitle)
          elements.wallStylePanelTitle.textContent = 'Wall Style';
        elements.wallStylePanelContent?.replaceChildren();
        elements.wallStylePanelFooter?.replaceChildren();
        refreshWallpaperDetail = null;
        if (panel) panel.hidden = true;
      };
      if (!panel) {
        finishClose();
        return undefined;
      }
      if (panelTransitions) {
        return panelTransitions.close(panel, {
          beforeExit: playCloseSound,
          afterClose: finishClose
        });
      }
      const canAnimate = !panel.hidden;
      panel.classList.remove('is-open', 'is-collapsed');
      playCloseSound();
      const reducedMotion = Boolean(
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      );
      if (!canAnimate || reducedMotion || !window.setTimeout) {
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

    function openWallpaperMenu() {
      const committed = getCommittedSelection();
      rememberWallpaperChoice(committed.wallpaperKey, committed.variantKey);
      originalWallpaperKey = committed.wallpaperKey;
      originalWallpaperVariantKey = committed.variantKey;
      previewWallpaperKey = committed.wallpaperKey;
      previewWallpaperVariantKey = committed.variantKey;
      const wallpapers = [...state.wallpapers.values()]
        .filter((wallpaper) => getOwnedWallpaperChoices(wallpaper).length)
        .sort((left, right) =>
          String(left.name).localeCompare(String(right.name))
        );
      openWallpaperPanel();

      const applyButton = createInlineAction('Apply', applyWallpaperSelection, {
        soundIntent: 'confirm'
      });
      applyButton.dataset.olingLabWallpaperApply = '';
      applyButton.disabled = true;
      const footer = document.createElement('div');
      footer.className = 'oling-lab-wallpaper-actions';
      footer.append(applyButton);

      function setFooterActionsVisible(visible) {
        footer.classList.toggle('are-actions-hidden', !visible);
        footer.setAttribute('aria-hidden', visible ? 'false' : 'true');
        applyButton.tabIndex = visible ? 0 : -1;
        if (elements.wallStylePanelFooter)
          elements.wallStylePanelFooter.hidden = !visible;
      }

      setFooterActionsVisible(false);

      if (!wallpapers.length) {
        if (elements.wallStylePanelTitle)
          elements.wallStylePanelTitle.textContent = 'Wall Style';
        elements.wallStylePanelContent?.replaceChildren(
          Object.assign(document.createElement('p'), {
            className: 'oling-lab-wall-decoration-panel-empty',
            textContent: 'No wallpapers are available.'
          })
        );
        elements.wallStylePanelFooter?.replaceChildren(footer);
        return;
      }

      let carouselIndex = Math.max(
        0,
        wallpapers.findIndex(
          (wallpaper) => wallpaper.key === getSelectedSelection().wallpaperKey
        )
      );
      const content = document.createElement('div');
      content.className = 'oling-lab-wallpaper-browser';

      function renderVariantPicker(wallpaper, selectedChoice) {
        const section = document.createElement('section');
        section.className = 'oling-lab-wallpaper-variant-section';
        const picker = document.createElement('div');
        picker.className = 'oling-lab-wallpaper-variants';
        picker.setAttribute('aria-label', 'Wallpaper colour variants');

        getOwnedWallpaperChoices(wallpaper).forEach((choice) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'oling-lab-wallpaper-variant';
          button.dataset.soundIntent = 'select';
          const selected = choice.variantKey === selectedChoice.variantKey;
          button.classList.toggle('is-selected', selected);
          button.setAttribute('aria-pressed', selected ? 'true' : 'false');
          button.setAttribute(
            'aria-label',
            `${wallpaper.name}: ${choice.name}`
          );

          const image = document.createElement('img');
          const choiceSelection = {
            wallpaperKey: wallpaper.key,
            variantKey: choice.variantKey
          };
          const resolved = getResolvedWallpaper(choiceSelection);
          setPreviewImage(
            image,
            wallpaper,
            choice.variantKey,
            resolved?.preview || wallpaper.preview || wallpaper.image
          );
          image.alt = '';
          const name = document.createElement('span');
          name.textContent = choice.name;
          button.append(image, name);
          enableWallpaperDrag(button, choiceSelection);
          button.dataset.olingLabWallpaperKey = wallpaper.key;
          button.dataset.olingLabWallpaperVariantKey = choice.variantKey || '';
          button.addEventListener('click', (event) => {
            if (consumeWallpaperDragClick(event, button)) return;
            selectWallpaper(wallpaper.key, choice.variantKey);
            renderDetail();
          });
          picker.append(button);
        });

        section.append(picker);
        return section;
      }

      function renderDetail() {
        const wallpaper = wallpapers[carouselIndex];
        let selection = getSelectedSelection();
        let selectedChoice = getChoiceForWallpaper(wallpaper, selection);
        if (!selectedChoice) {
          selectedChoice = getOwnedWallpaperChoices(wallpaper)[0];
        }
        if (selection.wallpaperKey !== wallpaper.key) {
          selectWallpaper(wallpaper.key, selectedChoice.variantKey);
          selection = getSelectedSelection();
        }

        const detail = document.createElement('div');
        detail.className = 'oling-lab-wallpaper-detail';
        const carousel = document.createElement('div');
        carousel.className = 'oling-lab-wallpaper-carousel';
        const preview = document.createElement('div');
        preview.className = 'oling-lab-wallpaper-carousel-preview';
        const card = document.createElement('figure');
        card.className = 'oling-lab-wallpaper-carousel-card is-selected';
        card.dataset.olingLabWallpaperKey = wallpaper.key;
        card.setAttribute('aria-current', 'true');
        const labPreview = createMiniatureLab(
          selection,
          `${wallpaper.name}${
            selectedChoice.variantKey ? ` ${selectedChoice.name}` : ''
          } in your Lab`
        );
        const caption = document.createElement('figcaption');
        if (selectedChoice.variantKey) {
          caption.textContent = selectedChoice.name;
          card.append(labPreview, caption);
        } else {
          card.append(labPreview);
        }
        preview.replaceChildren(card);
        carousel.append(preview);
        detail.append(carousel, renderVariantPicker(wallpaper, selectedChoice));
        content.replaceChildren(detail);
        if (elements.wallStylePanelTitle)
          elements.wallStylePanelTitle.textContent = wallpaper.name;
        setFooterActionsVisible(true);
        showHeaderBackButton(renderGallery);
      }

      function renderGallery() {
        removeHeaderBackButton();
        if (elements.wallStylePanelTitle)
          elements.wallStylePanelTitle.textContent = 'Wall Style';
        setFooterActionsVisible(false);
        const gallery = document.createElement('div');
        gallery.className = 'oling-lab-wallpaper-gallery';
        const selection = getSelectedSelection();
        wallpapers.forEach((wallpaper, index) => {
          const choice = getChoiceForWallpaper(wallpaper, selection);
          const choiceSelection = {
            wallpaperKey: wallpaper.key,
            variantKey: choice.variantKey
          };
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'oling-lab-wallpaper-gallery-card';
          button.dataset.soundIntent = 'select';
          button.dataset.olingLabWallpaperKey = wallpaper.key;
          button.classList.toggle(
            'is-selected',
            selection.wallpaperKey === wallpaper.key
          );
          button.setAttribute(
            'aria-pressed',
            selection.wallpaperKey === wallpaper.key ? 'true' : 'false'
          );
          const image = document.createElement('img');
          const resolved = getResolvedWallpaper(choiceSelection);
          setPreviewImage(
            image,
            wallpaper,
            choice.variantKey,
            resolved?.preview || wallpaper.preview || wallpaper.image
          );
          image.alt = '';
          button.append(
            image,
            Object.assign(document.createElement('span'), {
              textContent: wallpaper.name
            })
          );
          enableWallpaperDrag(button, choiceSelection);
          button.addEventListener('click', (event) => {
            if (consumeWallpaperDragClick(event, button)) return;
            carouselIndex = index;
            selectWallpaper(wallpaper.key, choice.variantKey);
            renderDetail();
          });
          gallery.append(button);
        });
        content.replaceChildren(gallery);
      }

      refreshWallpaperDetail = () => {
        if (content.querySelector('.oling-lab-wallpaper-detail')) {
          renderDetail();
        }
      };

      elements.wallStylePanelContent?.replaceChildren(content);
      elements.wallStylePanelFooter?.replaceChildren(footer);
      renderGallery();
      updateApplyButton();
    }

    elements.wallStylePanelToggle?.addEventListener('click', () =>
      setPanelCollapsed(!state.wallStylePanelCollapsed)
    );
    elements.wallStylePanel?.addEventListener('pointerdown', (event) =>
      event.stopPropagation()
    );
    window.addEventListener?.('pointermove', (event) => {
      if (
        pendingWallpaperDrag &&
        event.pointerId === pendingWallpaperDrag.pointerId
      ) {
        pendingWallpaperDrag.clientX = event.clientX;
        pendingWallpaperDrag.clientY = event.clientY;
        pendingWallpaperDrag.moved ||=
          Math.hypot(
            event.clientX - pendingWallpaperDrag.startX,
            event.clientY - pendingWallpaperDrag.startY
          ) > 5;
        return;
      }
      if (!wallpaperDrag || event.pointerId !== wallpaperDrag.pointerId) return;
      updateWallpaperDrag(event);
      event.preventDefault();
    });
    window.addEventListener?.('pointerup', (event) => {
      if (
        pendingWallpaperDrag &&
        event.pointerId === pendingWallpaperDrag.pointerId
      ) {
        clearPendingWallpaperDrag(pendingWallpaperDrag.moved);
        return;
      }
      finishWallpaperDrag(event);
    });
    window.addEventListener?.('pointercancel', (event) => {
      if (
        pendingWallpaperDrag &&
        event.pointerId === pendingWallpaperDrag.pointerId
      ) {
        clearPendingWallpaperDrag();
        return;
      }
      finishWallpaperDrag(event, true);
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') cancelWallpaperDrag();
      });
    }

    window.addEventListener?.('pagehide', () => {
      generatedObjectUrls.forEach((url) => URL.revokeObjectURL?.(url));
      generatedObjectUrls.clear();
    });

    return {
      getSelectedWallpaper,
      getSelectedWallpaperVariant,
      applyWallpaper,
      selectWallpaper,
      cancelWallpaperPreview,
      applyWallpaperSelection,
      openWallpaperMenu,
      closeWallpaperPanel
    };
  }

  window.createOlingLabWallpapers = createOlingLabWallpapers;
})();

(function () {
  function createOlingLabShelfStorage(dependencies, shelfInventory) {
    const {
      furnitureGridSize: FURNITURE_GRID_SIZE,
      createImage,
      setPanelInteractivity,
      openStagePanel,
      closeStagePanel,
      getFurniturePlacement
    } = dependencies;
    const { createShelfDetailsPanel, getShelfInventoryItems } = shelfInventory;

function createShelfStorageTab(placed, item) {
      const section = document.createElement('section');
      section.className = 'oling-lab-menu-section oling-lab-shelf-section';
      const stage = document.createElement('section');
      stage.className = 'oling-lab-egg-insertion-stage oling-lab-shelf-stage';
      const viewport = document.createElement('div');
      viewport.className = 'oling-lab-shelf-viewport';
      const shelf = document.createElement('div');
      shelf.className = 'oling-lab-shelf-grid';
      const placement = getFurniturePlacement(item);
      const shelfArtboard = document.createElement('div');
      shelfArtboard.className = 'oling-lab-shelf-artboard';
      const shelfArt = createImage(item.image, item.name);
      shelfArt.className = 'oling-lab-shelf-art';
      shelfArtboard.appendChild(shelfArt);
      shelf.appendChild(shelfArtboard);
      const view = {
        scale: 1,
        x: 0,
        y: 0,
        dragging: false,
        dragged: false,
        pointerId: null
      };
      const applyShelfView = () => {
        const maxX = (viewport.clientWidth * (view.scale - 1)) / 2;
        const maxY = (viewport.clientHeight * (view.scale - 1)) / 2;
        view.x = Math.max(-maxX, Math.min(maxX, view.x));
        view.y = Math.max(-maxY, Math.min(maxY, view.y));
        shelf.style.width = `${view.scale * 100}%`;
        shelf.style.height = `${view.scale * 100}%`;
        shelf.style.transform = `translate(-50%, -50%) translate3d(${view.x}px, ${view.y}px, 0)`;
        const canvasSize = Math.min(shelf.clientWidth, shelf.clientHeight);
        const canvasLeft = (shelf.clientWidth - canvasSize) / 2;
        const canvasTop = (shelf.clientHeight - canvasSize) / 2;
        const scale = canvasSize / FURNITURE_GRID_SIZE;
        shelfArtboard.style.left = `${canvasLeft + placement.x * scale}px`;
        shelfArtboard.style.top = `${canvasTop + placement.y * scale}px`;
        shelfArtboard.style.width = `${placement.width * scale}px`;
        shelfArtboard.style.height = `${placement.height * scale}px`;
      };
      const setShelfScale = (scale) => {
        view.scale = Math.max(1, Math.min(3, Number(scale) || 1));
        if (view.scale === 1) {
          view.x = 0;
          view.y = 0;
        }
        applyShelfView();
      };
      let panel = null;
      const closePanel = () => {
        if (!panel) return;
        closeStagePanel(stage, panel, 'is-viewing-shelf-slot', () => {
          panel = null;
        });
      };
      const storedItems = getShelfInventoryItems();
      (item.inventorySlots || []).forEach((slotDefinition, index) => {
        const storedItem = storedItems[index] || null;
        const button = document.createElement('button');
        button.className = 'oling-lab-shelf-slot';
        button.type = 'button';
        const slotX = Number(slotDefinition?.x || 256);
        const slotY = Number(slotDefinition?.y || 256);
        const slotWidth = Number(slotDefinition?.width || 48);
        const slotHeight = Number(slotDefinition?.height || 48);
        button.style.setProperty(
          '--shelf-slot-x',
          `${((slotX - placement.x) / placement.width) * 100}%`
        );
        button.style.setProperty(
          '--shelf-slot-y',
          `${((slotY - placement.y) / placement.height) * 100}%`
        );
        button.style.setProperty(
          '--shelf-slot-width',
          `${(slotWidth / placement.width) * 100}%`
        );
        button.style.setProperty(
          '--shelf-slot-height',
          `${(slotHeight / placement.height) * 100}%`
        );
        button.setAttribute(
          'aria-label',
          storedItem
            ? `${storedItem.name}, ${storedItem.quantity} in storage`
            : 'Empty shelf slot'
        );
        if (storedItem?.image)
          button.appendChild(createImage(storedItem.image, ''));
        button.addEventListener('click', () => {
          if (panel) closePanel();
          if (!storedItem) return;
          panel = createShelfDetailsPanel(storedItem, closePanel);
          setPanelInteractivity(panel, true);
          stage.appendChild(panel);
          openStagePanel(stage, panel, 'is-viewing-shelf-slot');
        });
        shelfArtboard.appendChild(button);
      });
      viewport.appendChild(shelf);
      viewport.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          setShelfScale(view.scale + (event.deltaY < 0 ? 0.25 : -0.25));
        },
        { passive: false }
      );
      viewport.addEventListener('pointerdown', (event) => {
        view.dragging = true;
        view.dragged = false;
        view.pointerId = event.pointerId;
        view.startX = event.clientX;
        view.startY = event.clientY;
        view.lastX = event.clientX;
        view.lastY = event.clientY;
      });
      viewport.addEventListener('pointermove', (event) => {
        if (!view.dragging || event.pointerId !== view.pointerId) return;
        if (!view.dragged) {
          view.dragged =
            Math.hypot(
              event.clientX - view.startX,
              event.clientY - view.startY
            ) >= 4;
        }
        if (!view.dragged) return;
        if (!viewport.hasPointerCapture?.(event.pointerId)) {
          viewport.setPointerCapture?.(event.pointerId);
          viewport.classList.add('is-panning');
        }
        view.x += event.clientX - view.lastX;
        view.y += event.clientY - view.lastY;
        view.lastX = event.clientX;
        view.lastY = event.clientY;
        applyShelfView();
      });
      const stopShelfPan = (event) => {
        if (!view.dragging || event.pointerId !== view.pointerId) return;
        view.dragging = false;
        view.pointerId = null;
        viewport.classList.remove('is-panning');
      };
      viewport.addEventListener('pointerup', stopShelfPan);
      viewport.addEventListener('pointercancel', stopShelfPan);
      viewport.addEventListener(
        'click',
        (event) => {
          if (!view.dragged) return;
          view.dragged = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true
      );

      const controls = document.createElement('div');
      controls.className = 'oling-lab-shelf-zoom-controls';
      [
        {
          label: '−',
          title: 'Zoom out',
          action: () => setShelfScale(view.scale - 0.25)
        },
        {
          label: 'Reset',
          title: 'Reset shelf view',
          action: () => setShelfScale(1)
        },
        {
          label: '+',
          title: 'Zoom in',
          action: () => setShelfScale(view.scale + 0.25)
        }
      ].forEach((control) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = control.label;
        button.setAttribute('aria-label', control.title);
        button.addEventListener('click', control.action);
        controls.appendChild(button);
      });
      stage.append(viewport, controls);
      window.requestAnimationFrame(applyShelfView);
      section.appendChild(stage);
      return [section];
    }

    return { createShelfStorageTab };
  }

  window.createOlingLabShelfStorage = createOlingLabShelfStorage;
})();

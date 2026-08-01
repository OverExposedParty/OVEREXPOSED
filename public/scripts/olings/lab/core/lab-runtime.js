(function () {
  window.createOlingLabRuntime = () => {
    const constants = {
      LAB_ENDPOINT: '/api/olings/lab',
      LAB_EXPANSION_ENDPOINT: '/api/olings/lab/expand',
      HATCH_ENDPOINT: '/api/olings/hatch',
      MY_OLINGS_ENDPOINT: '/api/olings/mine',
      RARITY_PALETTE_ENDPOINT: '/json-files/olings/rarities.json',
      FURNITURE_GRID_SIZE: 512,
      DEFAULT_HATCH_DURATION_MS: 2 * 60 * 60 * 1000,
      OLING_REST_DURATION_MS: Object.freeze({
        common: 10 * 60 * 60 * 1000,
        uncommon: 8 * 60 * 60 * 1000,
        rare: 6 * 60 * 60 * 1000,
        epic: 4.5 * 60 * 60 * 1000,
        legendary: 3 * 60 * 60 * 1000,
        mythic: 2 * 60 * 60 * 1000
      }),
      OLING_LAYERS: ['flight', 'body', 'eyes', 'mouth'],
      ROWS: 2,
      OLING_ROAM_MIN_Y: 0.22,
      OLING_ROAM_MAX_Y: 0.78,
      OLING_ROAM_SPEED_MIN: 18,
      OLING_ROAM_SPEED_MAX: 34,
      OLING_REST_VISUAL_CONFIG: Object.freeze({
        originPath: '/images/olings/interaction-points/rest-z-origin.svg',
        closedEyesPath: '/images/olings/states/rest/closed-eyes.svg',
        debugAnchor: false,
        burstIncrement: 3,
        burstDelayMs: 3200,
        burstStepDelayMs: 700,
        lifetimeMs: 1500,
        driftDistancePx: 32,
        riseDistancePx: 46,
        swayMinPx: 3,
        swayMaxPx: 5,
        maxActiveZs: 3
      }),
      EGG_PICKER_TRANSITION_MS: 240,
      OLING_CONTAINER_THEMES: {
        incubation: { primaryColour: '#FFD6A5', secondaryColour: '#E8B77E' },
        'olings-lab': { primaryColour: '#B8E1FF', secondaryColour: '#84BEE8' },
        'battle-arena': { primaryColour: '#FFB5C8', secondaryColour: '#E684A1' },
        'oling-collection': {
          primaryColour: '#C9B6FF',
          secondaryColour: '#A18AE8'
        },
        'egg-shop': { primaryColour: '#FFF1A8', secondaryColour: '#D8C96A' },
        'quests-adventures': {
          primaryColour: '#B7F0C1',
          secondaryColour: '#7FD194'
        },
        'oling-profile': { primaryColour: '#FFD1E8', secondaryColour: '#E39BC1' },
        inventory: { primaryColour: '#D7F5E8', secondaryColour: '#8ED8B8' },
        trading: { primaryColour: '#CFF0FF', secondaryColour: '#79CBE8' },
        achievements: { primaryColour: '#FFE3B8', secondaryColour: '#E6A85F' },
        settings: { primaryColour: '#DDE3F0', secondaryColour: '#9FAECB' },
        'social-friends': { primaryColour: '#F8C7FF', secondaryColour: '#D987E6' },
        'care-mood': { primaryColour: '#FFE0C7', secondaryColour: '#E89B70' },
        customisation: { primaryColour: '#D6C8FF', secondaryColour: '#9C84E8' },
        'rarity-special': { primaryColour: '#F6E7FF', secondaryColour: '#C08BE8' },
        warning: { primaryColour: '#FFC9B8', secondaryColour: '#E8846B' },
        success: {
          primaryColour: 'var(--successcolour)',
          secondaryColour: 'var(--successcoloursecondary)'
        },
        'locked-disabled': { primaryColour: '#D8D8D8', secondaryColour: '#9A9A9A' }
      },
      ITEM_INFLUENCE_SLOTS: [
        {
          key: 'hatch',
          label: 'Hatch Influence',
          category: 'hatching',
          subcategory: 'speed',
          effectTypes: ['hatch_speed']
        },
        {
          key: 'rarity',
          label: 'Rarity Influence',
          category: 'hatching',
          subcategory: 'rarity',
          effectTypes: ['rarity_chance']
        },
        {
          key: 'personality',
          label: 'Personality Influence',
          category: 'hatching',
          subcategory: 'personality',
          effectTypes: ['personality_chance']
        },
        {
          key: 'matching-set',
          label: 'Matching Set Influence',
          category: 'hatching',
          subcategory: 'matching-set',
          effectTypes: ['matching_set', 'set_match']
        }
      ]
    };

    const state = {
      layers: constants.OLING_LAYERS,
      catalog: new Map(),
      eggs: new Map(),
      consumables: new Map(),
      olings: [],
      olingRoam: new Map(),
      owned: new Set(),
      ownedEggs: [],
      ownedConsumables: [],
      rarityPalette: {},
      lab: null,
      account: null,
      expansion: null,
      editMode: false,
      selectedTarget: null,
      menuSelectedTarget: null,
      pinnedMenu: false,
      sellConfirmTarget: null,
      incubatorPanelTargets: {},
      incubatorItemInfluenceSelections: {},
      animatingIncubatorPanelTarget: null,
      saving: false,
      expanding: false,
      hatching: false,
      hatchTimerInterval: null,
      restTimerInterval: null,
      adventureTimerInterval: null,
      activeAdventure: null,
      explorerAdventureKey: null,
      explorerOlingIndex: 0,
      restOlingIndex: 0,
      explorerTabLabel: 'Overview',
      explorerDiscoveryIndex: null,
      roamAnimationFrame: null,
      lastRoamFrameAt: null,
      camera: {
        x: 0,
        y: 0,
        scale: 1,
        targetX: 0,
        targetY: 0,
        targetScale: 1,
        frame: null,
        initialized: false,
        dragging: false,
        dragMoved: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        lastX: 0,
        lastY: 0
      }
    };

    const elements = {
      page: document.querySelector('.oling-lab-page'),
      room: document.getElementById('oling-lab-room'),
      viewport: document.getElementById('oling-lab-viewport'),
      editToggle: document.getElementById('oling-lab-edit-toggle'),
      status: document.getElementById('oling-lab-save-status'),
      scrollLeft: document.getElementById('oling-lab-scroll-left'),
      scrollRight: document.getElementById('oling-lab-scroll-right'),
      actionPanel: null,
      backdrop: document.getElementById('oling-lab-menu-backdrop'),
      menu: document.querySelector('.oling-lab-menu'),
      menuTabs: document.getElementById('oling-lab-menu-tabs'),
      menuTitle: document.getElementById('oling-lab-menu-title'),
      menuContent: document.getElementById('oling-lab-menu-content'),
      menuFooter: document.getElementById('oling-lab-menu-footer'),
      menuClose: document.getElementById('oling-lab-menu-close')
    };

    const getLabImageAssetUrl = (assetUrl) =>
      String(assetUrl || '').replace(
        '/images/olings/furniture/ceiling-lights/basic-hanging-light.svg',
        '/images/olings/furniture/ceiling-lights/basic-hanging-light/basic-hanging-light.svg'
      );
    const setStatus = (message) => {
      if (elements.status) elements.status.textContent = message;
    };
    const clearTimer = (key) => {
      if (!state[key]) return;
      window.clearInterval(state[key]);
      state[key] = null;
    };
    const clearHatchTimer = () => clearTimer('hatchTimerInterval');
    const clearRestTimer = () => clearTimer('restTimerInterval');
    const clearAdventureTimer = () => clearTimer('adventureTimerInterval');
    const parsePayload = (response) =>
      response.json().then((payload) => {
        if (!response.ok || payload.success === false) {
          throw new Error(payload.error?.message || 'Lab request failed');
        }
        return payload;
      });
    const getTargetKey = (target) =>
      target ? `${target.type}:${target.id}` : '';
    const isTargetSelected = (type, id) =>
      getTargetKey(state.selectedTarget) === `${type}:${id}`;
    const closeSelectedTarget = () => {
      state.selectedTarget = null;
      state.sellConfirmTarget = null;
      if (elements.actionPanel) {
        elements.actionPanel.remove();
        elements.actionPanel = null;
      }
    };
    const createSelectionTools = ({ renderLab, openPlacedItemMenu }) => ({
      toggleSelectedTarget(type, id) {
        if (isTargetSelected(type, id)) {
          closeSelectedTarget();
        } else {
          state.selectedTarget = { type, id };
          state.sellConfirmTarget = null;
        }
        renderLab();
      },
      openFurnitureEditor(placedId) {
        closeSelectedTarget();
        openPlacedItemMenu(placedId);
      }
    });
    const bindEvents = ({
      ensureCameraFrame,
      panLabBy,
      zoomLabAt,
      clampCameraTarget,
      closeMenu,
      renderLab
    }) => {
      ensureCameraFrame();
      elements.editToggle.addEventListener('click', () => {
        state.editMode = !state.editMode;
        closeSelectedTarget();
        renderLab();
      });
      elements.scrollLeft.addEventListener('click', () => panLabBy(420, 0));
      elements.scrollRight.addEventListener('click', () => panLabBy(-420, 0));
      elements.viewport.addEventListener('pointerdown', (event) => {
        if (
          !event.isPrimary ||
          (event.pointerType === 'mouse' && event.button > 1)
        )
          return;
        state.camera.dragging = true;
        state.camera.dragMoved = false;
        state.camera.pointerId = event.pointerId;
        state.camera.startX = event.clientX;
        state.camera.startY = event.clientY;
        state.camera.lastX = event.clientX;
        state.camera.lastY = event.clientY;
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
        state.camera.dragging = false;
        state.camera.pointerId = null;
        elements.viewport.classList.remove('is-panning');
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
          event.preventDefault();
          const factor = Math.exp(-event.deltaY * 0.0015);
          zoomLabAt(
            event.clientX,
            event.clientY,
            state.camera.targetScale * factor
          );
        },
        { passive: false }
      );
      elements.viewport.addEventListener('contextmenu', (event) => {
        if (state.camera.dragging) event.preventDefault();
      });
      window.addEventListener('resize', clampCameraTarget);
      if (elements.menuClose) {
        elements.menuClose.addEventListener('click', closeMenu);
      }
      elements.room.addEventListener('click', (event) => {
        if (
          !event.target.closest('.oling-lab-item') &&
          !event.target.closest('.oling-lab-roamer') &&
          !event.target.closest('.oling-lab-action-panel')
        ) {
          closeSelectedTarget();
          renderLab();
        }
      });
      elements.backdrop.addEventListener('click', (event) => {
        if (event.target === elements.backdrop) closeMenu();
      });
      elements.menu?.addEventListener('click', (event) => event.stopPropagation());
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          closeSelectedTarget();
          closeMenu();
          renderLab();
        }
      });
    };

    return {
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
    };
  };
})();

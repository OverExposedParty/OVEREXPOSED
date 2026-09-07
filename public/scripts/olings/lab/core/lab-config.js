(function () {
  function createOlingLabConfig(location = window.location) {
    const pathname = String(location?.pathname || '').replace(/\/+$/, '');
    const tutorialMode = pathname === '/olings/lab/tutorial';
    const visitorMatch = tutorialMode
      ? null
      : pathname.match(/^\/olings\/lab\/([^/]+)$/i);
    let visitorUsername = null;
    try {
      visitorUsername = visitorMatch
        ? decodeURIComponent(visitorMatch[1]).replace(/^@+/, '')
        : null;
    } catch {
      visitorUsername = null;
    }
    const visitorMode = Boolean(visitorUsername);
    const LAB_INTERACTION_MODES = Object.freeze({
      default: Object.freeze({
        camera: true,
        furnitureMenus: true,
        furnitureDragging: false,
        olingMenus: true,
        olingDragging: true,
        olingInteractions: true,
        labExpansion: false,
        wallDecorations: false
      }),
      furniture: Object.freeze({
        camera: true,
        furnitureMenus: false,
        furnitureDragging: true,
        olingMenus: false,
        olingDragging: false,
        olingInteractions: false,
        labExpansion: true,
        wallDecorations: false
      }),
      'wall-style': Object.freeze({
        camera: true,
        furnitureMenus: false,
        furnitureDragging: false,
        olingMenus: false,
        olingDragging: false,
        olingInteractions: false,
        labExpansion: false,
        wallDecorations: false
      }),
      'wall-decorations': Object.freeze({
        camera: true,
        furnitureMenus: false,
        furnitureDragging: false,
        olingMenus: false,
        olingDragging: false,
        olingInteractions: false,
        labExpansion: false,
        wallDecorations: true
      })
    });
    const OLING_VISIBILITY_CONTEXTS = Object.freeze({
      CUSTOMISE: 'customise',
      HATCH_REVEAL: 'hatch-reveal',
      LAB_PREVIEW: 'lab-preview',
      ADVENTURE_TRANSITION: 'adventure-transition'
    });
    return {
      LAB_ENDPOINT: tutorialMode
        ? '/api/olings/lab/tutorial'
        : visitorMode
          ? `/api/olings/labs/${encodeURIComponent(visitorUsername)}`
          : '/api/olings/lab',
      LAB_PRIVACY_ENDPOINT: '/api/olings/lab/privacy',
      VISITOR_MODE: visitorMode,
      VISITOR_USERNAME: visitorUsername,
      LAB_EXPANSION_ENDPOINT: '/api/olings/lab/expand',
      HATCH_ENDPOINT: '/api/olings/hatch',
      MY_OLINGS_ENDPOINT: '/api/olings/mine',
      OLING_STORAGE_ENDPOINT: '/api/olings/storage',
      RARITY_PALETTE_ENDPOINT: '/json-files/olings/rarities.json',
      FURNITURE_GRID_SIZE: 512,
      LAB_DRAG_HOLD_DELAY_MS: 220,
      LAB_INTERACTION_MODES,
      OLING_VISIBILITY_CONTEXTS,
      DEFAULT_WALLPAPER_KEY: 'brick',
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
      // Higher values make a carried Oling trail the pointer for longer. Set to
      // zero for immediate pointer following.
      OLING_CARRY_FOLLOW_LAG_MS: 80,
      OLING_RELEASE_GLIDE_CONFIG: Object.freeze({
        sampleWindowMs: 110,
        velocityScale: 0.82,
        minSpeed: 45,
        maxSpeed: 900,
        decelerationMs: 260,
        edgeBounce: 0.35,
        edgeTangentialDamping: 0.9,
        edgeImpactSoundThresholdRatio: 0.25,
        maxBounces: 2
      }),
      OLING_REST_VISUAL_CONFIG: Object.freeze({
        originPath: '/images/olings/lab/interaction-points/rest-z-origin.svg',
        closedEyesPath: '/images/olings/lab/states/rest/closed-eyes.svg',
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
        'battle-arena': {
          primaryColour: '#6EA8FF',
          secondaryColour: '#4B73B5'
        },
        'oling-collection': {
          primaryColour: '#C9B6FF',
          secondaryColour: '#A18AE8'
        },
        'egg-shop': { primaryColour: '#FFF1A8', secondaryColour: '#D8C96A' },
        'quests-adventures': {
          primaryColour: '#B7F0C1',
          secondaryColour: '#7FD194'
        },
        'oling-profile': {
          primaryColour: '#FFD1E8',
          secondaryColour: '#E39BC1'
        },
        inventory: { primaryColour: '#D7F5E8', secondaryColour: '#8ED8B8' },
        trading: { primaryColour: '#CFF0FF', secondaryColour: '#79CBE8' },
        achievements: { primaryColour: '#FFE3B8', secondaryColour: '#E6A85F' },
        settings: { primaryColour: '#DDE3F0', secondaryColour: '#9FAECB' },
        'social-friends': {
          primaryColour: '#F8C7FF',
          secondaryColour: '#D987E6'
        },
        'care-mood': { primaryColour: '#FFE0C7', secondaryColour: '#E89B70' },
        customisation: { primaryColour: '#D6C8FF', secondaryColour: '#9C84E8' },
        'wall-style': {
          primaryColour: '#FFD0C2',
          secondaryColour: '#FF9F80'
        },
        'wall-decorations': {
          primaryColour: '#C9BEFF',
          secondaryColour: '#9D8AFF'
        },
        furniture: {
          primaryColour: '#B7EBE8',
          secondaryColour: '#63C7C2'
        },
        'rarity-special': {
          primaryColour: '#F6E7FF',
          secondaryColour: '#C08BE8'
        },
        warning: { primaryColour: '#FFC9B8', secondaryColour: '#E8846B' },
        success: {
          primaryColour: 'var(--successcolour)',
          secondaryColour: 'var(--successcoloursecondary)'
        },
        'locked-disabled': {
          primaryColour: '#D8D8D8',
          secondaryColour: '#9A9A9A'
        }
      }
    };
  }
  window.createOlingLabConfig = createOlingLabConfig;
})();

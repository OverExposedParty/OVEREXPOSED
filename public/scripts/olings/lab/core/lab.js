(function () {
  window.OEAudio?.register({
    olingLabRoamingEdgeHit: {
      src: '/sounds/olings/lab/roaming/edge-hit.wav',
      group: 'olings',
      preload: true,
      cooldown: 150,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabRoamingPickup1: {
      src: '/sounds/olings/lab/roaming/pickup/default/1.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureStandardTablePlaced: {
      src: '/sounds/olings/lab/furniture/tables/standard-table/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureIncubetaPlaced: {
      src: '/sounds/olings/lab/furniture/incubators/incubeta/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureExplorerGatewayPlaced: {
      src: '/sounds/olings/lab/furniture/door-modules/explorer-gateway/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureOlingBedPlaced: {
      src: '/sounds/olings/lab/furniture/beds/oling-bed/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureSupplyShelfPlaced: {
      src: '/sounds/olings/lab/furniture/storage/supply-shelf/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurniturePodRackPlaced: {
      src: '/sounds/olings/lab/furniture/storage/pod-rack/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabFurnitureBasicHangingLightPlaced: {
      src: '/sounds/olings/lab/furniture/ceiling-lights/basic-hanging-light/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabWallDecorationPosterPlaced: {
      src: '/sounds/olings/lab/wall-decorations/posters/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabWallDecorationSignPlaced: {
      src: '/sounds/olings/lab/wall-decorations/signs/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabWallDecorationClockPlaced: {
      src: '/sounds/olings/lab/wall-decorations/clocks/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabWallDecorationShelfPlaced: {
      src: '/sounds/olings/lab/wall-decorations/shelves/placed.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      lane: 'independent',
      maxInstances: 2
    },
    olingLabPrivacyPrivate: {
      src: '/sounds/olings/lab/privacy/private.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      maxInstances: 1
    },
    olingLabPrivacyFriendsOnly: {
      src: '/sounds/olings/lab/privacy/friends-only.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      maxInstances: 1
    },
    olingLabPrivacyPublic: {
      src: '/sounds/olings/lab/privacy/public.wav',
      group: 'olings',
      preload: true,
      cooldown: 80,
      maxInstances: 1
    }
  });

  window.createOlingLabStartup();
  if (typeof window.SetScriptLoaded === 'function') {
    window.SetScriptLoaded('/scripts/olings/lab/core/lab.js');
  }

  if (window.Ready && typeof window.Ready.set === 'function') {
    window.Ready.set('oling-lab', true);
  }
})();

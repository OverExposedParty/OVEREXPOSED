(function initOeLibraryPage() {
  const state = {
    account: null,
    packs: [],
    preferences: {
      showLockedOes: true,
      disabledOes: [],
      disabledPacks: []
    },
    selectedPacks: new Set(['all']),
    activeSlot: 'all',
    activeOwnership: 'all',
    search: ''
  };
  const elements = {
    grid: document.querySelector('.oe-library-grid'),
    statusNode: document.querySelector('.oe-library-status'),
    showLockedButton: document.getElementById('oe-library-show-locked'),
    searchInput: document.getElementById('oe-library-search'),
    collectionFilter: document.getElementById('oe-library-collection-filter'),
    collectionButton: document.getElementById('oe-library-collection-button'),
    collectionMenu: document.getElementById('oe-library-collection-menu'),
    slotFilter: document.getElementById('oe-library-slot-filter'),
    ownershipFilter: document.getElementById('oe-library-ownership-filter')
  };
  const defaultOeIcon = '0000:0100:0200:0300';
  const slotStorageKeys = {
    colour: 'colourSlotId',
    'head-slot': 'headSlotId',
    'eyes-slot': 'eyesSlotId',
    'mouth-slot': 'mouthSlotId'
  };

  const hasModules = window.createOeLibraryData
    && window.createOeLibraryPurchaseDialog
    && window.createOeLibraryView;
  if (!hasModules) {
    console.error('OE Library modules did not load.');
    SetScriptLoaded('/scripts/other/oes-customisation/oes-customisation.js');
    return;
  }

  const data = window.createOeLibraryData({
    state,
    defaultOeIcon,
    slotStorageKeys
  });
  let view;
  const purchase = window.createOeLibraryPurchaseDialog({
    state,
    data,
    render: () => view?.render()
  });
  view = window.createOeLibraryView({ state, elements, data, purchase });
  view.bindEvents();

  fetch('/api/oe-library')
    .then((response) => response.json())
    .then((payload) => {
      const library = payload?.data || payload;
      state.account = library.account || JSON.parse(localStorage.getItem('oe-account') || 'null');
      state.packs = Array.isArray(library.packs)
        ? library.packs.filter((pack) => pack.slug !== 'blank')
        : [];
      state.preferences = data.normalizePreferences({
        ...data.getStoredPreferences(),
        ...(library.customisationPreferences || library.account?.customisationPreferences || {})
      });
      view.render();
      SetScriptLoaded('/scripts/other/oes-customisation/oes-customisation.js');
    })
    .catch((error) => {
      console.error('Failed to load OE library:', error);
      if (elements.statusNode) elements.statusNode.textContent = 'Failed to load OEs.';
      SetScriptLoaded('/scripts/other/oes-customisation/oes-customisation.js');
    });
})();

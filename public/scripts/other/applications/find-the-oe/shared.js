(() => {
  const modules = window.Error404FindTheOeModules = window.Error404FindTheOeModules || {};
  const APPLICATION_ID = 'find-the-oe-game';
  const CUSTOMISATION_PACKS_PATH = '/api/oe-image-packs';
  const TARGET_PREVIEW_DURATION_SECONDS = 3;
  const ROUND_DURATION_SECONDS = 5;
  const TIMER_TICK_MS = 100;
  const RANDOM_CUSTOMISATION_ATTEMPTS = 30;
  const SIMILAR_CUSTOMISATION_ATTEMPTS = 250;
  const PERFECT_SIMILARITY = 1;
  const SLOT_ORDER = ['colour', 'head-slot', 'eyes-slot', 'mouth-slot'];
  const SLOT_KEY_MAP = {
    colour: 'colour',
    'head-slot': 'headSlot',
    'eyes-slot': 'eyesSlot',
    'mouth-slot': 'mouthSlot'
  };
  const ROW_DIFFICULTY_STEPS = [
    { minScore: 0, rowSize: 3 },
    { minScore: 10, rowSize: 4 },
    { minScore: 20, rowSize: 5 }
  ];
  const SLOT_SIMILARITY_WEIGHTS = {
    colour: 1.4,
    'head-slot': 1,
    'eyes-slot': 1,
    'mouth-slot': 1
  };

  function versionUrl(path) {
    return typeof versionAssetUrl === 'function'
      ? versionAssetUrl(path, { cacheBustKey: 'ERROR_404' })
      : path;
  }

  async function fetchJson(path) {
    const response = await fetch(versionUrl(path));
    if (!response.ok) throw new Error(`Failed to load ${path}`);

    return response.json().then((payload) => payload?.data || payload);
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  function weightedRandomItem(weightedItems) {
    const totalWeight = weightedItems.reduce(
      (total, item) => total + item.weight,
      0
    );
    let marker = Math.random() * totalWeight;

    for (const weightedItem of weightedItems) {
      marker -= weightedItem.weight;
      if (marker <= 0) return weightedItem.item;
    }

    return weightedItems[weightedItems.length - 1]?.item || null;
  }

  function shuffle(items) {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index]
      ];
    }

    return shuffled;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createButton(className, label) {
    const button = createElement('button', className);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    return button;
  }

  function createFindTheOeCallout() {
    const callout = createElement('div', 'find-the-oe-callout');
    const title = createElement('h2', 'find-the-oe-title', 'FIND THE OE');
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    arrow.classList.add('find-the-oe-arrow');
    arrow.setAttribute('viewBox', '0 0 124.14 102.77');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.setAttribute('focusable', 'false');
    path.setAttribute(
      'd',
      'M111.47,50.31c-10.94,15.58-33.08,25.7-50.66,31.78-17.04,5.89-29.48,7.21-47.53,6.49-.89-.04-1.8-.43-2.75-.25l14.53,10.31c1.63,2.07-.39,4.69-2.83,4.03-.47-.13-2.17-1.43-2.75-1.81-6.19-4.06-12.05-8.66-18.29-12.67-2.81-2.74.02-5.11,2.31-6.79,4.28-3.14,9.57-4.65,14.16-7.2,1.22-.67,4.71-3.42,5.53-3.59,1.19-.25,2.25-.02,2.91,1.06,2.02,3.31-3.77,5.35-5.8,6.85l-9.52,4.76c2.11.13,4.24.15,6.36.24,25.77,1.16,50.88-6.96,72.58-20.54,19.19-12.01,27.04-27.44,28.82-49.9.26-3.36,0-7.58.5-10.78s4.71-2.97,5.03-.26c.41,3.53-.75,7.9-.49,11.52-.63,13.1-4.55,26.01-12.09,36.75Z'
    );
    arrow.appendChild(path);
    callout.append(title, arrow);
    return callout;
  }

  function createImageStack(customisation, className = '') {
    const stack = createElement(
      'div',
      `find-the-oe-image-stack ${className}`.trim()
    );

    SLOT_ORDER.forEach((slot) => {
      const image = document.createElement('img');
      image.src = versionUrl(customisation[SLOT_KEY_MAP[slot]]);
      image.alt = '';
      image.decoding = 'async';
      image.loading = 'eager';
      image.dataset.slot = slot;
      stack.appendChild(image);
    });

    return stack;
  }

  function getCustomisationId(customisation) {
    return SLOT_ORDER.map((slot) => customisation[`${SLOT_KEY_MAP[slot]}Id`]).join(':');
  }

  function applySlotItem(customisation, slot, item) {
    const key = SLOT_KEY_MAP[slot];

    customisation[key] = item.filePath;
    customisation[`${key}Id`] = item.id;
    customisation[`${key}FindTheOe`] = item.findTheOe || null;
  }

  function createRandomCustomisation(slots) {
    const customisation = {};

    SLOT_ORDER.forEach((slot) => {
      applySlotItem(customisation, slot, randomItem(slots[slot]));
    });

    customisation.id = getCustomisationId(customisation);
    return customisation;
  }

  const preloadedImages = new Map();

  function preloadImage(path) {
    const src = versionUrl(path);
    if (preloadedImages.has(src)) return preloadedImages.get(src);

    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    const loaded = new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    }).then(() => image.decode?.().catch(() => undefined));

    image.src = src;
    preloadedImages.set(src, loaded);
    return loaded;
  }

  function preloadCustomisation(customisation) {
    SLOT_ORDER.forEach((slot) => preloadImage(customisation[SLOT_KEY_MAP[slot]]));
  }

  function preloadRoundLayout(roundLayout) {
    roundLayout.pieces.forEach((piece) => preloadCustomisation(piece.customisation));
  }

  function scheduleImagePreload(callback) {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 1000 });
      return;
    }

    setTimeout(callback, 80);
  }

  function preloadSlotImages(slots) {
    const paths = [
      ...new Set(
        SLOT_ORDER.flatMap((slot) => slots[slot].map((item) => item.filePath))
      )
    ];
    let index = 0;

    function preloadNextChunk() {
      const chunkEnd = Math.min(index + 6, paths.length);

      for (; index < chunkEnd; index += 1) preloadImage(paths[index]);
      if (index < paths.length) scheduleImagePreload(preloadNextChunk);
    }

    scheduleImagePreload(preloadNextChunk);
  }

  Object.assign(modules, {
    APPLICATION_ID,
    CUSTOMISATION_PACKS_PATH,
    PERFECT_SIMILARITY,
    RANDOM_CUSTOMISATION_ATTEMPTS,
    ROW_DIFFICULTY_STEPS,
    ROUND_DURATION_SECONDS,
    SIMILAR_CUSTOMISATION_ATTEMPTS,
    SLOT_KEY_MAP,
    SLOT_ORDER,
    SLOT_SIMILARITY_WEIGHTS,
    TARGET_PREVIEW_DURATION_SECONDS,
    TIMER_TICK_MS,
    applySlotItem,
    clamp,
    createButton,
    createElement,
    createFindTheOeCallout,
    createImageStack,
    createRandomCustomisation,
    fetchJson,
    getCustomisationId,
    preloadCustomisation,
    preloadRoundLayout,
    preloadSlotImages,
    randomItem,
    shuffle,
    versionUrl,
    weightedRandomItem
  });
})();

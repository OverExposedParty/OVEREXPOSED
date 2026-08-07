(function () {
  const modeAssets = [
    {
      id: 'online',
      label: 'Play online',
      description: 'Everyone plays on their own device',
      artwork: '/images/party-games/mode-selection/online/artwork.svg',
      content: '/images/party-games/mode-selection/online/content.svg',
      partyActive: '/images/party-games/mode-selection/party-active.svg'
    },
    {
      id: 'offline',
      label: 'Play offline',
      description: 'Everyone plays together on one device',
      artwork: '/images/party-games/mode-selection/offline/artwork.svg',
      content: '/images/party-games/mode-selection/offline/content.svg'
    }
  ];

  const themedColours = [
    {
      pattern: /#(?:66ccff|6cf)(?![0-9a-f])/gi,
      replacement: 'var(--primarypagecolour)'
    },
    {
      pattern: /#427bb9(?![0-9a-f])/gi,
      replacement: 'var(--secondarypagecolour)'
    }
  ];
  const helpIconPath = '/images/icons/oe-help-icon.svg';

  let modeSelectionReady = null;
  let currentModeSelectionContainer = null;
  let helpIconSourcePromise = null;

  function escapeRegularExpression(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function applyThemeColours(value) {
    return themedColours.reduce(
      (result, colour) => result.replace(colour.pattern, colour.replacement),
      value
    );
  }

  function namespaceSvgClasses(svg, namespace) {
    const classMap = new Map();

    svg.querySelectorAll('[class]').forEach((element) => {
      element.classList.forEach((className) => {
        if (!classMap.has(className)) {
          classMap.set(className, `${namespace}-${className}`);
        }
      });
    });

    svg.querySelectorAll('[class]').forEach((element) => {
      const classNames = Array.from(element.classList).map(
        (className) => classMap.get(className) || className
      );
      element.setAttribute('class', classNames.join(' '));
    });

    svg.querySelectorAll('style').forEach((style) => {
      let css = style.textContent;
      classMap.forEach((newClassName, oldClassName) => {
        css = css.replace(
          new RegExp(`\\.${escapeRegularExpression(oldClassName)}(?![\\w-])`, 'g'),
          `.${newClassName}`
        );
      });
      style.textContent = css;
    });
  }

  function namespaceSvgIds(svg, namespace) {
    const idMap = new Map();

    svg.removeAttribute('id');
    svg.querySelectorAll('[id]').forEach((element) => {
      const oldId = element.id;
      const newId = `${namespace}-${oldId}`;
      idMap.set(oldId, newId);
      element.id = newId;
    });

    svg.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        if (attribute.name === 'id') return;

        let value = attribute.value;
        idMap.forEach((newId, oldId) => {
          const escapedId = escapeRegularExpression(oldId);
          value = value
            .replace(
              new RegExp(`url\\(\\s*#${escapedId}\\s*\\)`, 'g'),
              `url(#${newId})`
            )
            .replace(new RegExp(`^#${escapedId}$`), `#${newId}`);
        });
        element.setAttribute(attribute.name, value);
      });
    });
  }

  function prepareInlineSvg(source, namespace, layer) {
    const parsedSvg = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (parsedSvg.querySelector('parsererror')) {
      throw new Error(`Unable to parse mode-selection SVG: ${namespace}`);
    }

    const svg = document.importNode(parsedSvg.documentElement, true);
    namespaceSvgClasses(svg, namespace);
    namespaceSvgIds(svg, namespace);

    if (layer === 'artwork' || layer === 'party-active') {
      svg.querySelectorAll('style').forEach((style) => {
        style.textContent = applyThemeColours(style.textContent);
      });
      svg.querySelectorAll('*').forEach((element) => {
        Array.from(element.attributes).forEach((attribute) => {
          element.setAttribute(attribute.name, applyThemeColours(attribute.value));
        });
      });
    }

    svg.classList.add('mode-selection-svg', `mode-selection-svg--${layer}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return svg;
  }

  function prepareHelpIconSvg(source, namespace) {
    const parsedSvg = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (parsedSvg.querySelector('parsererror')) {
      throw new Error(`Unable to parse mode-selection SVG: ${namespace}`);
    }

    const svg = document.importNode(parsedSvg.documentElement, true);
    namespaceSvgClasses(svg, namespace);
    namespaceSvgIds(svg, namespace);
    svg.querySelectorAll('style').forEach((style) => {
      style.textContent = style.textContent.replace(
        /#fd6a6a(?![0-9a-f])/gi,
        'var(--mode-selection-help-colour)'
      );
    });
    svg.querySelectorAll('*').forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        element.setAttribute(
          attribute.name,
          attribute.value.replace(
            /#fd6a6a(?![0-9a-f])/gi,
            'var(--mode-selection-help-colour)'
          )
        );
      });
    });

    svg.classList.add('mode-selection-help-icon');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    return svg;
  }

  async function fetchSvg(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to load mode-selection SVG: ${path}`);
    }
    return response.text();
  }

  function fetchHelpIconSource() {
    if (!helpIconSourcePromise) {
      helpIconSourcePromise = fetchSvg(helpIconPath);
    }
    return helpIconSourcePromise;
  }

  function closeModeSelection(container) {
    if (!container) return;
    overlay.classList.remove('mode-selection-overlay-blur');
    hideContainer(container);
    removeElementIfExists(permanantElementClassArray, container);
  }

  function setModeSelection(container, mode) {
    container.querySelectorAll('.mode-selection-button').forEach((button) => {
      const isSelected = button.dataset.mode === mode;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  function setModeSelectionBusy(container, isBusy) {
    container.dataset.selectionPending = String(isBusy);
    container.setAttribute('aria-busy', String(isBusy));
    container.querySelectorAll('.mode-selection-button').forEach((button) => {
      const option = button.closest('.mode-selection-option');
      button.disabled = isBusy || option?.classList.contains('is-help-open');
    });
    container
      .querySelectorAll('.mode-selection-help-button')
      .forEach((button) => {
        button.disabled = isBusy;
      });
  }

  function setOnlineProgress(container, value, label = 'Creating party') {
    const button = container?.querySelector(
      '.mode-selection-button--online'
    );
    const progress = button?.querySelector('.mode-selection-progress');
    if (!button || !progress) return;

    const normalizedValue = Math.min(100, Math.max(0, Number(value) || 0));
    if (!button.dataset.preProgressAriaLabel) {
      button.dataset.preProgressAriaLabel =
        button.getAttribute('aria-label') || 'Play online';
    }

    button.classList.add('is-loading');
    button.style.borderColor = 'transparent';
    progress.hidden = false;
    progress.style.setProperty(
      '--mode-selection-online-progress',
      String(normalizedValue)
    );
    progress.setAttribute('aria-valuenow', String(Math.round(normalizedValue)));
    progress.setAttribute('aria-valuetext', label);
    button.setAttribute(
      'aria-label',
      `${label}. ${Math.round(normalizedValue)} percent`
    );
  }

  function clearOnlineProgress(container) {
    const button = container?.querySelector(
      '.mode-selection-button--online'
    );
    const progress = button?.querySelector('.mode-selection-progress');
    if (!button || !progress) return;

    button.classList.remove('is-loading');
    button.style.removeProperty('border-color');
    progress.hidden = true;
    progress.style.setProperty('--mode-selection-online-progress', '0');
    progress.setAttribute('aria-valuenow', '0');
    progress.setAttribute('aria-valuetext', 'Not loading');
    if (button.dataset.preProgressAriaLabel) {
      button.setAttribute('aria-label', button.dataset.preProgressAriaLabel);
      delete button.dataset.preProgressAriaLabel;
    }
  }

  function waitForOnlineProgressCompletion(
    container,
    { holdMilliseconds = 180, timeoutMilliseconds = 420 } = {}
  ) {
    const progress = container?.querySelector('.mode-selection-progress');
    if (!progress || progress.hidden) return Promise.resolve();

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    return new Promise((resolve) => {
      let transitionTimeoutId = null;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        progress.removeEventListener('transitionend', handleTransitionEnd);
        if (transitionTimeoutId) window.clearTimeout(transitionTimeoutId);
        window.setTimeout(
          resolve,
          prefersReducedMotion ? 120 : holdMilliseconds
        );
      };

      const handleTransitionEnd = (event) => {
        if (
          event.target === progress &&
          event.propertyName === '--mode-selection-online-progress'
        ) {
          finish();
        }
      };

      if (prefersReducedMotion) {
        finish();
        return;
      }

      progress.addEventListener('transitionend', handleTransitionEnd);
      transitionTimeoutId = window.setTimeout(
        finish,
        timeoutMilliseconds
      );
    });
  }

  function closeModeHelp(option, { restoreFocus = false } = {}) {
    if (!option?.classList.contains('is-help-open')) return;

    const container = option.closest('.mode-selection-container');
    const modeButton = option.querySelector('.mode-selection-button');
    const helpButton = option.querySelector('.mode-selection-help-button');
    const panel = option.querySelector('.mode-selection-help-panel');

    option.classList.remove('is-help-open');
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    helpButton.hidden = false;
    helpButton.setAttribute('aria-expanded', 'false');
    modeButton.disabled = container?.dataset.selectionPending === 'true';

    if (restoreFocus) helpButton.focus();
  }

  function openModeHelp(option) {
    if (!option || option.classList.contains('is-help-open')) return;

    document
      .querySelectorAll('.mode-selection-option.is-help-open')
      .forEach((openOption) => closeModeHelp(openOption));

    const modeButton = option.querySelector('.mode-selection-button');
    const helpButton = option.querySelector('.mode-selection-help-button');
    const panel = option.querySelector('.mode-selection-help-panel');
    const backButton = panel.querySelector('.mode-selection-help-back');

    option.classList.add('is-help-open');
    modeButton.disabled = true;
    helpButton.setAttribute('aria-expanded', 'true');
    helpButton.hidden = true;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    backButton.focus();
  }

  function createModeHelpPanel(mode, option, helpButton) {
    const panel = document.createElement('section');
    const header = document.createElement('header');
    const backButton = document.createElement('button');
    const title = document.createElement('h3');
    const content = document.createElement('div');
    const description = document.createElement('p');
    const modeName = `${mode.id.charAt(0).toUpperCase()}${mode.id.slice(1)}`;

    panel.id = `mode-selection-${mode.id}-help`;
    panel.className = 'mode-selection-help-panel';
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');

    header.className = 'mode-selection-help-header';

    backButton.type = 'button';
    backButton.className = 'mode-selection-help-back';
    backButton.dataset.soundIntent = 'previous';
    backButton.setAttribute('aria-label', `Back to ${modeName}`);

    title.id = `${panel.id}-title`;
    title.className = 'mode-selection-help-title';
    title.textContent = modeName;
    panel.setAttribute('aria-labelledby', title.id);

    content.className = 'mode-selection-help-content';
    description.className = 'mode-selection-help-description';
    description.textContent = mode.description;

    const partyDetails = document.createElement('dl');
    partyDetails.className = 'mode-selection-party-details';
    partyDetails.hidden = true;
    [
      ['Game', 'gamemode'],
      ['Party code', 'code'],
      ['Status', 'status'],
      ['Your role', 'role']
    ].forEach(([label, field]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const value = document.createElement('dd');

      row.className = 'mode-selection-party-detail';
      term.textContent = label;
      value.dataset.partyField = field;
      row.append(term, value);
      partyDetails.appendChild(row);
    });

    backButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeModeHelp(option, { restoreFocus: true });
    });
    panel.addEventListener('click', (event) => event.stopPropagation());
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeModeHelp(option, { restoreFocus: true });
    });

    content.append(description);
    if (mode.id === 'online') content.appendChild(partyDetails);
    header.append(backButton, title);
    panel.append(header, content);
    helpButton.setAttribute('aria-controls', panel.id);
    return panel;
  }

  function resetModeSelection(container) {
    clearOnlineProgress(container);
    setModeSelectionBusy(container, false);
    setModeSelection(container, '');
  }

  async function createModeButton(mode) {
    const [
      artworkSource,
      contentSource,
      partyActiveSource,
      helpIconSource
    ] = await Promise.all([
      fetchSvg(mode.artwork),
      fetchSvg(mode.content),
      mode.partyActive ? fetchSvg(mode.partyActive) : Promise.resolve(null),
      fetchHelpIconSource()
    ]);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mode-selection-button mode-selection-button--${mode.id}`;
    button.dataset.mode = mode.id;
    button.dataset.modeAction =
      mode.id === 'online' ? 'create-party' : 'close';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute(
      'aria-label',
      `${mode.label}. ${mode.description}.`
    );
    button.dataset.defaultAriaLabel = button.getAttribute('aria-label');

    const artwork = prepareInlineSvg(
      artworkSource,
      `mode-selection-${mode.id}-artwork`,
      'artwork'
    );
    const content = prepareInlineSvg(
      contentSource,
      `mode-selection-${mode.id}-content`,
      'content'
    );
    const partyActive = partyActiveSource
      ? prepareInlineSvg(
          partyActiveSource,
          `mode-selection-${mode.id}-party-active`,
          'party-active'
        )
      : null;

    const artboard = document.createElement('span');
    artboard.className = 'mode-selection-artboard';
    artboard.setAttribute('aria-hidden', 'true');
    artboard.append(artwork);
    if (partyActive) {
      const activeBackdrop = document.createElement('span');
      activeBackdrop.className = 'mode-selection-party-active-backdrop';
      artboard.append(activeBackdrop);
    }
    artboard.append(content);
    if (partyActive) artboard.append(partyActive);

    const helpButton = document.createElement('button');
    helpButton.type = 'button';
    helpButton.className = 'mode-selection-help-button';
    helpButton.dataset.modeHelp = mode.id;
    const modeName = `${mode.id.charAt(0).toUpperCase()}${mode.id.slice(1)}`;
    helpButton.setAttribute('aria-label', `Help with ${modeName} mode`);
    helpButton.setAttribute('aria-expanded', 'false');
    helpButton.dataset.sound = 'containerOpen';

    const helpIcon = prepareHelpIconSvg(
      helpIconSource,
      `mode-selection-${mode.id}-help-icon`
    );
    helpButton.appendChild(helpIcon);

    const helpAnchor = document.createElement('span');
    helpAnchor.className = 'mode-selection-help-anchor';
    helpAnchor.appendChild(helpButton);

    const option = document.createElement('div');
    option.className = `mode-selection-option mode-selection-option--${mode.id}`;
    const helpPanel = createModeHelpPanel(mode, option, helpButton);

    helpButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openModeHelp(option);
    });

    button.appendChild(artboard);
    if (mode.id === 'online') {
      const progress = document.createElement('span');
      progress.id = 'mode-selection-online-progress';
      progress.className = 'mode-selection-progress';
      progress.hidden = true;
      progress.setAttribute('role', 'progressbar');
      progress.setAttribute('aria-label', 'Online lobby loading progress');
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('aria-valuenow', '0');
      progress.setAttribute('aria-valuetext', 'Not loading');
      button.appendChild(progress);
    }
    option.append(button, helpAnchor, helpPanel);
    return option;
  }

  async function createModeSelection() {
    if (typeof partyCode !== 'undefined' && partyCode) return null;
    if (
      window.PartyPlayModeController?.shouldSkipInitialSelection?.() === true
    ) {
      return null;
    }

    const existingContainer = document.getElementById('mode-selection-container');
    if (existingContainer) return existingContainer;

    const container = document.createElement('section');
    container.id = 'mode-selection-container';
    container.className = 'mode-selection-container';

    const header = document.createElement('header');
    header.className = 'mode-selection-header';
    const title = document.createElement('h2');
    title.id = 'mode-selection-title';
    title.className = 'mode-selection-header-title';
    title.textContent = 'ONE DEVICE OR MANY';
    header.appendChild(title);
    container.setAttribute('aria-labelledby', title.id);

    const options = document.createElement('div');
    options.className = 'mode-selection-options';
    const modeOptions = await Promise.all(modeAssets.map(createModeButton));
    const separator = document.createElement('span');
    separator.className = 'mode-selection-separator';
    separator.textContent = 'OR';
    separator.setAttribute('aria-hidden', 'true');

    modeOptions.forEach((option) => {
      const button = option.querySelector('.mode-selection-button');
      button.addEventListener('click', () => {
        container.dispatchEvent(
          new CustomEvent('oe-play-mode-request', {
            detail: {
              mode: button.dataset.mode,
              action: button.dataset.modeAction,
              button
            }
          })
        );
      });
    });

    options.append(modeOptions[0], separator, modeOptions[1]);
    container.append(header, options);
    document.body.appendChild(container);
    addElementIfNotExists(permanantElementClassArray, container);
    overlay.classList.add('mode-selection-overlay-blur');
    currentModeSelectionContainer = container;
    window.PartyPlayModeController?.bind(container);
    return container;
  }

  window.ModeSelectionView = {
    close: closeModeSelection,
    closeCurrent() {
      closeModeSelection(currentModeSelectionContainer);
    },
    reset: resetModeSelection,
    clearProgress: clearOnlineProgress,
    setBusy: setModeSelectionBusy,
    setProgress: setOnlineProgress,
    setSelected: setModeSelection,
    waitForProgressCompletion: waitForOnlineProgressCompletion
  };

  window.initializeModeSelection = function initializeModeSelection() {
    if (!modeSelectionReady) {
      modeSelectionReady = createModeSelection().catch((error) => {
        modeSelectionReady = null;
        console.error('Error loading mode selection:', error);
        throw error;
      });
    }
    return modeSelectionReady;
  };
})();

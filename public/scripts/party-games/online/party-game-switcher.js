(() => {
  const PARTY_GAME_SWITCH_OPTIONS = [
    {
      gamemode: 'truth-or-dare',
      label: 'Truth or Dare',
      minPlayers: 2,
      maxPlayers: 20,
      primary: '#66CCFF',
      secondary: '#427BB9'
    },
    {
      gamemode: 'paranoia',
      label: 'Paranoia',
      minPlayers: 3,
      maxPlayers: 15,
      primary: '#9D8AFF',
      secondary: '#7F71B2'
    },
    {
      gamemode: 'never-have-i-ever',
      label: 'Never Have I Ever',
      minPlayers: 2,
      maxPlayers: 20,
      primary: '#FF9266',
      secondary: '#B96542'
    },
    {
      gamemode: 'most-likely-to',
      label: 'Most Likely To',
      minPlayers: 2,
      maxPlayers: 20,
      primary: '#FFEE66',
      secondary: '#B9AA42'
    },
    {
      gamemode: 'imposter',
      label: 'Imposter',
      minPlayers: 3,
      maxPlayers: 16,
      primary: '#3DA7A1',
      secondary: '#2A6E6A'
    },
    {
      gamemode: 'would-you-rather',
      label: 'Would You Rather',
      minPlayers: 2,
      maxPlayers: 20,
      primary: '#7CFFB2',
      secondary: '#55B97F'
    },
    {
      gamemode: 'mafia',
      label: 'Mafia',
      minPlayers: 5,
      maxPlayers: 20,
      primary: '#9B56D3',
      secondary: '#6D3C95'
    }
  ];
  const PUBLIC_PARTY_GAME_SWITCH_GAMEMODES = new Set([
    'truth-or-dare',
    'paranoia',
    'never-have-i-ever',
    'most-likely-to'
  ]);

  let switchDialog = null;
  let switchSideButton = null;
  let switchRequestInFlight = false;
  let handledSwitchGameId = null;
  let activeSwitchContext = null;

  function loadPartyGameSwitcherStyles() {
    const href = '/css/party-games/online/party-game-switcher.css';
    if (document.querySelector(`link[href^="${href}"]`)) return;
    if (typeof LoadStylesheet === 'function') {
      LoadStylesheet(href);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function isPartyGameSwitcherOpen() {
    if (!switchDialog) return false;
    if (typeof isContainerVisible === 'function') {
      return isContainerVisible(switchDialog);
    }
    return switchDialog.classList.contains('is-visible');
  }

  function syncPartyGameSwitcherButtonState() {
    const isOpen = isPartyGameSwitcherOpen();
    switchSideButton?.classList.toggle('active', isOpen);
    switchSideButton?.setAttribute(
      'aria-label',
      isOpen ? 'Close game picker' : 'Change party game'
    );
  }

  function setPartyGameSwitcherClosePrevented(prevented) {
    if (!switchDialog) return;
    switchDialog.dataset.preventContainerClose = prevented ? 'true' : 'false';
    if (typeof syncOverlayStack === 'function') syncOverlayStack();
  }

  function closePartyGameSwitcher({ force = false } = {}) {
    if (!switchDialog || (switchRequestInFlight && !force)) return false;

    switchDialog.dataset.preventContainerClose = 'false';
    if (typeof hideContainer === 'function') {
      hideContainer(switchDialog);
    } else {
      switchDialog.classList.remove('is-visible');
    }
    if (
      typeof removeElementIfExists === 'function' &&
      typeof popUpClassArray !== 'undefined'
    ) {
      removeElementIfExists(popUpClassArray, switchDialog);
    }
    syncPartyGameSwitcherButtonState();
    return true;
  }

  function getSwitcherPartyData(partyData) {
    if (partyData) return partyData;
    return typeof currentPartyData === 'undefined' ? null : currentPartyData;
  }

  function isCurrentDevicePartyHost(partyData) {
    const hostId = partyData?.state?.hostComputerId;
    return Boolean(
      hostId &&
      typeof deviceId !== 'undefined' &&
      String(hostId) === String(deviceId)
    );
  }

  function getPartySwitchErrorMessage(payload, response) {
    const apiError = payload?.error;
    return (
      (typeof apiError === 'string' ? apiError : apiError?.message) ||
      payload?.message ||
      `Failed to switch games (${response.status})`
    );
  }

  async function getAvailablePartyGameSwitchModes() {
    try {
      const response = await fetch('/api/homepage-tiles', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok)
        throw new Error(`Homepage catalogue ${response.status}`);

      const payload = await response.json();
      const tiles = Array.isArray(payload)
        ? payload
        : payload?.data?.homepageTiles || payload?.homepageTiles || [];
      return new Set(
        tiles
          .filter(
            (tile) => tile?.kind === 'gamemode' && tile?.canAccess === true
          )
          .map((tile) =>
            String(tile.id || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      );
    } catch (error) {
      console.error('Failed to load available party games:', error);
      return new Set(PUBLIC_PARTY_GAME_SWITCH_GAMEMODES);
    }
  }

  function ensurePartyGameSwitchDialog() {
    if (switchDialog?.isConnected) return switchDialog;

    switchDialog = document.createElement('div');
    switchDialog.id = 'party-game-switch-dialog';
    switchDialog.className = 'party-game-switch-dialog';
    switchDialog.setAttribute('role', 'dialog');
    switchDialog.setAttribute('aria-modal', 'true');
    switchDialog.setAttribute('aria-labelledby', 'party-game-switch-title');
    switchDialog.innerHTML = `
      <form class="party-game-switch-form">
        <div class="party-game-switch-heading">
          <h2 id="party-game-switch-title">Change party game</h2>
          <p>Everyone stays in this lobby and keeps the same party code.</p>
        </div>
        <div class="party-game-switch-options" role="radiogroup" aria-label="Party games"></div>
        <p class="party-game-switch-status" role="alert" hidden></p>
        <div class="party-game-switch-actions">
          <button type="submit" data-party-switch-confirm disabled>CHANGE GAME</button>
        </div>
      </form>`;
    document.body.appendChild(switchDialog);

    const form = switchDialog.querySelector('form');
    const confirmButton = switchDialog.querySelector(
      '[data-party-switch-confirm]'
    );
    new window.MutationObserver(syncPartyGameSwitcherButtonState).observe(
      switchDialog,
      { attributes: true, attributeFilter: ['class'] }
    );
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !isPartyGameSwitcherOpen()) return;
      if (switchRequestInFlight) return;
      event.preventDefault();
      closePartyGameSwitcher();
    });
    switchDialog.addEventListener('change', () => {
      const selected = switchDialog.querySelector(
        'input[name="party-switch-gamemode"]:checked'
      );
      const currentGamemode = switchDialog.querySelector(
        '.party-game-switch-options'
      )?.dataset.currentGamemode;
      confirmButton.disabled = !selected || selected.value === currentGamemode;
      syncPartyGameSwitchSelection(selected?.value);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const selected = switchDialog.querySelector(
        'input[name="party-switch-gamemode"]:checked'
      );
      if (!selected || switchRequestInFlight) return;

      const status = switchDialog.querySelector('.party-game-switch-status');
      switchRequestInFlight = true;
      setPartyGameSwitcherClosePrevented(true);
      confirmButton.disabled = true;
      status.hidden = false;
      status.textContent =
        activeSwitchContext?.mode === 'offline'
          ? 'Opening the new game…'
          : 'Moving everyone to the new game…';

      try {
        if (activeSwitchContext?.mode === 'offline') {
          handleOfflinePartyGameSwitched(selected.value);
          return;
        }
        const result = await switchOnlinePartyGame(selected.value);
        handleOnlinePartyGameSwitched(result.transition);
      } catch (error) {
        status.textContent = error.message || 'Failed to switch games.';
        switchRequestInFlight = false;
        setPartyGameSwitcherClosePrevented(false);
        confirmButton.disabled = false;
      }
    });

    return switchDialog;
  }

  function getPartyGameSwitchOption(gamemode) {
    return PARTY_GAME_SWITCH_OPTIONS.find(
      (option) => option.gamemode === gamemode
    );
  }

  function applyPartyGameSwitchTheme(gamemode) {
    const option = getPartyGameSwitchOption(gamemode);
    if (!switchDialog || !option) return;

    switchDialog.style.setProperty('--party-switch-primary', option.primary);
    switchDialog.style.setProperty(
      '--party-switch-secondary',
      option.secondary
    );
  }

  function syncPartyGameSwitchSelection(gamemode) {
    if (!switchDialog) return;
    switchDialog
      .querySelectorAll('.party-game-switch-option')
      .forEach((tile) => {
        tile.classList.toggle(
          'is-selected',
          tile.dataset.gamemode === gamemode
        );
      });
    applyPartyGameSwitchTheme(gamemode);
  }

  function ensurePartyGameSwitchSideButton() {
    if (switchSideButton?.isConnected) return switchSideButton;
    if (typeof window.SideButtons?.createIconButton !== 'function') {
      return null;
    }

    switchSideButton = window.SideButtons.createIconButton({
      id: 'change-party-game-side-button',
      label: 'Change party game',
      iconSrc: '/images/icons/gamemode-settings/change-game.svg'
    });
    if (!switchSideButton) return null;

    switchSideButton.dataset.partyGameSwitcher = '';
    switchSideButton.dataset.partyGameSwitcherContext = 'lobby';
    switchSideButton.classList.add('party-game-switch-side-button');
    return switchSideButton;
  }

  function isForceOnlineGamemode(gamemode) {
    return (
      typeof partyGamesInformation !== 'undefined' &&
      partyGamesInformation?.[gamemode]?.forceOnline === true
    );
  }

  function renderPartyGameSwitchOptions(
    partyData,
    availableGamemodes,
    { mode = 'online', currentGamemode = partyData?.config?.gamemode || '' } = {}
  ) {
    const dialog = ensurePartyGameSwitchDialog();
    const optionsContainer = dialog.querySelector('.party-game-switch-options');
    const playerCount = Array.isArray(partyData?.players)
      ? partyData.players.length
      : 0;
    const description = dialog.querySelector('.party-game-switch-heading p');
    if (description) {
      description.textContent =
        mode === 'offline'
          ? 'Choose another party game to play on this device.'
          : 'Everyone stays in this lobby and keeps the same party code.';
    }
    optionsContainer.replaceChildren();
    optionsContainer.dataset.currentGamemode = currentGamemode;
    applyPartyGameSwitchTheme(currentGamemode);

    const visibleOptions = PARTY_GAME_SWITCH_OPTIONS.filter(
      (option) =>
        availableGamemodes.has(option.gamemode) &&
        (mode !== 'offline' || !isForceOnlineGamemode(option.gamemode))
    );
    optionsContainer.style.setProperty(
      '--party-switch-option-rows',
      Math.max(1, Math.ceil(visibleOptions.length / 2))
    );

    visibleOptions.forEach((option) => {
      const isCurrent = option.gamemode === currentGamemode;
      const isOverCapacity =
        mode === 'online' && playerCount > option.maxPlayers;
      const isUnavailable = !isCurrent && isOverCapacity;
      const label = document.createElement('label');
      label.className =
        'party-game-switch-option homepage-tile has-homepage-image';
      label.dataset.gamemode = option.gamemode;
      label.style.setProperty('--tile-colour', option.primary);
      label.style.setProperty('--tile-secondary-colour', option.secondary);
      label.classList.toggle('is-selected', isCurrent);
      label.classList.toggle('is-unavailable', isUnavailable);

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'party-switch-gamemode';
      input.value = option.gamemode;
      input.checked = isCurrent;
      input.disabled = isUnavailable;

      const picture = document.createElement('picture');
      picture.className = 'homepage-tile-picture';
      const mobileSource = document.createElement('source');
      mobileSource.media = '(orientation: portrait)';
      mobileSource.srcset = `/images/homepage/mobile/${option.gamemode}.svg`;
      const image = document.createElement('img');
      image.className = 'homepage-tile-image';
      image.src = `/images/homepage/desktop/${option.gamemode}.svg`;
      image.alt = option.label;
      image.loading = 'eager';
      picture.append(mobileSource, image);

      const detail = document.createElement('span');
      detail.className = 'party-game-switch-option-detail';
      detail.textContent = isCurrent
        ? 'Current game'
        : isOverCapacity
          ? `Maximum ${option.maxPlayers} players`
          : mode === 'offline'
            ? 'Play on this device'
            : `${option.minPlayers}-${option.maxPlayers} players`;

      label.append(input, picture, detail);
      optionsContainer.appendChild(label);
    });
  }

  async function getLatestPartyForSwitcher() {
    const existing = getSwitcherPartyData();
    if (existing?.partyId && existing?.state?.phase) return existing;
    if (typeof GetCurrentPartyData === 'function') {
      return (await GetCurrentPartyData({ retries: 1 })) || existing;
    }
    return existing;
  }

  async function openOnlinePartyGameSwitcher() {
    const partyData = await getLatestPartyForSwitcher();
    if (!partyData || !isCurrentDevicePartyHost(partyData)) return false;
    if (
      partyData.state?.isPlaying === true ||
      !['lobby', 'game-over'].includes(partyData.state?.phase)
    ) {
      return false;
    }

    if (isPartyGameSwitcherOpen()) {
      closePartyGameSwitcher();
      return true;
    }

    const availableGamemodes = await getAvailablePartyGameSwitchModes();
    activeSwitchContext = { mode: 'online' };
    renderPartyGameSwitchOptions(partyData, availableGamemodes, {
      mode: 'online'
    });
    return openRenderedPartyGameSwitcher();
  }

  function openRenderedPartyGameSwitcher() {
    const dialog = ensurePartyGameSwitchDialog();
    const status = dialog.querySelector('.party-game-switch-status');
    const confirmButton = dialog.querySelector('[data-party-switch-confirm]');
    status.hidden = true;
    status.textContent = '';
    confirmButton.disabled = true;
    switchRequestInFlight = false;
    setPartyGameSwitcherClosePrevented(false);
    if (typeof showContainer === 'function') {
      showContainer(dialog);
    } else {
      dialog.classList.add('is-visible');
    }
    if (
      typeof addElementIfNotExists === 'function' &&
      typeof popUpClassArray !== 'undefined'
    ) {
      addElementIfNotExists(popUpClassArray, dialog);
    }
    if (typeof toggleOverlay === 'function') toggleOverlay(true);
    syncPartyGameSwitcherButtonState();
    dialog
      .querySelector('input[name="party-switch-gamemode"]:checked')
      ?.focus({ preventScroll: true });
    return true;
  }

  async function openOfflinePartyGameSwitcher(
    currentGamemode = activeSwitchContext?.gamemode
  ) {
    const gamemode = String(currentGamemode || '')
      .trim()
      .toLowerCase();
    if (!getPartyGameSwitchOption(gamemode) || isForceOnlineGamemode(gamemode)) {
      return false;
    }

    if (isPartyGameSwitcherOpen()) {
      closePartyGameSwitcher();
      return true;
    }

    const availableGamemodes = await getAvailablePartyGameSwitchModes();
    activeSwitchContext = { mode: 'offline', gamemode };
    renderPartyGameSwitchOptions(null, availableGamemodes, {
      mode: 'offline',
      currentGamemode: gamemode
    });
    return openRenderedPartyGameSwitcher();
  }

  async function switchOnlinePartyGame(targetGamemode) {
    const partyData = await getLatestPartyForSwitcher();
    if (!partyData?.partyId) throw new Error('Party data is unavailable.');

    const response = await fetch('/api/party-lobbies/switch-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partyId: partyData.partyId,
        targetGamemode,
        expectedGameId: partyData.session?.gameId || null
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getPartySwitchErrorMessage(payload, response));
    }

    return payload?.data || payload;
  }

  function getPartySwitchDestination(transition) {
    const partyId = transition?.partyId;
    const gamemode = transition?.toGamemode;
    const isHost =
      transition?.hostComputerId &&
      typeof deviceId !== 'undefined' &&
      String(transition.hostComputerId) === String(deviceId);
    if (!partyId || !gamemode) return null;

    return isHost
      ? `/${gamemode}/settings?partyCode=${encodeURIComponent(partyId)}`
      : `/${encodeURIComponent(partyId)}`;
  }

  function getPartySwitchSplashScreen(transition) {
    const gamemode = String(transition?.toGamemode || '')
      .trim()
      .toLowerCase();
    const isHost =
      transition?.hostComputerId &&
      typeof deviceId !== 'undefined' &&
      String(transition.hostComputerId) === String(deviceId);
    if (!getPartyGameSwitchOption(gamemode)) {
      return '/images/splash-screens/overexposed.png';
    }

    return `/images/splash-screens/${gamemode}${isHost ? '-settings' : ''}.png`;
  }

  function getOfflinePartyGameSwitchDestination(gamemode) {
    const normalizedGamemode = String(gamemode || '')
      .trim()
      .toLowerCase();
    if (
      !getPartyGameSwitchOption(normalizedGamemode) ||
      isForceOnlineGamemode(normalizedGamemode)
    ) {
      return null;
    }
    return `/${normalizedGamemode}/settings?playMode=offline`;
  }

  function handleOfflinePartyGameSwitched(gamemode) {
    const destination = getOfflinePartyGameSwitchDestination(gamemode);
    if (!destination) return false;

    const normalizedGamemode = String(gamemode).trim().toLowerCase();
    const splash = `/images/splash-screens/${normalizedGamemode}-settings.png`;
    if (typeof loadingPage !== 'undefined') loadingPage = true;
    closePartyGameSwitcher({ force: true });
    preloadPartySwitchSplashScreen(splash);
    if (typeof transitionSplashScreen === 'function') {
      transitionSplashScreen(destination, splash);
    } else {
      window.location.assign(destination);
    }
    return true;
  }

  function preloadPartySwitchSplashScreen(splashScreen) {
    if (typeof window.Image !== 'function') return;
    const image = new window.Image();
    image.src = splashScreen;
  }

  function handleOnlinePartyGameSwitched(transition) {
    if (!transition?.gameId || handledSwitchGameId === transition.gameId) {
      return false;
    }
    const destination = getPartySwitchDestination(transition);
    if (!destination) return false;

    handledSwitchGameId = transition.gameId;
    window.onlinePartySwitchInProgress = true;
    window.onlinePartyReturningToLobby = true;
    if (typeof loadingPage !== 'undefined') loadingPage = true;
    closePartyGameSwitcher({ force: true });

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const splash = getPartySwitchSplashScreen(transition);
    preloadPartySwitchSplashScreen(splash);
    if (typeof transitionSplashScreen === 'function') {
      transitionSplashScreen(destination, splash);
    } else if (currentUrl === destination) {
      window.location.reload();
    } else {
      window.location.assign(destination);
    }
    return true;
  }

  function syncOnlinePartyGameSwitcherButtons(partyData) {
    const party = partyData === null ? null : getSwitcherPartyData(partyData);
    const isHost = isCurrentDevicePartyHost(party);
    const phase = party?.state?.phase;
    if (
      isHost &&
      ['lobby', 'game-over'].includes(phase) &&
      party?.state?.isPlaying !== true
    ) {
      activeSwitchContext = { mode: 'online' };
    } else if (activeSwitchContext?.mode === 'online') {
      activeSwitchContext = null;
    }
    if (isHost && phase === 'lobby' && party?.state?.isPlaying !== true) {
      ensurePartyGameSwitchSideButton();
    }
    document
      .querySelectorAll('[data-party-game-switcher]')
      .forEach((button) => {
        const requiredPhase = button.dataset.partyGameSwitcherContext;
        const shouldHide =
          !isHost ||
          party?.state?.isPlaying === true ||
          !['lobby', 'game-over'].includes(phase) ||
          (requiredPhase && requiredPhase !== phase);
        button.hidden = shouldHide;
        const shell = button.closest('.side-button-shell');
        if (shell) shell.hidden = shouldHide;
      });
  }

  function syncOfflinePartyGameSwitcherButton(gamemode) {
    const normalizedGamemode = String(gamemode || '')
      .trim()
      .toLowerCase();
    const canSwitchOffline = Boolean(
      getPartyGameSwitchOption(normalizedGamemode) &&
        !isForceOnlineGamemode(normalizedGamemode)
    );

    activeSwitchContext = canSwitchOffline
      ? { mode: 'offline', gamemode: normalizedGamemode }
      : null;
    if (canSwitchOffline) ensurePartyGameSwitchSideButton();

    document
      .querySelectorAll('[data-party-game-switcher]')
      .forEach((button) => {
        const requiredPhase = button.dataset.partyGameSwitcherContext;
        const shouldHide =
          !canSwitchOffline || (requiredPhase && requiredPhase !== 'lobby');
        button.hidden = shouldHide;
        const shell = button.closest('.side-button-shell');
        if (shell) shell.hidden = shouldHide;
      });
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-party-game-switcher]');
    if (!button || button.disabled) return;
    const openSwitcher =
      activeSwitchContext?.mode === 'offline'
        ? openOfflinePartyGameSwitcher
        : openOnlinePartyGameSwitcher;
    openSwitcher().catch((error) => {
      console.error('Failed to open the party game switcher:', error);
    });
  });

  loadPartyGameSwitcherStyles();
  Object.assign(window, {
    PARTY_GAME_SWITCH_OPTIONS,
    getOfflinePartyGameSwitchDestination,
    getPartySwitchDestination,
    getPartySwitchSplashScreen,
    handleOfflinePartyGameSwitched,
    handleOnlinePartyGameSwitched,
    openOfflinePartyGameSwitcher,
    openOnlinePartyGameSwitcher,
    switchOnlinePartyGame,
    syncOfflinePartyGameSwitcherButton,
    syncOnlinePartyGameSwitcherButtons
  });
})();

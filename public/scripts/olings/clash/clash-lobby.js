(function () {
  const scriptPath = '/scripts/olings/clash/clash-lobby.js';
  const gameSplashScreen = '/images/splash-screens/olings/clash/game.png';
  const settingsSplashScreen =
    '/images/splash-screens/olings/clash/settings.png';
  const isSettingsPage = /^\/olings\/clash\/settings\/?$/i.test(
    window.location.pathname
  );
  const isRoomPage = /^\/olings\/clash\/[a-z0-9]{3}-[a-z0-9]{3}\/?$/i.test(
    window.location.pathname
  );
  if (/^\/olings\/clash\/tutorial\/?$/i.test(window.location.pathname)) {
    window.SetScriptLoaded?.(scriptPath);
    return;
  }
  const minimumTeamSize = 3;
  const playerCards = {
    local: document.querySelector('[data-clash-player="local"]'),
    opponent: document.querySelector('[data-clash-player="opponent"]')
  };
  const page = document.querySelector('.olings-clash-page');
  const game = document.querySelector('[data-clash-game]');
  const lobby = document.querySelector('.olings-clash-lobby');
  const teamSlots = [...document.querySelectorAll('.olings-clash-team-slot')];
  const selectorPicker = document.querySelector('[data-clash-selector-picker]');
  const selectorPreview = document.querySelector(
    '[data-clash-selector-preview]'
  );
  const selectorPrevious = document.querySelector(
    '[data-clash-selector-previous]'
  );
  const selectorNext = document.querySelector('[data-clash-selector-next]');
  const selectorSelected = document.querySelector(
    '[data-clash-selector-selected]'
  );
  const selectorAbilities = document.querySelector(
    '[data-clash-selector-abilities]'
  );
  const selectorAbilityCards = [
    ...document.querySelectorAll('[data-clash-selector-ability]')
  ];
  const gate = document.querySelector('[data-clash-gate]');
  const gateTitle = document.querySelector('[data-clash-gate-title]');
  const gateMessage = document.querySelector('[data-clash-gate-message]');
  const gateActions = document.querySelector('[data-clash-gate-actions]');
  const gatePrimary = document.querySelector('[data-clash-gate-primary]');
  const gateSecondary = document.querySelector('[data-clash-gate-secondary]');
  const roomCodeInput = document.querySelector('[data-clash-room-code]');
  const copyLinkButton = document.querySelector('[data-clash-copy-link]');
  const qrCodeButton = document.querySelector('[data-clash-qr-code]');
  const qrDialog = document.querySelector('[data-clash-qr-dialog]');
  const qrImage = document.querySelector('[data-clash-qr-image]');
  const qrUrl = document.querySelector('[data-clash-qr-url]');
  const qrPlayerCount = document.querySelector('[data-clash-qr-player-count]');
  const shareControls = document.querySelector('[data-clash-share-controls]');
  const aiControls = document.querySelector('[data-clash-ai-controls]');
  const aiDifficultySelect = document.querySelector(
    '[data-clash-ai-difficulty]'
  );
  const selectorCancelButton = document.querySelector(
    '[data-clash-selector-cancel]'
  );
  const readyButton = document.querySelector('[data-clash-ready]');
  const opponentSlotButton = document.querySelector(
    '[data-clash-opponent-slot]'
  );
  const tabButtons = [...document.querySelectorAll('[data-clash-tab]')];
  const tabPanels = [...document.querySelectorAll('[data-clash-tab-panel]')];
  const modeSelection = document.querySelector('[data-clash-mode-selection]');
  const modeBackdrop = document.querySelector('[data-clash-mode-backdrop]');
  const modeButtons = [...document.querySelectorAll('[data-clash-mode]')];
  const aiLevel = document.querySelector('[data-clash-ai-level]');
  const teamCount = document.querySelector('[data-clash-team-count]');
  const playerCount = document.querySelector('[data-clash-player-count]');
  const rulesetName = document.querySelector('[data-clash-ruleset-name]');
  const ruleHealth = document.querySelector('[data-clash-rule-health]');
  const ruleDecisive = document.querySelector('[data-clash-rule-decisive]');
  const ruleDraw = document.querySelector('[data-clash-rule-draw]');
  const ruleLastStand = document.querySelector('[data-clash-rule-last-stand]');
  const renderRules = window.createOlingClashRulesSummaryRenderer?.({
    document,
    ruleDecisive,
    ruleDraw,
    ruleHealth,
    ruleLastStand,
    rulesetName
  });
  const { getMatchCodeFromPath, getStoredAccount, requestJson } =
    window.OlingClashLobbyApi || {};
  let playerOlings = [];
  let currentAccount = null;
  let clashMatch = null;
  let clashSocket = null;
  let teamSyncPromise = null;
  let aiOpponentRequestPending = false;
  let aiDifficultyRequestPending = false;
  let selectedOpponentMode = '';
  let selectedOlingIndex = 0;
  let activeTeamSlotIndex = -1;
  let qrPreviousFocus = null;
  let onlineRuntimePromise = null;
  let clashAbilitiesByTrait = new Map();
  const selectedTeam = [null, null, null];
  const selectorAbilityLayers = Object.freeze({
    attack: 'mouth',
    guard: 'body',
    skill: 'flight',
    draw: 'eyes'
  });

  function setModeSelectionVisible(visible) {
    page?.classList.toggle('is-choosing-mode', visible);
    if (lobby) {
      lobby.inert = visible;
      lobby.setAttribute('aria-hidden', String(visible));
    }
    if (modeSelection) {
      modeSelection.hidden = !visible;
      modeSelection.classList.toggle('is-visible', visible);
      modeSelection.setAttribute('aria-hidden', String(!visible));
    }
    if (modeBackdrop) modeBackdrop.hidden = !visible;
    if (visible) {
      window.setTimeout(() => modeButtons[0]?.focus(), 0);
    }
  }

  function activateLobbyTab(tabName, { focus = false } = {}) {
    const requestedTab = String(tabName || '').toLowerCase();
    const activeButton = tabButtons.find(
      (button) => button.dataset.clashTab === requestedTab
    );
    if (!activeButton) return;

    if (
      requestedTab !== 'team' &&
      lobby?.classList.contains('is-selecting-oling')
    ) {
      activeTeamSlotIndex = -1;
      setSelectorVisible(false);
    }

    tabButtons.forEach((button) => {
      const isActive = button === activeButton;
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    tabPanels.forEach((panel) => {
      const isActive = panel.dataset.clashTabPanel === requestedTab;
      panel.hidden = !isActive;
      panel.classList.toggle('is-active', isActive);
    });
    if (focus) activeButton.focus();
  }

  function getAiDifficultyLabel(value) {
    const difficulty = Number(value);
    if (difficulty >= 0.7) return 'HARD AI';
    if (difficulty <= 0.3) return 'EASY AI';
    return 'NORMAL AI';
  }

  function getAiDifficultyOption(value) {
    const difficulty = Number(value);
    if (difficulty >= 0.7) return '0.75';
    if (difficulty <= 0.3) return '0.2';
    return '0.45';
  }

  function renderRulesSummary(match = clashMatch) {
    renderRules?.(match);
  }

  function setLobbyView(isLobby) {
    page?.classList.toggle('is-lobby', isLobby);
    if (lobby) {
      lobby.hidden = !isLobby;
      lobby.setAttribute('aria-hidden', String(!isLobby));
    }
    if (game) {
      game.hidden = isLobby;
      game.setAttribute('aria-hidden', String(isLobby));
    }
  }

  function navigateTo(path) {
    const shouldNavigate = window.dispatchEvent(
      new CustomEvent('olings-clash:navigate', {
        cancelable: true,
        detail: { path }
      })
    );
    if (!shouldNavigate) return;
    if (typeof window.transitionSplashScreen === 'function') {
      const splashScreen = /^\/olings\/clash(?:\/tutorial)?\/?$/i.test(path)
        ? gameSplashScreen
        : settingsSplashScreen;
      window.transitionSplashScreen(path, splashScreen);
      return;
    }
    window.location.assign(path);
  }

  function showLobby() {
    setModeSelectionVisible(false);
    setLobbyView(true);
    lobby?.classList.remove('is-gated');
    if (gate) gate.hidden = true;
  }

  function showGame(match = clashMatch) {
    if (isRoomPage) {
      const shouldReload = window.dispatchEvent(
        new CustomEvent('olings-clash:match-started', {
          cancelable: true,
          detail: { match }
        })
      );
      if (shouldReload) {
        if (typeof window.transitionSplashScreen === 'function') {
          window.transitionSplashScreen(
            window.location.pathname,
            gameSplashScreen
          );
        } else {
          window.location.reload();
        }
      }
      return;
    }
    setLobbyView(false);
    window.OlingClashGame?.useOnlineMatch?.(match, getCurrentAccountId());
  }

  function showGate({
    title,
    message = '',
    primaryLabel = 'MAIN MENU',
    primaryHref = '/',
    secondaryLabel = '',
    onSecondary = null
  }) {
    setModeSelectionVisible(false);
    setLobbyView(true);
    lobby?.classList.add('is-gated');
    if (gate) gate.hidden = false;
    if (gateTitle) gateTitle.textContent = title;
    if (gateMessage) gateMessage.textContent = message;
    if (gatePrimary) {
      gatePrimary.textContent = primaryLabel;
      gatePrimary.href = primaryHref;
      gatePrimary.hidden = !primaryLabel;
    }
    if (gateSecondary) {
      gateSecondary.textContent = secondaryLabel;
      gateSecondary.hidden = !secondaryLabel;
      gateSecondary.onclick = onSecondary;
    }
    if (gateActions) gateActions.hidden = !primaryLabel && !secondaryLabel;
  }

  function showEligibilityGate(ownedOlingCount = playerOlings.length) {
    showGate({
      title: '3 OLINGS REQUIRED',
      message: `You need at least 3 Olings to enter an Oling Clash. You currently have ${ownedOlingCount}.`,
      secondaryLabel: 'OLING LAB',
      onSecondary: () => window.location.assign('/olings/lab')
    });
  }

  function showMatchError(error) {
    if (error?.code === 'oling_clash_three_olings_required') {
      showEligibilityGate(error.details?.ownedOlingCount);
      return;
    }
    const states = {
      oling_clash_not_found: {
        title: 'CLASH NOT FOUND',
        message: 'That Oling Clash no longer exists or the code is incorrect.'
      },
      oling_clash_full: {
        title: 'CLASH FULL',
        message: 'Two players have already joined that Oling Clash.'
      },
      oling_clash_already_started: {
        title: 'CLASH STARTED',
        message: 'That Oling Clash has already started.'
      }
    };
    const state = states[error?.code] || {
      title: 'CLASH UNAVAILABLE',
      message: error?.message || 'The Oling Clash could not be loaded.'
    };
    showGate({
      ...state,
      secondaryLabel:
        error?.code && states[error.code] ? 'CREATE CLASH' : 'TRY AGAIN',
      onSecondary: () => {
        if (error?.code && states[error.code]) {
          navigateTo('/olings/clash/settings');
          return;
        }
        initializeOnlineMatch().catch(showMatchError);
      }
    });
  }

  async function waitForOeAssets() {
    if (window.Ready?.isReady?.('user-customisation-icon')) return;
    await window.Ready?.when?.('user-customisation-icon', { timeout: 10000 });
  }

  function createOeLayers(oeIcon) {
    return (
      window.OlingClashOeLayers?.createLayers?.(oeIcon, {
        className: 'olings-clash-player__oe-layer'
      }) || []
    );
  }

  function getPlayerLevel(player) {
    const level = Number(player?.gameData?.level ?? player?.level);
    return Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  }

  function renderPlayer(card, player, { isOpponent = false } = {}) {
    if (!card || !player) return;

    const level = card.querySelector('[data-clash-player-level]');
    const name = card.querySelector('[data-clash-player-name]');
    const oe = card.querySelector('[data-clash-player-oe]');
    const opponentSlot = card.querySelector('[data-clash-opponent-slot]');
    const playerType = card.querySelector('[data-clash-player-type]');
    const readyStatus = card.querySelector('[data-clash-player-ready]');
    const aiStatus = card.querySelector('[data-clash-ai-level]');

    card.classList.remove('is-empty');
    if (level) {
      level.hidden = false;
      level.textContent = `LEVEL ${getPlayerLevel(player)}`;
    }
    if (name) name.textContent = player.username || 'PLAYER';
    if (playerType && isOpponent) {
      playerType.textContent = player.isAi ? 'AI' : 'OPPONENT';
    }
    if (readyStatus) {
      const isHost = player.slot === 'player-one';
      const hasReadyState = isHost || typeof player.ready === 'boolean';
      readyStatus.hidden = !hasReadyState;
      readyStatus.textContent = isHost
        ? 'HOST'
        : player.ready
          ? 'READY'
          : 'NOT READY';
      readyStatus.classList.toggle('is-ready', isHost || Boolean(player.ready));
    }
    if (aiStatus) {
      aiStatus.hidden = !player.isAi;
      aiStatus.textContent = getAiDifficultyLabel(player.aiDifficulty);
    }
    if (oe) {
      oe.hidden = false;
      oe.replaceChildren(...createOeLayers(player.oeIcon));
    }
    if (isOpponent && opponentSlot) opponentSlot.hidden = true;
  }

  function renderEmptyOpponent() {
    const card = playerCards.opponent;
    if (!card) return;

    const level = card.querySelector('[data-clash-player-level]');
    const name = card.querySelector('[data-clash-player-name]');
    const oe = card.querySelector('[data-clash-player-oe]');
    const opponentSlot = card.querySelector('[data-clash-opponent-slot]');
    const playerType = card.querySelector('[data-clash-player-type]');
    const readyStatus = card.querySelector('[data-clash-player-ready]');
    const aiStatus = card.querySelector('[data-clash-ai-level]');

    card.classList.add('is-empty');
    if (level) level.hidden = true;
    if (name) name.textContent = 'WAITING FOR PLAYER';
    if (playerType) playerType.textContent = 'OPPONENT';
    if (readyStatus) {
      readyStatus.hidden = true;
      readyStatus.textContent = '';
      readyStatus.classList.remove('is-ready');
    }
    if (aiStatus) {
      aiStatus.hidden = true;
      aiStatus.textContent = '';
    }
    if (oe) {
      oe.hidden = true;
      oe.replaceChildren();
    }
    if (opponentSlot) opponentSlot.hidden = false;
  }

  function setOpponent(opponent) {
    if (opponent) {
      renderPlayer(playerCards.opponent, opponent, { isOpponent: true });
      return;
    }
    renderEmptyOpponent();
  }

  function getSelectedOling() {
    return playerOlings[selectedOlingIndex] || playerOlings[0] || null;
  }

  function configureOlingFlight(container, oling) {
    window.OlingFlightMotion?.configure?.(container, oling);
  }

  function getSelectorTraitKey(oling, layer) {
    const source = oling?.source || {};
    const directKey =
      source.traits?.[layer]?.key || source.build?.[layer] || '';
    if (directKey) return String(directKey).trim().toLowerCase();

    return String(oling?.[layer] || '')
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase();
  }

  function renderSelectorAbilities(oling) {
    if (!selectorAbilities) return;
    let resolvedAbilityCount = 0;

    selectorAbilityCards.forEach((card) => {
      const action = card.dataset.clashSelectorAbility;
      const layer = selectorAbilityLayers[action];
      const traitKey = getSelectorTraitKey(oling, layer);
      const ability = clashAbilitiesByTrait.get(traitKey) || null;
      const abilityName = ability?.name || action.toUpperCase();
      const image = card.querySelector('[data-clash-move-image]');
      const label = card.querySelector('[data-clash-move-name]');

      if (ability) resolvedAbilityCount += 1;
      card.disabled = !ability;
      if (ability?.key) card.dataset.clashAbilityKey = ability.key;
      else delete card.dataset.clashAbilityKey;
      if (image) {
        image.hidden = !ability?.imagePath;
        if (ability?.imagePath) image.src = ability.imagePath;
        else image.removeAttribute('src');
      }
      if (label) label.textContent = abilityName;
      card.setAttribute(
        'aria-label',
        action === 'draw'
          ? `Draw passive: ${abilityName}`
          : `${action}: ${abilityName}`
      );
      card.title = ability?.description || abilityName;
    });

    selectorAbilities.hidden = resolvedAbilityCount === 0;
  }

  function getSelectedOlingAbilities() {
    const oling = getSelectedOling();
    return Object.values(selectorAbilityLayers)
      .map((layer) => {
        const ability = clashAbilitiesByTrait.get(
          getSelectorTraitKey(oling, layer)
        );
        return ability
          ? { ...ability, traitImagePath: oling?.[layer] || '' }
          : null;
      })
      .filter(Boolean);
  }

  function openSelectorAbilityDetails(card) {
    const abilityKey = card?.dataset.clashAbilityKey;
    if (!abilityKey) return null;
    return window.OlingClashAbilityDetails?.open({
      abilities: getSelectedOlingAbilities(),
      initialAbilityKey: abilityKey,
      returnFocus: card
    });
  }

  async function loadSelectorAbilityCatalog() {
    let abilities = [];
    if (window.OlingClashAbilityDetails?.loadCatalog) {
      abilities = await window.OlingClashAbilityDetails.loadCatalog();
    } else {
      const response = await fetch('/json-files/olings/clash-abilities.json', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return 0;
      const payload = await response.json();
      abilities = payload?.abilities || [];
    }
    clashAbilitiesByTrait = new Map(
      abilities
        .filter(
          (ability) =>
            ability?.traitKey &&
            ability.enabled !== false &&
            ability.isCurrent !== false
        )
        .map((ability) => [String(ability.traitKey).toLowerCase(), ability])
    );
    renderSelectorAbilities(getSelectedOling());
    return clashAbilitiesByTrait.size;
  }

  function renderSelector() {
    const oling = getSelectedOling();
    if (!oling || !window.OlingSelector) return;

    const isSelected = selectedTeam.some(
      (teamOling) => teamOling?.id === oling.id
    );
    if (selectorSelected) selectorSelected.hidden = !isSelected;
    selectorPicker?.classList.toggle('is-selected', isSelected);

    window.OlingSelector.renderArt(selectorPreview, oling, {
      configureFlight: configureOlingFlight
    });
    renderSelectorAbilities(oling);
  }

  function setSelectorVisible(visible) {
    lobby?.classList.toggle('is-selecting-oling', visible);
    if (selectorPicker) selectorPicker.hidden = !visible;
    if (selectorCancelButton) selectorCancelButton.hidden = !visible;
    updateReadyButton();
  }

  function cancelOlingSelection() {
    if (!lobby?.classList.contains('is-selecting-oling')) return false;
    activeTeamSlotIndex = -1;
    setSelectorVisible(false);
    return true;
  }

  function openOlingSelector(slotIndex) {
    if (!playerOlings.length || !teamSlots[slotIndex]) return;

    activateLobbyTab('team');
    activeTeamSlotIndex = slotIndex;
    const currentOling = selectedTeam[slotIndex];
    const firstUnselectedIndex = playerOlings.findIndex(
      (oling) => !selectedTeam.some((teamOling) => teamOling?.id === oling.id)
    );
    selectedOlingIndex = currentOling
      ? Math.max(
          0,
          playerOlings.findIndex((oling) => oling.id === currentOling.id)
        )
      : Math.max(0, firstUnselectedIndex);
    setSelectorVisible(true);
    renderSelector();
  }

  function cycleOling(direction) {
    if (!playerOlings.length) return;
    selectedOlingIndex =
      (selectedOlingIndex + direction + playerOlings.length) %
      playerOlings.length;
    renderSelector();
  }

  function createEmptySlotMarker() {
    const marker = document.createElement('span');
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = '+';
    return marker;
  }

  function formatClashRoles(roles) {
    const labels = (Array.isArray(roles) ? roles : [])
      .map((role) => window.OlingSelector?.formatKey?.(role, '') || '')
      .filter(Boolean)
      .slice(0, 2);
    return labels.length ? labels.join('/') : 'UNCLASSIFIED';
  }

  function renderTeamSlot(slotIndex, oling) {
    const slot = teamSlots[slotIndex];
    const button = slot?.querySelector('button');
    const name = slot?.querySelector('[data-clash-team-name]');
    const roles = slot?.querySelector('[data-clash-team-roles]');
    if (!slot || !button) return;

    if (!oling || !window.OlingSelector) {
      button.classList.remove('has-oling');
      delete button.dataset.olingId;
      button.setAttribute('aria-label', `Select Oling ${slotIndex + 1}`);
      button.replaceChildren(createEmptySlotMarker());
      if (name) {
        name.textContent = `OLING ${slotIndex + 1}`;
        name.removeAttribute('title');
      }
      if (roles) {
        roles.textContent = '';
        roles.hidden = true;
      }
      updateTeamCount();
      return;
    }

    button.classList.add('has-oling');
    button.dataset.olingId = oling.id;
    button.setAttribute(
      'aria-label',
      `Change Oling ${slotIndex + 1}, currently ${oling.name}`
    );
    window.OlingSelector.renderArt(button, oling, {
      configureFlight: configureOlingFlight
    });
    if (name) {
      name.textContent = oling.name || `OLING ${slotIndex + 1}`;
      name.title = name.textContent;
    }
    if (roles) {
      roles.textContent = formatClashRoles(oling.clashRoles);
      roles.hidden = false;
    }
    updateTeamCount();
  }

  function saveSelectedTeam() {
    localStorage.setItem(
      'olings-clash-team',
      JSON.stringify(selectedTeam.map((teamOling) => teamOling?.id || null))
    );
  }

  function swapTeamSlots(fromSlotIndex, toSlotIndex) {
    const from = Number(fromSlotIndex);
    const to = Number(toSlotIndex);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from === to ||
      !teamSlots[from] ||
      !teamSlots[to] ||
      !selectedTeam[from]
    ) {
      return false;
    }
    [selectedTeam[from], selectedTeam[to]] = [
      selectedTeam[to],
      selectedTeam[from]
    ];
    renderTeamSlot(from, selectedTeam[from]);
    renderTeamSlot(to, selectedTeam[to]);
    saveSelectedTeam();
    updateReadyButton();
    if (hasCompleteTeam() && clashMatch) {
      syncSelectedTeam().catch(showMatchError);
    }
    return true;
  }

  const teamDragController = window.createOlingClashTeamDragController({
    document,
    hasOling: (slotIndex) => Boolean(selectedTeam[slotIndex]),
    holdMs: 180,
    lobby,
    onSwap: swapTeamSlots,
    teamSlots
  });
  const clearTeamDrag = teamDragController.clear;
  const handleTeamPointerDown = teamDragController.pointerDown;
  const handleTeamPointerMove = teamDragController.pointerMove;
  const handleTeamPointerUp = teamDragController.pointerUp;

  function saveSelectedOling() {
    const oling = getSelectedOling();
    if (!oling || activeTeamSlotIndex < 0) return;

    const previousSlotIndex = selectedTeam.findIndex(
      (teamOling, slotIndex) =>
        slotIndex !== activeTeamSlotIndex && teamOling?.id === oling.id
    );
    if (previousSlotIndex >= 0) {
      selectedTeam[previousSlotIndex] = null;
      renderTeamSlot(previousSlotIndex, null);
    }
    selectedTeam[activeTeamSlotIndex] = oling;
    renderTeamSlot(activeTeamSlotIndex, oling);
    saveSelectedTeam();
    activeTeamSlotIndex = -1;
    setSelectorVisible(false);
    updateReadyButton();
    if (hasCompleteTeam() && clashMatch) {
      syncSelectedTeam().catch(showMatchError);
    }
  }

  function restoreSavedTeam() {
    let savedIds = [];
    const restoredIds = new Set();
    try {
      savedIds = JSON.parse(localStorage.getItem('olings-clash-team')) || [];
    } catch {
      savedIds = [];
    }

    selectedTeam.forEach((_, slotIndex) => {
      const savedId = String(savedIds[slotIndex] || '');
      const oling = playerOlings.find(
        (item) => item.id === savedId && !restoredIds.has(savedId)
      );
      if (oling) restoredIds.add(oling.id);
      selectedTeam[slotIndex] = oling || null;
      renderTeamSlot(slotIndex, oling);
    });
    saveSelectedTeam();
  }

  async function fetchCurrentAccount() {
    const payload = await requestJson('/api/accounts/me');
    return payload.account || payload.data?.account || null;
  }

  async function fetchPlayerOlings() {
    const payload = await requestJson('/api/olings/mine');
    const olings = payload.olings || payload.data?.olings || [];
    const normalizeOling =
      window.OlingSelector?.normalizeOling || ((oling) => oling);
    return Array.isArray(olings)
      ? olings.map(normalizeOling).filter(Boolean)
      : [];
  }

  function hasCompleteTeam() {
    return (
      selectedTeam.length === minimumTeamSize && selectedTeam.every(Boolean)
    );
  }

  function updateTeamCount() {
    const selectedCount = selectedTeam.filter(Boolean).length;
    if (teamCount) {
      teamCount.textContent = `${selectedCount}/${minimumTeamSize} SELECTED`;
    }
  }

  function getCurrentAccountId() {
    return String(currentAccount?.id || currentAccount?._id || '');
  }

  function getLocalMatchPlayer(match = clashMatch) {
    const accountId = getCurrentAccountId();
    return match?.players?.find(
      (player) => String(player.accountId || '') === accountId
    );
  }

  function isSelectedTeamSynced() {
    const team = getLocalMatchPlayer()?.team;
    if (!hasCompleteTeam() || !Array.isArray(team) || team.length !== 3) {
      return false;
    }
    return team.every(
      (teamOling) =>
        selectedTeam[Number(teamOling.teamSlot)]?.id ===
        String(teamOling.playerOlingId || '')
    );
  }

  function updateReadyButton() {
    if (!readyButton) return;
    if (lobby?.classList.contains('is-selecting-oling')) {
      readyButton.disabled = !getSelectedOling();
      readyButton.textContent = 'SAVE';
      readyButton.classList.remove('is-ready');
      return;
    }
    if (isSettingsPage && !clashMatch) {
      updateTeamCount();
      readyButton.disabled = !hasCompleteTeam() || !selectedOpponentMode;
      readyButton.textContent =
        selectedOpponentMode === 'online'
          ? 'CREATE ONLINE CLASH'
          : selectedOpponentMode === 'ai'
            ? 'START AI CLASH'
            : 'CHOOSE OPPONENT';
      readyButton.classList.remove('is-ready');
      return;
    }
    const localPlayer = getLocalMatchPlayer();
    const opponent = clashMatch?.players?.find(
      (player) => player.accountId !== localPlayer?.accountId
    );
    const isHost = localPlayer?.slot === 'player-one';
    const canChangeLobbyState = ['waiting', 'ready'].includes(
      clashMatch?.status
    );
    const isAiMatch = Boolean(opponent?.isAi);
    updateTeamCount();
    if (shareControls) shareControls.hidden = isAiMatch;
    if (aiControls) aiControls.hidden = !isAiMatch;
    if (aiDifficultySelect) {
      if (!aiDifficultyRequestPending) {
        aiDifficultySelect.value = getAiDifficultyOption(
          opponent?.aiDifficulty
        );
      }
      aiDifficultySelect.disabled =
        aiDifficultyRequestPending || !isHost || !canChangeLobbyState;
    }
    if (playerCount) {
      playerCount.textContent = isAiMatch
        ? 'SOLO CLASH'
        : `${opponent ? 2 : 1}/2 PLAYERS`;
    }
    if (isHost) {
      readyButton.disabled = !(
        clashMatch &&
        hasCompleteTeam() &&
        opponent?.ready &&
        canChangeLobbyState
      );
      readyButton.textContent = !opponent
        ? 'WAITING FOR PLAYER'
        : !opponent.ready
          ? 'WAITING FOR OPPONENT'
          : isSettingsPage && isAiMatch
            ? 'START AI CLASH'
            : 'START CLASH';
    } else {
      readyButton.disabled = !(
        clashMatch &&
        hasCompleteTeam() &&
        opponent &&
        canChangeLobbyState
      );
      readyButton.textContent = localPlayer?.ready
        ? 'CANCEL READY'
        : 'READY UP';
    }
    readyButton.classList.toggle('is-ready', Boolean(localPlayer?.ready));
  }

  function updateOpponentButton() {
    if (!opponentSlotButton) return;
    const localPlayer = getLocalMatchPlayer();
    const hasOpponent = Boolean(
      clashMatch?.players?.some(
        (player) => player.accountId !== localPlayer?.accountId
      )
    );
    const canAddAi =
      Boolean(clashMatch) &&
      localPlayer?.slot === 'player-one' &&
      !localPlayer?.isAi &&
      !hasOpponent &&
      ['waiting', 'ready'].includes(clashMatch.status);
    opponentSlotButton.disabled = aiOpponentRequestPending || !canAddAi;
    opponentSlotButton.setAttribute(
      'aria-busy',
      aiOpponentRequestPending ? 'true' : 'false'
    );
  }

  function restoreMatchTeam(match) {
    const player = getLocalMatchPlayer(match);
    if (
      !Array.isArray(player?.team) ||
      player.team.length !== minimumTeamSize
    ) {
      return;
    }
    selectedTeam.forEach((_, slotIndex) => {
      selectedTeam[slotIndex] = null;
      renderTeamSlot(slotIndex, null);
    });
    player.team.forEach((teamOling) => {
      const slotIndex = Number(teamOling.teamSlot);
      const oling = playerOlings.find(
        (item) => item.id === String(teamOling.playerOlingId || '')
      );
      if (!Number.isInteger(slotIndex) || !teamSlots[slotIndex] || !oling)
        return;
      selectedTeam[slotIndex] = oling;
      renderTeamSlot(slotIndex, oling);
    });
    saveSelectedTeam();
  }

  function syncMatch(match) {
    if (!match?.matchCode) return;
    clashMatch = match;
    if (roomCodeInput) roomCodeInput.value = match.matchCode;
    const localPlayer = getLocalMatchPlayer(match);
    const opponent = match.players?.find(
      (player) => player.accountId !== localPlayer?.accountId
    );
    if (localPlayer) renderPlayer(playerCards.local, localPlayer);
    setOpponent(opponent || null);
    restoreMatchTeam(match);
    renderRulesSummary(match);
    updateReadyButton();
    updateOpponentButton();
    if (window.OlingClashGame?.isOnlineEndGameVisible?.()) {
      setLobbyView(false);
      window.OlingClashGame.handleOnlineRematchUpdate?.(
        match,
        getCurrentAccountId()
      );
      return;
    }
    if (window.OlingClashGame?.isResolvingOnlineRound?.()) {
      setLobbyView(false);
      window.OlingClashGame.useOnlineMatch?.(match, getCurrentAccountId());
      return;
    }
    if (match.status === 'active') showGame(match);
    else showLobby();
  }

  async function createOnlineMatch() {
    const payload = await requestJson('/api/olings/clashes', {
      method: 'POST',
      body: JSON.stringify({
        olingIds: hasCompleteTeam()
          ? selectedTeam.map((oling) => oling.id)
          : undefined
      })
    });
    return payload.match || null;
  }

  async function joinOnlineMatch(matchCode) {
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(matchCode)}/join`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
    return payload.match || null;
  }

  async function fetchOnlineMatch() {
    if (!clashMatch?.matchCode) return null;
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(clashMatch.matchCode)}`
    );
    return payload.match || null;
  }

  async function syncSelectedTeam() {
    if (!clashMatch?.matchCode || !hasCompleteTeam()) return clashMatch;
    if (teamSyncPromise) return teamSyncPromise;
    teamSyncPromise = requestJson(
      `/api/olings/clashes/${encodeURIComponent(clashMatch.matchCode)}/team`,
      {
        method: 'POST',
        body: JSON.stringify({
          olingIds: selectedTeam.map((oling) => oling.id)
        })
      }
    )
      .then((payload) => {
        syncMatch(payload.match);
        return payload.match;
      })
      .finally(() => {
        teamSyncPromise = null;
      });
    return teamSyncPromise;
  }

  async function toggleReady() {
    if (!clashMatch?.matchCode || !hasCompleteTeam()) return;
    if (!isSelectedTeamSynced()) await syncSelectedTeam();
    const localPlayer = getLocalMatchPlayer();
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(clashMatch.matchCode)}/ready`,
      {
        method: 'POST',
        body: JSON.stringify({ ready: !localPlayer?.ready })
      }
    );
    syncMatch(payload.match);
  }

  async function startClash() {
    if (!clashMatch?.matchCode || !hasCompleteTeam()) return;
    if (!isSelectedTeamSynced()) await syncSelectedTeam();
    const payload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(clashMatch.matchCode)}/start`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    if (isSettingsPage && selectedOpponentMode === 'ai') {
      const activeMatch = payload.match || clashMatch;
      window.sessionStorage.setItem(
        'olings-clash-offline-match',
        activeMatch.matchCode
      );
      navigateTo('/olings/clash');
      return;
    }
    syncMatch(payload.match);
  }

  async function handleReadyButton() {
    const localPlayer = getLocalMatchPlayer();
    if (localPlayer?.slot === 'player-one') return startClash();
    return toggleReady();
  }

  async function addAiOpponent(difficulty = 0.45) {
    if (!clashMatch?.matchCode || aiOpponentRequestPending) return;
    aiOpponentRequestPending = true;
    updateOpponentButton();
    try {
      const payload = await requestJson(
        `/api/olings/clashes/${encodeURIComponent(
          clashMatch.matchCode
        )}/ai-opponent`,
        {
          method: 'POST',
          body: JSON.stringify({ difficulty })
        }
      );
      syncMatch(payload.match);
    } finally {
      aiOpponentRequestPending = false;
      updateOpponentButton();
    }
  }

  async function updateAiDifficulty() {
    const difficulty = Number(aiDifficultySelect?.value);
    if (
      !clashMatch?.matchCode ||
      !Number.isFinite(difficulty) ||
      aiDifficultyRequestPending
    ) {
      return;
    }
    aiDifficultyRequestPending = true;
    updateReadyButton();
    try {
      const payload = await requestJson(
        `/api/olings/clashes/${encodeURIComponent(
          clashMatch.matchCode
        )}/ai-opponent/difficulty`,
        {
          method: 'POST',
          body: JSON.stringify({ difficulty })
        }
      );
      syncMatch(payload.match);
    } finally {
      aiDifficultyRequestPending = false;
      updateReadyButton();
    }
  }

  function ensureOnlineRuntime() {
    if (window.OlingClashLobbyOnline) {
      return Promise.resolve(window.OlingClashLobbyOnline);
    }
    if (onlineRuntimePromise) return onlineRuntimePromise;

    onlineRuntimePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const version = String(window.WEBSITE_CACHE_VERSION || '').trim();
      script.src = `/build/olings/clash/clash-lobby-online.js${
        version ? `?v=${encodeURIComponent(version)}` : ''
      }`;
      script.async = true;
      script.addEventListener(
        'load',
        () => resolve(window.OlingClashLobbyOnline || null),
        { once: true }
      );
      script.addEventListener(
        'error',
        () => {
          onlineRuntimePromise = null;
          reject(new Error('Unable to load the Oling Clash online runtime.'));
        },
        { once: true }
      );
      document.head.append(script);
    });
    return onlineRuntimePromise;
  }

  async function initializeClashSocket() {
    if (clashSocket || !clashMatch?.matchCode) {
      return;
    }
    if (typeof window.io !== 'function') {
      const onlineRuntime = await ensureOnlineRuntime();
      await onlineRuntime?.ensureSocketIo?.();
    }
    if (typeof window.io !== 'function') {
      throw new Error('The Oling Clash online client is unavailable.');
    }
    clashSocket = window.io();
    const joinRoom = () => {
      clashSocket.emit('oling-clash:join-room', clashMatch.matchCode);
    };
    const applySocketMatch = (match) => {
      if (match?.matchCode === clashMatch?.matchCode) syncMatch(match);
    };
    clashSocket.on('connect', () => {
      joinRoom();
      fetchOnlineMatch().then(syncMatch).catch(showMatchError);
    });
    clashSocket.on('oling-clash:state', applySocketMatch);
    clashSocket.on('oling-clash:started', applySocketMatch);
    clashSocket.on('oling-clash:left', applySocketMatch);
    clashSocket.on('oling-clash:round', applySocketMatch);
    clashSocket.on('oling-clash:replacement', applySocketMatch);
    clashSocket.on('oling-clash:round-resolved', (payload) => {
      window.OlingClashGame?.handleOnlineRoundResult?.(payload);
    });
    clashSocket.on('oling-clash:replacement-selected', (payload) => {
      window.OlingClashGame?.handleOnlineReplacement?.(payload);
    });
    clashSocket.on('oling-clash:forfeited', (payload) => {
      window.OlingClashGame?.handleOnlineForfeit?.(payload);
    });
  }

  async function initializeOnlineMatch({ opponentMode = 'online' } = {}) {
    showGate({
      title: getMatchCodeFromPath() ? 'JOINING CLASH' : 'CREATING CLASH',
      message: '',
      primaryLabel: '',
      secondaryLabel: ''
    });
    const pathMatchCode = getMatchCodeFromPath();
    const match = pathMatchCode
      ? await joinOnlineMatch(pathMatchCode)
      : await createOnlineMatch();
    if (!match) throw new Error('The Oling Clash did not return a lobby.');
    if (!pathMatchCode) {
      window.history.replaceState(
        {},
        '',
        `/olings/clash/${encodeURIComponent(match.matchCode)}`
      );
    }
    syncMatch(match);
    if (hasCompleteTeam() && !isSelectedTeamSynced()) {
      await syncSelectedTeam();
    }
    await initializeClashSocket();
    if (!pathMatchCode && opponentMode === 'ai') {
      showGate({
        title: 'ADDING AI OPPONENT',
        message: '',
        primaryLabel: '',
        secondaryLabel: ''
      });
      await addAiOpponent();
    }
  }

  async function launchConfiguredMatch(mode) {
    if (!hasCompleteTeam()) {
      activateLobbyTab('team');
      return;
    }
    showGate({
      title: mode === 'ai' ? 'PREPARING AI CLASH' : 'CREATING CLASH',
      message: '',
      primaryLabel: '',
      secondaryLabel: ''
    });
    const match = await createOnlineMatch();
    if (!match?.matchCode) {
      throw new Error('The Oling Clash did not return a lobby.');
    }
    if (mode === 'online') {
      navigateTo(`/olings/clash/${encodeURIComponent(match.matchCode)}`);
      return;
    }

    const aiPayload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(match.matchCode)}/ai-opponent`,
      {
        method: 'POST',
        body: JSON.stringify({ difficulty: 0.45 })
      }
    );
    const aiMatch = aiPayload.match || match;
    const startPayload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(aiMatch.matchCode)}/start`,
      { method: 'POST', body: JSON.stringify({}) }
    );
    const activeMatch = startPayload.match || aiMatch;
    window.sessionStorage.setItem(
      'olings-clash-offline-match',
      activeMatch.matchCode
    );
    navigateTo('/olings/clash');
  }

  async function prepareAiSettingsMatch() {
    showGate({
      title: 'PREPARING AI CLASH',
      message: '',
      primaryLabel: '',
      secondaryLabel: ''
    });
    const match = await createOnlineMatch();
    if (!match?.matchCode) {
      throw new Error('The Oling Clash did not return a lobby.');
    }
    clashMatch = match;
    const aiPayload = await requestJson(
      `/api/olings/clashes/${encodeURIComponent(match.matchCode)}/ai-opponent`,
      {
        method: 'POST',
        body: JSON.stringify({ difficulty: 0.45 })
      }
    );
    syncMatch(aiPayload.match || match);
    const matchupTab = tabButtons.find(
      (button) => button.dataset.clashTab === 'online'
    );
    if (matchupTab) matchupTab.hidden = false;
    showLobby();
    activateLobbyTab('team');
    updateReadyButton();
  }

  async function chooseOpponentMode(mode) {
    if (!['online', 'ai'].includes(mode)) return;
    const selectedButton = modeButtons.find(
      (button) => button.dataset.clashMode === mode
    );
    if (!selectedButton || selectedButton.disabled) return;

    modeButtons.forEach((button) => {
      const isSelected = button === selectedButton;
      button.disabled = true;
      button.setAttribute('aria-busy', String(isSelected));
      button.setAttribute('aria-pressed', String(isSelected));
      button.classList.toggle('is-selected', isSelected);
    });
    try {
      if (isSettingsPage) {
        selectedOpponentMode = mode;
        if (page) page.dataset.clashOpponentMode = mode;
        if (mode === 'ai') await prepareAiSettingsMatch();
        else {
          showLobby();
          activateLobbyTab('team');
          updateReadyButton();
        }
      } else {
        await initializeOnlineMatch({ opponentMode: mode });
        activateLobbyTab('team');
      }
    } catch (error) {
      showMatchError(error);
    } finally {
      modeButtons.forEach((button) => {
        button.disabled = false;
        button.setAttribute('aria-busy', 'false');
      });
    }
  }

  async function copyRoomLink() {
    if (!clashMatch?.matchCode) return;
    const roomUrl = `${window.location.origin}/olings/clash/${clashMatch.matchCode}`;
    if (typeof window.navigator.clipboard?.writeText === 'function') {
      await window.navigator.clipboard.writeText(roomUrl);
    } else {
      if (!roomCodeInput) return;
      roomCodeInput.value = roomUrl;
      roomCodeInput.select();
      if (!document.execCommand?.('copy')) {
        roomCodeInput.value = clashMatch.matchCode;
        return;
      }
    }
    if (roomCodeInput) roomCodeInput.value = 'COPIED';
    window.setTimeout(() => {
      if (roomCodeInput && clashMatch) {
        roomCodeInput.value = clashMatch.matchCode;
      }
    }, 1200);
  }

  function closeRoomQrCode({ restoreFocus = true } = {}) {
    if (!qrDialog || qrDialog.hidden) return false;
    qrDialog.hidden = true;
    qrDialog.setAttribute('aria-hidden', 'true');
    if (lobby) lobby.inert = false;
    qrCodeButton?.classList.remove('active');
    if (restoreFocus) qrPreviousFocus?.focus?.();
    qrPreviousFocus = null;
    return true;
  }

  function showRoomQrCode() {
    if (!clashMatch?.matchCode || !qrDialog || !qrImage) return false;
    const roomPath = `/olings/clash/${clashMatch.matchCode}`;
    const roomUrl = `${window.location.origin}${roomPath}`;
    qrPreviousFocus = document.activeElement;
    qrImage.alt = `Join Oling Clash ${clashMatch.matchCode}`;
    qrImage.src = `/api/party-qr/${encodeURIComponent(
      clashMatch.matchCode
    )}?color=%234BC7C1&path=${encodeURIComponent(roomPath)}`;
    if (qrUrl) qrUrl.textContent = roomUrl;
    if (qrPlayerCount) {
      const count = Math.min(2, Math.max(1, clashMatch.players?.length || 1));
      qrPlayerCount.textContent = `(${count}/2)`;
    }
    if (lobby) lobby.inert = true;
    qrDialog.hidden = false;
    qrDialog.setAttribute('aria-hidden', 'false');
    qrCodeButton?.classList.add('active');
    qrDialog.focus();
    return true;
  }

  async function initializeClashLobby() {
    showGate({
      title: 'LOADING CLASH',
      message: '',
      primaryLabel: '',
      secondaryLabel: ''
    });
    await waitForOeAssets();

    window.OlingsClashLobby = {
      initializeOnlineMatch,
      addAiOpponent,
      cancelOlingSelection,
      createOeLayers,
      fetchOnlineMatch,
      openOlingSelector,
      saveSelectedOling,
      setOpponent,
      showMatchError,
      showRoomQrCode,
      swapTeamSlots,
      syncMatch
    };

    const storedAccount = getStoredAccount();
    if (storedAccount) renderPlayer(playerCards.local, storedAccount);

    currentAccount = await fetchCurrentAccount().catch(() => storedAccount);
    if (currentAccount) renderPlayer(playerCards.local, currentAccount);
    setOpponent(null);

    playerOlings = await fetchPlayerOlings();
    loadSelectorAbilityCatalog().catch(() => {});
    restoreSavedTeam();

    teamSlots.forEach((slot, slotIndex) => {
      const button = slot.querySelector('button');
      button?.setAttribute('aria-grabbed', 'false');
      button?.addEventListener('click', () => {
        if (teamDragController.shouldSuppressClick()) return;
        openOlingSelector(slotIndex);
      });
      button?.addEventListener('pointerdown', (event) =>
        handleTeamPointerDown(event, slotIndex)
      );
      button?.addEventListener('contextmenu', (event) => {
        if (selectedTeam[slotIndex]) event.preventDefault();
      });
    });
    tabButtons.forEach((button, buttonIndex) => {
      button.addEventListener('click', () => {
        activateLobbyTab(button.dataset.clashTab);
      });
      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          return;
        }
        event.preventDefault();
        let nextIndex = buttonIndex;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabButtons.length - 1;
        if (event.key === 'ArrowLeft') {
          nextIndex = (buttonIndex - 1 + tabButtons.length) % tabButtons.length;
        }
        if (event.key === 'ArrowRight') {
          nextIndex = (buttonIndex + 1) % tabButtons.length;
        }
        activateLobbyTab(tabButtons[nextIndex]?.dataset.clashTab, {
          focus: true
        });
      });
    });
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        chooseOpponentMode(button.dataset.clashMode);
      });
    });
    aiDifficultySelect?.addEventListener('change', () => {
      updateAiDifficulty().catch(showMatchError);
    });
    modeSelection?.addEventListener('keydown', (event) => {
      const availableButtons = modeButtons.filter((button) => !button.disabled);
      if (!availableButtons.length) return;
      const activeIndex = availableButtons.indexOf(document.activeElement);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex =
          (Math.max(0, activeIndex) + direction + availableButtons.length) %
          availableButtons.length;
        availableButtons[nextIndex].focus();
        return;
      }
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === availableButtons[0]) {
        event.preventDefault();
        availableButtons.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === availableButtons.at(-1)
      ) {
        event.preventDefault();
        availableButtons[0].focus();
      }
    });
    document.addEventListener('pointermove', handleTeamPointerMove, {
      passive: false
    });
    document.addEventListener('pointerup', handleTeamPointerUp);
    document.addEventListener('pointercancel', () => clearTeamDrag());
    selectorPrevious?.addEventListener('click', () => cycleOling(-1));
    selectorNext?.addEventListener('click', () => cycleOling(1));
    selectorAbilityCards.forEach((card) => {
      card.addEventListener('click', () => openSelectorAbilityDetails(card));
    });
    selectorCancelButton?.addEventListener('click', cancelOlingSelection);
    readyButton?.addEventListener('click', () => {
      if (lobby?.classList.contains('is-selecting-oling')) {
        saveSelectedOling();
        return;
      }
      if (isSettingsPage && !clashMatch) {
        if (!selectedOpponentMode) {
          setModeSelectionVisible(true);
          return;
        }
        launchConfiguredMatch(selectedOpponentMode).catch(showMatchError);
        return;
      }
      handleReadyButton().catch(showMatchError);
    });
    opponentSlotButton?.addEventListener('click', () => {
      addAiOpponent().catch(showMatchError);
    });
    copyLinkButton?.addEventListener('click', () => {
      copyRoomLink().catch(() => {});
    });
    qrCodeButton?.addEventListener('click', () => {
      showRoomQrCode();
    });
    qrDialog?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeRoomQrCode();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && qrDialog && !qrDialog.hidden) {
        event.preventDefault();
        closeRoomQrCode();
        return;
      }
      if (
        event.key === 'Escape' &&
        !window.OlingClashAbilityDetails?.isOpen?.() &&
        lobby?.classList.contains('is-selecting-oling')
      ) {
        event.preventDefault();
        cancelOlingSelection();
        return;
      }
      if (
        event.key.toLowerCase() !== 'o' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
        opponentSlotButton?.disabled
      ) {
        return;
      }
      event.preventDefault();
      addAiOpponent().catch(showMatchError);
    });

    window.addEventListener('oe-account-state-changed', (event) => {
      if (event.detail?.account) {
        currentAccount = event.detail.account;
        renderPlayer(playerCards.local, event.detail.account);
      }
    });
    window.addEventListener('olings-clash:opponent-changed', (event) => {
      setOpponent(event.detail?.opponent || null);
    });
    document.addEventListener('olings-clash:online-round-finished', (event) => {
      if (event.detail?.match) syncMatch(event.detail.match);
    });

    renderRulesSummary();
    updateReadyButton();
    updateOpponentButton();
    if (playerOlings.length < minimumTeamSize) {
      showEligibilityGate(playerOlings.length);
      return;
    }
    if (getMatchCodeFromPath()) {
      activateLobbyTab('online');
      await initializeOnlineMatch();
      return;
    }
    if (isSettingsPage) {
      const onlineTab = tabButtons.find(
        (button) => button.dataset.clashTab === 'online'
      );
      if (onlineTab) onlineTab.hidden = true;
      showLobby();
      activateLobbyTab('team');
      updateReadyButton();
      setModeSelectionVisible(true);
      return;
    }
    setModeSelectionVisible(true);
  }

  initializeClashLobby()
    .catch((error) => {
      const expectedCodes = new Set([
        'oling_clash_not_found',
        'oling_clash_full',
        'oling_clash_already_started',
        'oling_clash_three_olings_required'
      ]);
      if (!expectedCodes.has(error?.code)) {
        console.error('Failed to initialize the Olings Clash lobby:', error);
      }
      renderEmptyOpponent();
      showMatchError(error);
    })
    .finally(() => {
      window.SetScriptLoaded?.(scriptPath);
      window.dispatchEvent(new CustomEvent('olings-clash:ready'));
    });
})();

function areHostedPartyRoleControlsReady() {
  return (
    partyGameMode !== 'mafia' ||
    (typeof fetchedRoles !== 'undefined' && fetchedRoles)
  );
}

async function waitForHostedPartySettingsControls(timeoutMs = 5000) {
  const startedAt = Date.now();
  while (
    (!window.inputPartyCode ||
      typeof window.SetGamemodeButtons !== 'function' ||
      typeof fetchedPacks === 'undefined' ||
      typeof fetchedSettings === 'undefined' ||
      !fetchedPacks ||
      !fetchedSettings ||
      !areHostedPartyRoleControlsReady()) &&
    Date.now() - startedAt < timeoutMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return Boolean(
    window.inputPartyCode &&
    typeof window.SetGamemodeButtons === 'function' &&
    typeof fetchedPacks !== 'undefined' &&
    typeof fetchedSettings !== 'undefined' &&
    fetchedPacks &&
    fetchedSettings &&
    areHostedPartyRoleControlsReady()
  );
}

function restoreHostedPartySettingControls(party) {
  const gameRules = party?.config?.gameRules || {};
  const selectedPacks = Array.isArray(party?.config?.selectedPacks)
    ? party.config.selectedPacks
    : [];
  const roleCounts =
    party?.config?.roleCounts && typeof party.config.roleCounts === 'object'
      ? party.config.roleCounts
      : {};

  gamemodeSettings = { ...gameRules };
  gamemodeSelectedPacks = [...selectedPacks];
  gamemodeRoleCounts = { ...roleCounts };

  packButtons.forEach((button) => {
    button.classList.toggle(
      'active',
      selectedPacks.includes(button.dataset.key)
    );
    SetButtonStyle(button, false);
  });

  settingsButtons.forEach((button) => {
    const key = button.dataset.key;
    if (!key) return;

    if (button.dataset.count !== undefined) {
      const value = Number(gameRules[key]);
      if (Number.isFinite(value)) {
        button.dataset.count = String(value);
        const countDisplay = button.querySelector('.count-display');
        if (countDisplay) countDisplay.textContent = String(value);
      }
      return;
    }

    const isActive = gameRules[key] === true || gameRules[key] === 'true';
    button.classList.toggle('active', isActive);
    SetButtonStyle(button, false);
  });

  const availableRoleButtons =
    typeof roleButtons === 'undefined' ? [] : roleButtons;
  availableRoleButtons.forEach((button) => {
    const key = button.dataset.key;
    if (!key) return;
    const value = Number(roleCounts[key] ?? gameRules[key]);
    if (!Number.isFinite(value)) return;

    gamemodeRoleCounts[key] = value;
    button.dataset.count = String(value);
    const countDisplay = button.querySelector('.count-display');
    if (countDisplay) countDisplay.textContent = String(value);
  });
}

function hostedPartyNeedsInitialSettings(party) {
  const config = party?.config || {};
  const gameRules = config.gameRules || {};
  const roleCounts = config.roleCounts || {};
  return (
    (!Array.isArray(config.selectedPacks) ||
      config.selectedPacks.length === 0) &&
    Object.keys(gameRules).length === 0 &&
    Object.keys(roleCounts).length === 0
  );
}

async function resumeHostedOnlinePartyFromUrl() {
  if (!partyCode) return false;

  if (!(await waitForHostedPartySettingsControls())) {
    throw new Error('Game settings controls were not ready for party resume.');
  }

  const existingData = await getExistingPartyData(partyCode);
  const party = Array.isArray(existingData) ? existingData[0] : null;
  if (!party) {
    await resetOnlineSettingsAfterMissingParty('resume-party-missing');
    return false;
  }

  const state = party.state || {};
  const gamemode = party.config?.gamemode || partyGameMode;
  if (state.isPlaying === true || state.phase !== 'lobby') {
    loadingPage = true;
    transitionSplashScreen(
      `/${formatPackName(gamemode)}/${partyCode}`,
      `/images/splash-screens/${formatPackName(gamemode)}.png`
    );
    return false;
  }

  const access = await getHostedOnlineSettingsAccess(party);
  if (!access.isHost) {
    redirectOnlinePartyToLobby(party, { forceWaitingRoom: true });
    return false;
  }

  if (!access.hostPlayer || !access.hostComputerId) {
    await resetOnlineSettingsAfterMissingParty('resume-party-host-missing');
    return false;
  }

  hostedParty = true;
  waitingForHost = false;
  window.onlinePartyTeardownInProgress = false;
  hostDeviceId = access.hostComputerId;
  currentPartyData = party;
  window.currentOnlineShuffleSeed = party.config?.shuffleSeed ?? null;
  window.inputPartyCode.value = partyCode;
  setOnlineSettingsPartyCodeInUrl(partyCode);

  onlineSettingsTab.classList.remove('disabled');
  hideContainer(packsContainer);
  packsSettingsTab.classList.remove('active');
  hideContainer(rulesContainer);
  rulesSettingsTab.classList.remove('active');
  onlineSettingsTab.classList.add('active');
  showContainer(onlineSettingsContainer);

  const needsInitialSettings = hostedPartyNeedsInitialSettings(party);
  if (!needsInitialSettings) {
    restoreHostedPartySettingControls(party);
  }
  await window.SetGamemodeButtons();

  await UpdateUserPartyData({
    partyId: partyCode,
    computerId: hostDeviceId,
    newUsername: access.hostPlayer?.identity?.username,
    newUserIcon: access.hostPlayer?.identity?.userIcon,
    newUserReady: true,
    newUserConfirmation: false,
    newUserSocketId: socket.id
  });
  await joinParty(partyCode);
  window.onlinePartySettingsResumePending = false;

  if (needsInitialSettings && typeof UpdateSettings === 'function') {
    await UpdateSettings();
    const initializedData = await getExistingPartyData(partyCode);
    currentPartyData = initializedData?.[0] || currentPartyData;
  }

  const latestParty = currentPartyData || party;
  window.syncOnlinePartyGameSwitcherButtons?.(latestParty);
  if (typeof UpdateUserIcons === 'function') {
    await UpdateUserIcons(latestParty);
  }
  if (typeof refreshOnlinePlayerCountRestrictions === 'function') {
    await refreshOnlinePlayerCountRestrictions();
  }
  if (typeof GetAllUsersReady === 'function') {
    allUsersReady = await GetAllUsersReady();
  }
  updateStartGameButton(allUsersReady);
  toggleUserCustomisationIcon(true);
  startOnlinePartyExpiryMonitor();

  const partyChat = await window.PartyChatReady;
  partyChat?.displayLogs();
  if (typeof updatePartyQrPlayerCount === 'function') {
    updatePartyQrPlayerCount((latestParty.players || []).length);
  }
  if (typeof preparePartyQrCode === 'function') {
    preparePartyQrCode(partyCode).catch((error) => {
      console.error('Failed to prepare resumed party QR code:', error);
    });
  }

  window.PartyPlayModeController?.completeOnlineSelection?.();
  return true;
}

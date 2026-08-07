const GAMEMODE_SETTINGS_LOBBY_CREATED_SOUND =
  'gamemodeSettingsOnlineLobbyCreated';
const GAMEMODE_SETTINGS_LOBBY_DELETED_SOUND =
  'gamemodeSettingsOnlineLobbyDeleted';

if (typeof window.OEAudio?.register === 'function') {
  window.OEAudio.register({
    [GAMEMODE_SETTINGS_LOBBY_CREATED_SOUND]: {
      src: '/sounds/gamemode-settings/online-lobby-created.wav',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    },
    [GAMEMODE_SETTINGS_LOBBY_DELETED_SOUND]: {
      src: '/sounds/gamemode-settings/online-lobby-deleted.mp3',
      group: 'party-games',
      preload: true,
      cooldown: 500,
      maxInstances: 1,
      priority: 'confirmation',
      conflictPolicy: 'interrupt'
    }
  });
}

function playGamemodeSettingsLobbySound(soundKey) {
  if (typeof playSoundEffect === 'function') {
    playSoundEffect(soundKey);
  }
}

function playGamemodeSettingsLobbyErrorSound() {
  if (typeof playInteractionSound === 'function') {
    playInteractionSound('error');
  }
}

function reportOnlineLobbyCreationProgress(onProgress, value, label) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress({ value, label });
  } catch (error) {
    console.warn('Failed to report online lobby progress:', error);
  }
}

function isActivePartyCreationConflict(error) {
  return [
    'party_owner_active_party_exists',
    'party_participant_active_party_exists'
  ].includes(error?.code);
}

function createPartyReplacementAction(exitPreviousParty) {
  let previousPartyExited = false;

  return async () => {
    try {
      if (!previousPartyExited) {
        await exitPreviousParty();
        previousPartyExited = true;
      }

      const enabled = await ToggleOnlineMode(true);
      if (!enabled) {
        throw new Error('The new party could not be created.');
      }
      if (typeof toggleUserCustomisationIcon === 'function') {
        toggleUserCustomisationIcon(true);
      }
      window.PartyPlayModeController?.completeOnlineSelection?.();
    } catch (error) {
      const replacementError =
        error instanceof Error
          ? error
          : new Error('The new party could not be created.');
      replacementError.previousPartyExited = previousPartyExited;
      throw replacementError;
    }
  };
}

function openActivePartyCreationConflict(error) {
  if (
    !isActivePartyCreationConflict(error) ||
    typeof window.ActivePartyConflictDialog?.openFromError !== 'function'
  ) {
    return false;
  }

  const isParticipant = error.code === 'party_participant_active_party_exists';
  const onLeaveAndCreate =
    isParticipant && typeof window.leaveActivePartyLobby === 'function'
      ? createPartyReplacementAction(() =>
          window.leaveActivePartyLobby(error.details)
        )
      : null;
  const onEndAndCreate =
    !isParticipant && typeof window.endActiveOwnedParty === 'function'
      ? createPartyReplacementAction(() =>
          window.endActiveOwnedParty(error.details)
        )
      : null;

  return window.ActivePartyConflictDialog.openFromError(error, {
    source: 'party-creation',
    onLeaveAndCreate,
    onEndAndCreate
  });
}

async function ToggleOnlineMode(toggle, options = {}) {
  try {
    return await updateGamemodeSettingsOnlineMode(toggle, options);
  } catch (error) {
    playGamemodeSettingsLobbyErrorSound();
    throw error;
  }
}

async function updateGamemodeSettingsOnlineMode(
  toggle,
  { onProgress, onProgressComplete } = {}
) {
  debugLog('[ToggleOnlineMode] toggle=', toggle);
  if (toggle === true) {
    if (partyCode) {
      reportOnlineLobbyCreationProgress(onProgress, 100, 'Lobby ready');
      return true;
    }

    reportOnlineLobbyCreationProgress(onProgress, 10, 'Reserving party code');
    let reservedPartyCode;
    try {
      reservedPartyCode = await reserveUniquePartyCode();
    } catch (error) {
      if (openActivePartyCreationConflict(error)) return false;
      throw error;
    }
    reportOnlineLobbyCreationProgress(onProgress, 30, 'Party code reserved');

    window.onlinePartyTeardownInProgress = false;

    hostedParty = true;
    hostDeviceId = deviceId;
    onlineSettingsTab.classList.remove('disabled');

    const newShuffleSeed = Math.floor(Math.random() * 256);
    debugLog('[ToggleOnlineMode] generated shuffleSeed=', newShuffleSeed);
    window.currentOnlineShuffleSeed = newShuffleSeed;
    partyCode = reservedPartyCode;
    inputPartyCode.value = partyCode;
    setOnlineSettingsPartyCodeInUrl(partyCode);

    document.querySelectorAll('.user-icon').forEach((el) => el.remove());
    onlineUsername = await resolveOnlineUsername();
    const onlineUserIcon = getStoredUserIconString();
    reportOnlineLobbyCreationProgress(onProgress, 42, 'Host profile ready');

    hideContainer(packsContainer);
    packsSettingsTab.classList.remove('active');
    hideContainer(rulesContainer);
    rulesSettingsTab.classList.remove('active');

    onlineSettingsTab.classList.add('active');
    showContainer(onlineSettingsContainer);

    SetGamemodeButtons();
    await UpdateSettings({ syncOnlineParty: false });
    reportOnlineLobbyCreationProgress(onProgress, 55, 'Settings ready');
    updateStartGameButton(false);

    let baseState = {
      isReady: true,
      hasConfirmed: false
    };

    if (partyGameMode === 'mafia') {
      baseState = {
        ...baseState,
        status: 'alive',
        vote: 'N/A',
        phase: {
          scenarioFileName: 'N/A',
          index: 1,
          state: 'pending'
        }
      };
    }

    const players = [
      {
        identity: {
          computerId: deviceId,
          username: onlineUsername,
          userIcon: onlineUserIcon
        },
        connection: {
          socketId: socket.id,
          lastPing: new Date()
        },
        state: baseState
      }
    ];

    const config = {
      gamemode: partyGameMode,
      gameRules: gamemodeSettings,
      selectedPacks: gamemodeSelectedPacks,
      roleCounts:
        typeof gamemodeRoleCounts === 'undefined' ? {} : gamemodeRoleCounts,
      userInstructions: '',
      shuffleSeed: newShuffleSeed
    };
    debugLog(
      '[ToggleOnlineMode] initial config.shuffleSeed=',
      config.shuffleSeed
    );

    const session = {
      createdAt: new Date()
    };

    const state = {
      isPlaying: false,
      lastPinged: new Date(),
      phase: 'lobby',
      timer: null,
      playerTurn: 0,
      completedRounds: 0,
      hostComputerId: hostDeviceId
    };

    const deck = {
      currentCardIndex: 0,
      currentCardSecondIndex: 0,
      questionType: 'truth',
      alternativeQuestionIndex: 0
    };
    currentPartyData = {
      partyId: partyCode,
      session,
      config,
      state,
      deck,
      players
    };
    window.syncOnlinePartyGameSwitcherButtons?.(currentPartyData);
    if (typeof window.syncGamemodeSettingsReadySound === 'function') {
      window.syncGamemodeSettingsReadySound(currentPartyData, {
        initializeOnly: true
      });
    }

    const creationResult = await updateOnlineParty({
      partyId: partyCode,
      session,
      config,
      state,
      deck,
      players
    });
    if (creationResult?.primary?.updated) {
      currentPartyData = creationResult.primary.updated;
    }
    reportOnlineLobbyCreationProgress(onProgress, 70, 'Lobby created');

    await joinParty(partyCode);
    reportOnlineLobbyCreationProgress(onProgress, 82, 'Connected to lobby');
    const partyChat = await window.PartyChatReady;
    if (partyChat && typeof partyChat.sendMessage === 'function') {
      try {
        await partyChat.sendMessage({
          username: '[CONSOLE]',
          message: `PARTY CREATED: ${partyCode}`,
          eventType: 'connect'
        });
      } catch (error) {
        console.error(
          '[OE online-game-settings] partyChat.sendMessage failed',
          error
        );
      }
    } else {
      console.warn(
        '[OE online-game-settings] partyChat.sendMessage unavailable, skipping sendMessage'
      );
    }

    if (typeof UpdateUserIcons === 'function') {
      await UpdateUserIcons(currentPartyData);
    }
    promptOnlineHostForCustomOeIcon();
    if (typeof refreshOnlinePlayerCountRestrictions === 'function') {
      await refreshOnlinePlayerCountRestrictions();
    }
    if (typeof GetAllUsersReady === 'function') {
      allUsersReady = await GetAllUsersReady();
    }
    reportOnlineLobbyCreationProgress(onProgress, 94, 'Preparing lobby');
    if (typeof updateStartGameButton === 'function') {
      updateStartGameButton(allUsersReady);
    }
    try {
      partyChat?.displayLogs();
    } catch (error) {
      console.error(
        '[OE online-game-settings] partyChat.displayLogs failed',
        error
      );
    }
    toggleUserCustomisationIcon(true);
    startOnlinePartyExpiryMonitor();

    if (typeof updatePartyQrPlayerCount === 'function') {
      updatePartyQrPlayerCount(1);
    }
    if (typeof togglePartyQrCode === 'function') {
      togglePartyQrCode(false, partyCode);
    }
    if (typeof preparePartyQrCode === 'function') {
      preparePartyQrCode(partyCode).catch((error) => {
        console.error('Failed to prepare party QR code:', error);
      });
    }

    reportOnlineLobbyCreationProgress(onProgress, 100, 'Lobby ready');
    if (typeof onProgressComplete === 'function') {
      await onProgressComplete();
    }
    playGamemodeSettingsLobbySound(GAMEMODE_SETTINGS_LOBBY_CREATED_SOUND);
    return true;
  } else {
    const deletedPartyCode = partyCode;
    stopOnlinePartyExpiryMonitor();
    try {
      if (deletedPartyCode) {
        await DeleteParty(deletedPartyCode);
        playGamemodeSettingsLobbySound(GAMEMODE_SETTINGS_LOBBY_DELETED_SOUND);
      } else {
        window.onlinePartyTeardownInProgress = true;
      }
    } catch (error) {
      startOnlinePartyExpiryMonitor();
      throw error;
    }

    suppressActiveLobbyLockForDeletedParty(deletedPartyCode);
    window.currentOnlineShuffleSeed = null;
    window.syncOnlinePartyGameSwitcherButtons?.(null);
    removeOnlineSettingsPartyCodeFromUrl();
    inputPartyCode.value = '';
    if (typeof clearPlayerCountRestrictionError === 'function') {
      clearPlayerCountRestrictionError();
    }
    if (typeof togglePartyQrCode === 'function') {
      togglePartyQrCode(false);
    }
    if (typeof updatePartyQrPlayerCount === 'function') {
      updatePartyQrPlayerCount(0);
    }

    onlineSettingsTab.classList.add('disabled');
    onlineSettingsTab.classList.remove('active');
    hideContainer(onlineSettingsContainer);

    hideContainer(packsContainer);
    packsSettingsTab.classList.remove('active');

    showContainer(rulesContainer);
    rulesSettingsTab.classList.add('active');

    const partyChat = await window.PartyChatReady;
    partyChat?.setAvailable?.(false);
    window.clearActivePartyLobbyLock?.();

    // Re-evaluate rule visibility after partyCode is cleared.
    SetGamemodeButtons();
    await UpdateSettings({ syncOnlineParty: false });
    await refreshActivePartyLobbyLock();
    allUsersReady = undefined;
    if (typeof clearPlayerCountRestrictionError === 'function') {
      clearPlayerCountRestrictionError();
    }
    updateStartGameButton();
    toggleUserCustomisationIcon(false);
    window.syncOfflinePartyGameSwitcherButton?.(partyGameMode);
    return true;
  }
}

let partyUserCount = 0;
window.currentOnlineShuffleSeed = window.currentOnlineShuffleSeed ?? null;

async function ToggleOnlineMode(toggle) {
  debugLog("[ToggleOnlineMode] toggle=", toggle);
  if (toggle === true) {
    if(partyCode) return;
    hostedParty = true;
    hostDeviceId = deviceId;
    onlineSettingsTab.classList.remove('disabled');

    const newShuffleSeed = Math.floor(Math.random() * 256);
    debugLog("[ToggleOnlineMode] generated shuffleSeed=", newShuffleSeed);
    window.currentOnlineShuffleSeed = newShuffleSeed;
    partyCode = await reserveUniquePartyCode();
    inputPartyCode.value = partyCode;

    document.querySelectorAll(".user-icon").forEach(el => el.remove());

    showContainer(enterUsernameContainer);
    addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
    toggleOverlay(true);

    hideContainer(packsContainer);
    packsSettingsTab.classList.remove('active');
    hideContainer(rulesContainer);
    rulesSettingsTab.classList.remove('active');

    onlineSettingsTab.classList.add('active');
    showContainer(onlineSettingsContainer);

    SetGamemodeButtons();
    await UpdateSettings();
    updateStartGameButton(false);

    let baseState = {
      isReady: true,
      hasConfirmed: false
    };

    if (partyGameMode === 'mafia') {
      baseState = {
        ...baseState,
        role: 'N/A',
        status: 'alive',
        vote: 'N/A',
        phase: {
          scenarioFileName: 'N/A',
          index: 1,
          state: 'pending'
        }
      };
    }

    const players = [{
      identity: {
        computerId: deviceId,
        username: "",
        userIcon: "0000:0100:0200:0300"
      },
      connection: {
        socketId: socket.id,
        lastPing: new Date()
      },
      state: baseState
    }];

    const config = {
      gamemode: partyGameMode,
      gameRules: gamemodeSettings,
      selectedPacks: gamemodeSelectedPacks,
      userInstructions: "",
      shuffleSeed: newShuffleSeed
    };
    debugLog("[ToggleOnlineMode] initial config.shuffleSeed=", config.shuffleSeed);

    const state = {
      isPlaying: false,
      lastPinged: new Date(),
      phase: 'lobby',
      timer: null,
      playerTurn: 0,
      hostComputerId: hostDeviceId,
    };

    const deck = {
      currentCardIndex: 0,
      currentCardSecondIndex: 0,
      questionType: "truth",
      alternativeQuestionIndex: 0
    };
    await updateOnlineParty({
      partyId: partyCode,
      config,
      state,
      deck,
      players
    });

    await joinParty(partyCode);
    await sendPartyChat({
      username: "[CONSOLE]",
      message: `PARTY CREATED: ${partyCode}`,
      eventType: "connect"
    });
    DisplayChatLogs();
    toggleUserCustomisationIcon(true);

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

  } else {
    window.currentOnlineShuffleSeed = null;
    inputPartyCode.value = "";
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

    await DeletePartyChat();
    DeleteParty();

    // Re-evaluate rule visibility after partyCode is cleared.
    SetGamemodeButtons();
    await UpdateSettings();
    allUsersReady = undefined;
    if (typeof clearPlayerCountRestrictionError === 'function') {
      clearPlayerCountRestrictionError();
    }
    updateStartGameButton();
    toggleUserCustomisationIcon(false);
  }
}

window.addEventListener('beforeunload', function () {
  if (partyCode == null || loadingPage) return;
  DeleteParty();
});

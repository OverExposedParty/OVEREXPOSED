let partyUserCount = 0;

async function ToggleOnlineMode(toggle) {
  if (toggle === true) {
    if(partyCode) return;
    hostedParty = true;
    hostDeviceId = deviceId;
    onlineSettingsTab.classList.remove('disabled');

    const newShuffleSeed = Math.floor(Math.random() * 256);
    partyCode = generatePartyCode();

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

    const players = {
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
    };

    const config = {
      gamemode: partyGameMode,
      gameRules: gamemodeSettings,
      selectedPacks: gamemodeSelectedPacks,
      userInstructions: "",
      shuffleSeed: newShuffleSeed
    };

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
        console.log("players", players);
    await updateOnlineParty({
      partyId: partyCode,
      config,
      state,
      deck,
      players
    });

    document.querySelectorAll(".user-icon").forEach(el => el.remove());


    inputPartyCode.value = "https://overposed.app/" + partyCode;

    enterUsernameContainer.classList.add('active');
    addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
    toggleOverlay(true);

    packsContainer.classList.remove('active');
    packsSettingsTab.classList.remove('active');
    rulesContainer.classList.remove('active');
    rulesSettingsTab.classList.remove('active');

    onlineSettingsTab.classList.add('active');
    onlineSettingsContainer.classList.add('active');

    SetGamemodeButtons();
    UpdateSettings();
    updateStartGameButton(false);

    await joinParty(partyCode);
    await sendPartyChat({
      username: "[CONSOLE]",
      message: `PARTY CREATED: ${partyCode}`,
      eventType: "connect"
    });
    DisplayChatLogs();
    toggleUserCustomisationIcon(true);

  } else {
    inputPartyCode.value = "";

    onlineSettingsTab.classList.add('disabled');
    onlineSettingsTab.classList.remove('active');
    onlineSettingsContainer.classList.remove('active');

    packsContainer.classList.remove('active');
    packsSettingsTab.classList.remove('active');

    rulesContainer.classList.add('active');
    rulesSettingsTab.classList.add('active');

    SetGamemodeButtons();
    updateStartGameButton(true);

    await DeletePartyChat();
    DeleteParty();
    toggleUserCustomisationIcon(false);
  }
}

window.addEventListener('beforeunload', function () {
  if (partyCode == null || loadingPage) return;
  DeleteParty();
});

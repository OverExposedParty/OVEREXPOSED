hostedParty = true;
let partyUserCount = 0;

async function ToggleOnlineMode(toggle) {
  if (toggle == true) {
    onlineSettingTab.classList.remove('disabled');
    const newShuffleSeed = Math.floor(Math.random() * 256);  // Random number between 0 and 255
    partyCode = generatePartyCode();
    const players = [{
      computerId: deviceId,
      username: "",
      userIcon: "0000:0100:0200:0300",
      isReady: true,
      hasConfirmed: false,
      lastPing: new Date(),
      socketId: socket.id
    }];

    await updateOnlineParty({
      partyId: partyCode,
      players,
      gamemode: partyGameMode,
      gameSettings: gamemodeSettings,
      selectedPacks: gamemodeSelectedPacks,
      userInstructions: "",
      isPlaying: false,
      lastPinged: new Date(),
      playerTurn: 0,
      shuffleSeed: newShuffleSeed,
    });
    document.querySelectorAll(".user-icon").forEach(el => el.remove());
    createUserIcon({
      userId: deviceId,
      username: "",
      checked: true
    });
    //inputPartyCode.value = "https://overexposed.app/" + partyCode;
    inputPartyCode.value = "http://overexposed.app/" + partyCode;

    enterUsernameContainer.classList.add('active');
    addElementIfNotExists(permanantElementClassArray, enterUsernameContainer);
    toggleOverlay(true);

    packsContainer.classList.remove('active');
    packsSettingsTab.classList.remove('active');

    settingsContainer.classList.remove('active');
    gameSettingsTab.classList.remove('active')

    onlineSettingTab.classList.add('active');
    onlineSettingsContainer.classList.add('active');
    SetGamemodeButtons();
    updateStartGameButton(false);
    await joinParty(partyCode);
    await sendPartyChat({
      username: "[CONSOLE]",
      message: `PARTY CREATED: ${partyCode}`,
      eventType: "connect"
    });
    DisplayChatLogs();
    toggleUserCustomisationIcon(true);
  }
  else {
    inputPartyCode.value = "";

    onlineSettingTab.classList.add('disabled');
    onlineSettingTab.classList.remove('active');
    onlineSettingsContainer.classList.remove('active');

    packsContainer.classList.remove('active');
    packsSettingsTab.classList.remove('active');

    settingsContainer.classList.add('active');
    gameSettingsTab.classList.add('active')

    SetGamemodeButtons();
    updateStartGameButton(true);
    await DeletePartyChat()
    DeleteParty();
    toggleUserCustomisationIcon(false);
  }
}

window.addEventListener('beforeunload', function () {
  if (partyCode == null || loadingPage) return;
  DeleteParty();
});
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const resultsChartContainer = document.getElementById('results-container');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChooseOption = gameContainerPrivate.querySelector('#button-choose-option');

gameContainers.push(
  gameContainerPrivate,
  resultsChartContainer
);
async function SetPageSettings() {
  buttonChooseOption.addEventListener('click', async () => {
    await setUserBool(deviceId, null, true);
  });

  selectOptionConfirmButtonYes.addEventListener('click', async () => {
    await SetVote({
      option: true
    });
  });
  selectOptionConfirmButtonNo.addEventListener('click', async () => {
    await SetVote({
      option: false
    });
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    let parsedInstructions = parseInstruction(currentPartyData.userInstructions);
    if (parsedInstructions.instruction.includes("DISPLAY_PUNISHMENT_TO_USER")) {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      await ResetQuestion({
        icons: icons,
        timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
      });
    }
    else {
      setUserBool(deviceId, true, true);
    }
  });

  AddTimerToContainer(gameContainerPrivate.querySelector('.main-image-container'));
  AddTimerToContainer(selectOptionContainer);
  AddTimerToContainer(waitingForPlayersContainer);
  AddTimerToContainer(resultsChartContainer);

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);
  console.log("Loaded JSON files");
  await initialisePage();
}

function updateTextContainer(text, cardType) {

  const textContainerPrivate = document.querySelector('#private-view .text-container');

  textContainerPrivate.textContent = text;
  selectOptionQuestionText.textContent = text.replace("Never have I ever ", "");

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#private-view .card-type-text').textContent = cardType;
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  currentPartyData = data[0];
  if (data.length > 0) {
    isPlaying = true;
    const index = data[0].players.findIndex(player => player.computerId === deviceId);
    onlineUsername = data[0].players[index].username;
    hostDeviceId = data[0].players[0].computerId;
    console.log("hostDeviceId: " + hostDeviceId);
    if (data[0].players[index].socketId == "DISCONNECTED") {
      sendPartyChat({
        username: "[CONSOLE]",
        message: `${onlineUsername} has reconnected.`,
        eventType: "connect"
      });
    }
    data[0].players[index].socketId = socket.id
    joinParty(partyCode);
    if (data[0].isPlaying === true) {
      partyRulesSettings = parseGameRules(data[0].gameRules)
      for (let i = 0; i < partyRulesSettings.length; i++) {
        let settingsButton;
        if (!(partyRulesSettings[i] == "take-a-sip")) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
        }
      }
      await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);
      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        await SendInstruction({
          instruction: "DISPLAY_PRIVATE_CARD",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true,
          timer: Date.now() + getIncrementContainerValue("time-limit") * 1000,
        });
      }
      else {
        updateOnlineParty({
          partyId: partyCode,
          players: data[0].players,
          lastPinged: Date.now(),
        });
        FetchInstructions();
      }
      SetPartyGameStatistics();
      await AddUserIcons();
      SetScriptLoaded('/scripts/party-games/online/online-settings.js');
    }
  }
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }
  await UpdatePartyGameStatistics();
  if (currentPartyData.userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (currentPartyData.userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (currentPartyData.userInstructions.includes("RESET_QUESTION")) {
    const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
    await ResetQuestion({
      icons: icons,
      timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
    });
  }
}

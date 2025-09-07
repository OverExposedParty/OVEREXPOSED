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
    const currentPartyData = await GetCurrentPartyData();
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    selectOptionQuestionText.textContent = selectedQuestionObj.question.replace("Never have I ever ", "");
    setActiveContainers(selectOptionContainer);
    setUserBool(deviceId, null, true)
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
    const currentPartyData = await GetCurrentPartyData();
    let parsedInstructions = parseInstruction(currentPartyData.userInstructions);
    if (parsedInstructions.instruction === "DISPLAY_PUNISHMENT_TO_USER") {
      const icons = waitingForPlayersIconContainer.querySelectorAll('.icon');
      await ResetQuestion({
        currentPartyData: currentPartyData,
        icons: icons
      });
    }
    else {
      setUserBool(deviceId, true, true);
    }
  });


  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

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
  const currentPartyData = data[0];
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
      const partyRulesSettings = parseGameRules(data[0].gameRules)
      for (let i = 0; i < partyRulesSettings.length; i++) {
        let settingsButton;
        if (!(partyRulesSettings[i] == "take-a-sip")) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
        }
      }
      await LoadScript(`/scripts/party-games/gamemode/online/general/party-games-online-instructions.js?30082025`);
      await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);
      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        await SendInstruction({
          instruction: "DISPLAY_PRIVATE_CARD",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true
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
      await AddUserIcons();
    }
  }
}

async function FetchInstructions() {
  const res = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    PartyDisbanded();
    return;
  }

  if (data[0].userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_VOTE_RESULTS")) {
    DisplayVoteResults();
  }
  else if (data[0].userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(data[0].userInstructions);
  }
}

async function AddUserIcons() {
  const currentPartyData = await GetCurrentPartyData();
  console.log(currentPartyData);
  if (currentPartyData) {
    for (let i = 0; i < currentPartyData.players.length; i++) {
      createUserIconPartyGames({
        container: waitingForPlayersIconContainer,
        userId: currentPartyData.players[i].computerId,
        userCustomisationString: currentPartyData.players[i].userIcon
      });
    }
  }
}

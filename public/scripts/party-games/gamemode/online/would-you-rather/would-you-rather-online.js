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
    currentPartyData = await GetCurrentPartyData();
    selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
    const splitQuestion = SplitQuestion(selectedQuestionObj.question.replace("Would you rather ", ""))
    selectOptionQuestionTextA.textContent = "A: " + splitQuestion.a;
    selectOptionQuestionTextB.textContent = "B: " + splitQuestion.b;
    setActiveContainers(selectOptionContainer);
    setUserBool(deviceId, null, true)
  });

  selectOptionConfirmButtonA.addEventListener('click', async () => {
    await SetVote({
      option: "A"
    });
  });
  selectOptionConfirmButtonB.addEventListener('click', async () => {
    await SetVote({
      option: "B"
    });
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    let parsedInstructions = parseInstruction(currentPartyData.userInstructions);
    if (parsedInstructions.instruction === "DISPLAY_PUNISHMENT_TO_USER") {
      const aVoteCount = currentPartyData.players.filter(player => player.vote === "A").length;
      const bVoteCount = currentPartyData.players.filter(player => player.vote === "B").length;
      const winningVote = aVoteCount === bVoteCount ? null : aVoteCount > bVoteCount ? "A" : "B";
      await SendInstruction({
        instruction: "RESET_QUESTION:" + winningVote
      })
    }
    else {
      await setUserBool(deviceId, true, true);
    }
  });

  AddTimerToContainer(selectOptionContainer);
  AddTimerToContainer(cardContainerPrivate.querySelector('.main-image-container'));
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
        if (partyRulesSettings[i].includes("drink-punishment")) {
          settingsButton = createUserButton("take-a-shot", "Take A Shot");
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
        else if (!/\d/.test(partyRulesSettings[i])) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
          settingsButton = createUserButton(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }), formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode }));
          selectPunishmentButtonContainer.appendChild(settingsButton);
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
    if (hostDeviceId != deviceId) return;
    const parsedInstructions = parseInstruction(currentPartyData.userInstructions)
    if (parsedInstructions.reason == "A" || parsedInstructions.reason == "B") {
      for (let i = 0; i < currentPartyData.players.length; i++) {
        if (currentPartyData.players[i].vote == parsedInstructions.reason && !currentPartyData.players[i].sockedtId !== "DISCONNECTED") {
          currentPartyData.players[i].score++;
        }
      }
    }
    await ResetQuestion({ nextPlayer: true, timer: Date.now() + getIncrementContainerValue("time-limit") * 1000 });
  }
}
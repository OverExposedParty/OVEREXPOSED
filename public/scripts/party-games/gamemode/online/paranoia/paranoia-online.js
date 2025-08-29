let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const gameContainerDualStack = document.querySelector('#dual-stack-view.card-container');
const buttonNextQuestion = document.getElementById('button-next-question');

const gameContainerPrivate = document.querySelector('#private-view.card-container');
const buttonChoosePlayer = document.getElementById('button-choose-player');

gameContainers.push(
  gameContainerPrivate,
  gameContainerDualStack,
);

async function SetPageSettings() {
  buttonChoosePlayer.addEventListener('click', async () => {
    await SendInstruction({
      instruction: "DISPLAY_PRIVATE_CARD:CHOOSE_PLAYER",
    });
  });

  buttonNextQuestion.addEventListener('click', async () => {
    gameContainerDualStack.classList.remove('active');
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true,
      reason: "QUESTION",
    });
  });

  selectUserConfirmPlayerButton.addEventListener('click', async () => {
    if (selectUserButtonContainer.getAttribute('selected-id') != "") {
      await SetVote({
        option: selectUserButtonContainer.getAttribute('selected-id'),
        sendInstruction: "CHOOSING_PUNISHMENT"
      });
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      selectUserButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectUserButtonContainer.getAttribute('selected-id') != ""
    }
  });
  confirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      selectPunishmentContainer.classList.remove('active');
      if (selectPunishmentContainer.getAttribute('select-id') == 'lucky-coin-flip') {
        console.log("paranoia-coin-flip");
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:COIN_FLIP"
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'drink-wheel') {
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:DRINK_WHEEL"
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
        completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT"
        });
      }
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonPass.addEventListener('click', async () => {
    completePunishmentContainer.classList.remove('active');
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: false,
      reason: "PASS",
      userInstruction: "PUNISHMENT_OFFER"
    });
  });
  completePunishmentButtonConfirm.addEventListener('click', async () => {
    const currentPartyData = await GetCurrentPartyData();
    const parsedInstructions = parseInstruction(currentPartyData.userInstructions);
    completePunishmentContainer.classList.remove('active');
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true,
      reason: "CONFIRM:" + parsedInstructions.reason,
      userInstruction: "PUNISHMENT_OFFER"
    });
  });

  document.querySelector('#heads-or-tails-pick-container .select-button-container #heads').addEventListener('click', () => {
    pickHeadsOrTailsContainer.classList.remove('active');
    luckyCoinFlipContainer.classList.add('active');
    pickedHeads = true;
  });

  document.querySelector('#heads-or-tails-pick-container .select-button-container #tails').addEventListener('click', () => {
    pickHeadsOrTailsContainer.classList.remove('active');
    luckyCoinFlipContainer.classList.add('active');
    pickedHeads = false;
  });

  confirmPunishmentButtonYes.addEventListener('click', async () => {
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: true
    });
  });

  confirmPunishmentButtonNo.addEventListener('click', async () => {
    await SetUserConfirmation({
      selectedDeviceId: deviceId,
      option: false
    });

  });

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);

  selectedQuestionObj = getNextQuestion(currentPartyData.currentCardIndex);
  await initialisePage();
}

function updateTextContainer(text, cardType, punishment) {

  const textContainerPrivate = document.querySelector('#private-view .text-container');
  const textContainerDualStack = document.querySelector('#dual-stack-view .text-container');

  textContainerPrivate.textContent = text;
  textContainerDualStack.textContent = text;
  selectUserQuestionText.textContent = text;

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#dual-stack-view .main-image').src = imageUrl;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#dual-stack-view .card-type-text').style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#dual-stack-view .card-type-text').textContent = cardType;
  document.querySelector('#private-view .card-type-text').textContent = cardType;
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    isPlaying = true;
    const index = data[0].players.findIndex(player => player.computerId === deviceId);
    onlineUsername = data[0].players[index].username;
    hostDeviceId = data[0].players[0].computerId;
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
      for (let i = 0; i < data[0].players.length; i++) {
        if (data[0].players[i].computerId != deviceId) {
          const userButton = createUserButton(data[0].players[i].computerId, data[0].players[i].username);
          selectUserButtonContainer.appendChild(userButton);
        }
      }
      const partyGamemodeSettings = parseGameSettings(data[0].gameSettings)
      for (let i = 0; i < partyGamemodeSettings.length; i++) {
        let settingsButton;
        if (partyGamemodeSettings[i] == "take-a-shot") {
          settingsButton = createUserButton(partyGamemodeSettings[i], partyGamemodeSettings[i].replace(/-/g, " "));
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
        else {
          AddGamemodeContainers(formatDashedString({ input: partyGamemodeSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
          settingsButton = createUserButton(formatDashedString({ input: partyGamemodeSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }), formatDashedString({ input: partyGamemodeSettings[i], gamemode: data[0].gamemode }));
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
      }
      const selectUserButtons = document.getElementById('select-user-container').querySelectorAll('.selected-user-container .button-container button');
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');

      selectUserButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectUserButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          selectUserButtonContainer.setAttribute('selected-id', button.getAttribute('id'));
        });
      });
      if (selectUserButtonContainer.length > 4) {
        selectUserButtonContainer.classList.add('overflow');
      }

      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
      if (deviceId == hostDeviceId && data[0].userInstructions == "") {
        await SendInstruction({
          instruction: "DISPLAY_PRIVATE_CARD:READING_CARD",
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
  if (data[0].userInstructions.includes("DISPLAY_DUAL_STACK_CARD")) {
    DisplayDualStackCard();
  }
  else if (data[0].userInstructions == "NEXT_USER_TURN") {
    NextUserTurn();
  }
  else if (data[0].userInstructions == "NEXT_QUESTION") {
    NextQuestion();
  }
  else if (data[0].userInstructions.includes("USER_HAS_PASSED")) {
    UserHasPassed(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("USER_SELECTED_FOR_PUNISHMENT")) {
    UserSelectedForPunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_PRIVATE_CARD")) {
    DisplayPrivateCard(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment();
  }
  else if (data[0].userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("PUNISHMENT_OFFER")) {
    PunishmentOffer(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("HAS_USER_DONE_PUNISHMENT")) {
    HasUserDonePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("ANSWER_TO_USER_DONE_PUNISHMENT")) {
    AnswerToUserDonePunishment(data[0].userInstructions);
  }
}

async function AddUserIcons() {
  const currentPartyData = await GetCurrentPartyData();
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
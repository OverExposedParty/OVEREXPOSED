let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPublicButtonContainer = gameContainerPublic.querySelector('.regular-button-container');
const gameContainerPublicWaitingText = gameContainerPublicButtonContainer.querySelector('h2');
const gameContainerPublicButtonAnswer = gameContainerPublicButtonContainer.querySelector('#answer');
const gameContainerPublicButtonPass = gameContainerPublicButtonContainer.querySelector("#pass");
const gameContainerAnswer = document.querySelector('#answer-view.card-container');
const gameContainerAnswerButtonContainer = gameContainerAnswer.querySelector('.regular-button-container');
const gameContainerAnswerButtonNextQuestion = gameContainerAnswerButtonContainer.querySelector("#next-question");

gameContainers.push(
  gameContainerPublic,
  gameContainerAnswer
);

let textBoxSetting = false;

async function SetPageSettings() {
  selectPunishmentConfirmPunishmentButton.addEventListener('click', async () => {
    if (selectPunishmentContainer.getAttribute('select-id')) {
      selectPunishmentContainer.classList.remove('active');
      if (selectPunishmentContainer.getAttribute('select-id') == 'truth-or-dare-drink-wheel') {
        await SendInstruction({
          instruction: `CHOSE_PUNISHMENT:${formatDashedString({ input: selectPunishmentContainer.getAttribute('select-id'), gamemode: placeHolderSelectedUser.dataset.template, seperator: '_' }).toUpperCase()}:` + deviceId
        });
      }
      else if (selectPunishmentContainer.getAttribute('select-id') == 'take-a-shot') {
        completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
        await SendInstruction({
          instruction: "CHOSE_PUNISHMENT:TAKE_A_SHOT:" + deviceId
        });
      }
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.classList.remove('active');
      });
      selectPunishmentContainer.setAttribute('select-id', "");
    }
  });

  completePunishmentButtonConfirm.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: true, nextPlayer: true });
  });

  selectQuestionTypeButtonTruth.addEventListener('click', async () => {
    currentPartyData.currentCardIndex++;
    currentPartyData.questionType = "truth";
    await SendInstruction({
      partyData: currentPartyData,
      instruction: "DISPLAY_PUBLIC_CARD",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
    });
  });

  selectQuestionTypeButtonDare.addEventListener('click', async () => {
    currentPartyData.currentCardSecondIndex++;
    currentPartyData.questionType = "dare";
    await SendInstruction({
      partyData: currentPartyData,
      instruction: "DISPLAY_PUBLIC_CARD",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + getIncrementContainerValue("time-limit") * 1000
    });
  });

  gameContainerPublicButtonPass.addEventListener('click', async () => {
    if (selectPunishmentButtonContainer.childElementCount == 0) {
      await SendInstruction({
        instruction: "RESET_QUESTION"
      });
      return;
    }
    else {
      await SendInstruction({
        instruction: "CHOOSING_PUNISHMENT"
      });
    }
  });

  gameContainerPublicButtonAnswer.addEventListener('click', async () => {
    if (textBoxSetting == false) {
      await SendInstruction({
        instruction: "DISPLAY_COMPLETE_QUESTION"
      });
    }
    else {
      await SendInstruction({
        instruction: "DISPLAY_CONFIRM_INPUT"
      });
    }
  });

  answerQuestionSubmitButton.addEventListener('click', async () => {
    await SendInstruction({
      instruction: "DISPLAY_ANSWER_CARD:" + answerQuestionAnswer.value
    });
  });

  gameContainerAnswerButtonNextQuestion.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: false, nextPlayer: true });
  });

  completePromptCompleted.addEventListener('click', async () => {
    await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: 1 });
  })

  AddTimerToContainer(waitingForPlayerContainer);
  AddTimerToContainer(selectUserContainer);
  AddTimerToContainer(selectQuestionTypeContainer);
  AddTimerToContainer(cardContainerPublic.querySelector('.main-image-container'));
  AddTimerToContainer(selectPunishmentContainer);

  console.log(cardContainerPublic);
  console.log(cardContainerPublic.querySelector('.main-image-container'));

  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);
  console.log("initialisePage");
  await initialisePage();
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
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
        if (partyRulesSettings[i].includes("take-a-shot")) {
          settingsButton = createUserButton("take-a-shot", "Take A Shot");
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
        else if (partyRulesSettings[i] == "truth-or-dare-text-box") {
          textBoxSetting = true;
        }
        else if (!/\d/.test(partyRulesSettings[i])) {
          AddGamemodeContainers(formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode, seperator: '-', uppercase: false }));
          settingsButton = createUserButton(partyRulesSettings[i], formatDashedString({ input: partyRulesSettings[i], gamemode: data[0].gamemode }));
          selectPunishmentButtonContainer.appendChild(settingsButton);
        }
      }
      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
    }
  }
  await LoadScript(`/scripts/party-games/gamemode/online/${cardContainerGamemode}/${cardContainerGamemode}-online-instructions.js?30082025`);
  if (deviceId == hostDeviceId && data[0].userInstructions == "") {
    await SendInstruction({
      instruction: "DISPLAY_SELECT_QUESTION_TYPE",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      timer: Date.now() + getIncrementContainerValue("time-limit") * 1000,
    });
  }
  else {
    updateOnlineParty({
      partyId: partyCode,
      players: data[0].players,
      lastPinged: Date.now(),
    });
  }
  SetPartyGameStatistics();
  await AddUserIcons();
  EditUserIconPartyGames({
    container: podiumThirdPlace,
    userId: data[0].players[0].computerId,
    userCustomisationString: data[0].players[0].userIcon
  });
  console.log("podiumThirdPlace:", podiumThirdPlace);
  SetScriptLoaded('/scripts/party-games/online/online-settings.js');
}

async function FetchInstructions() {
  currentPartyData = await GetCurrentPartyData();
  if (currentPartyData == undefined || currentPartyData.length === 0) {
    PartyDisbanded();
    return;
  }
  await UpdatePartyGameStatistics();
  if (currentPartyData.userInstructions.includes("DISPLAY_SELECT_QUESTION_TYPE")) {
    DisplaySelectQuestionType();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_COMPLETE_QUESTION")) {
    DisplayCompleteQuestion();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_ANSWER_CARD")) {
    DisplayAnswerCard(data[0].userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_CONFIRM_INPUT")) {
    DisplayConfirmInput(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(currentPartyData.playerTurn);
  }
  else if (currentPartyData.userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment();
  }
  else if (currentPartyData.userInstructions.includes("DISPLAY_PUNISHMENT_TO_USER")) {
    DisplayPunishmentToUser(currentPartyData.userInstructions);
  }
  else if (currentPartyData.userInstructions.includes("GAME_OVER")) {
    SetPartyGameStatisticsGameOver();
  }
  else if (currentPartyData.userInstructions.includes("RESET_QUESTION")) {
    if (currentPartyData.userInstructions.includes("TIMER_EXPIRED:2")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: -2 });
    }
    else if (currentPartyData.userInstructions.includes("TIMER_EXPIRED")) {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true, incrementScore: -1 });
    }
    else {
      await ResetTruthOrDareQuestion({ force: true, nextPlayer: true });
    }
  }
  console.log(`FETCHING ${currentPartyData.userInstructions}`);
}

function GetQuestion({ cardTitle, currentPartyData }) {
  if (currentPartyData.questionType == "truth") {
    cardTitle.src = "/images/party-games/truth-or-dare/truth-text.svg";
    return getNextQuestion(currentPartyData.currentCardIndex, currentPartyData.questionType, currentPartyData.shuffleSeed);
  } else if (currentPartyData.questionType == "dare") {
    cardTitle.src = "/images/party-games/truth-or-dare/dare-text.svg";
    return getNextQuestion(currentPartyData.currentCardSecondIndex, currentPartyData.questionType, currentPartyData.shuffleSeed);
  } else {
    console.warn("Unknown questionType:", currentPartyData.questionType);
    return;
  }
}
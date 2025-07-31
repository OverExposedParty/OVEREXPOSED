let isHeads = false;
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const waitingForPlayersContainer = document.getElementById('waiting-for-confirm-punishment-container')
const waitingForPlayersIconContainer = waitingForPlayersContainer.querySelector('.content-container .user-confirmed-section');

const selectUserContainer = document.getElementById('select-user-container');
const selectUserContainerQuestionText = selectUserContainer.querySelector('.content-container h2');

const confirmPlayerButton = selectUserContainer.querySelector('.select-button-container button');

const waitingForPlayerContainer = document.getElementById('waiting-for-player');
const waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
const waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

const playerHasPassedContainer = document.getElementById('player-has-passed');
const playerHasPassedTitle = playerHasPassedContainer.querySelector('.content-container h2');
const playerHasPassedText = playerHasPassedContainer.querySelector('.content-container p');

const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPrivate = document.querySelector('#private-view.card-container');

const selectUserButtonContainer = document.getElementById('select-user-container').querySelector('.selected-user-container .button-container');

const confirmPunishmentContainer = document.getElementById('confirm-punishment-container');
const confirmPunishmentText = confirmPunishmentContainer.querySelector('.content-container h2');
const confirmPunishmentButtonYes = confirmPunishmentContainer.querySelector('#yes');
const confirmPunishmentButtonNo = confirmPunishmentContainer.querySelector('#no');

const pickHeadsOrTailsContainer = document.getElementById('heads-or-tails-pick-container');

const selectPunishmentContainer = document.getElementById('select-punishment-container')
const selectPunishmentButtonContainer = selectPunishmentContainer.querySelector('.selected-user-container .button-container');

const drinkingWheelContainer = document.querySelector('#spin-the-wheel-container');
const coinTossContainer = document.querySelector('#coin-flip-container');

const buttonChoosePlayer = document.getElementById('button-choose-player');
const buttonNextQuestion = document.getElementById('button-next-question');
const confirmPunishmentButton = document.getElementById('select-punishment-container').querySelector('.select-button-container button');

const completePunishmentContainer = document.getElementById('complete-punishment-container');
const completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #confirm');
const completePunishmentButtonPass = completePunishmentContainer.querySelector('.select-button-container #pass');

gameContainers.push(
  waitingForPlayersContainer,
  selectUserContainer,
  waitingForPlayerContainer,
  playerHasPassedContainer,
  gameContainerPrivate,
  gameContainerPublic,
  selectUserButtonContainer,
  confirmPunishmentContainer,
  pickHeadsOrTailsContainer,
  selectPunishmentContainer,
  completePunishmentContainer,
  drinkingWheelContainer,
  coinTossContainer,
);

function setActiveContainers(...activeContainers) {
  if (activeContainers == null || activeContainers.length === 0) {
    gameContainers.forEach(container => container.classList.remove('active'));
    return;
  }

  const uniqueActiveContainers = new Set(activeContainers);
  gameContainers.forEach(container => {
    if (uniqueActiveContainers.has(container)) {
      container.classList.add('active');
    } else {
      container.classList.remove('active');
    }
  });
}


const punishmentText = document
  .querySelector('#complete-punishment-container .content-container #punishment-text');

buttonChoosePlayer.addEventListener('click', async () => {
  await SendInstruction({
    instruction: "WAITING_FOR_PLAYER:CHOOSE_PLAYER",
  });
});

buttonNextQuestion.addEventListener('click', async () => {
  gameContainerPublic.classList.remove('active');
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: true,
    reason: "QUESTION",
  });
});

confirmPlayerButton.addEventListener('click', async () => {
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
    if (selectPunishmentContainer.getAttribute('select-id') == 'paranoia-coin-flip') {
      await SendInstruction({
        instruction: "CHOSE_PUNISHMENT:PARANOIA_COIN_FLIP"
      });
    }
    else if (selectPunishmentContainer.getAttribute('select-id') == 'paranoia-drink-wheel') {
      await SendInstruction({
        instruction: "CHOSE_PUNISHMENT:PARANOIA_DRINK_WHEEL"
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
  completePunishmentContainer.classList.remove('active');
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: true,
    reason: "CONFIRM:" + completePunishmentContainer.getAttribute("punishment-type").toUpperCase().replace(/-/g, '_'),
    userInstruction: "PUNISHMENT_OFFER"
  });
});

document.querySelector('#heads-or-tails-pick-container .select-button-container #heads').addEventListener('click', () => {
  pickHeadsOrTailsContainer.classList.remove('active');
  coinFlipContainer.classList.add('active');
  isHeads = true;
});

document.querySelector('#heads-or-tails-pick-container .select-button-container #tails').addEventListener('click', () => {
  pickHeadsOrTailsContainer.classList.remove('active');
  coinFlipContainer.classList.add('active');
  isHeads = false;
});

confirmPunishmentButtonYes.addEventListener('click', async () => {
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: true,
    reason: "PUNISHMENT:",
    userInstruction: "ANSWER_TO_USER_DONE_PUNISHMENT"
  });
});

confirmPunishmentButtonNo.addEventListener('click', async () => {
  await SetUserConfirmation({
    selectedDeviceId: deviceId,
    option: false,
    reason: "PUNISHMENT:",
    userInstruction: "ANSWER_TO_USER_DONE_PUNISHMENT"
  });

});

document.addEventListener('DOMContentLoaded', async () => {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);

  const selectedQuestionObj = getNextQuestion();
  updateTextContainer(selectedQuestionObj.question, selectedQuestionObj.cardType);
  initialisePage();
});

function updateTextContainer(text, cardType, punishment) {

  const textContainerPrivate = document.querySelector('#private-view .text-container');
  const textContainerPublic = document.querySelector('#public-view .text-container');

  textContainerPrivate.textContent = text;
  textContainerPublic.textContent = text;
  selectUserContainerQuestionText.textContent = text;

  const searchPackName = cardType.toLowerCase();

  // Find the matching pack based on the cardType
  const matchedPack = cardPackMap.find(pack => {
    const packNameLower = pack.packName.toLowerCase();
    return packNameLower === searchPackName;
  });

  if (matchedPack) {
    const imageUrl = matchedPack.packCard ? matchedPack.packCard : `/images/blank-cards/${gamemode}-blank-card.svg`;
    document.querySelector('#public-view .main-image').src = imageUrl;
    document.querySelector('#private-view .main-image').src = imageUrl;
    textContainerPrivate.style.color = matchedPack.packColour;
    document.querySelector('#public-view .card-type-text').style.color = matchedPack.packColour;
    document.querySelector('#private-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#public-view .card-type-text').textContent = cardType;
  document.querySelector('#private-view .card-type-text').textContent = cardType;
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    joinParty(partyCode);
    hostDeviceId = data[0].players[0].computerId;
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
        }
        else {
          settingsButton = createUserButton(partyGamemodeSettings[i], formatDashedString(partyGamemodeSettings[i], data[0].gamemode));
        }
        selectPunishmentButtonContainer.appendChild(settingsButton);
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
      for (let i = 0; i < data[0].players.length; i++) {
        waitingForPlayersIconContainer.appendChild(createUserIcon(data[0].players[0].computerId));
      }
      if (deviceId == hostDeviceId) {
        await SendInstruction({
          instruction: "WAITING_FOR_PLAYER:READING_CARD",
          updateUsersReady: false,
          updateUsersConfirmation: false,
          fetchInstruction: true
        });
      }
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
  if (data[0].userInstructions == "") {
    setPageforUser();
  }
  else if (data[0].userInstructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard();
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
  else if (data[0].userInstructions.includes("WAITING_FOR_PLAYER")) {
    WaitingForPlayer(data[0].userInstructions);
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
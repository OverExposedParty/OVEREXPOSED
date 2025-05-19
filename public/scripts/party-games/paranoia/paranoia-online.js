let isHeads = false;
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const waitingForConfirmPunishmentContainer = document.getElementById('waiting-for-confirm-punishment-container')
const waitingForConfirmPunishmentIconContainer = waitingForConfirmPunishmentContainer.querySelector('.content-container .user-confirmed-section');

const nextQuestionContainer = document.getElementById('next-question-container')
const nextQuestionSectionContainer = nextQuestionContainer.querySelector('.content-container .user-confirmed-section');

const selectUserContainer = document.getElementById('select-user-container');
const selectUserContainerQuestionText = selectUserContainer.querySelector('.content-container h2');;

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


const drinkWheelContainer = document.querySelector('.spin-the-wheel-container');

const buttonChoosePlayer = document.getElementById('button-choose-player');
const buttonNextQuestion = document.getElementById('button-next-question');
const confirmPunishmentButton = document.getElementById('select-punishment-container').querySelector('.select-button-container button');

const completePunishmentContainer = document.getElementById('complete-punishment-container');
const completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #confirm');
const completePunishmentButtonPass = completePunishmentContainer.querySelector('.select-button-container #pass');

const gameContainers = [
  waitingForConfirmPunishmentContainer,
  nextQuestionContainer,
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
  drinkWheelContainer,
  coinFlipContainer,
];

function setActiveContainers(...activeContainers) {
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
  SendInstruction("WAITING_FOR_PLAYER:CHOOSE_PLAYER", true);
  // When player presses choose player in private card section 
});

buttonNextQuestion.addEventListener('click', () => {
  gameContainerPublic.classList.remove('active');
  SetUserConfirmation(deviceId, true, "QUESTION", true);
});

confirmPlayerButton.addEventListener('click', () => {
  if (selectUserButtonContainer.getAttribute('selected-id') != "") {
    SendInstruction("CHOOSING_PUNISHMENT:" + selectUserButtonContainer.getAttribute('selected-id'), true);
  }
});

confirmPunishmentButton.addEventListener('click', () => {
  if (selectPunishmentContainer.getAttribute('select-id')) {
    selectPunishmentContainer.classList.remove('active');
    if (selectPunishmentContainer.getAttribute('select-id') == 'paranoia-coin-flip') {
      SendInstruction("CHOSE_PUNISHMENT:PARANOIA_COIN_FLIP:" + deviceId, true);
    }
    else if (selectPunishmentContainer.getAttribute('select-id') == 'paranoia-drink-wheel') {
      SendInstruction("CHOSE_PUNISHMENT:PARANOIA_DRINK_WHEEL:" + deviceId, true);
    }
    else if (selectPunishmentContainer.getAttribute('select-id') == 'paranoia-take-a-shot') {
      completePunishmentContainer.setAttribute("punishment-type", "take-a-shot")
      SendInstruction("CHOSE_PUNISHMENT:PARANOIA_TAKE_A_SHOT:" + deviceId, true);
    }
  }
});

completePunishmentButtonPass.addEventListener('click', () => {
  completePunishmentContainer.classList.remove('active');
  SendInstruction("PUNISHMENT_OFFER:PASS:" + ":" + deviceId);
});
completePunishmentButtonConfirm.addEventListener('click', () => {
  completePunishmentContainer.classList.remove('active');
  SendInstruction("PUNISHMENT_OFFER:CONFIRM:" + completePunishmentContainer.getAttribute("punishment-type").toUpperCase().replace(/-/g, '_') + ":" + deviceId);
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

confirmPunishmentButtonYes.addEventListener('click', () => {
  SetUserConfirmation(deviceId, true, "PUNISHMENT", true);
});

confirmPunishmentButtonNo.addEventListener('click', () => {
  SetUserConfirmation(deviceId, false, "PUNISHMENT", true);
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
  const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    hostDeviceId = data[0].computerIds[0];
    if (data[0].isPlaying === true) {
      if (deviceId == hostDeviceId) {
        const index = data[0].computerIds.indexOf(deviceId);
        SendInstruction("WAITING_FOR_PLAYER:READING_CARD:" + data[0].usernames[index]);
      }
      for (let i = 0; i < data[0].computerIds.length; i++) {
        if (data[0].computerIds[i] != deviceId) {
          const userButton = createUserButton(data[0].computerIds[i], data[0].usernames[i]);
          selectUserButtonContainer.appendChild(userButton);
        }
      }
      const partyGamemodeSettings = parseGameSettings(data[0].gameSettings)
      for (let i = 0; i < partyGamemodeSettings.length; i++) {
        const settingsButton = createUserButton(partyGamemodeSettings[i], formatDashedString(partyGamemodeSettings[i]));
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
      console.log(data[0].computerIds.length);
      for (let i = 0; i < data[0].computerIds.length; i++) {
        waitingForConfirmPunishmentIconContainer.appendChild(createUserIcon(data[0].computerIds[i]));
        nextQuestionSectionContainer.appendChild(createUserIcon(data[0].computerIds[i]));
      }
      let removeUsersReady = data[0].usersReady;

      for (let key in removeUsersReady) {
        if (typeof removeUsersReady[key] === 'boolean') {
          removeUsersReady[key] = false;
        }
      }
      FetchInstructions();
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: removeUsersReady,
        lastPinged: Date.now(),
      });
    }
  }
}

function parseGameSettings(settingsString) {
  if (!settingsString) return [];
  return settingsString.split(',').filter(Boolean);
}

function formatDashedString(input) {
  const words = input.split('-').slice(1); // Remove the first word
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function createUserButton(id, text) {
  const button = document.createElement("button");
  button.id = id;
  button.textContent = text;
  return button;
}

function createUserIcon(id) {
  const icon = document.createElement('div');
  icon.id = id;
  icon.classList.add('icon');
  icon.textContent = 'O';
  return icon;
}

window.addEventListener('beforeunload', function () {
  if (loadingPage || hostDeviceId != deviceId) return;
  deleteParty();
});

async function FetchInstructions() {
  console.log("bnowwww");
  const res = await fetch(`/api/party-games?partyCode=${partyCode}`);
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
    ChoosingPunishment(data[0].userInstructions);
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
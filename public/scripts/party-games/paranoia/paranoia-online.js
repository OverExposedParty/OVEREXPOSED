let isHeads = false;
let currentPlayerTurn = 0;

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const confirmPunishmentUserIconContainer = document.getElementById('confirm-punishment-container').querySelector('.content-container .user-confirmed-section');
const nextQuestionUserIconContainer = document.getElementById('next-question-container').querySelector('.content-container .user-confirmed-section');

const selectUserContainer = document.getElementById('select-user-container');

const waitingForPlayerContainer = document.getElementById('waiting-for-player');
const waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
const waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

const playerHasPassedContainer = document.getElementById('player-has-passed');
const playerHasPassedTitle = playerHasPassedContainer.querySelector('.content-container h2');
const playerHasPassedText = playerHasPassedContainer.querySelector('.content-container p');

const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPrivate = document.querySelector('#private-view.card-container');

const selectUserButtonContainer = document.getElementById('select-user-container').querySelector('.selected-user-container .button-container');
const selectPunishmentContainer = document.getElementById('select-punishment-container')
const selectPunishmentButtonContainer = document.getElementById('select-punishment-container').querySelector('.selected-user-container .button-container');
const completePunishmentContainer = document.getElementById('complete-punishment-container');
const confirmPunishmentContainer = document.getElementById('confirm-punishment-container');
const confirmPunishmentButtonContainer = document.getElementById('select-punishment-container');
const pickHeadsOrTailsContainer = document.getElementById('heads-or-tails-pick-container');

const drinkWheelContainer = document.querySelector('.spin-the-wheel-container');

const buttonChoosePlayer = document.getElementById('button-choose-player');
const buttonNextQuestion = document.getElementById('button-next-question');
const confirmPlayerButton = selectUserContainer.querySelector('.select-button-container button');
const confirmPunishmentButton = document.getElementById('select-punishment-container').querySelector('.select-button-container button');

const completePunishmentButtonConfirm = document
  .querySelector('#complete-punishment-container .select-button-container #confirm');

const completePunishmentButtonPass = document.querySelector('#complete-punishment-container .select-button-container #pass');

const punishmentText = document
  .querySelector('#complete-punishment-container .content-container #punishment-text');

  buttonChoosePlayer.addEventListener('click', async () => {
    SendInstruction("WAITING_FOR_PLAYER:CHOOSE_PLAYER",true);
    // When player presses choose player in private card section 
  });
  
buttonNextQuestion.addEventListener('click', () => {
  gameContainerPublic.classList.remove('active');
  waitingForPlayerContainer.classList.add('active');
});

confirmPlayerButton.addEventListener('click', () => {
  selectUserContainer.classList.remove('active');
  selectPunishmentContainer.classList.add('active');
  SendInstruction("CHOOSING_PUNISHMENT:"+selectUserButtonContainer.getAttribute('selected-id'),false);
});

confirmPunishmentButton.addEventListener('click', () => {
  selectPunishmentContainer.classList.remove('active');
  if (confirmPunishmentButtonContainer.getAttribute('id') == 'paranoia-coin-flip') {
    SendInstruction("CHOSE_PUNISHMENT:PARANOIA_COIN_FLIP",false);
    pickHeadsOrTailsContainer.classList.add('active');
  }
  else if (confirmPunishmentButtonContainer.getAttribute('id') == 'paranoia-drink-wheel') {
    SendInstruction("CHOSE_PUNISHMENT:PARANOIA_DRINK_WHEEL",false);
    drinkWheelContainer.classList.add('active');
  }
  else if (confirmPunishmentButtonContainer.getAttribute('id') == 'take-a-shot') {
    SendInstruction("CHOSE_PUNISHMENT:PARANOIA_TAKE_A_SHOT",false);
    completePunishmentContainer.classList.add('active');
  }
});

completePunishmentButtonConfirm.addEventListener('click', () => {
  completePunishmentContainer.classList.remove('active');
  confirmPunishmentContainer.classList.add('active');
});

document.querySelector('#heads-or-tails-pick-container .select-button-container #heads').addEventListener('click', () => {
  pickHeadsOrTailsContainer.remove('active');
  coinFlipContainer.classList.add('active');
  isHeads = true;
});

document.querySelector('#heads-or-tails-pick-container .select-button-container #tails').addEventListener('click', () => {
  pickHeadsOrTailsContainer.remove('active');
  coinFlipContainer.classList.add('active');
  isHeads = false;
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
  setPageforUser();
});

function updateTextContainer(text, cardType, punishment) {

  const textContainerPrivate = document.querySelector('#private-view .text-container');
  const textContainerPublic = document.querySelector('#public-view .text-container');
  console.log(textContainerPrivate);
  // Update the innerHTML to include the question text and optionally the punishment
  textContainerPrivate.textContent = text;
  textContainerPublic.textContent = text;

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
initialisePage();

async function initialisePage() {
  const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
  const data = await response.json();
  console.log(data);
  if (data.length > 0) {
    if (data[0].isPlaying === true) {
      for (let i = 0; i < data[0].computerIds.length; i++) {
        if(data[0].computerIds[i] != deviceId){
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

      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          confirmPunishmentButtonContainer.setAttribute('id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
      console.log(data[0].computerIds.length);
      for (let i = 0; i < data[0].computerIds.length; i++) {
        confirmPunishmentUserIconContainer.appendChild(createUserIcon(data[0].computerIds));
        nextQuestionUserIconContainer.appendChild(createUserIcon(data[0].computerIds));
      }
      let removeUsersReady = data[0].usersReady;

      for (let key in removeUsersReady) {
        if (typeof removeUsersReady[key] === 'boolean') {
          removeUsersReady[key] = false;
        }
      }
      
      await updateOnlineParty({
        partyId: partyCode,
        usersReady: removeUsersReady,
        lastPinged: Date.now(),
      });
    }
    else {
    }
  } else {
  }
}

async function setPageforUser(){
  const response = await fetch(`/api/party-games?partyCode=${partyCode}`);
  const data = await response.json();

  if(data[0].computerIds[data[0].playerTurn] == deviceId){
    gameContainerPrivate.classList.add('active');
  }
  else{
    waitingForPlayerContainer.classList.add('active');
  }
}

completePunishmentButtonConfirm.addEventListener('click', () => {
  confirmPunishmentUserIconContainer.querySelector(`#${deviceId}`).classList.add('yes');
});

completePunishmentButtonPass.addEventListener('click', () => {
  confirmPunishmentUserIconContainer.querySelector(`#${deviceId}`).classList.add('no');
});


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

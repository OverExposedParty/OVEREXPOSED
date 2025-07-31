let isHeads = false;
let hostDeviceId = "";

const url = window.location.href;
const segments = url.split('/');
partyCode = segments.pop() || segments.pop(); // handle trailing slash

const waitingForPlayers = document.getElementById('waiting-for-players-container')
const waitingForPlayersIconContainer = waitingForPlayers.querySelector('.content-container .user-confirmed-section');

const nextQuestionContainer = document.getElementById('next-question-container')
const nextQuestionSectionContainer = nextQuestionContainer.querySelector('.content-container .user-confirmed-section');

const selectQuestionTypeContainer = document.getElementById('select-question-type-container');
const selectQuestionTypeContainerQuestionText = selectQuestionTypeContainer.querySelector('.content-container h1');
const selectQuestionTypeButtonContainer = selectQuestionTypeContainer.querySelector('.select-button-container');
const selectQuestionTypeButtonTruth = selectQuestionTypeButtonContainer.querySelector('#truth');
const selectQuestionTypeButtonDare = selectQuestionTypeButtonContainer.querySelector('#dare');

const answerQuestionContainer = document.getElementById('answer-question-container');
const answerQuestionContainerQuestionText = answerQuestionContainer.querySelector('.content-container h2');
const answerQuestionAnswer = answerQuestionContainer.querySelector('textarea');
const answerQuestionSubmitButton = answerQuestionContainer.querySelector("#submit");

const waitingForPlayerContainer = document.getElementById('waiting-for-player');
const waitingForPlayerTitle = waitingForPlayerContainer.querySelector('.content-container h2')
const waitingForPlayerText = waitingForPlayerContainer.querySelector('.content-container p')

const gameContainerPublic = document.querySelector('#public-view.card-container');
const gameContainerPublicTitle = gameContainerPublic.querySelector('.content .gamemode-text-svg');
const gameContainerPublicText = gameContainerPublic.querySelector('.content .main-image-container .text-container');
const gameContainerPublicCardType = gameContainerPublic.querySelector('.content .main-image-container .card-type-text');
const gameContainerPublicButtonContainer = gameContainerPublic.querySelector('.regular-button-container');
const gameContainerPublicWaitingText = gameContainerPublicButtonContainer.querySelector('h2');
const gameContainerPublicButtonAnswer = gameContainerPublicButtonContainer.querySelector('#answer');
const gameContainerPublicButtonPass = gameContainerPublicButtonContainer.querySelector("#pass");

const gameContainerAnswer = document.querySelector('#answer-view.card-container');
const gameContainerAnswerTitle = gameContainerAnswer.querySelector('.content .gamemode-text-svg');
const gameContainerAnswerText = gameContainerAnswer.querySelector('.text-container');
const gameContainerAnswerCardType = gameContainerAnswer.querySelector('.content .main-image-container .card-type-text');
const gameContainerAnswerButtonContainer = gameContainerAnswer.querySelector('.regular-button-container');
const gameContainerAnswerButtonNextQuestion = gameContainerAnswerButtonContainer.querySelector("#next-question");

const selectPunishmentContainer = document.getElementById('select-punishment-container')
const selectPunishmentButtonContainer = selectPunishmentContainer.querySelector('.selected-user-container .button-container');

const drinkingWheelContainer = document.querySelector('#spin-the-wheel-container');

const confirmPunishmentButton = document.getElementById('select-punishment-container').querySelector('.select-button-container button');

const completePunishmentContainer = document.getElementById('complete-punishment-container');
const completePunishmentButtonConfirm = completePunishmentContainer.querySelector('.select-button-container #pass');

const playerHasPassedContainer = document.getElementById('player-has-passed');
const playerHasPassedTitle = playerHasPassedContainer.querySelector('.content-container h2');
const playerHasPassedText = playerHasPassedContainer.querySelector('.content-container p');


gameContainers.push(
  waitingForPlayers,
  nextQuestionContainer,
  selectQuestionTypeContainer,
  waitingForPlayerContainer,
  gameContainerPublic,
  selectPunishmentContainer,
  completePunishmentContainer,
  drinkingWheelContainer,
  playerHasPassedContainer,
  answerQuestionContainer,
  gameContainerAnswer
);

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

const punishmentText = document.querySelector('#complete-punishment-container .content-container #punishment-text');

confirmPunishmentButton.addEventListener('click', async () => {
  if (selectPunishmentContainer.getAttribute('select-id')) {
    selectPunishmentContainer.classList.remove('active');
    if (selectPunishmentContainer.getAttribute('select-id') == 'truth-or-dare-drink-wheel') {
      await SendInstruction({
        instruction: "CHOSE_PUNISHMENT:TRUTH_OR_DARE_DRINK_WHEEL:" + deviceId
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

completePunishmentButtonConfirm.addEventListener('click', () => {
  ResetTruthOrDareQuestion(true);
});

selectQuestionTypeButtonTruth.addEventListener('click', async () => {
  IncrementCurrentCardIndex(0);
  await SendInstruction({
    instruction: "DISPLAY_PUBLIC_CARD:0"
  });
});

selectQuestionTypeButtonDare.addEventListener('click', async () => {
  IncrementCurrentCardIndex(1);
  await SendInstruction({
    instruction: "DISPLAY_PUBLIC_CARD:1"
  });
});

gameContainerPublicButtonPass.addEventListener('click', async () => {
  await SendInstruction({
    instruction: "CHOOSING_PUNISHMENT:" + deviceId
  });
});

gameContainerPublicButtonAnswer.addEventListener('click', () => {
  SendInstructionTruthOrDare("DISPLAY_CONFIRM_INPUT:", true);
});

answerQuestionSubmitButton.addEventListener('click', async () => {
  await SendInstruction({
    instruction: "DISPLAY_ANSWER_CARD:" + answerQuestionAnswer.value
  });
});

gameContainerAnswerButtonNextQuestion.addEventListener('click', async () => {
  ResetTruthOrDareQuestion();
});


document.addEventListener('DOMContentLoaded', async () => {
  const existingData = await getExistingPartyData(partyCode);
  if (!existingData || existingData.length === 0) {
    console.warn('No party data found.');
    return;
  }
  const currentPartyData = existingData[0];

  await loadJSONFiles(currentPartyData.selectedPacks, currentPartyData.shuffleSeed);
  initialisePage();
});

function updateTextContainer(text, cardType, type = null) {

  const textContainerPublic = document.querySelector('#public-view .text-container');

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
    textContainerPublic.style.color = matchedPack.packColour;
    document.querySelector('#public-view .card-type-text').style.color = matchedPack.packColour;
  } else {
    console.log("Pack not found");
  }

  document.querySelector('#public-view .card-type-text').textContent = cardType;
}

async function initialisePage() {
  const response = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await response.json();
  if (data.length > 0) {
    joinParty(partyCode);
    hostDeviceId = data[0].players[0].computerId;
    console.log("hostDeviceId: " + hostDeviceId);
    if (data[0].isPlaying === true) {
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

      const selectPunishmentButtons = document.getElementById('select-punishment-container').querySelectorAll('.selected-user-container .button-container button');
      selectPunishmentButtons.forEach(button => {
        button.addEventListener('click', () => {
          selectPunishmentButtons.forEach(btn => btn.classList.remove('active'));
          selectPunishmentContainer.setAttribute('select-id', button.getAttribute('id'))
          button.classList.add('active');
        });
      });
      for (let i = 0; i < data[0].players.length; i++) {
        waitingForPlayersIconContainer.appendChild(createUserIcon(data[0].players[i].computerId));
      }
    }
  }
  if (deviceId == hostDeviceId) {
    let voteString = "";
    for (let i = 0; i < data[0].players.length; i++) {
      voteString += "0";
      if (i < data[0].players.length - 1) {
        voteString += ";";
      }
    }
    await SendInstruction({
      instruction: "DISPLAY_SELECT_QUESTION_TYPE:0",
      updateUsersReady: false,
      updateUsersConfirmation: false,
      fetchInstruction: true
    });
  }
}

async function FetchInstructions() {
  const res = await fetch(`/api/${sessionPartyType}?partyCode=${partyCode}`);
  const data = await res.json();
  if (!data || data.length === 0) {
    PartyDisbanded();
    return;
  }
  if (data[0].userInstructions.includes("DISPLAY_SELECT_QUESTION_TYPE")) {
    DisplaySelectQuestionType();
  }
  else if (data[0].userInstructions.includes("DISPLAY_PUBLIC_CARD")) {
    DisplayPublicCard(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_ANSWER_CARD")) {
    DisplayAnswerCard(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("DISPLAY_CONFIRM_INPUT")) {
    DisplayConfirmInput(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOSE_PUNISHMENT")) {
    ChosePunishment(data[0].userInstructions);
  }
  else if (data[0].userInstructions.includes("CHOOSING_PUNISHMENT")) {
    ChoosingPunishment(data[0].userInstructions);
  }
}